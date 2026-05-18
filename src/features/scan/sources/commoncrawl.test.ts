import { describe, expect, it } from 'vitest';

import { fetchCCCrawlId, fetchAshbySlugs, fetchGreenhouseSlugs } from './commoncrawl.js';

type FetchArgs = [string | URL | Request, RequestInit?];

function mockFetch(handler: (url: string) => Response | Promise<Response>) {
  const original = globalThis.fetch;
  globalThis.fetch = (async (...args: FetchArgs) => {
    const url = typeof args[0] === 'string' ? args[0] : args[0] instanceof URL ? args[0].toString() : (args[0] as Request).url;
    return handler(url);
  }) as typeof fetch;
  return () => { globalThis.fetch = original; };
}

function ndjson(urls: string[]): string {
  return urls.map((u) => JSON.stringify({ url: u })).join('\n');
}

describe('fetchCCCrawlId', () => {
  it('extracts the latest crawl id from collinfo.json', async () => {
    const restore = mockFetch(async () =>
      new Response(JSON.stringify([{ id: 'CC-MAIN-2026-17' }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }) as Response,
    );
    try {
      await expect(fetchCCCrawlId()).resolves.toBe('CC-MAIN-2026-17');
    } finally {
      restore();
    }
  });

  it('fails when collinfo.json returns no crawls', async () => {
    const restore = mockFetch(async () =>
      new Response(JSON.stringify([]), { status: 200 }) as Response,
    );
    try {
      await expect(fetchCCCrawlId()).rejects.toThrow('No CC crawls found');
    } finally {
      restore();
    }
  });
});

describe('fetchAshbySlugs', () => {
  it('returns slugs sorted by frequency across pages', async () => {
    const restore = mockFetch(async (url) => {
      if (url.includes('showNumPages=true')) {
        return new Response('2', { status: 200 }) as Response;
      }
      if (url.includes('page=0')) {
        return new Response(
          ndjson([
            'https://jobs.ashbyhq.com/stripe/senior-engineer',
            'https://jobs.ashbyhq.com/stripe/product-manager',
            'https://jobs.ashbyhq.com/notion/data-scientist',
          ]),
          { status: 200 },
        ) as Response;
      }
      if (url.includes('page=1')) {
        return new Response(
          ndjson([
            'https://jobs.ashbyhq.com/stripe/frontend-eng',
            'https://jobs.ashbyhq.com/retool/staff-engineer',
          ]),
          { status: 200 },
        ) as Response;
      }
      return new Response('', { status: 404 }) as Response;
    });

    try {
      const slugs = await fetchAshbySlugs('CC-MAIN-2026-17');
      // stripe appears 3x, notion and retool appear 1x each
      expect(slugs[0]).toBe('stripe');
      expect(slugs).toContain('notion');
      expect(slugs).toContain('retool');
      expect(slugs).toHaveLength(3);
    } finally {
      restore();
    }
  });

  it('filters out numeric slugs, percent-encoded slugs, and robots.txt', async () => {
    const restore = mockFetch(async (url) => {
      if (url.includes('showNumPages=true')) return new Response('1', { status: 200 }) as Response;
      return new Response(
        ndjson([
          'https://jobs.ashbyhq.com/12345/job',       // numeric slug — filtered
          'https://jobs.ashbyhq.com/hello%20world/job', // percent-encoded — filtered
          'https://jobs.ashbyhq.com/robots.txt',        // robots.txt — filtered
          'https://jobs.ashbyhq.com/linear/eng-role',   // valid
        ]),
        { status: 200 },
      ) as Response;
    });

    try {
      const slugs = await fetchAshbySlugs('CC-MAIN-2026-17');
      expect(slugs).toEqual(['linear']);
    } finally {
      restore();
    }
  });

  it('handles plain URL lines (non-JSON) in addition to JSON objects', async () => {
    const restore = mockFetch(async (url) => {
      if (url.includes('showNumPages=true')) return new Response('1', { status: 200 }) as Response;
      // mix of JSON and plain URL strings
      const body = [
        JSON.stringify({ url: 'https://jobs.ashbyhq.com/figma/designer' }),
        'https://jobs.ashbyhq.com/figma/product-eng',
        'https://jobs.ashbyhq.com/vercel/infra-eng',
      ].join('\n');
      return new Response(body, { status: 200 }) as Response;
    });

    try {
      const slugs = await fetchAshbySlugs('CC-MAIN-2026-17');
      expect(slugs[0]).toBe('figma'); // 2 hits
      expect(slugs).toContain('vercel');
    } finally {
      restore();
    }
  });

  it('falls back to 1 page when page-count request fails', async () => {
    const restore = mockFetch(async (url) => {
      if (url.includes('showNumPages=true')) return new Response('', { status: 500 }) as Response;
      // only page=0 should be requested
      if (url.includes('page=0')) {
        return new Response(
          ndjson(['https://jobs.ashbyhq.com/rippling/hr-engineer']),
          { status: 200 },
        ) as Response;
      }
      return new Response('', { status: 404 }) as Response;
    });

    try {
      const slugs = await fetchAshbySlugs('CC-MAIN-2026-17');
      expect(slugs).toEqual(['rippling']);
    } finally {
      restore();
    }
  });

  it('skips failed pages and returns slugs from successful ones', async () => {
    const restore = mockFetch(async (url) => {
      if (url.includes('showNumPages=true')) return new Response('3', { status: 200 }) as Response;
      if (url.includes('page=0')) {
        return new Response(
          ndjson(['https://jobs.ashbyhq.com/openai/researcher']),
          { status: 200 },
        ) as Response;
      }
      if (url.includes('page=1')) return new Response('', { status: 500 }) as Response; // failed
      if (url.includes('page=2')) {
        return new Response(
          ndjson(['https://jobs.ashbyhq.com/anthropic/safety-eng']),
          { status: 200 },
        ) as Response;
      }
      return new Response('', { status: 404 }) as Response;
    });

    try {
      const slugs = await fetchAshbySlugs('CC-MAIN-2026-17');
      expect(slugs).toContain('openai');
      expect(slugs).toContain('anthropic');
    } finally {
      restore();
    }
  });

  it('returns empty array when no valid slugs found', async () => {
    const restore = mockFetch(async (url) => {
      if (url.includes('showNumPages=true')) return new Response('1', { status: 200 }) as Response;
      return new Response('', { status: 200 }) as Response; // empty body
    });

    try {
      const slugs = await fetchAshbySlugs('CC-MAIN-2026-17');
      expect(slugs).toEqual([]);
    } finally {
      restore();
    }
  });
});

describe('fetchGreenhouseSlugs', () => {
  it('uses boards.greenhouse.io hostname and returns correct slugs', async () => {
    const restore = mockFetch(async (url) => {
      if (url.includes('showNumPages=true')) return new Response('1', { status: 200 }) as Response;
      return new Response(
        ndjson([
          'https://boards.greenhouse.io/airbnb/jobs/123',
          'https://boards.greenhouse.io/airbnb/jobs/456',
          'https://boards.greenhouse.io/databricks/jobs/789',
          // Ashby URL — should NOT appear (wrong hostname)
          'https://jobs.ashbyhq.com/stripe/eng',
        ]),
        { status: 200 },
      ) as Response;
    });

    try {
      const slugs = await fetchGreenhouseSlugs('CC-MAIN-2026-17');
      expect(slugs[0]).toBe('airbnb'); // 2 hits
      expect(slugs).toContain('databricks');
      expect(slugs).not.toContain('stripe');
    } finally {
      restore();
    }
  });
});
