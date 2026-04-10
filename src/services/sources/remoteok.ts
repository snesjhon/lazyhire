import type { ScanJob } from '../../types.js';

interface RemoteOKJob {
  id?: string;
  url: string;
  title: string;
  company: string;
  tags?: string[];
  description?: string;
  date?: string;
}

const RELEVANT_TAGS = new Set([
  'javascript', 'typescript', 'react', 'reactjs', 'nextjs', 'next.js',
  'node', 'nodejs', 'frontend', 'front-end', 'fullstack', 'full-stack',
  'vue', 'vuejs', 'angular', 'web', 'ui', 'ux',
]);

export async function fetchRemoteOK(roleKeywords: string[]): Promise<ScanJob[]> {
  try {
    const res = await fetch('https://remoteok.io/remote-jobs.json', {
      headers: { 'User-Agent': 'open-positions/1.0' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const all = await res.json() as RemoteOKJob[];
    const jobs = all.slice(1); // first entry is legal notice

    const kwLower = roleKeywords.map((k) => k.toLowerCase());

    return jobs
      .filter((job) => {
        const tags = (job.tags ?? []).map((t) => t.toLowerCase());
        const titleLower = job.title.toLowerCase();
        const hasTag = tags.some((t) => RELEVANT_TAGS.has(t));
        const hasKw = kwLower.some((k) => titleLower.includes(k.split(' ')[0]!));
        return hasTag || hasKw;
      })
      .map((job) => ({
        title: job.title,
        company: job.company,
        url: job.url,
        source: 'remoteok' as const,
        score: 0,
      }));
  } catch {
    return [];
  }
}
