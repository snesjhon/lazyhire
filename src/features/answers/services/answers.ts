import { query } from '@anthropic-ai/claude-code';
import type { AnswerCategory, Job, Profile } from '../../../shared/models/types.js';
import { buildWritingGuidance } from '../../../shared/ai/writing-guidance.js';

export const TONE_OPTIONS = [
  'Professional',
  'Storytelling',
  'Concise',
  'Enthusiastic',
  'Humble',
] as const;

export type Tone = (typeof TONE_OPTIONS)[number];

const TONE_DESCRIPTIONS: Record<string, string> = {
  Professional: 'confident, formal, and results-driven — focused on impact and outcomes',
  Storytelling: 'narrative arc using the STAR format (Situation, Task, Action, Result) with a specific example',
  Concise: 'brief and direct, 2–3 sentences max, no filler words',
  Enthusiastic: 'energetic, passionate, and forward-looking — shows genuine excitement',
  Humble: 'collaborative, growth-minded, and self-aware — team-first framing',
};

const CATEGORY_DESCRIPTIONS: Record<AnswerCategory, string> = {
  identity: 'who you are, what drives you, your personal story or aspirations',
  motivation: 'why this company, why this role, what excites you about this opportunity',
  behavioral: 'a past experience or example demonstrating a skill or quality',
  strengths: 'what you excel at and what unique value you bring',
  vision: 'your goals, growth trajectory, and future aspirations',
  culture: 'how you work with others, your team style, or values alignment',
  situational: 'a hypothetical scenario asking what you would do',
  other: 'general interview question',
};

const VALID_CATEGORIES = new Set<string>([
  'identity', 'motivation', 'behavioral', 'strengths', 'vision', 'culture', 'situational', 'other',
]);

function buildProfileSummary(profile: Profile): string {
  const recentRoles = profile.experiences
    .slice(0, 3)
    .map((e) => `${e.role} at ${e.company}`)
    .join(', ');

  return [
    `Name: ${profile.candidate.name}`,
    `Headline: ${profile.headline}`,
    `Summary: ${profile.summary}`,
    `Skills: ${profile.skills.join(', ')}`,
    recentRoles ? `Recent experience: ${recentRoles}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildJobContext(
  job: Pick<Job, 'company' | 'role' | 'jdSummary' | 'jd' | 'url'> | null | undefined,
): string {
  if (!job) return '';

  const summary = (job.jdSummary || job.jd || '').trim();
  return [
    `Company: ${job.company || 'Unknown Company'}`,
    `Role: ${job.role || 'Unknown Role'}`,
    job.url ? `URL: ${job.url}` : '',
    summary ? `Job Description Summary:\n${summary.slice(0, 1800)}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

async function runQuery(prompt: string): Promise<string> {
  let result = '';
  for await (const message of query({ prompt, options: { maxTurns: 1 } })) {
    if (message.type === 'result' && message.subtype === 'success') {
      result = message.result;
    }
  }
  return result.trim();
}

export async function detectCategory(question: string): Promise<AnswerCategory> {
  const prompt = `Classify this interview question into exactly one of these categories:
identity, motivation, behavioral, strengths, vision, culture, situational, other

Definitions:
- identity: who you are, personal story, dreams, aspirations, what makes you special
- motivation: why this company, why this role, what excites you
- behavioral: tell me about a time you..., past experience examples
- strengths: what you bring, your greatest strength, unique value
- vision: future goals, where you see yourself, growth trajectory
- culture: team dynamics, working style, leadership style, values
- situational: what would you do if..., hypothetical scenarios
- other: anything that doesn't fit above

Question: "${question}"

Respond with exactly one word from the list above. Nothing else.`;

  const raw = await runQuery(prompt);
  const category = raw.toLowerCase().trim() as AnswerCategory;
  return VALID_CATEGORIES.has(category) ? category : 'other';
}

export function buildGenerateAnswerPrompt(
  question: string,
  category: AnswerCategory,
  tone: string,
  context: string,
  profile: Profile,
  job?: Pick<Job, 'company' | 'role' | 'jdSummary' | 'jd' | 'url'> | null,
): string {
  const toneDesc = TONE_DESCRIPTIONS[tone] ?? tone;
  const categoryDesc = CATEGORY_DESCRIPTIONS[category];
  const jobContext = buildJobContext(job);
  const sharedGuidance = buildWritingGuidance('answer');

  return `You are helping a job candidate craft a compelling interview answer. Write a single polished response. No preamble, no labels, no meta-commentary. Just the answer itself.

## Candidate Background
${buildProfileSummary(profile)}

${jobContext ? `## Company and Role Context\n${jobContext}\n\n` : ''}## Question
${question}

## Question Type
${category}: ${categoryDesc}

## Desired Tone
${tone}: ${toneDesc}

${context.trim() ? `## Additional Context from Candidate\n${context.trim()}\n\n` : ''}${sharedGuidance}

## Answer-Specific Rules (follow strictly)
- Keep the answer to approximately 100 words
- Mix short punchy sentences with longer ones. Avoid uniform structure
- Aim for 8th-grade clarity unless the role requires more technical language

Write the answer now. Output ONLY the answer text.`;
}

export async function generateAnswer(
  question: string,
  category: AnswerCategory,
  tone: string,
  context: string,
  profile: Profile,
  job?: Pick<Job, 'company' | 'role' | 'jdSummary' | 'jd' | 'url'> | null,
): Promise<string> {
  return runQuery(buildGenerateAnswerPrompt(question, category, tone, context, profile, job));
}

export function buildRefineAnswerPrompt(
  question: string,
  existingAnswer: string,
  refineRequest: string,
  profile: Profile,
  job?: Pick<Job, 'company' | 'role' | 'jdSummary' | 'jd' | 'url'> | null,
): string {
  const jobContext = buildJobContext(job);
  const sharedGuidance = buildWritingGuidance('answer');
  return `You are helping a job candidate refine an existing interview answer. Rewrite it incorporating the refinement request. Output ONLY the revised answer text. No preamble, no labels.

## Candidate Background
${buildProfileSummary(profile)}

${jobContext ? `## Company and Role Context\n${jobContext}\n\n` : ''}## Question
${question}

## Current Answer
${existingAnswer}

## Refinement Request
${refineRequest}

${sharedGuidance}

## Answer-Specific Rules (follow strictly)
- Keep the answer to approximately 100 words
- Mix short punchy sentences with longer ones. Avoid uniform structure
- Aim for 8th-grade clarity unless the role requires more technical language

Write the revised answer now.`;
}

export async function refineAnswer(
  question: string,
  existingAnswer: string,
  refineRequest: string,
  profile: Profile,
  job?: Pick<Job, 'company' | 'role' | 'jdSummary' | 'jd' | 'url'> | null,
): Promise<string> {
  return runQuery(buildRefineAnswerPrompt(question, existingAnswer, refineRequest, profile, job));
}
