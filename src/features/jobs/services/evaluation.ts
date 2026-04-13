import { query } from '@anthropic-ai/claude-code';
import type { EvaluationResult, Profile } from '../../../shared/models/types.js';
import { getClaudeQueryOptions } from '../../../shared/ai/claude.js';
import CATEGORIES_PROMPT from './prompts/categories.md' with { type: 'text' };
import EVALUATION_PROMPT from './prompts/evaluation.md' with { type: 'text' };

export interface EvalInput {
  jd: string;
  cv: string;
  configSummary: string;
  experienceContext: string;
}

export function buildEvalPrompt(input: EvalInput): string {
  return `${CATEGORIES_PROMPT}

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
  if (!parsed.category) throw new Error('Missing category in evaluation result');
  if (!parsed.recommendation) throw new Error('Missing recommendation in evaluation result');
  if (!parsed.jobSummary) throw new Error('Missing jobSummary in evaluation result');
  if (typeof parsed.jobSummary.company !== 'string')
    throw new Error('Missing company summary in evaluation result');
  if (!Array.isArray(parsed.jobSummary.alignments))
    throw new Error('Missing alignments in evaluation result');
  if (!Array.isArray(parsed.jobSummary.gaps))
    throw new Error('Missing gaps in evaluation result');
  if (!parsed.blockA) throw new Error('Missing blockA in evaluation result');
  if (!parsed.blockB) throw new Error('Missing blockB in evaluation result');
  if (!parsed.blockE) throw new Error('Missing blockE in evaluation result');

  return parsed as EvaluationResult;
}

async function runEvaluationQuery(prompt: string): Promise<string> {
  let responseText = '';
  for await (const message of query({ prompt, options: getClaudeQueryOptions({ maxTurns: 1 }) })) {
    if (message.type === 'result' && message.subtype === 'success') {
      responseText = message.result;
    }
  }
  return responseText;
}

function buildConfigSummary(profile: Profile): string {
  return [
    `Target roles: ${profile.targets.roles.join(', ')}`,
    `Salary target: $${profile.targets.salaryMin.toLocaleString()} – $${profile.targets.salaryMax.toLocaleString()}`,
    `Remote preference: ${profile.targets.remote}`,
    `Preferred categories: ${profile.targets.categories.join(', ') || 'none'}`,
    `Preferred focuses: ${profile.targets.focuses.join(', ') || 'none'}`,
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
  const responseText = await runEvaluationQuery(prompt);

  try {
    return parseEvaluationResult(responseText);
  } catch (error) {
    const repairPrompt = `${prompt}

Your previous reply was not valid JSON for the required schema.
Return exactly one valid JSON object and nothing else.

Previous reply:
${responseText}`;

    const repaired = await runEvaluationQuery(repairPrompt);

    try {
      return parseEvaluationResult(repaired);
    } catch {
      throw error;
    }
  }
}

export function formatJobSummary(result: Pick<EvaluationResult, 'jobSummary'>): string {
  const company = result.jobSummary.company.trim();
  const alignments = result.jobSummary.alignments
    .map((item) => item.trim())
    .filter(Boolean);
  const gaps = result.jobSummary.gaps
    .map((item) => item.trim())
    .filter(Boolean);

  const lines: string[] = [];
  if (company) lines.push(company);
  if (alignments.length > 0) {
    lines.push('', `Alignments: ${alignments.join(' ')}`);
  }
  if (gaps.length > 0) {
    lines.push('', `Gaps: ${gaps.join(' ')}`);
  }
  return lines.join('\n').trim();
}
