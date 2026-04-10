import type { ScanJob } from '../../types.js';

interface AlgoliaHit {
  objectID: string;
  title?: string;
  comment_text?: string;
  author: string;
  points?: number;
}

interface AlgoliaResponse {
  hits: AlgoliaHit[];
}

const URL_RE = /https?:\/\/[^\s<>"]+/g;
const HTML_TAG_RE = /<[^>]+>/g;
const HTML_ENTITY_RE = /&[a-z]+;/g;

function stripHtml(html: string): string {
  return html
    .replace(HTML_TAG_RE, '\n')
    .replace(HTML_ENTITY_RE, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parseHNComment(text: string): { company: string; title: string; url: string } | null {
  const plain = stripHtml(text);
  const lines = plain.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  const firstLine = lines[0]!;

  // Extract first URL found in the comment
  const urls = plain.match(URL_RE) ?? [];
  const url = urls.find((u) => !u.includes('hn.algolia') && !u.includes('news.ycombinator')) ?? '';
  if (!url) return null;

  // Try "Company | Role | ..." format
  const parts = firstLine.split('|').map((p) => p.trim());
  if (parts.length >= 2) {
    return { company: parts[0]!, title: parts[1]!, url };
  }

  // Try "Company — Role" or "Company: Role"
  const dashMatch = firstLine.match(/^(.+?)[\u2014\u2013-]\s*(.+)$/);
  if (dashMatch) {
    return { company: dashMatch[1]!.trim(), title: dashMatch[2]!.trim(), url };
  }

  // Fall back: first line = title, author = company hint
  return { company: firstLine.slice(0, 40), title: firstLine, url };
}

export async function fetchHNHiring(roleKeywords: string[]): Promise<ScanJob[]> {
  try {
    // Find the most recent "Who is hiring?" thread
    const storyRes = await fetch(
      'https://hn.algolia.com/api/v1/search_by_date?query=Ask+HN+Who+is+hiring&tags=story&hitsPerPage=5',
      { signal: AbortSignal.timeout(8000) }
    );
    if (!storyRes.ok) return [];
    const storyData = await storyRes.json() as AlgoliaResponse;
    const thread = storyData.hits.find((h) =>
      h.title?.toLowerCase().includes('who is hiring')
    );
    if (!thread) return [];
    const threadId = thread.objectID;

    // Search comments in that thread for relevant roles
    const query = encodeURIComponent(roleKeywords.slice(0, 3).join(' OR ') + ' remote');
    const commentRes = await fetch(
      `https://hn.algolia.com/api/v1/search?query=${query}&tags=comment,story_${threadId}&hitsPerPage=100`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!commentRes.ok) return [];
    const commentData = await commentRes.json() as AlgoliaResponse;

    const results: ScanJob[] = [];
    for (const hit of commentData.hits) {
      if (!hit.comment_text) continue;
      const parsed = parseHNComment(hit.comment_text);
      if (!parsed) continue;
      results.push({
        title: parsed.title,
        company: parsed.company,
        url: parsed.url,
        source: 'hn-hiring' as const,
        score: 0,
        snippet: `HN thread ${threadId}`,
      });
    }
    return results;
  } catch {
    return [];
  }
}
