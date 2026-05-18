import type { DiscoveredJob, DiscoveredStore, Profile, ScanJob } from '../../shared/models/types.js';
import { db } from '../../shared/data/db.js';
import { discoveredDb } from '../../shared/data/discoveredDb.js';
import { dismissedDb } from '../../shared/data/dismissedDb.js';
import { fetchCCCrawlId, fetchGreenhouseSlugs, fetchAshbySlugs } from './sources/commoncrawl.js';
import { fetchGreenhouse } from './sources/greenhouse.js';
import { fetchAshby } from './sources/ashby.js';
import { canonicalizeJobUrl, shortlistJobs, keepBestJobPerCompany } from './scan.js';

const SLUGS_PER_RUN = 120;
const BATCH_SIZE = 40;
const SLICE_SIZE = 10;
const FETCH_CONCURRENCY = 10;
const FILTER_MAX = 400;
const SLUG_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

async function runBatchAts<T>(
  items: T[],
  fn: (item: T) => Promise<ScanJob[]>,
): Promise<ScanJob[]> {
  const results: ScanJob[] = [];
  for (let i = 0; i < items.length; i += FETCH_CONCURRENCY) {
    const batch = items.slice(i, i + FETCH_CONCURRENCY);
    const settled = await Promise.allSettled(batch.map(fn));
    for (const r of settled) {
      if (r.status === 'fulfilled') results.push(...r.value);
    }
  }
  return results;
}

function slugToName(slug: string): string {
  return slug
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function extractSlugFromUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname.split('/').filter(Boolean)[0] ?? '';
  } catch {
    return '';
  }
}

function toDiscoveredJob(job: ScanJob): DiscoveredJob {
  return {
    slug: extractSlugFromUrl(job.url),
    name: job.company,
    ats: job.source as 'greenhouse' | 'ashby',
    jobTitle: job.title,
    jobUrl: canonicalizeJobUrl(job.url),
    score: job.score,
    snippet: job.snippet ?? null,
    status: 'pending',
  };
}

function readSlugCache(store: DiscoveredStore): DiscoveredStore | null {
  const cache = store.slugCache;
  if (!cache) return null;
  const age = Date.now() - new Date(cache.fetchedAt).getTime();
  if (age >= SLUG_CACHE_TTL_MS) return null;
  if (cache.greenhouse.length === 0 && cache.ashby.length === 0) return null;
  return store;
}

export type DiscoveryStepName = 'cc-greenhouse' | 'cc-ashby' | 'scan-ashby' | 'scan-greenhouse' | 'done';

export interface DiscoveryProgress {
  step: DiscoveryStepName;
  status: 'running' | 'done' | 'cached' | 'failed';
  count?: number;
  error?: string;
}

export async function runDiscovery(
  profile: Profile,
  onProgress?: (progress: DiscoveryProgress) => void,
): Promise<void> {
  let store = discoveredDb.readDiscovered();
  const cached = readSlugCache(store);

  let ghSlugs: string[];
  let asSlugs: string[];

  if (cached) {
    store = cached;
    ghSlugs = store.slugCache!.greenhouse;
    asSlugs = store.slugCache!.ashby;
    onProgress?.({ step: 'cc-greenhouse', status: 'cached', count: ghSlugs.length });
    onProgress?.({ step: 'cc-ashby', status: 'cached', count: asSlugs.length });
  } else {
    const crawlId = await fetchCCCrawlId();

    onProgress?.({ step: 'cc-greenhouse', status: 'running' });
    ghSlugs = await fetchGreenhouseSlugs(crawlId);
    onProgress?.({ step: 'cc-greenhouse', status: 'done', count: ghSlugs.length });

    onProgress?.({ step: 'cc-ashby', status: 'running' });
    asSlugs = await fetchAshbySlugs(crawlId);
    onProgress?.({ step: 'cc-ashby', status: 'done', count: asSlugs.length });

    if (ghSlugs.length === 0 && asSlugs.length === 0) {
      throw new Error('Common Crawl returned no slugs for Greenhouse or Ashby — fetch may have timed out or the index is unavailable.');
    }

    store = {
      ...store,
      cursor: { greenhouse: 0, ashby: 0 },
      slugCache: {
        greenhouse: ghSlugs,
        ashby: asSlugs,
        fetchedAt: new Date().toISOString(),
      },
    };
  }

  const ghSlice = ghSlugs.slice(store.cursor.greenhouse, store.cursor.greenhouse + SLUGS_PER_RUN);
  const asSlice = asSlugs.slice(store.cursor.ashby, store.cursor.ashby + SLUGS_PER_RUN);

  onProgress?.({ step: 'scan-ashby', status: 'running' });
  const asJobs = await runBatchAts(asSlice, (slug) => fetchAshby(slug, slugToName(slug)));
  onProgress?.({ step: 'scan-ashby', status: 'done', count: asJobs.length });

  onProgress?.({ step: 'scan-greenhouse', status: 'running' });
  const ghJobs = await runBatchAts(ghSlice, (slug) => fetchGreenhouse(slug, slugToName(slug)));
  onProgress?.({ step: 'scan-greenhouse', status: 'done', count: ghJobs.length });

  const allJobs = [...ghJobs, ...asJobs];

  const existingUrls = new Set(
    db.readJobs().map((j) => canonicalizeJobUrl(j.url)),
  );
  const dismissedUrls = new Set(
    dismissedDb.readDismissed().map(canonicalizeJobUrl),
  );

  const dedupSeen = new Set<string>();
  const deduped = allJobs.filter((job) => {
    const url = canonicalizeJobUrl(job.url);
    if (existingUrls.has(url) || dismissedUrls.has(url) || dedupSeen.has(url)) return false;
    dedupSeen.add(url);
    return true;
  });

  const filtered = shortlistJobs(deduped, profile, FILTER_MAX);
  const companyDeduped = keepBestJobPerCompany(filtered);
  const sorted = companyDeduped.sort((a, b) => b.score - a.score);

  const newBatch = sorted.slice(0, BATCH_SIZE).map(toDiscoveredJob);
  const newQueue = sorted.slice(BATCH_SIZE).map(toDiscoveredJob);

  const nextStore: DiscoveredStore = {
    ...store,
    batch: newBatch,
    batchOffset: 0,
    queue: newQueue,
    cursor: {
      greenhouse: store.cursor.greenhouse + ghSlice.length,
      ashby: store.cursor.ashby + asSlice.length,
    },
    lastSourcedAt: new Date().toISOString(),
  };

  discoveredDb.writeDiscovered(nextStore);

  onProgress?.({ step: 'done', status: 'done', count: newBatch.length });
}

export function getActiveSlice(): DiscoveredJob[] {
  const store = discoveredDb.readDiscovered();
  return store.batch.slice(store.batchOffset, store.batchOffset + SLICE_SIZE);
}

export function markActed(jobUrl: string, status: 'added' | 'passed'): void {
  const store = discoveredDb.readDiscovered();
  const canonical = canonicalizeJobUrl(jobUrl);

  for (const job of store.batch) {
    if (canonicalizeJobUrl(job.jobUrl) === canonical) {
      job.status = status;
      break;
    }
  }

  discoveredDb.writeDiscovered(store);
}

export function advanceSlice(): boolean {
  const store = discoveredDb.readDiscovered();
  const nextOffset = store.batchOffset + SLICE_SIZE;

  if (nextOffset >= BATCH_SIZE) return false;

  discoveredDb.writeDiscovered({ ...store, batchOffset: nextOffset });
  return true;
}

export function retreatSlice(): boolean {
  const store = discoveredDb.readDiscovered();
  const prevOffset = store.batchOffset - SLICE_SIZE;

  if (prevOffset < 0) return false;

  discoveredDb.writeDiscovered({ ...store, batchOffset: prevOffset });
  return true;
}

export function getPendingCount(): { batch: number; queue: number } {
  const store = discoveredDb.readDiscovered();
  return {
    batch: store.batch.filter((j) => j.status === 'pending').length,
    queue: store.queue.filter((j) => j.status === 'pending').length,
  };
}

export function getBatchPending(): DiscoveredJob[] {
  const store = discoveredDb.readDiscovered();
  return store.batch.filter((j) => j.status === 'pending');
}

function persistScanResults(store: DiscoveredStore, jobs: ScanJob[], profile: Profile, cursors: { greenhouse?: number; ashby?: number }): number {
  const existingUrls = new Set(db.readJobs().map((j) => canonicalizeJobUrl(j.url)));
  const dismissedUrls = new Set(dismissedDb.readDismissed().map(canonicalizeJobUrl));
  const dedupSeen = new Set<string>();
  const deduped = jobs.filter((job) => {
    const url = canonicalizeJobUrl(job.url);
    if (existingUrls.has(url) || dismissedUrls.has(url) || dedupSeen.has(url)) return false;
    dedupSeen.add(url);
    return true;
  });
  const filtered = shortlistJobs(deduped, profile, FILTER_MAX);
  const companyDeduped = keepBestJobPerCompany(filtered);
  const sorted = companyDeduped.sort((a, b) => b.score - a.score);
  const newBatch = sorted.slice(0, BATCH_SIZE).map(toDiscoveredJob);
  const newQueue = sorted.slice(BATCH_SIZE).map(toDiscoveredJob);
  discoveredDb.writeDiscovered({
    ...store,
    batch: newBatch,
    batchOffset: 0,
    queue: newQueue,
    cursor: {
      greenhouse: cursors.greenhouse ?? store.cursor.greenhouse,
      ashby: cursors.ashby ?? store.cursor.ashby,
    },
    lastSourcedAt: new Date().toISOString(),
  });
  return newBatch.length;
}

export async function runCCFetchGreenhouse(
  onProgress?: (p: DiscoveryProgress) => void,
): Promise<void> {
  onProgress?.({ step: 'cc-greenhouse', status: 'running' });
  try {
    const store = discoveredDb.readDiscovered();
    const crawlId = await fetchCCCrawlId();
    const slugs = await fetchGreenhouseSlugs(crawlId);
    if (slugs.length === 0) throw new Error('No slugs returned — CC index may be unavailable.');
    discoveredDb.writeDiscovered({
      ...store,
      cursor: { ...store.cursor, greenhouse: 0 },
      slugCache: {
        greenhouse: slugs,
        ashby: store.slugCache?.ashby ?? [],
        fetchedAt: new Date().toISOString(),
      },
    });
    onProgress?.({ step: 'cc-greenhouse', status: 'done', count: slugs.length });
    onProgress?.({ step: 'done', status: 'done' });
  } catch (e) {
    onProgress?.({ step: 'cc-greenhouse', status: 'failed', error: String(e) });
  }
}

export async function runCCFetchAshby(
  onProgress?: (p: DiscoveryProgress) => void,
): Promise<void> {
  onProgress?.({ step: 'cc-ashby', status: 'running' });
  try {
    const store = discoveredDb.readDiscovered();
    const crawlId = await fetchCCCrawlId();
    const slugs = await fetchAshbySlugs(crawlId);
    if (slugs.length === 0) throw new Error('No slugs returned — CC index may be unavailable.');
    discoveredDb.writeDiscovered({
      ...store,
      cursor: { ...store.cursor, ashby: 0 },
      slugCache: {
        greenhouse: store.slugCache?.greenhouse ?? [],
        ashby: slugs,
        fetchedAt: new Date().toISOString(),
      },
    });
    onProgress?.({ step: 'cc-ashby', status: 'done', count: slugs.length });
    onProgress?.({ step: 'done', status: 'done' });
  } catch (e) {
    onProgress?.({ step: 'cc-ashby', status: 'failed', error: String(e) });
  }
}

export async function runScanAshby(
  profile: Profile,
  onProgress?: (p: DiscoveryProgress) => void,
): Promise<void> {
  onProgress?.({ step: 'scan-ashby', status: 'running' });
  try {
    const store = discoveredDb.readDiscovered();
    const asSlugs = store.slugCache?.ashby ?? [];
    if (asSlugs.length === 0) throw new Error('No Ashby slugs in cache — run CC Fetch Ashby first.');
    const slice = asSlugs.slice(store.cursor.ashby, store.cursor.ashby + SLUGS_PER_RUN);
    const jobs = await runBatchAts(slice, (slug) => fetchAshby(slug, slugToName(slug)));
    onProgress?.({ step: 'scan-ashby', status: 'done', count: jobs.length });
    const newChoices = persistScanResults(store, jobs, profile, { ashby: store.cursor.ashby + slice.length });
    onProgress?.({ step: 'done', status: 'done', count: newChoices });
  } catch (e) {
    onProgress?.({ step: 'scan-ashby', status: 'failed', error: String(e) });
  }
}

export async function runScanGreenhouse(
  profile: Profile,
  onProgress?: (p: DiscoveryProgress) => void,
): Promise<void> {
  onProgress?.({ step: 'scan-greenhouse', status: 'running' });
  try {
    const store = discoveredDb.readDiscovered();
    const ghSlugs = store.slugCache?.greenhouse ?? [];
    if (ghSlugs.length === 0) throw new Error('No Greenhouse slugs in cache — run CC Fetch Greenhouse first.');
    const slice = ghSlugs.slice(store.cursor.greenhouse, store.cursor.greenhouse + SLUGS_PER_RUN);
    const jobs = await runBatchAts(slice, (slug) => fetchGreenhouse(slug, slugToName(slug)));
    onProgress?.({ step: 'scan-greenhouse', status: 'done', count: jobs.length });
    const newChoices = persistScanResults(store, jobs, profile, { greenhouse: store.cursor.greenhouse + slice.length });
    onProgress?.({ step: 'done', status: 'done', count: newChoices });
  } catch (e) {
    onProgress?.({ step: 'scan-greenhouse', status: 'failed', error: String(e) });
  }
}

export function loadNextBatch(): boolean {
  const store = discoveredDb.readDiscovered();

  if (store.queue.length === 0) return false;

  const newBatch = store.queue.slice(0, BATCH_SIZE);
  const newQueue = store.queue.slice(BATCH_SIZE);

  discoveredDb.writeDiscovered({
    ...store,
    batch: newBatch,
    batchOffset: 0,
    queue: newQueue,
  });

  return true;
}
