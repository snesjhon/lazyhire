import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import puppeteer from 'puppeteer-core';
import { findChrome } from './chrome.js';
import { DATA_DIR } from './paths.js';
import type { GeneratedCV, GeneratedCoverLetter, Job } from '@shared/types';

// ── CV text size types (shared with ai.ts for PDF generation) ─────

export interface CvBulletWordRange {
  min: number;
  max: number;
}

export interface CvTextSizeScale {
  bodyPt: number;
  headingNamePt: number;
  headingSectionPt: number;
  headingRolePt: number;
}

export const DEFAULT_CV_BULLET_WORD_RANGE: CvBulletWordRange = { min: 25, max: 44 };

export const DEFAULT_CV_TEXT_SIZE_SCALE: CvTextSizeScale = {
  bodyPt: 10,
  headingNamePt: 20,
  headingSectionPt: 11,
  headingRolePt: 10.5,
};

export const DEFAULT_COVER_LETTER_TOTAL_WORD_COUNT = 280;

// ── HTML templates (inlined via ?raw) ────────────────────────────

import resumeTemplate from '../templates/resume.html?raw';
import coverLetterTemplate from '../templates/cover-letter.html?raw';

// ── PDF rendering ─────────────────────────────────────────────────

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderInlineMarkup(value: string): string {
  return escapeHtml(value).replace(/\*\*(.+?)\*\*/g, '<span class="emphasis">$1</span>');
}

function formatPeriod(period: { start: string; end: string }): string {
  const formatMonth = (ym: string): string => {
    const [year, month] = ym.split('-');
    const monthNumber = Number.parseInt(month ?? '', 10);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    if (!year || Number.isNaN(monthNumber) || monthNumber < 1 || monthNumber > 12) return ym;
    return `${months[monthNumber - 1]} ${year}`;
  };
  return `${formatMonth(period.start)} – ${period.end === 'present' ? 'Present' : formatMonth(period.end)}`;
}

export function injectCVWithTextSize(
  template: string,
  cv: GeneratedCV,
  textSizeScale: CvTextSizeScale,
): string {
  const skillsHtml = renderInlineMarkup(cv.skills.join(', '));
  const rolesHtml = cv.roles
    .map(
      (role) => `
    <div class="role">
      <h3>${renderInlineMarkup(role.company)}</h3>
      <p class="role-meta"><em>${renderInlineMarkup(role.role)} | ${formatPeriod(role.period)}</em></p>
      <ul>${role.bullets.map((bullet) => `<li>${renderInlineMarkup(bullet)}</li>`).join('')}</ul>
    </div>
  `,
    )
    .join('');
  const educationHtml = cv.education
    .map(
      (entry) => `
    <div class="edu">
      <p><strong>${renderInlineMarkup(entry.institution)}</strong>${entry.degree ? ` | ${renderInlineMarkup(entry.degree)}` : ''}</p>
    </div>
  `,
    )
    .join('');

  return template
    .replace(/\{\{BASE_FONT_SIZE\}\}/g, `${textSizeScale.bodyPt}pt`)
    .replace(/\{\{NAME_FONT_SIZE\}\}/g, `${textSizeScale.headingNamePt}pt`)
    .replace(/\{\{SECTION_FONT_SIZE\}\}/g, `${textSizeScale.headingSectionPt}pt`)
    .replace(/\{\{ROLE_FONT_SIZE\}\}/g, `${textSizeScale.headingRolePt}pt`)
    .replace(/\{\{NAME\}\}/g, renderInlineMarkup(cv.name))
    .replace(/\{\{TITLE\}\}/g, renderInlineMarkup(cv.title))
    .replace(/\{\{EMAIL\}\}/g, renderInlineMarkup(cv.contact.email))
    .replace(/\{\{LOCATION\}\}/g, renderInlineMarkup(cv.contact.location))
    .replace(/\{\{SITE\}\}/g, renderInlineMarkup(cv.contact.site))
    .replace(/\{\{SKILLS\}\}/g, skillsHtml)
    .replace(/\{\{ROLES\}\}/g, rolesHtml)
    .replace(/\{\{EDUCATION\}\}/g, educationHtml);
}

export function injectCoverLetter(template: string, coverLetter: GeneratedCoverLetter): string {
  const paragraphsHtml = coverLetter.paragraphs
    .map((paragraph) => `<p>${renderInlineMarkup(paragraph)}</p>`)
    .join('\n      ');

  return template
    .replace(/\{\{NAME\}\}/g, renderInlineMarkup(coverLetter.name))
    .replace(/\{\{EMAIL\}\}/g, renderInlineMarkup(coverLetter.contact.email))
    .replace(/\{\{LOCATION\}\}/g, renderInlineMarkup(coverLetter.contact.location))
    .replace(/\{\{SITE\}\}/g, renderInlineMarkup(coverLetter.contact.site))
    .replace(/\{\{COMPANY\}\}/g, renderInlineMarkup(coverLetter.company))
    .replace(/\{\{ROLE\}\}/g, renderInlineMarkup(coverLetter.role))
    .replace(/\{\{PARAGRAPHS\}\}/g, paragraphsHtml);
}

async function renderHtmlToPdf(html: string, outputPath: string): Promise<void> {
  mkdirSync(dirname(outputPath), { recursive: true });
  const tmpHtml = join(DATA_DIR, 'output', `_tmp-${Date.now()}.html`);
  mkdirSync(dirname(tmpHtml), { recursive: true });
  writeFileSync(tmpHtml, html, 'utf8');

  const browser = await puppeteer.launch({ headless: true, executablePath: findChrome() });
  const page = await browser.newPage();
  await page.setViewport({ width: 816, height: 1056, deviceScaleFactor: 1 });
  await page.goto(`file://${tmpHtml}`, { waitUntil: 'networkidle0' });
  await page.pdf({
    path: outputPath,
    format: 'Letter',
    margin: { top: '0.3in', bottom: '0.3in', left: '0.45in', right: '0.45in' },
    scale: 1,
    printBackground: false,
  });
  await browser.close();

  import('fs').then(({ unlinkSync }) => {
    try { unlinkSync(tmpHtml); } catch { /* ignore */ }
  });
}

export async function renderPDF(
  cv: GeneratedCV,
  outputPath: string,
  textSizeScale: CvTextSizeScale = DEFAULT_CV_TEXT_SIZE_SCALE,
): Promise<void> {
  await renderHtmlToPdf(injectCVWithTextSize(resumeTemplate, cv, textSizeScale), outputPath);
}

export async function renderCoverLetterPDF(
  coverLetter: GeneratedCoverLetter,
  outputPath: string,
): Promise<void> {
  await renderHtmlToPdf(injectCoverLetter(coverLetterTemplate, coverLetter), outputPath);
}

// ── Job hydration ─────────────────────────────────────────────────

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
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || 'job';
}

export function buildResumeFilename(candidateName: string, company: string): string {
  const nameParts = candidateName.trim().split(/\s+/).filter(Boolean);
  const firstName = slugify(nameParts[0] ?? 'candidate');
  const lastName = slugify(nameParts.at(-1) ?? nameParts[0] ?? 'candidate');
  const companySlug = slugify(company);
  return `${firstName}-${lastName}-${companySlug}-Resume.pdf`;
}

export function buildCoverLetterFilename(candidateName: string, company: string): string {
  const nameParts = candidateName.trim().split(/\s+/).filter(Boolean);
  const firstName = slugify(nameParts[0] ?? 'candidate');
  const lastName = slugify(nameParts.at(-1) ?? nameParts[0] ?? 'candidate');
  const companySlug = slugify(company);
  return `${firstName}-${lastName}-${companySlug}-cover-letter.pdf`;
}

function titleCaseWords(value: string): string {
  return value.split(/\s+/).filter(Boolean)
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
      hostname.replace(/^www\./, '').split('.').slice(0, -1).join(' ')
        .replace(/[-_]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()) || hostname
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

function normalizeSummarySource(value: string): string {
  const sectionLabels = [
    'Duties & Responsibilities', 'Develops and Implements Software Applications',
    'Designs Software Applications', 'Supports Software Applications',
    'Minimum Qualifications', 'Additional Information for US based jobs',
    'Additional Information', 'Technical Skills', 'Responsibilities', 'Qualifications',
    'Requirements', 'Benefits', 'Compensation', 'Our Mission', 'Our Values', 'Company Description',
  ];

  let normalized = normalizeMarkdown(value);
  for (const label of sectionLabels) {
    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    normalized = normalized.replace(
      new RegExp(`\\s+(${escapedLabel})(?=[:\\s])`, 'gi'),
      '\n\n## $1\n',
    );
  }

  return normalized.replace(/:\s+/g, ':\n').replace(/\n{3,}/g, '\n\n').trim();
}

function sectionBodyFromHeading(lines: string[], headingPattern: RegExp): string | null {
  const start = lines.findIndex((line) => headingPattern.test(line.replace(/^#+\s*/, '').trim()));
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

function looksLikeSummaryNoise(line: string): boolean {
  const normalized = cleanText(line).toLowerCase();
  const isCompensationLine =
    /\$\d/.test(normalized) || /\b(compensation|salary|equity|bonus)\b/.test(normalized);
  return (
    !normalized || normalized.length < 20 || normalized.length > 220 ||
    normalized === 'new' || normalized === 'apply' || normalized === 'back to jobs' ||
    normalized === 'create alert' || normalized === 'submit application' ||
    normalized === 'select...' || normalized === 'locate me' ||
    normalized === 'attachattach' || normalized === 'dropbox' ||
    normalized === 'google drive' || normalized === 'enter manuallyenter manually' ||
    normalized === 'autofill with mygreenhouse' ||
    normalized === 'indicates a required field' ||
    normalized.startsWith('accepted file types') ||
    normalized.startsWith('if you are an ai agent') ||
    normalized.includes('#li-remote') || normalized.includes('#li-sw') ||
    (looksLikeRole(normalized) && normalized.length < 80 && !/[.!?:]/.test(normalized)) ||
    (/^[#*]+/.test(normalized) && !isCompensationLine) ||
    /^\w+\*+$/.test(normalized) ||
    (/\b(remote)\b/.test(normalized) && normalized.length < 40) ||
    /\b(city|country|phone|email|resume\/cv|cover letter|linkedin profile|first name|last name)\b/.test(normalized)
  );
}

function firstMatchingLines(lines: string[], patterns: RegExp[], limit: number): string[] {
  const matches: string[] = [];
  for (const line of lines) {
    const normalized = line.replace(/^[-*]\s+/, '').trim();
    if (
      normalized.length >= 18 && normalized.length <= 180 &&
      !looksLikeSummaryNoise(normalized) &&
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
  const excerpts: string[] = [];

  for (const rawLine of value.split(/\n+/)) {
    const cleaned = cleanText(rawLine.replace(/^#+\s*/, '').replace(/^[-*]\s+/, ''));
    if (!cleaned || looksLikeSummaryNoise(cleaned)) continue;

    const candidates =
      cleaned.length <= 180
        ? [cleaned]
        : cleaned.split(/(?<=[.!?])\s+/).map((sentence) => cleanText(sentence)).filter(Boolean);

    for (const candidate of candidates) {
      if (candidate.length >= 24 && candidate.length <= 220 && !looksLikeSummaryNoise(candidate)) {
        excerpts.push(candidate);
      }
      if (excerpts.length >= limit) return excerpts;
    }
  }

  return excerpts;
}

function firstSentence(value: string): string {
  const cleaned = cleanText(value);
  if (!cleaned) return '';
  const match = cleaned.match(/(.{24,220}?[.!?])(?:\s|$)/);
  return cleanText(match?.[1] ?? cleaned);
}

function joinSummaryBits(parts: Array<string | null | undefined>): string {
  return parts.map((part) => cleanText(part ?? '')).filter(Boolean).join(' ');
}

function looksLikeShellText(value: string): boolean {
  const normalized = cleanText(value).toLowerCase();
  return (
    !normalized || normalized.length < 120 ||
    normalized.includes('just a moment') ||
    normalized.includes('attention required') ||
    normalized.includes('verify you are human') ||
    normalized.includes('checking your browser') ||
    normalized.includes('cf-browser-verification') ||
    normalized.includes('cloudflare') ||
    normalized.includes('enable javascript to run this app') ||
    normalized === 'apply for this job'
  );
}

export function resolveJobDescriptionText(signals: JobSignals): string {
  const candidates = [signals.text, signals.jsonLdDescription, signals.metaDescription, signals.ogDescription]
    .map((value) => normalizeMarkdown(value))
    .filter(Boolean);

  const primary = candidates.find((value) => !looksLikeShellText(value));
  if (primary) return primary;

  return candidates.sort((a, b) => b.length - a.length)[0] ?? '';
}

export function summarizeJobDescription(jd: string): string {
  const markdown = normalizeSummarySource(jd);
  if (!markdown) return '';

  const lines = markdown.split('\n').map((line) => line.trim()).filter(Boolean);

  const overview =
    sectionBodyFromHeading(lines, /^(about|overview|the role|role summary|job summary|what you'll do|about us|company description)$/i) ??
    excerptLines(markdown, 2).join('\n');
  const responsibilities = sectionBodyFromHeading(lines, /^(responsibilities|what you'll do|you will|in this role|in this role,? you['']ll:?|the work|projects you might work on:?$)/i);
  const requirements = sectionBodyFromHeading(lines, /^(requirements|qualifications|what we're looking for|you have|about you|skills|is this role right for you\??|minimum qualifications)$/i);
  const benefits = sectionBodyFromHeading(lines, /^(benefits|compensation|salary|perks|what we offer)$/i);
  const compensation = firstMatchingLines(lines, [/\$\d[\d,]*(?:\s*[-–]\s*\$?\d[\d,]*)?|\bequity\b|\bbonus\b|\bbenefits\b/i], 2);
  const seniority = firstMatchingLines(lines, [/\b(senior|staff|principal|lead|manager|director|architect)\b/i], 2);
  const stack = firstMatchingLines(lines, [/\b(typescript|javascript|react|node|python|ruby|go|golang|rust|java|kubernetes|aws|gcp|azure|postgres|postgresql|sql|graphql|api|apis|ai|ml|llm)\b/i], 4);
  const workModel = firstMatchingLines(lines, [/\b(remote|hybrid|onsite|office|timezone|distributed)\b/i], 3);

  const paragraphOne = joinSummaryBits([
    firstSentence(overview),
    responsibilities ? `Key responsibilities include ${cleanText(firstSentence(responsibilities)).replace(/[.!?]+$/g, '')}.` : null,
    seniority.length > 0 ? `The role targets ${seniority.map((line) => cleanText(line).replace(/[.!?]+$/g, '')).join(' and ')}.` : null,
  ]);

  const paragraphTwo = joinSummaryBits([
    requirements ? `Core requirements include ${cleanText(firstSentence(requirements)).replace(/[.!?]+$/g, '')}.` : null,
    stack.length > 0 ? `The posting emphasizes ${stack.map((line) => cleanText(firstSentence(line)).replace(/[.!?]+$/g, '')).join('; ')}.` : null,
    workModel.length > 0 ? `Work model signals include ${workModel.map((line) => cleanText(firstSentence(line)).replace(/[.!?]+$/g, '')).join('; ')}.` : null,
    benefits ? `Compensation or benefits highlights: ${cleanText(firstSentence(benefits)).replace(/[.!?]+$/g, '')}.` :
      compensation.length > 0 ? `Compensation or benefits highlights: ${compensation.map((line) => cleanText(firstSentence(line)).replace(/[.!?]+$/g, '')).join('; ')}.` : null,
  ]);

  return [paragraphOne, paragraphTwo]
    .map((paragraph) => cleanText(paragraph))
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 5000);
}

function looksLikeBlockedPageLabel(value: string): boolean {
  const normalized = cleanText(value).toLowerCase();
  return (
    !normalized || normalized === 'career page' || normalized === 'unknown company' ||
    normalized === 'pasted link' || normalized === 'apply for this job' ||
    normalized.includes('just a moment') || normalized.includes('attention required') ||
    normalized.includes('verify you are human') || normalized.includes('checking your browser') ||
    normalized.includes('cloudflare')
  );
}

export function hydratedJobLooksValid(job: Pick<Job, 'company' | 'role' | 'jd'>): boolean {
  const hasMeaningfulCompany = !looksLikeBlockedPageLabel(job.company);
  const hasMeaningfulRole = !looksLikeBlockedPageLabel(job.role);
  const hasMeaningfulJd = !looksLikeShellText(job.jd);

  if (hasMeaningfulJd) return true;
  return hasMeaningfulCompany && hasMeaningfulRole;
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
    if (companyParam) {
      const normalized = cleanText(companyParam).replace(/[-_]+/g, ' ');
      return normalized ? titleCaseWords(normalized) : null;
    }

    const boardSlug = parsed.pathname
      .split('/').map((part) => decodeURIComponent(part).trim())
      .find((part) => part && part !== 'embed' && part !== 'job_app' && part !== 'jobs');
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
  return cleanText(title).split(/\s*(?:\||—|–|-)\s*/).map((part) => part.trim()).filter(Boolean);
}

function looksLikeRole(value: string): boolean {
  return /\b(engineer|developer|manager|designer|architect|analyst|scientist|lead|director|head|specialist|recruiter|consultant|intern|principal|staff|senior|sr\.?|junior|jr\.?|frontend|backend|full[- ]stack|platform|product|software|data|devops|sre|security|mobile|ios|android)\b/i.test(value);
}

function isGenericSegment(value: string): boolean {
  return /^(careers?|jobs?|job board|open positions|job application|apply now|apply)$/i.test(cleanText(value));
}

function pickRole(candidates: string[]): string | null {
  const normalized = candidates.map(normalizeSegment).filter((candidate) => candidate && !isGenericSegment(candidate));
  return normalized.find(looksLikeRole) ?? normalized[0] ?? null;
}

function pickCompany(candidates: string[]): string | null {
  const normalized = candidates.map(normalizeSegment).filter(
    (candidate) => candidate && !looksLikeRole(candidate) && !isGenericSegment(candidate),
  );
  return normalized[0] ?? null;
}

export function inferRoleAndCompanyFromSignals(
  signals: JobSignals,
  url: string,
): { role: string; company: string } {
  const parsedTitleParts = [signals.pageTitle, signals.metaTitle, signals.ogTitle]
    .flatMap(splitTitleParts).map(normalizeSegment).filter(Boolean);
  const companyHint = companyHintFromUrl(url);

  const role =
    pickRole([signals.jsonLdTitle, signals.h1, ...parsedTitleParts, signals.ogTitle, signals.metaTitle, signals.pageTitle]) ??
    'Career Page';
  const company =
    pickCompany([signals.jsonLdCompany, companyHint ?? '', signals.companyText, ...parsedTitleParts, signals.ogTitle, signals.metaTitle, signals.pageTitle]) ??
    hostnameLabel(url);

  return { role, company };
}

export function inferFromJdText(jd: string): { company: string; role: string } {
  const text = jd.trim();
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  let company = '';
  let role = '';

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

  if (!company) {
    const m = text.match(/\bAbout\s+([A-Z][A-Za-z0-9&.,'\-\s]{1,50}?)(?:\n|\.|,|:)/);
    if (m) company = m[1]!.trim();
  }

  if (!company) {
    const m = text.match(/\b([A-Z][A-Za-z0-9&.\s]{1,40}?)\s+is\s+(?:hiring|looking for|seeking)/);
    if (m) company = m[1]!.trim();
  }

  if (!role) {
    for (const line of lines.slice(0, 15)) {
      const clean = line.replace(/^#+\s*/, '').trim();
      if (looksLikeRole(clean) && clean.length < 100) {
        role = clean;
        break;
      }
    }
  }

  return { company: company || 'Unknown Company', role: role || 'Pasted Job Description' };
}

export async function hydrateJobFromUrl(
  url: string,
): Promise<Pick<Job, 'company' | 'role' | 'url' | 'jd' | 'jdSummary'>> {
  const browser = await puppeteer.launch({ headless: true, executablePath: findChrome() });
  const page = await browser.newPage();

  try {
    await page.setJavaScriptEnabled(false);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForSelector('body', { timeout: 8000 }).catch(() => null);
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 1500 }).catch(() => null);

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
          } catch {}
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
    })()`)) as JobSignals;

    const { role, company } = inferRoleAndCompanyFromSignals(signals, page.url());
    const jd = resolveJobDescriptionText(signals);

    const hydrated = {
      company,
      role,
      url: page.url(),
      jd,
      jdSummary: summarizeJobDescription(jd),
    };

    if (!hydratedJobLooksValid(hydrated)) {
      throw new Error(
        'Could not crawl enough job details from this page. Paste the job description manually instead.',
      );
    }

    return hydrated;
  } finally {
    await page.close().catch(() => null);
    await browser.close().catch(() => null);
  }
}

export function createPendingJob(
  partial: Pick<Job, 'id' | 'company' | 'role' | 'url' | 'jd'> & Partial<Pick<Job, 'jdSummary'>>,
): Job {
  return {
    id: partial.id,
    added: today(),
    company: partial.company,
    role: partial.role,
    url: partial.url,
    jd: partial.jd,
    jdSummary: partial.jdSummary ?? '',
    status: 'Pending',
    score: null,
    category: null,
    focus: null,
    reportPath: null,
    pdfPath: null,
    coverLetterPdfPath: null,
    theme: null,
    notes: '',
  };
}
