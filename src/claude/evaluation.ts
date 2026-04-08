import { readFileSync } from 'fs';
import { join } from 'path';
import { query } from '@anthropic-ai/claude-code';
import type { EvaluationResult, Profile } from '../types.js';

const ARCHETYPES_PROMPT = readFileSync(join(process.cwd(), 'prompts', 'archetypes.md'), 'utf8');
const EVALUATION_PROMPT = readFileSync(join(process.cwd(), 'prompts', 'evaluation.md'), 'utf8');

export interface EvalInput {
  jd: string;
  cv: string;
  configSummary: string;
  experienceContext: string;
}

export function buildEvalPrompt(input: EvalInput): string {
  return `${ARCHETYPES_PROMPT}

---

${EVALUATION_PROMPT}

---

## Job Description

${input.jd}

---

## Candidate CV

${input.cv}

---

## Candidate Config

${input.configSummary}

---

## Experience Database

${input.experienceContext}

OUTPUT ONLY VALID JSON. NO EXPLANATION. NO MARKDOWN.`;
}

export function parseEvaluationResult(text: string): EvaluationResult {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON found in evaluation response');

  const parsed = JSON.parse(jsonMatch[0]) as Partial<EvaluationResult>;

  if (typeof parsed.score !== 'number') throw new Error('Missing score in evaluation result');
  if (!parsed.archetype) throw new Error('Missing archetype in evaluation result');
  if (!parsed.recommendation) throw new Error('Missing recommendation in evaluation result');
  if (!parsed.blockA) throw new Error('Missing blockA in evaluation result');
  if (!parsed.blockB) throw new Error('Missing blockB in evaluation result');
  if (!parsed.blockE) throw new Error('Missing blockE in evaluation result');

  return parsed as EvaluationResult;
}

function buildConfigSummary(profile: Profile): string {
  return [
    `Target roles: ${profile.targets.roles.join(', ')}`,
    `Salary target: $${profile.targets.salaryMin.toLocaleString()} – $${profile.targets.salaryMax.toLocaleString()}`,
    `Remote preference: ${profile.targets.remote}`,
    `Preferred archetypes: ${profile.targets.archetypes.join(', ')}`,
    `Deal-breakers: ${profile.targets.dealBreakers.join(', ')}`,
  ].join('\n');
}

function buildExperienceContext(profile: Profile): string {
  return profile.experiences.map((e) =>
    `--- ${e.company} | ${e.role} | ${e.period.start} to ${e.period.end} ---
Tags: ${e.tags.join(', ')}
Bullets:
${e.bullets.map((b) => `- ${b}`).join('\n')}
Narrative:
${e.narrative.trim()}`
  ).join('\n\n');
}

export async function evaluateJob(jd: string, profile: Profile): Promise<EvaluationResult> {
  const prompt = buildEvalPrompt({
    jd,
    cv: profile.cv,
    configSummary: buildConfigSummary(profile),
    experienceContext: buildExperienceContext(profile),
  });

  let responseText = '';
  for await (const message of query({ prompt, options: { maxTurns: 1 } })) {
    if (message.type === 'result' && message.subtype === 'success') {
      responseText = message.result;
    }
  }

  return parseEvaluationResult(responseText);
}
