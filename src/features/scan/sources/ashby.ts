import type { ScanJob } from '../../../shared/models/types.js';

interface AshbyJob {
  id: string;
  title: string;
  isRemote: boolean;
  locationName?: string;
  employmentType?: string;
  jobUrl?: string;
  applyUrl?: string;
}

interface AshbyResponse {
  jobPostings?: AshbyJob[];
  jobs?: AshbyJob[]; // some versions use this key
}

export async function fetchAshby(slug: string, companyName: string): Promise<ScanJob[]> {
  const url = `https://api.ashbyhq.com/posting-api/job-board/${slug}`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'open-positions/1.0',
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = await res.json() as AshbyResponse;
    const jobs = data.jobPostings ?? data.jobs ?? [];
    return jobs.map((job) => ({
      title: job.title,
      company: companyName,
      url: job.jobUrl ?? job.applyUrl ?? `https://jobs.ashbyhq.com/${slug}`,
      source: 'ashby' as const,
      score: 0,
      snippet: job.locationName ?? (job.isRemote ? 'Remote' : undefined),
    }));
  } catch {
    return [];
  }
}
