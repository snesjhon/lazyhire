import { query } from '@anthropic-ai/claude-code';
import type { ScanJob, Profile } from '../../../shared/models/types.js';

function buildQueries(profile: Profile): string[] {
  const role = profile.targets.roles[0] ?? 'Software Engineer';
  const remote = profile.targets.remote === 'full' ? 'remote' : '';
  const q = `"${role}" ${remote}`.trim();

  return [
    `site:job-boards.greenhouse.io OR site:boards.greenhouse.io ${q}`,
    `site:jobs.lever.co ${q}`,
    `site:jobs.ashbyhq.com ${q}`,
    `${q} TypeScript React`,
  ];
}

export async function fetchWebSearch(profile: Profile): Promise<ScanJob[]> {
  const queries = buildQueries(profile);

  const prompt = `You are a job discovery assistant. Run each of the following web searches and extract job listings from the results.

Searches to run:
${queries.map((q, i) => `${i + 1}. ${q}`).join('\n')}

For every result that is a real job posting (not a category page, company homepage, or search index), extract:
- title: the job title
- company: the company name
- url: the direct URL to that specific job posting
- source: one of "greenhouse", "lever", "ashby", or "other"

After running all searches, respond with ONLY a JSON array — no markdown, no explanation, no code fences:
[{"title":"...","company":"...","url":"...","source":"..."}]

If no results found, respond with exactly: []`;

  let responseText = '';
  try {
    for await (const message of query({
      prompt,
      options: {
        maxTurns: 20,
        allowedTools: ['WebSearch'],
      },
    })) {
      if (message.type === 'result' && message.subtype === 'success') {
        responseText = message.result;
      }
    }
  } catch {
    return [];
  }

  try {
    const match = responseText.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]) as Array<{
      title: string;
      company: string;
      url: string;
      source: string;
    }>;
    return parsed
      .filter((j) => j.title && j.company && j.url)
      .map((j) => ({
        title: j.title,
        company: j.company,
        url: j.url,
        source: 'websearch' as const,
        score: 0,
      }));
  } catch {
    return [];
  }
}
