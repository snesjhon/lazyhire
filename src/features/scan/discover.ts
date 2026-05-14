import type { DiscoveredJob, DiscoveredStore, Profile, ScanJob } from '../../shared/models/types.js';
import { db } from '../../shared/data/db.js';
import { discoveredDb } from '../../shared/data/discoveredDb.js';
import { dismissedDb } from '../../shared/data/dismissedDb.js';
import { fetchCCSlugs } from './sources/commoncrawl.js';
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

async function ensureSlugCache(store: DiscoveredStore): Promise<DiscoveredStore> {
  const now = Date.now();
  const cacheAge = store.slugCache
    ? now - new Date(store.slugCache.fetchedAt).getTime()
    : Infinity;

  if (cacheAge < SLUG_CACHE_TTL_MS && store.slugCache) return store;

  const slugs = await fetchCCSlugs();
  return {
    ...store,
    cursor: { greenhouse: 0, ashby: 0 },
    slugCache: {
      greenhouse: slugs.greenhouse,
      ashby: slugs.ashby,
      fetchedAt: new Date().toISOString(),
    },
  };
}

export async function runDiscovery(profile: Profile): Promise<void> {
  let store = discoveredDb.readDiscovered();
  store = await ensureSlugCache(store);

  const ghSlugs = store.slugCache!.greenhouse;
  const asSlugs = store.slugCache!.ashby;

  const ghSlice = ghSlugs.slice(store.cursor.greenhouse, store.cursor.greenhouse + SLUGS_PER_RUN);
  const asSlice = asSlugs.slice(store.cursor.ashby, store.cursor.ashby + SLUGS_PER_RUN);

  const [ghJobs, asJobs] = await Promise.all([
    runBatchAts(ghSlice, (slug) => fetchGreenhouse(slug, slugToName(slug))),
    runBatchAts(asSlice, (slug) => fetchAshby(slug, slugToName(slug))),
  ]);

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
