import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { query } from '@anthropic-ai/claude-code';
import type { GeneratedCV, Experience, Profile } from '../../types.js';
import { buildWritingGuidance } from './writing-guidance.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const GENERATE_PROMPT = readFileSync(join(__dirname, 'prompts', 'generate-cv.md'), 'utf8');

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
}

export function buildGeneratePrompt(input: GenerateInput): string {
  return `${GENERATE_PROMPT}

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
  });

  let responseText = '';
  for await (const message of query({ prompt, options: { maxTurns: 1 } })) {
    if (message.type === 'result' && message.subtype === 'success') {
      responseText = message.result;
    }
  }

  return parseGeneratedCV(responseText);
}
