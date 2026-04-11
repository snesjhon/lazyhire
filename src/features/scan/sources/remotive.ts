import type { ScanJob } from '../../../shared/models/types.js';

interface RemotiveJob {
  id: number;
  url: string;
  title: string;
  company_name: string;
  tags: string[];
  job_type: string;
  publication_date: string;
}

interface RemotiveResponse {
  jobs: RemotiveJob[];
}

export async function fetchRemotive(roleKeywords: string[]): Promise<ScanJob[]> {
  // software-dev category covers frontend, fullstack, backend
  const url = 'https://remotive.com/api/remote-jobs?category=software-dev&limit=150';
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'open-positions/1.0' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = await res.json() as RemotiveResponse;
    const kwLower = roleKeywords.map((k) => k.toLowerCase());

    return (data.jobs ?? [])
      .filter((job) => {
        const titleLower = job.title.toLowerCase();
        return kwLower.some((k) => titleLower.includes(k.split(' ')[0]!));
      })
      .map((job) => ({
        title: job.title,
        company: job.company_name,
        url: job.url,
        source: 'remotive' as const,
        score: 0,
      }));
  } catch {
    return [];
  }
}
