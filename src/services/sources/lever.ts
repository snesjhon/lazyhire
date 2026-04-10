import type { ScanJob } from '../../types.js';

interface LeverPosting {
  id: string;
  text: string;
  hostedUrl: string;
  workplaceType?: string;
  categories?: {
    location?: string;
    team?: string;
  };
}

export async function fetchLever(slug: string, companyName: string): Promise<ScanJob[]> {
  const url = `https://api.lever.co/v0/postings/${slug}?mode=json`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'open-positions/1.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = await res.json() as LeverPosting[];
    if (!Array.isArray(data)) return [];
    return data.map((job) => ({
      title: job.text,
      company: companyName,
      url: job.hostedUrl,
      source: 'lever' as const,
      score: 0,
      snippet: job.categories?.location ?? job.workplaceType,
    }));
  } catch {
    return [];
  }
}
