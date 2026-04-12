import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { query } from '@anthropic-ai/claude-code';
import type { GeneratedCV, Experience, Profile } from '../../../shared/models/types.js';
import { buildWritingGuidance } from '../../../shared/ai/writing-guidance.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const GENERATE_PROMPT = readFileSync(join(__dirname, 'prompts', 'generate-cv.md'), 'utf8');
const BULLET_WORD_RANGE_TOKEN = '{{BULLET_WORD_RANGE}}';

export interface CvBulletWordRange {
  min: number;
  max: number;
}

export interface CvBulletLengthPreset {
  id: 'tight' | 'compact' | 'balanced' | 'detailed' | 'extended';
  name: string;
  description: string;
  range: CvBulletWordRange;
}

export const DEFAULT_CV_BULLET_WORD_RANGE: CvBulletWordRange = {
  min: 25,
  max: 44,
};

export const CV_BULLET_LENGTH_PRESETS: CvBulletLengthPreset[] = [
  {
    id: 'tight',
    name: 'Tight',
    description: 'Lean bullets, 16-24 words',
    range: { min: 16, max: 24 },
  },
  {
    id: 'compact',
    name: 'Compact',
    description: 'Short but specific bullets, 20-32 words',
    range: { min: 20, max: 32 },
  },
  {
    id: 'balanced',
    name: 'Balanced',
    description: 'Default medium-length bullets, 25-44 words',
    range: DEFAULT_CV_BULLET_WORD_RANGE,
  },
  {
    id: 'detailed',
    name: 'Detailed',
    description: 'Richer implementation detail, 32-52 words',
    range: { min: 32, max: 52 },
  },
  {
    id: 'extended',
    name: 'Extended',
    description: 'Most expansive bullets, 40-60 words',
    range: { min: 40, max: 60 },
  },
];

export interface GenerateInput {
  jd: string;
  category: string;
  focus: string | null;
  cv: string;
  experienceContext: string;
  tailoringNotes?: string;
  candidate: {
    name: string;
    email: string;
    location: string;
    site: string;
  };
  education: Array<{ institution: string; degree: string }>;
  bulletWordRange?: CvBulletWordRange;
}

export function buildGeneratePrompt(input: GenerateInput): string {
  const bulletWordRange = input.bulletWordRange ?? DEFAULT_CV_BULLET_WORD_RANGE;
  const promptTemplate = GENERATE_PROMPT.replace(
    BULLET_WORD_RANGE_TOKEN,
    `${bulletWordRange.min}-${bulletWordRange.max}`,
  );

  return `${promptTemplate}

---

${buildWritingGuidance('cv')}

---

## Job Description

${input.jd}

---

## Detected Category: ${input.category}

## Detected Focus: ${input.focus ?? 'none'}

---

## Candidate CV

${input.cv}

---

## Experience Database

${input.experienceContext}

---

## Candidate Info

Name: ${input.candidate.name}
Email: ${input.candidate.email}
Location: ${input.candidate.location}
Site: ${input.candidate.site}

Education (static, use exactly as-is):
${input.education.map((e) => `- ${e.institution}: ${e.degree}`).join('\n')}

## Application Guidance

${input.tailoringNotes?.trim() || 'No additional guidance provided. Infer the strongest truthful framing from the JD and experience database.'}

OUTPUT ONLY VALID JSON. NO EXPLANATION. NO MARKDOWN.`;
}

export function parseGeneratedCV(text: string): GeneratedCV {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON found in CV generation response');

  const parsed = JSON.parse(jsonMatch[0]) as Partial<GeneratedCV>;

  if (!parsed.name) throw new Error('Missing name in generated CV');
  if (!Array.isArray(parsed.roles) || parsed.roles.length === 0) {
    throw new Error('Missing or empty roles in generated CV');
  }
  if (!Array.isArray(parsed.skills)) throw new Error('Missing skills in generated CV');

  return parsed as GeneratedCV;
}

function buildExperienceContext(experiences: Experience[]): string {
  return experiences.map((e) =>
    `--- ${e.company} | ${e.role} | ${e.period.start} to ${e.period.end} ---
Tags: ${e.tags.join(', ')}
Bullets:
${e.bullets.map((b) => `- ${b}`).join('\n')}
Narrative:
${e.narrative.trim()}`
  ).join('\n\n');
}

export async function generateCV(
  job: { jd: string; category: string | null; focus: string | null },
  profile: Profile,
  tailoringNotes = '',
  bulletWordRange: CvBulletWordRange = DEFAULT_CV_BULLET_WORD_RANGE,
): Promise<GeneratedCV> {
  const prompt = buildGeneratePrompt({
    jd: job.jd,
    category: job.category ?? 'engineering',
    focus: job.focus,
    cv: profile.cv,
    experienceContext: buildExperienceContext(profile.experiences),
    tailoringNotes,
    candidate: profile.candidate,
    education: profile.education,
    bulletWordRange,
  });

  let responseText = '';
  for await (const message of query({ prompt, options: { maxTurns: 1 } })) {
    if (message.type === 'result' && message.subtype === 'success') {
      responseText = message.result;
    }
  }

  return parseGeneratedCV(responseText);
}
