import { query } from '@anthropic-ai/claude-code';
import type { Profile } from '../types.js';

export interface ExtractionResult {
  candidate: Profile['candidate'];
  headline: string;
  summary: string;
  experiences: Profile['experiences'];
  education: Profile['education'];
  skills: string[];
  suggestedRoles: string[];
  suggestedCategories: string[];
  suggestedFocuses: string[];
}

export function buildSuggestedTargets(
  extracted: ExtractionResult,
): Profile['targets'] {
  return {
    roles: extracted.suggestedRoles,
    salaryMin: 0,
    salaryMax: 0,
    remote: 'full',
    dealBreakers: [],
    categories: extracted.suggestedCategories,
    focuses: extracted.suggestedFocuses,
  };
}

export interface FinalizeProfileInput {
  rawText: string;
  extracted: ExtractionResult;
  corrections: string;
  targets: Profile['targets'];
  extraExperience: string[];
}

const EXTRACTION_PROMPT = `You are parsing a resume to extract structured data for a job search tool.

Extract the following from the resume text provided and return ONLY valid JSON matching this exact schema:

{
  "candidate": {
    "name": "string",
    "email": "string",
    "location": "string",
    "site": "string (personal website, or empty string if none)",
    "github": "string or null",
    "linkedin": "string or null"
  },
  "headline": "string",
  "summary": "string",
  "experiences": [
    {
      "company": "string",
      "role": "string",
      "period": { "start": "YYYY-MM", "end": "YYYY-MM or present" },
      "tags": ["string"],
      "bullets": ["string"],
      "narrative": "string"
    }
  ],
  "education": [
    { "institution": "string", "degree": "string" }
  ],
  "skills": ["string"],
  "suggestedRoles": ["string"],
  "suggestedCategories": ["engineering | product | design | data | architecture | research | consulting | operations | leadership | go_to_market"],
  "suggestedFocuses": ["platform | frontend | backend | full_stack | forward_deployed | product_design | technical_pm | ux_research | analytics | ai | developer_relations | solutions_architecture"]
}

OUTPUT ONLY VALID JSON. NO EXPLANATION. NO MARKDOWN CODE FENCES.`;

const FINALIZE_PROFILE_PROMPT = `You are building the final profile.json for a job search tool.

You will receive:
- resume text
- an initial structured extraction from the resume
- user corrections and clarifications
- job target preferences
- extra experience notes the user wants included

Return ONLY valid JSON matching this exact schema:

{
  "candidate": {
    "name": "string",
    "email": "string",
    "location": "string",
    "site": "string",
    "github": "string or omitted",
    "linkedin": "string or omitted"
  },
  "headline": "string",
  "summary": "string",
  "cv": "string",
  "targets": {
    "roles": ["string"],
    "salaryMin": 0,
    "salaryMax": 0,
    "remote": "full | hybrid | any",
    "dealBreakers": ["string"],
    "categories": ["engineering | product | design | data | architecture | research | consulting | operations | leadership | go_to_market"],
    "focuses": ["platform | frontend | backend | full_stack | forward_deployed | product_design | technical_pm | ux_research | analytics | ai | developer_relations | solutions_architecture"]
  },
  "experiences": [
    {
      "company": "string",
      "role": "string",
      "period": { "start": "YYYY-MM", "end": "YYYY-MM or present" },
      "tags": ["string"],
      "bullets": ["string"],
      "narrative": "string"
    }
  ],
  "education": [
    { "institution": "string", "degree": "string" }
  ],
  "skills": ["string"]
}

Rules:
- Use the provided targets exactly.
- Use the structured extraction as the starting point.
- Preserve resume facts unless the user corrections explicitly override them.
- Incorporate extra experience notes into summary/skills/experiences when justified.
- Set "cv" to the full raw resume text exactly as provided.
- Output only JSON.`;

const JSON_RETRY_LIMIT = 2;

function assertSupportedClaudeRuntime(): void {
  const major = Number.parseInt(process.versions.node.split('.')[0] ?? '', 10);
  if (Number.isNaN(major)) return;

  if (major >= 25) {
    throw new Error(
      `Claude Code currently crashes under Node ${process.versions.node}. ` +
      'Run `pnpm init` with Node 20 or Node 22 instead.'
    );
  }
}

export function parseProfileResult(text: string): Profile {
  const parsed = parseJsonObject<Profile>(text, 'profile generation response');

  if (!parsed.candidate) throw new Error('Missing candidate in generated profile');
  if (!parsed.headline) throw new Error('Missing headline in generated profile');
  if (!parsed.summary) throw new Error('Missing summary in generated profile');
  if (!parsed.cv) throw new Error('Missing cv in generated profile');
  if (!parsed.targets) throw new Error('Missing targets in generated profile');
  if (!Array.isArray(parsed.experiences)) throw new Error('Missing experiences in generated profile');
  if (!Array.isArray(parsed.education)) throw new Error('Missing education in generated profile');
  if (!Array.isArray(parsed.skills)) throw new Error('Missing skills in generated profile');

  return parsed as Profile;
}

export function parseExtractionResult(text: string): ExtractionResult {
  const parsed = parseJsonObject<ExtractionResult>(text, 'extraction response');

  if (!parsed.candidate) throw new Error('Missing candidate in extraction result');
  if (!parsed.headline) throw new Error('Missing headline in extraction result');
  if (!parsed.summary) throw new Error('Missing summary in extraction result');
  if (!Array.isArray(parsed.experiences)) throw new Error('Missing experiences in extraction result');
  if (!Array.isArray(parsed.education)) throw new Error('Missing education in extraction result');
  if (!Array.isArray(parsed.skills)) throw new Error('Missing skills in extraction result');
  if (!Array.isArray(parsed.suggestedRoles)) throw new Error('Missing suggestedRoles in extraction result');
  if (!Array.isArray(parsed.suggestedCategories)) throw new Error('Missing suggestedCategories in extraction result');
  if (!Array.isArray(parsed.suggestedFocuses)) throw new Error('Missing suggestedFocuses in extraction result');

  return parsed as ExtractionResult;
}

function extractTopLevelJsonObject(text: string): string {
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaping = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (start === -1) {
      if (char === '{') {
        start = index;
        depth = 1;
      }
      continue;
    }

    if (inString) {
      if (escaping) {
        escaping = false;
        continue;
      }
      if (char === '\\') {
        escaping = true;
        continue;
      }
      if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      depth += 1;
      continue;
    }

    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, index + 1);
      }
    }
  }

  throw new Error('No complete JSON object found');
}

function parseJsonObject<T>(text: string, source: string): Partial<T> {
  let candidate: string;

  try {
    candidate = extractTopLevelJsonObject(text);
  } catch (error) {
    throw new Error(`No JSON found in ${source}`, { cause: error });
  }

  try {
    return JSON.parse(candidate) as Partial<T>;
  } catch (error) {
    throw new Error(`Invalid JSON in ${source}: ${(error as Error).message}`, { cause: error });
  }
}

async function runClaudePrompt(prompt: string, failureMessage: string): Promise<string> {
  let responseText = '';
  let stderr = '';

  try {
    for await (const message of query({
      prompt,
      options: {
        maxTurns: 1,
        stderr: (data) => {
          stderr += data;
        },
      },
    })) {
      if (message.type === 'result' && message.subtype === 'success') {
        responseText = message.result;
      }
    }
  } catch (error) {
    const detail = stderr
      .replaceAll(/\s+/g, ' ')
      .trim()
      .match(/TypeError:[\s\S]*|Error:[\s\S]*/)?.[0];

    const suffix = detail ? ` Claude stderr: ${detail}` : '';
    throw new Error(`${failureMessage}.${suffix}`, { cause: error });
  }

  return responseText;
}

async function runJsonPrompt<T>(
  prompt: string,
  parser: (text: string) => T,
  failureMessage: string,
): Promise<T> {
  let lastError: Error | null = null;
  let previousResponse = '';

  for (let attempt = 1; attempt <= JSON_RETRY_LIMIT; attempt += 1) {
    const attemptPrompt =
      attempt === 1
        ? prompt
        : `${prompt}

Your previous response was invalid JSON and could not be parsed.
Return the full response again as valid JSON only.
Previous parser error: ${lastError?.message ?? 'Unknown parse error'}

Previous invalid response:
${previousResponse}`;

    const responseText = await runClaudePrompt(attemptPrompt, failureMessage);

    try {
      return parser(responseText);
    } catch (error) {
      lastError = error as Error;
      previousResponse = responseText;
    }
  }

  throw new Error(
    `${failureMessage}. Failed to parse Claude JSON after ${JSON_RETRY_LIMIT} attempts: ${lastError?.message ?? 'Unknown parse error'}`,
    { cause: lastError ?? undefined },
  );
}

export function buildFinalizeProfilePrompt(input: FinalizeProfileInput): string {
  const extraExperience =
    input.extraExperience.length > 0
      ? input.extraExperience.map((item) => `- ${item}`).join('\n')
      : '- None provided';

  const corrections = input.corrections.trim() || 'No corrections provided.';

  return `${FINALIZE_PROFILE_PROMPT}

---

## Raw Resume Text

${input.rawText}

---

## Initial Extraction

${JSON.stringify(input.extracted, null, 2)}

---

## User Corrections

${corrections}

---

## Final Targets

${JSON.stringify(input.targets, null, 2)}

---

## Extra Experience Notes

${extraExperience}`;
}

export async function extractProfileFromText(resumeText: string): Promise<ExtractionResult> {
  assertSupportedClaudeRuntime();

  const prompt = `${EXTRACTION_PROMPT}\n\n---\n\nResume:\n\n${resumeText}`;
  return runJsonPrompt(prompt, parseExtractionResult, 'Failed to run Claude extraction');
}

export async function finalizeProfileFromIntake(input: FinalizeProfileInput): Promise<Profile> {
  assertSupportedClaudeRuntime();

  const prompt = buildFinalizeProfilePrompt(input);
  return runJsonPrompt(prompt, parseProfileResult, 'Failed to generate final profile');
}
