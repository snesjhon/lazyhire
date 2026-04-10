import { PORTALS } from './portals.js';
import { fetchGreenhouse } from './services/sources/greenhouse.js';
import { fetchLever } from './services/sources/lever.js';
import { fetchAshby } from './services/sources/ashby.js';
import { fetchRemoteOK } from './services/sources/remoteok.js';
import { fetchRemotive } from './services/sources/remotive.js';
import { fetchHNHiring } from './services/sources/hnhiring.js';
import { fetchWebSearch } from './services/sources/websearch.js';
import puppeteer from 'puppeteer';
import type { Portal } from './portals.js';
import type { ScanJob, Profile } from './types.js';

const MAX_SHORTLIST_SIZE = 50;
const MAX_VALIDATION_CANDIDATES = 100;
const VALIDATION_BATCH_SIZE = 8;
const STRICT_RELEVANCE_SCORE = 4;
const FALLBACK_RELEVANCE_SCORE = 2;
const JOB_PAGE_TIMEOUT_MS = 12000;
const JOB_PAGE_SETTLE_MS = 1500;

const NEGATIVE_KEYWORDS = [
  'junior', 'intern', 'entry level', 'entry-level',
  ' .net', 'java ', 'ios ', 'android ', 'php', ' ruby',
  'embedded', 'firmware', 'fpga', 'blockchain', 'web3', 'crypto',
  'data engineer', 'machine learning', 'ml engineer', 'ai engineer',
  'applied ai', 'salesforce', 'cobol', 'mainframe',
];

const SENIORITY_WORDS = ['senior', 'sr.', 'sr ', 'staff', 'principal', 'lead'];
const USER_FACING_REMOTE_WORDS = ['remote', 'distributed', 'work from home'];
const HYBRID_WORDS = ['hybrid', 'in office', 'in-office', 'onsite', 'on-site', 'office based'];
const GENERIC_ROLE_WORDS = new Set([
  'engineer', 'engineering', 'developer', 'software', 'senior', 'staff', 'principal', 'lead',
]);
const CLOSURE_WORDS = [
  'job no longer available',
  'job is no longer available',
  'position has been filled',
  'position is closed',
  'job has expired',
  'job posting has expired',
  'posting has expired',
  'this job is unavailable',
  'this position is no longer available',
  'this posting is no longer available',
  'sorry we couldn t find it',
  'sorry we could not find it',
  'sorry, we couldn t find it',
  'sorry, we could not find it',
  'couldn t find that job',
  'could not find that job',
  'job not found',
  'posting not found',
  'page not found',
  '404',
  'not found',
];

const OFF_TARGET_ROLE_PATTERNS = [
  /\bsolutions?\s+engineer\b/,
  /\bforward\s+deployed\b/,
  /\bfield\s+engineer\b/,
  /\bsales\s+engineer\b/,
  /\bcustomer\s+success\b/,
  /\baccount\s+executive\b/,
  /\brecruiter\b/,
  /\bdesigner\b/,
  /\bproduct\s+designer\b/,
  /\bux\b/,
  /\bui\/ux\b/,
  /\bqa\b/,
  /\btest\s+engineer\b/,
  /\bsdet\b/,
  /\btechnical\s+support\b/,
  /\bdevrel\b/,
  /\bdeveloper\s+advocate\b/,
];

const ARCHETYPE_KEYWORDS: Record<string, string[]> = {
  platform:       ['platform', 'infrastructure', 'infra', 'devops', 'dx', 'developer experience', 'observability'],
  agentic:        ['agent', 'ai', 'llm', 'automation', 'workflow', 'orchestration'],
  pm:             ['product manager', 'product management', 'roadmap'],
  architect:      ['architect', 'architecture', 'solutions', 'systems design'],
  fde:            ['forward deployed', 'field engineer', 'solutions engineer'],
  transformation: ['transformation', 'enablement', 'change management'],
};

export type SourceStatus = {
  name: string;
  state: 'pending' | 'running' | 'done' | 'error';
  count: number;
};

export type ScanProgressCallback = (update: SourceStatus) => void;
type JobPage = {
  finalUrl: string;
  title: string;
  text: string;
  applyActions: number;
  jobLinks: number;
};

const COMPANY_SUFFIXES = [
  'inc', 'incorporated', 'llc', 'l l c', 'ltd', 'limited', 'corp', 'corporation', 'co', 'company',
];
const URL_TRACKING_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'source', 'src', 'ref', 'refid', 'referrer',
];
const SOURCE_PRIORITY: Record<ScanJob['source'], number> = {
  greenhouse: 5,
  lever: 5,
  ashby: 5,
  websearch: 4,
  remotive: 3,
  remoteok: 2,
  'hn-hiring': 1,
};
const PORTAL_BY_COMPANY_KEY = new Map<string, Portal>(
  PORTALS.map((portal) => [normalizeCompanyKey(portal.name), portal]),
);

function isNegative(title: string): boolean {
  const t = ` ${title.toLowerCase()} `;
  return NEGATIVE_KEYWORDS.some((kw) => t.includes(kw));
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9+#]+/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 1);
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeTitleKey(value: string): string {
  return tokenize(value).join(' ');
}

export function canonicalizeJobUrl(value: string): string {
  try {
    const url = new URL(value);
    const pathname = url.pathname.replace(/\/+$/, '') || '/';
    const params = new URLSearchParams(url.search);
    for (const key of [...params.keys()]) {
      if (URL_TRACKING_PARAMS.includes(key.toLowerCase())) params.delete(key);
    }
    const search = params.toString();
    return `${url.origin.toLowerCase()}${pathname}${search ? `?${search}` : ''}`;
  } catch {
    return value.trim();
  }
}

export function normalizeCompanyKey(value: string): string {
  let normalized = value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  for (const suffix of COMPANY_SUFFIXES) {
    const pattern = new RegExp(`\\b${suffix.replace(/\s+/g, '\\s+')}\\b$`, 'i');
    normalized = normalized.replace(pattern, '').trim();
  }

  return normalized.replace(/\s+/g, ' ');
}

function titleOverlapScore(a: string, b: string): number {
  const aTokens = new Set(tokenize(a));
  const bTokens = new Set(tokenize(b));
  if (aTokens.size === 0 || bTokens.size === 0) return 0;

  let intersection = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) intersection += 1;
  }

  return intersection / Math.max(aTokens.size, bTokens.size);
}

function getPortalForCompany(company: string): Portal | undefined {
  return PORTAL_BY_COMPANY_KEY.get(normalizeCompanyKey(company));
}

export function isLikelyAtsBoardRoot(url: string, ats?: Portal['ats']): boolean {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split('/').filter(Boolean);
    if (ats === 'lever' || parsed.hostname === 'jobs.lever.co') return segments.length < 2;
    if (ats === 'greenhouse' || parsed.hostname.includes('greenhouse.io')) {
      return segments.length < 3 || (segments.length === 2 && segments[1] === 'jobs');
    }
    if (ats === 'ashby' || parsed.hostname === 'jobs.ashbyhq.com') {
      return segments.length < 2 || !segments.some((segment) => segment.toLowerCase() === 'job');
    }
    return false;
  } catch {
    return false;
  }
}

function isLikelyBoardIndexPage(job: ScanJob, page: JobPage): boolean {
  const portal = getPortalForCompany(job.company);
  if (isLikelyAtsBoardRoot(page.finalUrl, portal?.ats)) return true;
  if (page.jobLinks >= 5) return true;
  if (page.applyActions >= 4) return true;
  return false;
}

export function findOfficialMatch(job: ScanJob, officialJobs: ScanJob[]): ScanJob | null {
  const canonicalUrl = canonicalizeJobUrl(job.url);
  const exactUrlMatch = officialJobs.find((candidate) => canonicalizeJobUrl(candidate.url) === canonicalUrl);
  if (exactUrlMatch) return exactUrlMatch;

  const titleKey = normalizeTitleKey(job.title);
  const exactTitleMatch = officialJobs.find((candidate) => normalizeTitleKey(candidate.title) === titleKey);
  if (exactTitleMatch) return exactTitleMatch;

  let best: { job: ScanJob; score: number } | null = null;
  for (const candidate of officialJobs) {
    const score = titleOverlapScore(job.title, candidate.title);
    if (!best || score > best.score) best = { job: candidate, score };
  }

  return best && best.score >= 0.6 ? best.job : null;
}

function reconcileWithOfficialPosting(
  job: ScanJob,
  officialByCompany: Map<string, ScanJob[]>,
): ScanJob | null {
  const companyKey = normalizeCompanyKey(job.company);
  const officialJobs = officialByCompany.get(companyKey);
  if (!officialJobs || officialJobs.length === 0) return job;

  const match = findOfficialMatch(job, officialJobs);
  if (!match) return null;

  return {
    ...match,
    score: job.score,
    snippet: match.snippet ?? job.snippet,
  };
}

function stripHtml(html: string): string {
  return normalizeWhitespace(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/gi, '"')
  );
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return normalizeWhitespace(match?.[1] ?? '');
}

function getProfileLexicon(profile: Profile): Set<string> {
  const lexicon = new Set<string>();
  const add = (value: string) => {
    for (const token of tokenize(value)) lexicon.add(token);
  };

  for (const role of profile.targets.roles) add(role);
  for (const experience of profile.experiences) {
    add(experience.role);
    for (const tag of experience.tags) add(tag);
  }
  for (const skill of profile.skills) add(skill);

  return lexicon;
}

function isOffTargetTitle(job: ScanJob, profile: Profile): boolean {
  const titleLower = job.title.toLowerCase();
  const profileLexicon = getProfileLexicon(profile);

  return OFF_TARGET_ROLE_PATTERNS.some((pattern) => {
    const match = titleLower.match(pattern);
    if (!match) return false;

    const matchedTokens = tokenize(match[0]).filter((token) => !GENERIC_ROLE_WORDS.has(token));
    if (matchedTokens.length === 0) return false;
    return matchedTokens.every((token) => !profileLexicon.has(token));
  });
}

function rankJob(job: ScanJob, profile: Profile): number {
  let score = 0;
  const titleLower = job.title.toLowerCase();
  const snippetLower = (job.snippet ?? '').toLowerCase();

  // Exact role phrase match in title/snippet
  for (const role of profile.targets.roles) {
    const roleLower = role.toLowerCase();
    if (titleLower.includes(roleLower)) {
      score += 6;
      break;
    }
    if (snippetLower.includes(roleLower)) {
      score += 3;
      break;
    }
  }

  // Role token overlap in title/snippet
  for (const role of profile.targets.roles) {
    const words = tokenize(role).filter((w) => w.length > 2);
    const titleMatches = words.filter((w) => titleLower.includes(w)).length;
    const snippetMatches = words.filter((w) => snippetLower.includes(w)).length;
    const allMatch = words.every((w) => titleLower.includes(w));
    if (allMatch) {
      score += 4;
      break;
    }
    if (titleMatches >= 2) score += 3;
    else if (titleMatches === 1) score += 1;

    if (snippetMatches >= 2) score += 2;
    else if (snippetMatches === 1) score += 1;
  }

  // Seniority boost
  if (SENIORITY_WORDS.some((w) => titleLower.includes(w))) score += 2;

  // Archetype alignment
  for (const arch of profile.targets.archetypes) {
    const kws = ARCHETYPE_KEYWORDS[arch] ?? [];
    if (kws.some((k) => titleLower.includes(k))) { score += 1; break; }
  }

  // Remote match
  if (profile.targets.remote === 'full' && (
    USER_FACING_REMOTE_WORDS.some((word) => snippetLower.includes(word) || titleLower.includes(word))
  )) {
    score += 1;
  }

  return score;
}

function pageIncludesRemote(pageText: string): boolean {
  return USER_FACING_REMOTE_WORDS.some((word) => pageText.includes(word));
}

function pageIncludesHybrid(pageText: string): boolean {
  return HYBRID_WORDS.some((word) => pageText.includes(word));
}

function roleAppearsOnPage(job: ScanJob, pageText: string, profile: Profile): boolean {
  const titleTokens = tokenize(job.title).filter((token) => !GENERIC_ROLE_WORDS.has(token));
  if (titleTokens.length > 0 && titleTokens.some((token) => pageText.includes(token))) {
    return true;
  }

  return profile.targets.roles.some((role) => {
    const roleTokens = tokenize(role).filter((token) => !GENERIC_ROLE_WORDS.has(token));
    return roleTokens.length > 0 && roleTokens.some((token) => pageText.includes(token));
  });
}

export function pageMatchesProfile(job: ScanJob, profile: Profile, page: { title: string; text: string }): boolean {
  const pageText = normalizeWhitespace(`${page.title} ${page.text}`.toLowerCase());

  if (!pageText) return false;
  if (CLOSURE_WORDS.some((word) => pageText.includes(word))) return false;
  if (!roleAppearsOnPage(job, pageText, profile)) return false;

  if (profile.targets.remote === 'full') {
    if (!pageIncludesRemote(pageText)) return false;
    if (pageIncludesHybrid(pageText)) return false;
  }

  if (profile.targets.remote === 'hybrid') {
    const hasLocationMode = pageIncludesRemote(pageText) || pageIncludesHybrid(pageText);
    if (!hasLocationMode) return false;
  }

  const normalizedDealBreakers = profile.targets.dealBreakers
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  if (normalizedDealBreakers.some((item) => pageText.includes(item))) return false;

  return true;
}

function normalizePageText(value: string): string {
  return normalizeWhitespace(value.toLowerCase().replace(/[^a-z0-9]+/g, ' '));
}

async function fetchJobPage(url: string, browser: Awaited<ReturnType<typeof puppeteer.launch>>): Promise<JobPage | null> {
  const page = await browser.newPage();
  try {
    await page.setUserAgent('open-positions/1.0');
    await page.setViewport({ width: 1440, height: 1024, deviceScaleFactor: 1 });

    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: JOB_PAGE_TIMEOUT_MS,
    });
    if (!response || !response.ok()) return null;

    await page.waitForSelector('body', { timeout: JOB_PAGE_TIMEOUT_MS }).catch(() => null);
    await page.waitForNetworkIdle({ idleTime: 500, timeout: JOB_PAGE_SETTLE_MS }).catch(() => null);

    const html = await page.content();
    const title = normalizeWhitespace(await page.title());
    const details = await page.evaluate(() => {
      const text = document.body?.innerText ?? '';
      const actionMatcher = /\bapply\b/i;
      const applyActions = Array.from(document.querySelectorAll('a, button'))
        .filter((node) => actionMatcher.test(node.textContent ?? ''))
        .length;

      const currentHref = window.location.href;
      const currentOrigin = window.location.origin;
      const jobLinkMatcher = /(job|jobs|position|posting|career)/i;
      const jobLinks = new Set(
        Array.from(document.querySelectorAll('a[href]'))
          .map((node) => (node as HTMLAnchorElement).href)
          .filter((href) =>
            href.startsWith(currentOrigin)
            && href !== currentHref
            && jobLinkMatcher.test(href)
          )
      ).size;

      return { text, applyActions, jobLinks };
    });
    const text = normalizeWhitespace(details.text);
    if (!text) return null;

    const normalizedText = normalizePageText(`${title} ${text}`);
    if (CLOSURE_WORDS.some((word) => normalizedText.includes(normalizePageText(word)))) return null;

    return {
      finalUrl: page.url() || response.url() || url,
      title: title || extractTitle(html),
      text: text || stripHtml(html),
      applyActions: details.applyActions,
      jobLinks: details.jobLinks,
    };
  } catch {
    return null;
  } finally {
    await page.close().catch(() => null);
  }
}

async function validateJob(
  job: ScanJob,
  profile: Profile,
  browser: Awaited<ReturnType<typeof puppeteer.launch>>,
): Promise<ScanJob | null> {
  const page = await fetchJobPage(job.url, browser);
  if (!page) return null;
  if (isLikelyBoardIndexPage(job, page)) return null;
  if (!pageMatchesProfile(job, profile, page)) return null;

  const pageText = normalizeWhitespace(`${page.title} ${page.text}`);
  const locationHint = pageIncludesRemote(pageText.toLowerCase()) ? 'Remote' : undefined;

  return {
    ...job,
    url: page.finalUrl,
    snippet: locationHint ?? job.snippet,
  };
}

async function validateJobs(
  jobs: ScanJob[],
  profile: Profile,
  onProgress?: ScanProgressCallback,
): Promise<ScanJob[]> {
  const validated: ScanJob[] = [];
  const update = (state: SourceStatus['state'], count = 0) =>
    onProgress?.({ name: 'Validation', state, count });

  update('running');
  const browser = await puppeteer.launch({ headless: true });

  try {
    for (let i = 0; i < jobs.length; i += VALIDATION_BATCH_SIZE) {
      const batch = jobs.slice(i, i + VALIDATION_BATCH_SIZE);
      const settled = await Promise.allSettled(batch.map((job) => validateJob(job, profile, browser)));
      for (const result of settled) {
        if (result.status === 'fulfilled' && result.value) validated.push(result.value);
      }
    }
  } finally {
    await browser.close().catch(() => null);
  }

  update('done', validated.length);
  return validated;
}

function prefersJob(candidate: ScanJob, current: ScanJob): boolean {
  if (candidate.score !== current.score) return candidate.score > current.score;

  const candidatePriority = SOURCE_PRIORITY[candidate.source] ?? 0;
  const currentPriority = SOURCE_PRIORITY[current.source] ?? 0;
  if (candidatePriority !== currentPriority) return candidatePriority > currentPriority;

  return candidate.title.length > current.title.length;
}

export function keepBestJobPerCompany(
  jobs: ScanJob[],
  existingCompanyKeys = new Set<string>(),
): ScanJob[] {
  const bestByCompany = new Map<string, ScanJob>();

  for (const job of jobs) {
    const companyKey = normalizeCompanyKey(job.company);
    if (!companyKey || existingCompanyKeys.has(companyKey)) continue;

    const current = bestByCompany.get(companyKey);
    if (!current || prefersJob(job, current)) {
      bestByCompany.set(companyKey, job);
    }
  }

  return [...bestByCompany.values()];
}

export function shortlistJobs(jobs: ScanJob[], profile: Profile, maxSize = MAX_SHORTLIST_SIZE): ScanJob[] {
  const ranked = jobs
    .filter((job) => !isNegative(job.title))
    .filter((job) => !isOffTargetTitle(job, profile))
    .map((job) => ({ ...job, score: rankJob(job, profile) }))
    .sort((a, b) => b.score - a.score);

  const strict = ranked.filter((job) => job.score >= STRICT_RELEVANCE_SCORE);
  if (strict.length >= Math.min(maxSize, ranked.length)) {
    return strict.slice(0, maxSize);
  }

  const fallback = ranked.filter((job) => job.score >= FALLBACK_RELEVANCE_SCORE);
  return fallback.slice(0, maxSize);
}

async function runBatch<T>(
  items: T[],
  fn: (item: T) => Promise<ScanJob[]>,
  batchSize = 15,
): Promise<ScanJob[]> {
  const results: ScanJob[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const settled = await Promise.allSettled(batch.map(fn));
    for (const r of settled) {
      if (r.status === 'fulfilled') results.push(...r.value);
    }
  }
  return results;
}

export async function runScan(
  profile: Profile,
  existingUrls: Set<string>,
  existingCompanies = new Set<string>(),
  onProgress?: ScanProgressCallback,
): Promise<ScanJob[]> {
  const roleKeywords = profile.targets.roles;
  const allJobs: ScanJob[] = [];

  const progress = (name: string, state: SourceStatus['state'], count = 0) =>
    onProgress?.({ name, state, count });

  // ── ATS APIs (batched, parallel within each ATS) ─────────────────

  const ghPortals = PORTALS.filter((p) => p.ats === 'greenhouse');
  const lvPortals = PORTALS.filter((p) => p.ats === 'lever');
  const asPortals = PORTALS.filter((p) => p.ats === 'ashby');

  progress('Greenhouse', 'running');
  const ghJobs = await runBatch(ghPortals, (p) => fetchGreenhouse(p.slug, p.name));
  allJobs.push(...ghJobs);
  progress('Greenhouse', 'done', ghJobs.length);

  progress('Lever', 'running');
  const lvJobs = await runBatch(lvPortals, (p) => fetchLever(p.slug, p.name));
  allJobs.push(...lvJobs);
  progress('Lever', 'done', lvJobs.length);

  progress('Ashby', 'running');
  const asJobs = await runBatch(asPortals, (p) => fetchAshby(p.slug, p.name));
  allJobs.push(...asJobs);
  progress('Ashby', 'done', asJobs.length);

  const officialByCompany = new Map<string, ScanJob[]>();
  for (const job of [...ghJobs, ...lvJobs, ...asJobs]) {
    const companyKey = normalizeCompanyKey(job.company);
    const current = officialByCompany.get(companyKey) ?? [];
    current.push(job);
    officialByCompany.set(companyKey, current);
  }

  // ── Free job board APIs (parallel) ───────────────────────────────

  progress('RemoteOK', 'running');
  const roJobs = await fetchRemoteOK(roleKeywords).catch(() => [] as ScanJob[]);
  allJobs.push(...roJobs);
  progress('RemoteOK', 'done', roJobs.length);

  progress('Remotive', 'running');
  const rmJobs = await fetchRemotive(roleKeywords).catch(() => [] as ScanJob[]);
  allJobs.push(...rmJobs);
  progress('Remotive', 'done', rmJobs.length);

  progress('HN Hiring', 'running');
  const hnJobs = await fetchHNHiring(roleKeywords).catch(() => [] as ScanJob[]);
  allJobs.push(...hnJobs);
  progress('HN Hiring', 'done', hnJobs.length);

  // ── WebSearch (Claude SDK, broad discovery) ───────────────────────

  progress('WebSearch', 'running');
  const wsJobs = await fetchWebSearch(profile).catch(() => [] as ScanJob[]);
  allJobs.push(...wsJobs);
  progress('WebSearch', 'done', wsJobs.length);

  // ── Dedup by URL ──────────────────────────────────────────────────

  const seen = new Set<string>([...existingUrls].map(canonicalizeJobUrl));
  const deduped = allJobs.filter((job) => {
    const canonicalUrl = canonicalizeJobUrl(job.url);
    if (!job.url || seen.has(canonicalUrl)) return false;
    seen.add(canonicalUrl);
    return true;
  });

  const reconciled = deduped
    .map((job) => reconcileWithOfficialPosting(job, officialByCompany))
    .filter((job): job is ScanJob => Boolean(job));

  const candidateSeen = new Set<string>();
  const canonicalReconciled = reconciled.filter((job) => {
    const canonicalUrl = canonicalizeJobUrl(job.url);
    if (candidateSeen.has(canonicalUrl)) return false;
    candidateSeen.add(canonicalUrl);
    return true;
  });

  const candidates = shortlistJobs(canonicalReconciled, profile, MAX_VALIDATION_CANDIDATES);
  const validated = await validateJobs(candidates, profile, onProgress);
  const companyDeduped = keepBestJobPerCompany(validated, existingCompanies);
  return shortlistJobs(companyDeduped, profile, MAX_SHORTLIST_SIZE);
}
