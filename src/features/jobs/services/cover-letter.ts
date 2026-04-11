import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { query } from '@anthropic-ai/claude-code';
import { answersDb } from '../../../shared/data/db.js';
import type { AnswerEntry, GeneratedCoverLetter, Job, Profile } from '../../../shared/models/types.js';
import { buildWritingGuidance } from '../../../shared/ai/writing-guidance.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const GENERATE_PROMPT = readFileSync(
  join(__dirname, 'prompts', 'generate-cover-letter.md'),
  'utf8',
);

function buildProfileSummary(profile: Profile): string {
  const recentRoles = profile.experiences
    .slice(0, 3)
    .map((experience) => `${experience.role} at ${experience.company}`)
    .join(', ');

  return [
    `Name: ${profile.candidate.name}`,
    `Headline: ${profile.headline}`,
    `Summary: ${profile.summary}`,
    `Location: ${profile.candidate.location}`,
    `Email: ${profile.candidate.email}`,
    `Site: ${profile.candidate.site}`,
    `Skills: ${profile.skills.join(', ')}`,
    recentRoles ? `Recent experience: ${recentRoles}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildJobContext(job: Pick<Job, 'company' | 'role' | 'jdSummary' | 'jd' | 'url'>): string {
  const summary = (job.jdSummary || job.jd || '').trim();
  return [
    `Company: ${job.company || 'Unknown Company'}`,
    `Role: ${job.role || 'Unknown Role'}`,
    job.url ? `URL: ${job.url}` : '',
    summary ? `Job Description Summary:\n${summary.slice(0, 2500)}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function selectRelevantAnswers(
  answers: AnswerEntry[],
  job: Pick<Job, 'company' | 'role'>,
): AnswerEntry[] {
  const matchingCompany = answers.filter((answer) => answer.company === job.company);
  const matchingRole = answers.filter((answer) => answer.role === job.role);
  const recent = [...answers].sort((a, b) => b.revised.localeCompare(a.revised));
  const combined = [...matchingCompany, ...matchingRole, ...recent];
  const unique = combined.filter(
    (answer, index) => combined.findIndex((candidate) => candidate.id === answer.id) === index,
  );
  return unique.slice(0, 5);
}

function buildAnswerVoiceContext(answers: AnswerEntry[]): string {
  if (answers.length === 0) {
    return [
      'No saved answers are available.',
      'Infer a professional but natural voice using the cover letter guidance only.',
    ].join('\n');
  }

  return answers
    .map((answer) => [
      `Question: ${answer.question}`,
      `Tone: ${answer.tone}`,
      answer.context.trim() ? `Candidate Notes: ${answer.context.trim()}` : '',
      `Answer Sample: ${answer.answer.trim()}`,
    ]
      .filter(Boolean)
      .join('\n'))
    .join('\n\n---\n\n');
}

export interface GenerateCoverLetterInput {
  job: Pick<Job, 'company' | 'role' | 'jdSummary' | 'jd' | 'url'>;
  profile: Profile;
  tailoringNotes?: string;
}

export function buildGenerateCoverLetterPrompt(
  input: GenerateCoverLetterInput,
  answers = answersDb.readAnswers(),
): string {
  const relevantAnswers = selectRelevantAnswers(answers, input.job);

  return `${GENERATE_PROMPT}

---

${buildWritingGuidance('cover-letter')}

---

## Candidate Background

${buildProfileSummary(input.profile)}

---

## Company and Role Context

${buildJobContext(input.job)}

---

## Saved Answers Voice Reference

Use these to mirror tone, sentence discipline, and boundaries. Reuse the style, not the wording.

${buildAnswerVoiceContext(relevantAnswers)}

---

## Application Guidance

${input.tailoringNotes?.trim() || 'No additional guidance provided. Use the strongest truthful fit from the role and candidate background.'}

OUTPUT ONLY VALID JSON. NO EXPLANATION. NO MARKDOWN.`;
}

export function parseGeneratedCoverLetter(text: string): GeneratedCoverLetter {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON found in cover letter generation response');

  const parsed = JSON.parse(jsonMatch[0]) as Partial<GeneratedCoverLetter>;

  if (!parsed.name) throw new Error('Missing name in generated cover letter');
  if (!parsed.contact?.email) throw new Error('Missing contact in generated cover letter');
  if (!parsed.company) throw new Error('Missing company in generated cover letter');
  if (!parsed.role) throw new Error('Missing role in generated cover letter');
  if (!Array.isArray(parsed.paragraphs) || parsed.paragraphs.length !== 2) {
    throw new Error('Generated cover letter must contain exactly two paragraphs');
  }

  return {
    ...parsed,
    paragraphs: [parsed.paragraphs[0]!, parsed.paragraphs[1]!],
  } as GeneratedCoverLetter;
}

export async function generateCoverLetter(
  job: Pick<Job, 'company' | 'role' | 'jdSummary' | 'jd' | 'url'>,
  profile: Profile,
  tailoringNotes = '',
): Promise<GeneratedCoverLetter> {
  const prompt = buildGenerateCoverLetterPrompt({
    job,
    profile,
    tailoringNotes,
  });

  let responseText = '';
  for await (const message of query({ prompt, options: { maxTurns: 1 } })) {
    if (message.type === 'result' && message.subtype === 'success') {
      responseText = message.result;
    }
  }

  return parseGeneratedCoverLetter(responseText);
}
