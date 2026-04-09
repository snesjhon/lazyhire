import { join } from 'path';
import puppeteer from 'puppeteer';
import { db } from './db.js';
import { loadProfile } from './profile.js';
import { evaluateJob } from './claude/evaluation.js';
import { generateCV } from './claude/generate.js';
import { renderPDF } from './pdf.js';
import type { Job } from './types.js';

type JobSignals = {
  pageTitle: string;
  metaTitle: string;
  ogTitle: string;
  h1: string;
  companyText: string;
  jsonLdTitle: string;
  jsonLdCompany: string;
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function slugify(value: string): string {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || 'job';
}

function titleCaseWords(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function hostnameLabel(url: string): string {
  try {
    const { hostname } = new URL(url);
    return hostname
      .replace(/^www\./, '')
      .split('.')
      .slice(0, -1)
      .join(' ')
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase()) || hostname;
  } catch {
    return 'Unknown Company';
  }
}

function cleanText(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/^[\s|:;,\-–—]+|[\s|:;,\-–—]+$/g, '')
    .trim();
}

function normalizeSegment(value: string): string {
  return cleanText(value)
    .replace(/\b(job application for|apply for|job posting|careers?|career site|greenhouse|lever|ashby)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function companyHintFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes('greenhouse.io')) return null;

    const companyParam = parsed.searchParams.get('for');
    if (!companyParam) return null;

    const normalized = cleanText(companyParam).replace(/[-_]+/g, ' ');
    return normalized ? titleCaseWords(normalized) : null;
  } catch {
    return null;
  }
}

function splitTitleParts(title: string): string[] {
  return cleanText(title)
    .split(/\s*(?:\||—|–|-)\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function looksLikeRole(value: string): boolean {
  return /\b(engineer|developer|manager|designer|architect|analyst|scientist|lead|director|head|specialist|recruiter|consultant|intern|principal|staff|senior|sr\.?|junior|jr\.?|frontend|backend|full[- ]stack|platform|product|software|data|devops|sre|security|mobile|ios|android)\b/i
    .test(value);
}

function isGenericSegment(value: string): boolean {
  return /^(careers?|jobs?|job board|open positions|job application|apply now|apply)$/i.test(cleanText(value));
}

function pickRole(candidates: string[]): string | null {
  const normalized = candidates
    .map(normalizeSegment)
    .filter((candidate) => candidate && !isGenericSegment(candidate));

  return normalized.find(looksLikeRole) ?? normalized[0] ?? null;
}

function pickCompany(candidates: string[]): string | null {
  const normalized = candidates
    .map(normalizeSegment)
    .filter((candidate) => candidate && !looksLikeRole(candidate) && !isGenericSegment(candidate));

  return normalized[0] ?? null;
}

export function inferRoleAndCompanyFromSignals(signals: JobSignals, url: string): { role: string; company: string } {
  const parsedTitleParts = [signals.pageTitle, signals.metaTitle, signals.ogTitle]
    .flatMap(splitTitleParts)
    .map(normalizeSegment)
    .filter(Boolean);
  const companyHint = companyHintFromUrl(url);

  const role = pickRole([
    signals.jsonLdTitle,
    signals.h1,
    ...parsedTitleParts,
    signals.ogTitle,
    signals.metaTitle,
    signals.pageTitle,
  ]) ?? 'Career Page';
  const company = pickCompany([
    signals.jsonLdCompany,
    companyHint ?? '',
    signals.companyText,
    ...parsedTitleParts,
    signals.ogTitle,
    signals.metaTitle,
    signals.pageTitle,
  ]) ?? hostnameLabel(url);

  return { role, company };
}

function inferRoleAndCompany(title: string, url: string): { role: string; company: string } {
  return inferRoleAndCompanyFromSignals({
    pageTitle: title,
    metaTitle: '',
    ogTitle: '',
    h1: '',
    companyText: '',
    jsonLdTitle: '',
    jsonLdCompany: '',
  }, url);
}

export async function hydrateJobFromUrl(url: string): Promise<Pick<Job, 'company' | 'role' | 'url' | 'jd'>> {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // Prefer a static snapshot so broken third-party page scripts do not break intake.
    await page.setJavaScriptEnabled(false);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForSelector('body', { timeout: 8000 }).catch(() => null);
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 1500 }).catch(() => null);

    const signals = await page.evaluate(`(() => {
      const readMeta = (selector) =>
        (document.querySelector(selector)?.getAttribute('content') ?? '').trim();

      const readText = (selector) =>
        (document.querySelector(selector)?.textContent ?? '').trim();

      const getJsonLd = () => {
        const nodes = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
        for (const node of nodes) {
          const raw = node.textContent?.trim();
          if (!raw) continue;
          try {
            const parsed = JSON.parse(raw);
            const items = Array.isArray(parsed) ? parsed : [parsed];
            for (const item of items) {
              const entries = item?.['@graph'] && Array.isArray(item['@graph']) ? item['@graph'] : [item];
              for (const entry of entries) {
                if (entry?.['@type'] !== 'JobPosting') continue;
                const company = typeof entry.hiringOrganization === 'string'
                  ? entry.hiringOrganization
                  : (entry.hiringOrganization?.name ?? '');
                return {
                  title: String(entry.title ?? '').trim(),
                  company: String(company ?? '').trim(),
                };
              }
            }
          } catch {
            // ignore invalid JSON-LD blobs
          }
        }

        return { title: '', company: '' };
      };

      const jsonLd = getJsonLd();
      return {
        pageTitle: document.title.trim(),
        metaTitle: readMeta('meta[name="title"]'),
        ogTitle: readMeta('meta[property="og:title"]'),
        h1: readText('h1'),
        companyText: readText('[data-company], [data-testid*="company"], .company, .company-name, [class*="company"]'),
        jsonLdTitle: jsonLd.title,
        jsonLdCompany: jsonLd.company,
        text: document.body?.innerText ?? '',
      };
    })()`) as JobSignals & { text: string };
    const { role, company } = inferRoleAndCompanyFromSignals(signals, page.url());

    return {
      company,
      role,
      url: page.url(),
      jd: signals.text.trim(),
    };
  } finally {
    await page.close().catch(() => null);
    await browser.close().catch(() => null);
  }
}

export function createPendingJob(partial: Pick<Job, 'company' | 'role' | 'url' | 'jd'>): Job {
  return {
    id: db.nextId(),
    added: today(),
    company: partial.company,
    role: partial.role,
    url: partial.url,
    jd: partial.jd,
    status: 'Pending',
    score: null,
    archetype: null,
    reportPath: null,
    pdfPath: null,
    theme: null,
    notes: '',
  };
}

export function saveJob(job: Job): Job {
  db.addJob(job);
  return job;
}

export async function evaluateAndPersistJob(job: Job): Promise<Job> {
  const profile = loadProfile();
  const jd = job.jd || `URL: ${job.url}`;
  const result = await evaluateJob(jd, profile);

  const updated: Job = {
    ...job,
    status: 'Evaluated',
    score: result.score,
    archetype: result.archetype,
    reportPath: null,
  };
  db.updateJob(job.id, {
    status: updated.status,
    score: updated.score,
    archetype: updated.archetype,
    reportPath: null,
  });
  return updated;
}

export async function generateAndPersistPdf(job: Job, tailoringNotes = ''): Promise<Job> {
  const profile = loadProfile();
  const cv = await generateCV(
    { jd: job.jd || `URL: ${job.url}`, archetype: job.archetype },
    profile,
    tailoringNotes,
  );

  const theme = 'resume' as const;
  const filename = `${job.id}-${slugify(job.company)}-${theme}.pdf`;
  const pdfPath = join(process.cwd(), 'output', filename);
  await renderPDF(cv, pdfPath);

  const updated: Job = { ...job, pdfPath, theme };
  db.updateJob(job.id, { pdfPath, theme });
  return updated;
}
