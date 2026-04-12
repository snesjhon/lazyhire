import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { query } from '@anthropic-ai/claude-code';
import type { GeneratedCV, Experience, Profile } from '../../../shared/models/types.js';
import { buildWritingGuidance } from '../../../shared/ai/writing-guidance.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const GENERATE_PROMPT = readFileSync(join(__dirname, 'prompts', 'generate-cv.md'), 'utf8');
const BULLET_WORD_RANGE_TOKEN = '{{BULLET_WORD_RANGE}}';
const TEXT_SIZE_NAME_TOKEN = '{{TEXT_SIZE_NAME}}';
const TEXT_SIZE_BODY_PT_TOKEN = '{{TEXT_SIZE_BODY_PT}}';

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

export interface CvTextSizeScale {
  bodyPt: number;
  headingNamePt: number;
  headingSectionPt: number;
  headingRolePt: number;
}

export interface CvTextSizePreset {
  id: 'tight' | 'compact' | 'balanced' | 'detailed' | 'extended';
  name: string;
  description: string;
  scale: CvTextSizeScale;
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

export const DEFAULT_CV_TEXT_SIZE_SCALE: CvTextSizeScale = {
  bodyPt: 12,
  headingNamePt: 18,
  headingSectionPt: 11.5,
  headingRolePt: 12.5,
};

export const CV_TEXT_SIZE_PRESETS: CvTextSizePreset[] = [
  {
    id: 'tight',
    name: 'Tight',
    description: 'Smallest resume text, 11pt base body copy',
    scale: {
      bodyPt: 11,
      headingNamePt: 16.75,
      headingSectionPt: 10.5,
      headingRolePt: 11.5,
    },
  },
  {
    id: 'compact',
    name: 'Compact',
    description: 'Slightly smaller text, 11.25pt base body copy',
    scale: {
      bodyPt: 11.25,
      headingNamePt: 17,
      headingSectionPt: 10.75,
      headingRolePt: 11.75,
    },
  },
  {
    id: 'balanced',
    name: 'Balanced',
    description: 'Default text scale, 12pt base body copy',
    scale: DEFAULT_CV_TEXT_SIZE_SCALE,
  },
  {
    id: 'detailed',
    name: 'Detailed',
    description: 'Near-maximum text, 11.75pt base body copy',
    scale: {
      bodyPt: 11.75,
      headingNamePt: 17.75,
      headingSectionPt: 11.25,
      headingRolePt: 12.25,
    },
  },
  {
    id: 'extended',
    name: 'Extended',
    description: 'Largest resume text, 12pt base body copy',
    scale: {
      bodyPt: 12,
      headingNamePt: 18,
      headingSectionPt: 11.5,
      headingRolePt: 12.5,
    },
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
  textSizeScale?: CvTextSizeScale;
}

export function buildGeneratePrompt(input: GenerateInput): string {
  const bulletWordRange = input.bulletWordRange ?? DEFAULT_CV_BULLET_WORD_RANGE;
  const textSizeScale = input.textSizeScale ?? DEFAULT_CV_TEXT_SIZE_SCALE;
  const textSizePreset =
    CV_TEXT_SIZE_PRESETS.find((preset) => preset.scale.bodyPt === textSizeScale.bodyPt) ??
    CV_TEXT_SIZE_PRESETS.find((preset) => preset.id === 'balanced')!;
  const promptTemplate = GENERATE_PROMPT
    .replace(BULLET_WORD_RANGE_TOKEN, `${bulletWordRange.min}-${bulletWordRange.max}`)
    .replace(TEXT_SIZE_NAME_TOKEN, textSizePreset.name.toLowerCase())
    .replace(TEXT_SIZE_BODY_PT_TOKEN, String(textSizeScale.bodyPt));

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
  textSizeScale: CvTextSizeScale = DEFAULT_CV_TEXT_SIZE_SCALE,
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
    textSizeScale,
  });

  let responseText = '';
  for await (const message of query({ prompt, options: { maxTurns: 1 } })) {
    if (message.type === 'result' && message.subtype === 'success') {
      responseText = message.result;
    }
  }

  return parseGeneratedCV(responseText);
}
