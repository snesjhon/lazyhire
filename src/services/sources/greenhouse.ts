import type { ScanJob } from '../../types.js';

interface GHJob {
  id: number;
  title: string;
  absolute_url: string;
  location: { name: string };
}

interface GHResponse {
  jobs: GHJob[];
}

export async function fetchGreenhouse(slug: string, companyName: string): Promise<ScanJob[]> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'open-positions/1.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = await res.json() as GHResponse;
    return (data.jobs ?? []).map((job) => ({
      title: job.title,
      company: companyName,
      url: job.absolute_url,
      source: 'greenhouse' as const,
      score: 0,
      snippet: job.location?.name,
    }));
  } catch {
    return [];
  }
}
