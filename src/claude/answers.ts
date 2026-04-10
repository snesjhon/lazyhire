import { query } from '@anthropic-ai/claude-code';
import type { AnswerCategory, Profile } from '../types.js';

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

export async function generateAnswer(
  question: string,
  category: AnswerCategory,
  tone: string,
  context: string,
  profile: Profile,
): Promise<string> {
  const toneDesc = TONE_DESCRIPTIONS[tone] ?? tone;
  const categoryDesc = CATEGORY_DESCRIPTIONS[category];

  const prompt = `You are helping a job candidate craft a compelling interview answer. Write a single polished response. No preamble, no labels, no meta-commentary. Just the answer itself.

## Candidate Background
${buildProfileSummary(profile)}

## Question
${question}

## Question Type
${category}: ${categoryDesc}

## Desired Tone
${tone}: ${toneDesc}

${context.trim() ? `## Additional Context from Candidate\n${context.trim()}\n\n` : ''}## Writing Rules (follow strictly)
- Keep the answer to approximately 100 words
- Sound like a real person talking, not generated text
- No em-dashes (never use — or –). Use commas, periods, or conjunctions instead
- No filler openers: do not start with "Absolutely", "Certainly", "Great question", "I am passionate about", "Throughout my career"
- Vary sentence length. Mix short punchy sentences with longer ones. Avoid uniform structure
- No repetitive phrasing. Do not reuse the same word or phrase within 2 sentences of each other
- Plain readable language. Aim for 8th-grade clarity. No jargon unless the role requires it
- Each sentence should earn its place. Cut anything that restates what was just said
- Use "I" naturally, like a person would in conversation, not like a cover letter

Write the answer now. Output ONLY the answer text.`;

  return runQuery(prompt);
}

export async function refineAnswer(
  question: string,
  existingAnswer: string,
  refineRequest: string,
  profile: Profile,
): Promise<string> {
  const prompt = `You are helping a job candidate refine an existing interview answer. Rewrite it incorporating the refinement request. Output ONLY the revised answer text. No preamble, no labels.

## Candidate Background
${buildProfileSummary(profile)}

## Question
${question}

## Current Answer
${existingAnswer}

## Refinement Request
${refineRequest}

## Writing Rules (follow strictly)
- Keep the answer to approximately 100 words
- Sound like a real person talking, not generated text
- No em-dashes (never use — or –). Use commas, periods, or conjunctions instead
- No filler openers: do not start with "Absolutely", "Certainly", "Great question", "I am passionate about", "Throughout my career"
- Vary sentence length. Mix short punchy sentences with longer ones. Avoid uniform structure
- No repetitive phrasing. Do not reuse the same word or phrase within 2 sentences of each other
- Plain readable language. Aim for 8th-grade clarity. No jargon unless the role requires it
- Each sentence should earn its place. Cut anything that restates what was just said
- Use "I" naturally, like a person would in conversation, not like a cover letter

Write the revised answer now.`;

  return runQuery(prompt);
}
