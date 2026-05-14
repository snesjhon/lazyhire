const CC_BASE = 'https://index.commoncrawl.org';
const PAGE_SIZE = 10_000;
const MAX_PAGES = 5;

export interface SlugList {
  greenhouse: string[];
  ashby: string[];
}

async function getLatestCrawlId(): Promise<string> {
  const res = await fetch(`${CC_BASE}/collinfo.json`, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`CC collinfo fetch failed: ${res.status}`);
  const data = await res.json() as Array<{ id: string }>;
  if (!data.length) throw new Error('No CC crawls found');
  return data[0].id;
}

function parseSlug(rawUrl: string, hostname: string): string | null {
  try {
    const u = new URL(rawUrl);
    if (u.hostname !== hostname) return null;
    const parts = u.pathname.split('/').filter(Boolean);
    const slug = parts[0];
    if (!slug) return null;
    if (/^\d+$/.test(slug)) return null;
    if (slug.includes('%') || slug.includes(')')) return null;
    if (slug === 'robots.txt') return null;
    return slug.toLowerCase();
  } catch {
    return null;
  }
}

async function fetchSlugsSorted(
  crawlId: string,
  urlPattern: string,
  hostname: string,
): Promise<string[]> {
  const freq = new Map<string, number>();

  let totalPages = 1;
  try {
    const countUrl =
      `${CC_BASE}/${crawlId}-index` +
      `?url=${encodeURIComponent(urlPattern)}&output=json&fl=url&pageSize=${PAGE_SIZE}&showNumPages=true`;
    const countRes = await fetch(countUrl, { signal: AbortSignal.timeout(15_000) });
    if (countRes.ok) {
      const text = (await countRes.text()).trim();
      const n = parseInt(text, 10);
      if (!isNaN(n) && n > 0) totalPages = n;
    }
  } catch {
    // fall through — try at least one page
  }

  const pagesToFetch = Math.min(totalPages, MAX_PAGES);

  for (let page = 0; page < pagesToFetch; page++) {
    const queryUrl =
      `${CC_BASE}/${crawlId}-index` +
      `?url=${encodeURIComponent(urlPattern)}&output=json&fl=url&page=${page}&pageSize=${PAGE_SIZE}`;
    try {
      const res = await fetch(queryUrl, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) continue;
      const text = await res.text();
      for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let rawUrl = trimmed;
        try {
          const obj = JSON.parse(trimmed) as { url?: string };
          rawUrl = obj.url ?? trimmed;
        } catch {
          // treat as plain URL string
        }
        const slug = parseSlug(rawUrl, hostname);
        if (slug) freq.set(slug, (freq.get(slug) ?? 0) + 1);
      }
    } catch {
      // skip failed pages
    }
  }

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([slug]) => slug);
}

export async function fetchCCSlugs(): Promise<SlugList> {
  const crawlId = await getLatestCrawlId();

  const [greenhouse, ashby] = await Promise.all([
    fetchSlugsSorted(crawlId, 'boards.greenhouse.io/*', 'boards.greenhouse.io'),
    fetchSlugsSorted(crawlId, 'jobs.ashbyhq.com/*', 'jobs.ashbyhq.com'),
  ]);

  return { greenhouse, ashby };
}
