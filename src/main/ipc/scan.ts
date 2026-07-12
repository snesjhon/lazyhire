import { ipcMain } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import { query } from '@anthropic-ai/claude-code';
import { IPC } from '@shared/ipc-channels';
import { db, discoveredDb, dismissedDb, jobCacheDb } from '../services/db.js';
import { loadProfile } from '../services/profile.js';
import { getClaudeQueryOptions } from '../services/claude.js';
import { fetchGreenhouse } from '../services/sources/greenhouse.js';
import { fetchAshby } from '../services/sources/ashby.js';
import { fetchCCCrawlId, fetchGreenhouseSlugs, fetchAshbySlugs } from '../services/sources/commoncrawl.js';
import { isMockDiscoverEnabled } from '../services/mock-flag.js';
import * as mockDiscover from '../services/sources/mock-discover.js';
import type { CompanyEntry, DiscoveredStore, JobCacheEntry, JobCacheStore, Profile, ScanJob } from '@shared/types';

// ── Relevance-scoring constants ────────────────────────────────────

const MAX_SHORTLIST_SIZE = 50;
const STRICT_RELEVANCE_SCORE = 4;
const FALLBACK_RELEVANCE_SCORE = 2;

const NEGATIVE_KEYWORDS = [
  'junior', 'intern', 'entry level', 'entry-level',
  ' .net', 'java ', 'ios ', 'android ', 'php', ' ruby',
  'embedded', 'firmware', 'fpga', 'blockchain', 'web3', 'crypto',
  'data engineer', 'machine learning', 'ml engineer', 'ai engineer',
  'applied ai', 'salesforce', 'cobol', 'mainframe',
];

const SENIORITY_WORDS = ['senior', 'sr.', 'sr ', 'staff', 'principal', 'lead'];
const USER_FACING_REMOTE_WORDS = ['remote', 'distributed', 'work from home'];
const GENERIC_ROLE_WORDS = new Set([
  'engineer', 'engineering', 'developer', 'software', 'senior', 'staff', 'principal', 'lead',
]);

const OFF_TARGET_ROLE_PATTERNS = [
  /\bsolutions?\s+engineer\b/, /\bforward\s+deployed\b/, /\bfield\s+engineer\b/,
  /\bsales\s+engineer\b/, /\bcustomer\s+success\b/, /\baccount\s+executive\b/,
  /\brecruiter\b/, /\bdesigner\b/, /\bproduct\s+designer\b/, /\bux\b/, /\bui\/ux\b/,
  /\bqa\b/, /\btest\s+engineer\b/, /\bsdet\b/, /\btechnical\s+support\b/,
  /\bdevrel\b/, /\bdeveloper\s+advocate\b/,
];

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  engineering: ['engineer', 'engineering', 'developer', 'software'],
  product: ['product manager', 'product management', 'roadmap', 'discovery'],
  design: ['designer', 'design', 'ux', 'ui', 'product design'],
  data: ['data', 'analytics', 'analyst', 'scientist', 'experimentation'],
  architecture: ['architect', 'architecture', 'solution design', 'enterprise'],
  research: ['research', 'researcher', 'applied research', 'user research'],
  consulting: ['consulting', 'consultant', 'client-facing', 'implementation'],
  operations: ['operations', 'enablement', 'program management', 'transformation'],
  leadership: ['director', 'head of', 'vp', 'leadership', 'manager'],
  go_to_market: ['sales engineer', 'solutions consultant', 'customer success', 'growth'],
};

const FOCUS_KEYWORDS: Record<string, string[]> = {
  platform: ['platform', 'infrastructure', 'infra', 'developer experience', 'observability'],
  frontend: ['frontend', 'front end', 'react', 'ui'],
  backend: ['backend', 'back end', 'api', 'distributed systems'],
  full_stack: ['full stack', 'full-stack'],
  forward_deployed: ['forward deployed', 'field engineer', 'client-facing delivery'],
  product_design: ['product designer', 'product design', 'interaction design'],
  technical_pm: ['technical product manager', 'technical pm', 'prd'],
  ux_research: ['ux research', 'user research'],
  analytics: ['analytics', 'business intelligence', 'bi'],
  ai: ['ai', 'llm', 'machine learning', 'agent'],
  developer_relations: ['devrel', 'developer relations', 'developer advocate'],
  solutions_architecture: ['solutions architect', 'solution architect', 'systems design'],
};

const SOURCE_PRIORITY: Record<ScanJob['source'], number> = { greenhouse: 5, ashby: 5 };

const URL_TRACKING_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'source', 'src', 'ref', 'refid', 'referrer'];

const COMPANY_SUFFIXES = ['inc', 'incorporated', 'llc', 'l l c', 'ltd', 'limited', 'corp', 'corporation', 'co', 'company'];

// ── Utility functions ─────────────────────────────────────────────

function tokenize(value: string): string[] {
  return value.toLowerCase().split(/[^a-z0-9+#]+/i).map((part) => part.trim()).filter((part) => part.length > 1);
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
  let normalized = value.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
  for (const suffix of COMPANY_SUFFIXES) {
    const pattern = new RegExp(`\\b${suffix.replace(/\s+/g, '\\s+')}\\b$`, 'i');
    normalized = normalized.replace(pattern, '').trim();
  }
  return normalized.replace(/\s+/g, ' ');
}

function isNegative(title: string): boolean {
  const t = ` ${title.toLowerCase()} `;
  return NEGATIVE_KEYWORDS.some((kw) => t.includes(kw));
}

function isOffTargetTitle(job: ScanJob, profile: Profile): boolean {
  const titleLower = job.title.toLowerCase();
  const profileLexicon = new Set<string>();
  for (const role of profile.targets.roles) for (const t of tokenize(role)) profileLexicon.add(t);
  for (const exp of profile.experiences) {
    for (const t of tokenize(exp.role)) profileLexicon.add(t);
    for (const tag of exp.tags) for (const t of tokenize(tag)) profileLexicon.add(t);
  }
  for (const skill of profile.skills) for (const t of tokenize(skill)) profileLexicon.add(t);

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

  for (const role of profile.targets.roles) {
    const roleLower = role.toLowerCase();
    if (titleLower.includes(roleLower)) { score += 6; break; }
    if (snippetLower.includes(roleLower)) { score += 3; break; }
  }

  for (const role of profile.targets.roles) {
    const words = tokenize(role).filter((w) => w.length > 2 && !GENERIC_ROLE_WORDS.has(w));
    if (words.length === 0) continue;
    const titleMatches = words.filter((w) => titleLower.includes(w)).length;
    const snippetMatches = words.filter((w) => snippetLower.includes(w)).length;
    if (titleMatches === words.length) { score += 4; break; }
    if (words.length >= 3 && titleMatches >= 2) { score += 2; break; }
    if (snippetMatches === words.length) { score += 2; break; }
  }

  if (score > 0) {
    if (SENIORITY_WORDS.some((w) => titleLower.includes(w))) score += 2;

    for (const category of profile.targets.categories) {
      const kws = CATEGORY_KEYWORDS[category] ?? [];
      if (kws.some((k) => titleLower.includes(k) || snippetLower.includes(k))) { score += 1; break; }
    }

    for (const focus of profile.targets.focuses) {
      const kws = FOCUS_KEYWORDS[focus] ?? tokenize(focus).filter((w) => w.length > 2);
      if (kws.some((k) => titleLower.includes(k) || snippetLower.includes(k))) { score += 2; break; }
    }

    if (profile.targets.remote === 'full' &&
      USER_FACING_REMOTE_WORDS.some((w) => snippetLower.includes(w) || titleLower.includes(w))) {
      score += 1;
    }
  }

  return score;
}

function prefersJob(candidate: ScanJob, current: ScanJob): boolean {
  if (candidate.score !== current.score) return candidate.score > current.score;
  const cp = SOURCE_PRIORITY[candidate.source] ?? 0;
  const curp = SOURCE_PRIORITY[current.source] ?? 0;
  if (cp !== curp) return cp > curp;
  return candidate.title.length > current.title.length;
}

export function keepBestJobPerCompany(jobs: ScanJob[], existingCompanyKeys = new Set<string>()): ScanJob[] {
  const bestByCompany = new Map<string, ScanJob>();
  for (const job of jobs) {
    const companyKey = normalizeCompanyKey(job.company);
    if (!companyKey || existingCompanyKeys.has(companyKey)) continue;
    const current = bestByCompany.get(companyKey);
    if (!current || prefersJob(job, current)) bestByCompany.set(companyKey, job);
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
  if (strict.length >= Math.min(maxSize, ranked.length)) return strict.slice(0, maxSize);

  const fallback = ranked.filter((job) => job.score >= FALLBACK_RELEVANCE_SCORE);
  return fallback.slice(0, maxSize);
}

const DISCOVER_BATCH_SIZE = 30;

// Maps each slug to its fetch result, or null if the fetch failed (distinct
// from an empty array, which means "fetched successfully, zero jobs").
async function runBatched(
  slugs: string[],
  fn: (slug: string) => Promise<ScanJob[]>,
  batchSize = DISCOVER_BATCH_SIZE,
): Promise<Map<string, ScanJob[] | null>> {
  const results = new Map<string, ScanJob[] | null>();
  for (let i = 0; i < slugs.length; i += batchSize) {
    const batch = slugs.slice(i, i + batchSize);
    const settled = await Promise.allSettled(batch.map(fn));
    settled.forEach((r, idx) => {
      results.set(batch[idx], r.status === 'fulfilled' ? r.value : null);
    });
  }
  return results;
}

function slugToName(slug: string): string {
  return slug.split(/[-_]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function extractSlugFromUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname.split('/').filter(Boolean)[0] ?? '';
  } catch {
    return '';
  }
}

function mergeDiscoveredBatch(existing: ScanJob[], incoming: ScanJob[]): ScanJob[] {
  const byUrl = new Map(existing.map((job) => [canonicalizeJobUrl(job.url), job]));
  for (const job of incoming) {
    const key = canonicalizeJobUrl(job.url);
    if (!byUrl.has(key)) byUrl.set(key, job);
  }
  return [...byUrl.values()];
}

const SLUG_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function readSlugCache(store: DiscoveredStore): DiscoveredStore | null {
  const cache = store.slugCache;
  if (!cache) return null;
  const age = Date.now() - new Date(cache.fetchedAt).getTime();
  if (age >= SLUG_CACHE_TTL_MS) return null;
  if (cache.greenhouse.length === 0 && cache.ashby.length === 0) return null;
  return store;
}

// Per-company job-posting cache, so repeated Discover runs only refetch
// companies whose cached jobs have gone stale.
const JOB_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function isFresh(entry: JobCacheEntry | undefined): entry is JobCacheEntry {
  if (!entry) return false;
  return Date.now() - new Date(entry.fetchedAt).getTime() < JOB_CACHE_TTL_MS;
}

function partitionSlugs(
  slugs: string[],
  cache: Record<string, JobCacheEntry>,
): { cachedSlugs: string[]; staleSlugs: string[] } {
  const cachedSlugs = slugs.filter((s) => isFresh(cache[s]));
  const staleSlugs = slugs.filter((s) => !isFresh(cache[s]));
  return { cachedSlugs, staleSlugs };
}

// Combines cache hits with freshly-fetched results into the full job list for
// a source, plus the next cache map to persist. A failed fetch falls back to
// the old cached entry (if any) without bumping its fetchedAt, so it gets
// retried on the next Discover run instead of being masked for a full TTL.
function resolveSourceJobs(
  cachedSlugs: string[],
  staleSlugs: string[],
  fetchResults: Map<string, ScanJob[] | null>,
  oldCache: Record<string, JobCacheEntry>,
  fetchedAt: string,
): { jobs: ScanJob[]; nextCache: Record<string, JobCacheEntry>; fetchedCount: number } {
  const jobs: ScanJob[] = [];
  const nextCache: Record<string, JobCacheEntry> = {};
  let fetchedCount = 0;

  for (const slug of cachedSlugs) {
    const entry = oldCache[slug];
    jobs.push(...entry.jobs);
    nextCache[slug] = entry;
  }
  for (const slug of staleSlugs) {
    const result = fetchResults.get(slug);
    if (result == null) {
      const old = oldCache[slug];
      if (old) {
        jobs.push(...old.jobs);
        nextCache[slug] = old;
      }
      continue;
    }
    jobs.push(...result);
    nextCache[slug] = { jobs: result, fetchedAt };
    fetchedCount++;
  }
  return { jobs, nextCache, fetchedCount };
}

const VERTICALS = [
  'fintech', 'healthtech', 'dev-tools', 'enterprise-saas', 'ai-ml',
  'e-commerce', 'edtech', 'consumer', 'govtech', 'media', 'other',
] as const;

async function classifyCompanies(
  companies: Array<{ slug: string; name: string; ats: 'greenhouse' | 'ashby'; titles: string[] }>,
): Promise<Record<string, string>> {
  if (companies.length === 0) return {};

  const prompt = `Classify each company into one tech industry vertical based on its name and job titles.

Companies:
${companies.map((c) => `- ${c.slug} | ${c.name} | ${c.titles.slice(0, 3).join(', ')}`).join('\n')}

Verticals (pick exactly one per company): ${VERTICALS.join(', ')}

Respond with ONLY a JSON object mapping slug to vertical. No explanation, no markdown:
{"slug1":"fintech","slug2":"dev-tools"}`;

  let result = '';
  try {
    for await (const msg of query({ prompt, options: getClaudeQueryOptions({ maxTurns: 1 }) })) {
      if (msg.type === 'result' && msg.subtype === 'success') result = msg.result;
    }
    const match = result.match(/\{[\s\S]*\}/);
    if (!match) return {};
    return JSON.parse(match[0]) as Record<string, string>;
  } catch {
    return {};
  }
}

// ── Stage 1: Scan Companies ─────────────────────────────────────────
// Mines which companies exist on Greenhouse/Ashby. Never fetches job
// postings. Cached for SLUG_CACHE_TTL_MS since this almost never changes.
//
// Mock mode uses an in-memory cache (never written to disk) so flipping
// MOCK_DISCOVER off later can't leave fake companies behind in the real
// cache, while still requiring Scan Companies to run before Discover.

let mockSlugCache: { greenhouse: string[]; ashby: string[]; fetchedAt: string } | null = null;

export interface ScanCompaniesSummary {
  greenhouse: number;
  ashby: number;
  cached: boolean;
  fetchedAt: string;
}

export type CompanyScanStepName = 'cc-greenhouse' | 'cc-ashby' | 'done';

export interface CompanyScanProgress {
  step: CompanyScanStepName;
  status: 'running' | 'done' | 'cached';
  count?: number;
}

async function scanCompanies(onProgress?: (progress: CompanyScanProgress) => void): Promise<ScanCompaniesSummary> {
  const store = discoveredDb.readDiscovered();
  const mock = isMockDiscoverEnabled();
  const cached = mock ? mockSlugCache : readSlugCache(store)?.slugCache ?? null;

  if (cached) {
    onProgress?.({ step: 'cc-greenhouse', status: 'cached', count: cached.greenhouse.length });
    onProgress?.({ step: 'cc-ashby', status: 'cached', count: cached.ashby.length });
    onProgress?.({ step: 'done', status: 'done' });
    return { greenhouse: cached.greenhouse.length, ashby: cached.ashby.length, cached: true, fetchedAt: cached.fetchedAt };
  }

  const crawlId = mock ? await mockDiscover.fetchCCCrawlId() : await fetchCCCrawlId();

  onProgress?.({ step: 'cc-greenhouse', status: 'running' });
  const ghSlugs = mock ? await mockDiscover.fetchGreenhouseSlugs() : await fetchGreenhouseSlugs(crawlId);
  onProgress?.({ step: 'cc-greenhouse', status: 'done', count: ghSlugs.length });

  onProgress?.({ step: 'cc-ashby', status: 'running' });
  const asSlugs = mock ? await mockDiscover.fetchAshbySlugs() : await fetchAshbySlugs(crawlId);
  onProgress?.({ step: 'cc-ashby', status: 'done', count: asSlugs.length });

  if (ghSlugs.length === 0 && asSlugs.length === 0) {
    throw new Error('Common Crawl returned no slugs — fetch may have timed out or the index is unavailable.');
  }

  const fetchedAt = new Date().toISOString();

  if (mock) {
    mockSlugCache = { greenhouse: ghSlugs, ashby: asSlugs, fetchedAt };
  } else {
    discoveredDb.writeDiscovered({
      ...store,
      slugCache: { greenhouse: ghSlugs, ashby: asSlugs, fetchedAt },
    });
  }

  onProgress?.({ step: 'done', status: 'done' });
  return { greenhouse: ghSlugs.length, ashby: asSlugs.length, cached: false, fetchedAt };
}

// ── Stage 2: Discover ────────────────────────────────────────────────
// Uses the already-mined company list (never re-mines) to fetch job
// postings, classify/score them against the profile, and surface matches.

export type DiscoveryStepName = 'scan-ashby' | 'scan-greenhouse' | 'classify' | 'done';

export interface DiscoveryProgress {
  step: DiscoveryStepName;
  status: 'running' | 'done';
  count?: number;
  cachedCompanies?: number;
  fetchedCompanies?: number;
}

async function discoverJobs(
  profile: Profile,
  onProgress?: (progress: DiscoveryProgress) => void,
): Promise<ScanJob[]> {
  const store = discoveredDb.readDiscovered();
  const mock = isMockDiscoverEnabled();

  const ghSlugs = mock ? mockSlugCache?.greenhouse : store.slugCache?.greenhouse;
  const asSlugs = mock ? mockSlugCache?.ashby : store.slugCache?.ashby;

  if (!ghSlugs || !asSlugs || (ghSlugs.length === 0 && asSlugs.length === 0)) {
    throw new Error('No companies found — run Scan Companies first.');
  }

  const fetchGH = mock ? mockDiscover.fetchGreenhouse : fetchGreenhouse;
  const fetchAS = mock ? mockDiscover.fetchAshby : fetchAshby;

  // Mock mode never persists a job cache (mirrors mockSlugCache's "never
  // written to disk" convention) — every slug is treated as stale so mock
  // fetchers run every time, same as before caching existed.
  const jobCache: JobCacheStore = mock ? { greenhouse: {}, ashby: {} } : jobCacheDb.readJobCache();
  const ghPartition = partitionSlugs(ghSlugs, jobCache.greenhouse);
  const asPartition = partitionSlugs(asSlugs, jobCache.ashby);

  const fetchedAt = new Date().toISOString();

  onProgress?.({ step: 'scan-ashby', status: 'running' });
  onProgress?.({ step: 'scan-greenhouse', status: 'running' });

  // Independent APIs — run both concurrently instead of sequentially.
  const [ghFetchResults, asFetchResults] = await Promise.all([
    runBatched(ghPartition.staleSlugs, (slug) => fetchGH(slug, slugToName(slug))),
    runBatched(asPartition.staleSlugs, (slug) => fetchAS(slug, slugToName(slug))),
  ]);

  const gh = resolveSourceJobs(ghPartition.cachedSlugs, ghPartition.staleSlugs, ghFetchResults, jobCache.greenhouse, fetchedAt);
  onProgress?.({
    step: 'scan-greenhouse',
    status: 'done',
    count: gh.jobs.length,
    cachedCompanies: ghPartition.cachedSlugs.length,
    fetchedCompanies: gh.fetchedCount,
  });

  const as = resolveSourceJobs(asPartition.cachedSlugs, asPartition.staleSlugs, asFetchResults, jobCache.ashby, fetchedAt);
  onProgress?.({
    step: 'scan-ashby',
    status: 'done',
    count: as.jobs.length,
    cachedCompanies: asPartition.cachedSlugs.length,
    fetchedCompanies: as.fetchedCount,
  });

  if (!mock) {
    jobCacheDb.writeJobCache({ greenhouse: gh.nextCache, ashby: as.nextCache });
  }

  const ghJobs = gh.jobs;
  const asJobs = as.jobs;

  const allJobs = [...ghJobs, ...asJobs];
  const existingUrls = new Set(db.readJobs().map((j) => canonicalizeJobUrl(j.url)));
  const dismissedUrls = new Set(dismissedDb.readDismissed().map(canonicalizeJobUrl));

  const dedupSeen = new Set<string>();
  const deduped = allJobs.filter((job) => {
    const url = canonicalizeJobUrl(job.url);
    if (existingUrls.has(url) || dismissedUrls.has(url) || dedupSeen.has(url)) return false;
    dedupSeen.add(url);
    return true;
  });

  const filtered = shortlistJobs(deduped, profile, deduped.length);
  const companyDeduped = keepBestJobPerCompany(filtered);
  const sorted = shortlistJobs(companyDeduped, profile, MAX_SHORTLIST_SIZE);

  // Classify companies by vertical (auxiliary metadata, not shown in the job list)
  onProgress?.({ step: 'classify', status: 'running' });
  const bySlug = new Map<string, { name: string; ats: 'greenhouse' | 'ashby'; titles: string[] }>();
  for (const job of [...ghJobs, ...asJobs]) {
    const slug = extractSlugFromUrl(job.url);
    if (!slug) continue;
    const ats = ghJobs.includes(job) ? 'greenhouse' : 'ashby';
    const entry = bySlug.get(slug) ?? { name: job.company, ats, titles: [] };
    entry.titles.push(job.title);
    bySlug.set(slug, entry);
  }
  const toClassify = [...bySlug.entries()].map(([slug, v]) => ({ slug, ...v }));
  const verticals = await classifyCompanies(toClassify);
  onProgress?.({ step: 'classify', status: 'done', count: Object.keys(verticals).length });

  const now = fetchedAt;
  const indexUpdates: Record<string, CompanyEntry> = {};
  for (const { slug, name, ats } of toClassify) {
    indexUpdates[slug] = { slug, name, ats, vertical: verticals[slug] ?? null, classifiedAt: now };
  }

  // Merge into the existing persisted batch rather than replacing it, so a
  // prior run's results aren't silently wiped from disk.
  const mergedBatch = mergeDiscoveredBatch(store.batch, sorted);

  discoveredDb.writeDiscovered({
    ...store,
    batch: mergedBatch,
    lastSourcedAt: now,
    companyIndex: { ...(store.companyIndex ?? {}), ...indexUpdates },
  });

  onProgress?.({ step: 'done', status: 'done', count: mergedBatch.length });
  return mergedBatch;
}

// ── IPC handler registration ──────────────────────────────────────

export function registerScanHandlers(): void {
  ipcMain.handle(IPC.SCAN_COMPANIES, async (event: IpcMainInvokeEvent) => {
    return scanCompanies((progress) => {
      event.sender.send(IPC.SCAN_PROGRESS, { source: progress.step, count: progress.count ?? 0 });
    });
  });

  ipcMain.handle(IPC.SCAN_COMPANIES_STATUS, () => {
    const cache = isMockDiscoverEnabled() ? mockSlugCache : discoveredDb.readDiscovered().slugCache;
    return {
      greenhouse: cache?.greenhouse.length ?? 0,
      ashby: cache?.ashby.length ?? 0,
      fetchedAt: cache?.fetchedAt ?? null,
    };
  });

  ipcMain.handle(IPC.SCAN_DISCOVER, async (event: IpcMainInvokeEvent) => {
    const profile = loadProfile();

    return discoverJobs(profile, (progress) => {
      event.sender.send(IPC.SCAN_PROGRESS, {
        source: progress.step,
        count: progress.count ?? 0,
        cachedCompanies: progress.cachedCompanies,
        fetchedCompanies: progress.fetchedCompanies,
      });
    });
  });

  ipcMain.handle(IPC.SCAN_READ_DISCOVERED, () => {
    return discoveredDb.readDiscovered().batch;
  });
}
