# Sourcing

Extends the existing `scan` feature with an evergreen company discovery layer.
Today, `portals.ts` is a static hardcoded list. This adds a dynamic pool that
grows from Common Crawl data and persists across sessions.

---

## Problem with the current approach

`portals.ts` is a ~100-entry list that rarely gets updated. It covers known
companies well but has no mechanism for discovery — it can't surface companies
the user hasn't heard of, and it never grows on its own.

---

## The funnel

```
Source    ~1000 jobs   CC slugs → ATS APIs (batched, concurrent)
Filter      ~400 jobs  keyword score ≥ threshold against profile.targets
Show          40 jobs  top 40 by score → current batch, persisted
Rank          10 jobs  top 10 of batch shown at a time → user acts on each
                       → next 10 → next 10 → next 10
                       → "show another 40?" prompt
```

Each layer is a strict subset of the one above. No tokens are used until the
user explicitly adds a job to their pipeline.

### Source (~1000)

Mine Common Crawl for Greenhouse and Ashby board slugs. Query each slug's ATS
API. The raw yield is roughly 1000 jobs across all companies in the batch.

### Filter (~400)

Apply the existing `shortlistJobs(jobs, profile)` from `scan.ts`. This removes
negatives, off-target titles, and scores against `profile.targets.roles`,
`targets.focuses`, `targets.categories`. Jobs below `FALLBACK_RELEVANCE_SCORE`
are dropped. Dedup against `jobs.json` and `dismissed.json` (by canonical URL).
1:1 company selection via `keepBestJobPerCompany` — one job per company survives.
Result: ~400 scored, deduplicated, single-per-company candidates.

### Show (40)

Take the top 40 by score from the filtered set. This is the **current batch** —
persisted to `discovered.json` so the user can leave and return. The remaining
~360 stay queued behind the cursor.

### Rank (10 at a time)

Within the 40-job batch, show the top 10 first. Once the user has updated the
status of all 10 (add, dismiss, or skip), the next 10 are ranked and shown.
After all 4 groups of 10 are done, the app prompts: **"Show another 40?"**

Accepting loads the next 40 from the queued ~360. If the queue is exhausted,
the CC cursor advances and a new source run begins.

---

## Data files

All files live in `~/.lazyhire/` alongside `jobs.json`.

### `discovered.json`

```ts
interface DiscoveredStore {
  // Current batch: top 40 shown to user, 10 at a time
  batch: DiscoveredJob[];
  batchOffset: number;       // which group of 10 is active (0, 10, 20, 30)

  // Remaining filtered candidates behind the batch
  queue: DiscoveredJob[];

  // CC cursor — how far into the sorted slug list we've consumed
  cursor: {
    greenhouse: number;
    ashby: number;
  };

  lastSourcedAt: string;     // ISO date of last CC query
}

interface DiscoveredJob {
  slug: string;
  name: string;              // company name (title-cased slug until ATS confirms)
  ats: 'greenhouse' | 'ashby';
  jobTitle: string;
  jobUrl: string;            // canonicalized
  score: number;             // from rankJob()
  snippet: string | null;    // location or remote hint from ATS
  status: 'pending' | 'added' | 'passed';
  // pending — not yet seen
  // added   — user added to pipeline (job is now in jobs.json)
  // passed  — user said no to this posting (URL written to dismissed.json)
  //           company is NOT blacklisted; a new posting next quarter resurfaces
}
```

### `dismissed.json`

Job URLs the user passed on. Checked during dedup at filter time — passed jobs
never reappear unless the company posts a new role with a different URL.

```ts
interface DismissedStore {
  urls: string[]; // canonicalized
}
```

---

## Pipeline steps

### 1. Source

1. Fetch the latest CC index ID from `collinfo.json`.
2. Query CC for all Greenhouse and Ashby board URLs (`fl=url`, JSONL).
3. Parse slugs from URL paths. Filter out: numeric-only, slugs with `%` or `)`,
   `robots.txt`. Count frequency per slug.
4. Sort slugs descending by CC frequency (proxy for company size / hiring
   activity). Persist this sorted list.
5. Starting at `cursor.greenhouse` / `cursor.ashby`, take the next N slugs
   (enough to yield ~1000 jobs — typically ~100–150 slugs given average
   job counts per company). Advance the cursor.
6. Query each slug's ATS API using existing adapters:
   - `fetchGreenhouse(slug, name)` from `sources/greenhouse.ts`
   - `fetchAshby(slug, name)` from `sources/ashby.ts`
   - Concurrent, capped at 10 parallel requests via existing `runBatch`.

### 2. Filter

1. Run `shortlistJobs(allJobs, profile)` from `scan.ts` — scores and drops
   low-signal jobs.
2. Exclude URLs already in `jobs.json` (existing pipeline jobs).
3. Exclude URLs already in `dismissed.json`.
4. Run `keepBestJobPerCompany` — one surviving job per company.
5. Sort descending by score. Result is the filtered candidate set (~400).

### 3. Batch

1. Take top 40 from the filtered set → `discovered.json.batch`.
2. Remaining candidates → `discovered.json.queue`.
3. Set `batchOffset` to 0.

### 4. Rank and present

The active slice is `batch[batchOffset .. batchOffset + 10]`.

When the user acts on all 10 in the active slice:
- Increment `batchOffset` by 10.
- If `batchOffset < 40` → show next slice.
- If `batchOffset === 40` → prompt "Show another 40?"
  - Yes → pull next 40 from `queue` into `batch`, reset `batchOffset` to 0.
    If `queue` is exhausted, run a new source pass (advance CC cursor).
  - No → stay idle until user initiates.

---

## User actions per card

- **Add** → passes `jobUrl` to the existing `handleAddUrl` intake flow.
  Sets `status: 'added'`.
- **Pass** → appends `jobUrl` to `dismissed.json`. Sets `status: 'passed'`.
  The company stays in the pool; a new posting next quarter will surface cleanly.

Both actions advance the group of 10. A card stays `pending` within a session
until the user decides — but `pending` cards do not persist across sessions
(they return to the front of the active slice on next open).

---

## What this does NOT change

- `portals.ts` — unchanged. The existing scan flow continues to use it.
- `scan.ts` / `runScan` — unchanged. Discovery is a parallel flow.
- The job evaluation pipeline (AI, PDF, cover letter) — untouched.
- Lever — not included in CC discovery (Lever board URLs lack a consistent
  subdomain pattern in CC). Lever companies remain in `portals.ts` only.

---

## New files

```
src/features/scan/sources/commoncrawl.ts   CC fetch, slug parse, frequency rank
src/features/scan/discover.ts              source → filter → batch → rank orchestration
src/shared/data/discoveredDb.ts            read/write ~/.lazyhire/discovered.json
src/shared/data/dismissedDb.ts            read/write ~/.lazyhire/dismissed.json
```

### Public API of `discover.ts`

```ts
// Run source → filter → batch. Call when starting fresh or queue is empty.
export async function runDiscovery(profile: Profile): Promise<void>

// Load the current active slice (10 jobs) from the batch.
export function getActiveSlice(): DiscoveredJob[]

// Mark a card as added or passed (writing to jobs.json/dismissed.json is caller's responsibility).
export function markActed(jobUrl: string, status: 'added' | 'passed'): void

// Advance to next slice. Returns true if more remain, false if batch is done.
export function advanceSlice(): boolean

// Load the next 40 from the queue into the batch.
// Returns false if queue is empty (caller should trigger runDiscovery).
export function loadNextBatch(): boolean
```

UI wiring (feed screen, keyboard bindings, card layout) is out of scope for
this plan and will be designed separately.
