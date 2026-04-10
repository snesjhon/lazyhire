import { join } from 'path';
import puppeteer from 'puppeteer';
import { db } from '../../db.js';
import { loadProfile } from '../../profile.js';
import { evaluateJob } from '../ai/evaluation.js';
import { generateCV } from '../ai/generate.js';
import { renderPDF } from './pdf.js';
import type { Job } from '../../types.js';

type JobSignals = {
  pageTitle: string;
  metaTitle: string;
  ogTitle: string;
  metaDescription: string;
  ogDescription: string;
  h1: string;
  companyText: string;
  jsonLdTitle: string;
  jsonLdCompany: string;
  jsonLdDescription: string;
  text: string;
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'job';
}

function titleCaseWords(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

const GREENHOUSE_BOARD_COMPANY_HINTS: Record<string, string> = {
  nationalpublicradioinc: 'National Public Radio',
};

function hostnameLabel(url: string): string {
  try {
    const { hostname } = new URL(url);
    return (
      hostname
        .replace(/^www\./, '')
        .split('.')
        .slice(0, -1)
        .join(' ')
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase()) || hostname
    );
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

function normalizeMarkdown(value: string): string {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function sectionBodyFromHeading(
  lines: string[],
  headingPattern: RegExp,
): string | null {
  const start = lines.findIndex((line) =>
    headingPattern.test(line.replace(/^#+\s*/, '').trim()),
  );
  if (start === -1) return null;

  const body: string[] = [];
  for (const line of lines.slice(start + 1)) {
    const trimmed = line.trim();
    if (/^#{1,4}\s+\S/.test(trimmed) && body.length > 0) break;
    if (/^[A-Z][A-Za-z /&-]{2,60}:$/.test(trimmed) && body.length > 0) break;
    if (trimmed) body.push(trimmed);
    if (body.length >= 10) break;
  }

  return body.length > 0 ? body.join('\n') : null;
}

function firstMatchingLines(
  lines: string[],
  patterns: RegExp[],
  limit: number,
): string[] {
  const matches: string[] = [];
  for (const line of lines) {
    const normalized = line.replace(/^[-*]\s+/, '').trim();
    if (
      normalized.length >= 18 &&
      normalized.length <= 180 &&
      patterns.some((pattern) => pattern.test(normalized)) &&
      !matches.includes(normalized)
    ) {
      matches.push(normalized);
    }
    if (matches.length >= limit) break;
  }
  return matches;
}

function excerptLines(value: string, limit: number): string[] {
  return value
    .split(/\n+/)
    .map((line) =>
      cleanText(line.replace(/^#+\s*/, '').replace(/^[-*]\s+/, '')),
    )
    .filter((line) => line.length >= 24 && line.length <= 180)
    .slice(0, limit);
}

function looksLikeShellText(value: string): boolean {
  const normalized = cleanText(value).toLowerCase();
  return (
    !normalized ||
    normalized.length < 120 ||
    normalized.includes('enable javascript to run this app') ||
    normalized === 'apply for this job'
  );
}

export function resolveJobDescriptionText(signals: JobSignals): string {
  const candidates = [
    signals.text,
    signals.jsonLdDescription,
    signals.metaDescription,
    signals.ogDescription,
  ]
    .map((value) => normalizeMarkdown(value))
    .filter(Boolean);

  const primary = candidates.find((value) => !looksLikeShellText(value));
  if (primary) return primary;

  return candidates.sort((a, b) => b.length - a.length)[0] ?? '';
}

export function summarizeJobDescription(jd: string): string {
  const markdown = normalizeMarkdown(jd);
  if (!markdown) return '';

  const lines = markdown
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const overview =
    sectionBodyFromHeading(
      lines,
      /^(about|overview|the role|role summary|job summary|what you'll do)$/i,
    ) ?? excerptLines(markdown, 2).join('\n');
  const responsibilities = sectionBodyFromHeading(
    lines,
    /^(responsibilities|what you'll do|you will|in this role|the work)$/i,
  );
  const requirements = sectionBodyFromHeading(
    lines,
    /^(requirements|qualifications|what we're looking for|you have|about you|skills)$/i,
  );
  const benefits = sectionBodyFromHeading(
    lines,
    /^(benefits|compensation|salary|perks|what we offer)$/i,
  );

  const seniority = firstMatchingLines(
    lines,
    [/\b(senior|staff|principal|lead|manager|director|architect)\b/i],
    2,
  );
  const stack = firstMatchingLines(
    lines,
    [
      /\b(typescript|javascript|react|node|python|ruby|go|rust|java|kubernetes|aws|gcp|azure|postgres|sql|graphql|ai|ml|llm)\b/i,
    ],
    4,
  );
  const workModel = firstMatchingLines(
    lines,
    [/\b(remote|hybrid|onsite|office|timezone|distributed)\b/i],
    3,
  );

  const summary: string[] = ['## Job Description Summary'];
  if (overview) summary.push('', '**Overview**', overview);
  if (responsibilities)
    summary.push('', '**Responsibilities**', responsibilities);
  if (requirements) summary.push('', '**Requirements**', requirements);
  if (stack.length > 0)
    summary.push(
      '',
      '**Likely Stack / Domain**',
      ...stack.map((line) => `- ${line}`),
    );
  if (seniority.length > 0)
    summary.push(
      '',
      '**Seniority Signals**',
      ...seniority.map((line) => `- ${line}`),
    );
  if (workModel.length > 0)
    summary.push('', '**Work Model**', ...workModel.map((line) => `- ${line}`));
  if (benefits) summary.push('', '**Compensation / Benefits**', benefits);

  return normalizeMarkdown(summary.join('\n')).slice(0, 5000);
}

function normalizeSegment(value: string): string {
  return cleanText(value)
    .replace(
      /\b(job application for|apply for|job posting|careers?|career site|greenhouse|lever|ashby)\b/gi,
      '',
    )
    .replace(/\s+/g, ' ')
    .trim();
}

function companyHintFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes('greenhouse.io')) return null;

    const companyParam = parsed.searchParams.get('for');
    if (companyParam) {
      const normalized = cleanText(companyParam).replace(/[-_]+/g, ' ');
      return normalized ? titleCaseWords(normalized) : null;
    }

    const boardSlug = parsed.pathname
      .split('/')
      .map((part) => decodeURIComponent(part).trim())
      .find(
        (part) =>
          part && part !== 'embed' && part !== 'job_app' && part !== 'jobs',
      );
    if (!boardSlug) return null;

    const knownHint = GREENHOUSE_BOARD_COMPANY_HINTS[boardSlug.toLowerCase()];
    if (knownHint) return knownHint;

    const normalizedBoardSlug = cleanText(boardSlug).replace(/[-_]+/g, ' ');
    const normalized = normalizedBoardSlug.includes(' ')
      ? normalizedBoardSlug.replace(/\b(?:inc|llc|ltd|corp|corporation)\b$/i, '')
      : normalizedBoardSlug.replace(/(?:inc|llc|ltd|corp|corporation)$/i, '');
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
  return /\b(engineer|developer|manager|designer|architect|analyst|scientist|lead|director|head|specialist|recruiter|consultant|intern|principal|staff|senior|sr\.?|junior|jr\.?|frontend|backend|full[- ]stack|platform|product|software|data|devops|sre|security|mobile|ios|android)\b/i.test(
    value,
  );
}

function isGenericSegment(value: string): boolean {
  return /^(careers?|jobs?|job board|open positions|job application|apply now|apply)$/i.test(
    cleanText(value),
  );
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
    .filter(
      (candidate) =>
        candidate && !looksLikeRole(candidate) && !isGenericSegment(candidate),
    );

  return normalized[0] ?? null;
}

export function inferRoleAndCompanyFromSignals(
  signals: JobSignals,
  url: string,
): { role: string; company: string } {
  const parsedTitleParts = [
    signals.pageTitle,
    signals.metaTitle,
    signals.ogTitle,
  ]
    .flatMap(splitTitleParts)
    .map(normalizeSegment)
    .filter(Boolean);
  const companyHint = companyHintFromUrl(url);

  const role =
    pickRole([
      signals.jsonLdTitle,
      signals.h1,
      ...parsedTitleParts,
      signals.ogTitle,
      signals.metaTitle,
      signals.pageTitle,
    ]) ?? 'Career Page';
  const company =
    pickCompany([
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

export function inferFromJdText(jd: string): { company: string; role: string } {
  const text = jd.trim();
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  let company = '';
  let role = '';

  // Look for explicit field labels in the first 40 lines
  for (const line of lines.slice(0, 40)) {
    if (!company) {
      const m = line.match(/^(?:company|employer|organization)[\s:]+(.+)$/i);
      if (m) company = m[1]!.trim();
    }
    if (!role) {
      const m = line.match(/^(?:job title|position|role|title)[\s:]+(.+)$/i);
      if (m) role = m[1]!.trim();
    }
    if (company && role) break;
  }

  // "About CompanyName" pattern
  if (!company) {
    const m = text.match(
      /\bAbout\s+([A-Z][A-Za-z0-9&.,'\-\s]{1,50}?)(?:\n|\.|,|:)/,
    );
    if (m) company = m[1]!.trim();
  }

  // "CompanyName is hiring / is looking for / is seeking"
  if (!company) {
    const m = text.match(
      /\b([A-Z][A-Za-z0-9&.\s]{1,40}?)\s+is\s+(?:hiring|looking for|seeking)/,
    );
    if (m) company = m[1]!.trim();
  }

  // Role from first line that looks like a job title (headers stripped)
  if (!role) {
    for (const line of lines.slice(0, 15)) {
      const clean = line.replace(/^#+\s*/, '').trim();
      if (looksLikeRole(clean) && clean.length < 100) {
        role = clean;
        break;
      }
    }
  }

  return {
    company: company || 'Unknown Company',
    role: role || 'Pasted Job Description',
  };
}

export async function hydrateJobFromUrl(
  url: string,
): Promise<Pick<Job, 'company' | 'role' | 'url' | 'jd' | 'jdSummary'>> {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // Prefer a static snapshot so broken third-party page scripts do not break intake.
    await page.setJavaScriptEnabled(false);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForSelector('body', { timeout: 8000 }).catch(() => null);
    await page
      .waitForNetworkIdle({ idleTime: 500, timeout: 1500 })
      .catch(() => null);

    const signals = (await page.evaluate(`(() => {
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
                  description: htmlToMarkdown({
                    childNodes: Array.from((() => {
                      const wrapper = document.createElement('div');
                      wrapper.innerHTML = String(entry.description ?? '');
                      return wrapper.childNodes;
                    })()),
                  }).trim(),
                };
              }
            }
          } catch {
            // ignore invalid JSON-LD blobs
          }
        }

        return { title: '', company: '', description: '' };
      };

      const htmlToMarkdown = (node) => {
        let out = '';
        for (const child of node.childNodes) {
          if (child.nodeType === 3) {
            out += child.textContent;
          } else if (child.nodeType === 1) {
            const tag = child.tagName.toLowerCase();
            if (['script','style','nav','footer','noscript','aside'].includes(tag)) continue;
            const inner = htmlToMarkdown(child);
            if (tag === 'h1') out += '\\n# ' + inner.trim() + '\\n';
            else if (tag === 'h2') out += '\\n## ' + inner.trim() + '\\n';
            else if (tag === 'h3') out += '\\n### ' + inner.trim() + '\\n';
            else if (['h4','h5','h6'].includes(tag)) out += '\\n#### ' + inner.trim() + '\\n';
            else if (tag === 'li') out += '\\n- ' + inner.trim();
            else if (['p','div','section','article','main','blockquote'].includes(tag)) out += '\\n' + inner + '\\n';
            else if (tag === 'br') out += '\\n';
            else if (['strong','b'].includes(tag)) out += '**' + inner.trim() + '**';
            else if (['em','i'].includes(tag)) out += '*' + inner.trim() + '*';
            else out += inner;
          }
        }
        return out;
      };

      const jsonLd = getJsonLd();
      const markdown = htmlToMarkdown(document.body ?? document.documentElement)
        .replace(/\\n{3,}/g, '\\n\\n')
        .trim();

      return {
        pageTitle: document.title.trim(),
        metaTitle: readMeta('meta[name="title"]'),
        ogTitle: readMeta('meta[property="og:title"]'),
        metaDescription: readMeta('meta[name="description"]'),
        ogDescription: readMeta('meta[property="og:description"]'),
        h1: readText('h1'),
        companyText: readText('[data-company], [data-testid*="company"], .company, .company-name, [class*="company"]'),
        jsonLdTitle: jsonLd.title,
        jsonLdCompany: jsonLd.company,
        jsonLdDescription: jsonLd.description,
        text: markdown,
      };
    })()`)) as JobSignals & { text: string };
    const { role, company } = inferRoleAndCompanyFromSignals(
      signals,
      page.url(),
    );
    const jd = resolveJobDescriptionText(signals);

    return {
      company,
      role,
      url: page.url(),
      jd,
      jdSummary: summarizeJobDescription(jd),
    };
  } finally {
    await page.close().catch(() => null);
    await browser.close().catch(() => null);
  }
}

export function createPendingJob(
  partial: Pick<Job, 'company' | 'role' | 'url' | 'jd'> &
    Partial<Pick<Job, 'jdSummary'>>,
): Job {
  return {
    id: db.nextId(),
    added: today(),
    company: partial.company,
    role: partial.role,
    url: partial.url,
    jd: partial.jd,
    jdSummary: partial.jdSummary ?? summarizeJobDescription(partial.jd),
    status: 'Pending',
    score: null,
    category: null,
    focus: null,
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
    category: result.category,
    focus: result.focus,
    reportPath: null,
  };
  db.updateJob(job.id, {
    status: updated.status,
    score: updated.score,
    category: updated.category,
    focus: updated.focus,
    reportPath: null,
  });
  return updated;
}

export async function generateAndPersistPdf(
  job: Job,
  tailoringNotes = '',
): Promise<Job> {
  const profile = loadProfile();
  const cv = await generateCV(
    { jd: job.jd || `URL: ${job.url}`, category: job.category, focus: job.focus },
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
