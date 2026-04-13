import { readFileSync } from 'fs';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const result = await pdfParse(buffer);
  return result.text.trim();
}

export async function fetchPdfFromUrl(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch PDF from ${url}: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export function readPdfFromPath(filePath: string): Buffer {
  return readFileSync(filePath);
}

export interface ResumePreview {
  name: string | null;
  headline: string | null;
  email: string | null;
  phone: string | null;
  urls: string[];
  firstLines: string[];
  experienceSnippets: string[];
}

export function buildResumePreview(text: string): ResumePreview {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? null;
  const phone =
    text.match(/(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}/)?.[0] ?? null;
  const urls = Array.from(new Set(text.match(/https?:\/\/\S+/g) ?? [])).slice(0, 5);
  const name = lines.find((line) =>
    line.length > 2 &&
    line.length < 80 &&
    !line.includes('@') &&
    !/^https?:\/\//.test(line) &&
    !/\d{3}[-.\s)]?\d{3}[-.\s]?\d{4}/.test(line)
  ) ?? null;
  const headline = lines.find((line, index) =>
    index > 0 &&
    line.length > 5 &&
    line.length < 120 &&
    !line.includes('@') &&
    !/^https?:\/\//.test(line)
  ) ?? null;

  const dateLike = /(19|20)\d{2}|present|current|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i;
  const experienceSnippets: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    if (!dateLike.test(lines[index])) continue;

    const snippet = lines.slice(Math.max(0, index - 1), Math.min(lines.length, index + 3)).join(' | ');
    if (!experienceSnippets.includes(snippet)) {
      experienceSnippets.push(snippet);
    }
    if (experienceSnippets.length >= 5) break;
  }

  return {
    name,
    headline,
    email,
    phone,
    urls,
    firstLines: lines.slice(0, 8),
    experienceSnippets,
  };
}
