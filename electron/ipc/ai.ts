import { ipcMain, BrowserWindow } from 'electron';
import { query } from '@anthropic-ai/claude-code';
import { IPC } from '@shared/ipc-channels';
import { loadProfile } from '../services/profile.js';
import { getClaudeQueryOptions } from '../services/claude.js';
import { buildWritingGuidance } from '../services/writing-guidance.js';
import { extractTextFromPdf } from '../services/pdf.js';
import type { AnswerCategory, Job, Profile } from '@shared/types';

// ── Shared helpers ─────────────────────────────────────────────────

async function runQuery(prompt: string, progressChannel?: string): Promise<string> {
  let result = '';
  for await (const message of query({
    prompt,
    options: getClaudeQueryOptions({ maxTurns: 1 }, progressChannel
      ? { stderr: (data) => {
          BrowserWindow.getAllWindows()[0]?.webContents.send(IPC.AI_PROGRESS, {
            channel: progressChannel,
            message: data.trim(),
          });
        } }
      : {}),
  })) {
    if (message.type === 'result' && message.subtype === 'success') {
      result = message.result;
    }
  }
  return result.trim();
}

// ── Answer category detection ──────────────────────────────────────

const VALID_CATEGORIES = new Set<string>([
  'identity', 'motivation', 'behavioral', 'strengths', 'vision', 'culture', 'situational', 'other',
]);

async function detectCategory(question: string): Promise<AnswerCategory> {
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

// ── Answer generation ──────────────────────────────────────────────

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
  ].filter(Boolean).join('\n');
}

function buildJobContext(job: Pick<Job, 'company' | 'role' | 'jdSummary' | 'jd' | 'url'> | null | undefined): string {
  if (!job) return '';
  const summary = (job.jdSummary || job.jd || '').trim();
  return [
    `Company: ${job.company || 'Unknown Company'}`,
    `Role: ${job.role || 'Unknown Role'}`,
    job.url ? `URL: ${job.url}` : '',
    summary ? `Job Description Summary:\n${summary.slice(0, 1800)}` : '',
  ].filter(Boolean).join('\n');
}

// ── Profile extraction ────────────────────────────────────────────

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

interface ExtractionResult {
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

function parseExtractionResult(text: string): ExtractionResult {
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned) as ExtractionResult;
}

async function extractProfileFromText(resumeText: string): Promise<Profile> {
  const prompt = `${EXTRACTION_PROMPT}\n\n---\n\nResume:\n\n${resumeText}`;
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const raw = await runQuery(prompt, IPC.AI_EXTRACT_PROFILE);
    try {
      const extracted = parseExtractionResult(raw);
      return {
        candidate: extracted.candidate,
        headline: extracted.headline,
        summary: extracted.summary,
        cv: resumeText,
        targets: {
          roles: extracted.suggestedRoles,
          salaryMin: 0,
          salaryMax: 0,
          remote: 'full',
          dealBreakers: [],
          categories: extracted.suggestedCategories,
          focuses: extracted.suggestedFocuses,
        },
        experiences: extracted.experiences,
        education: extracted.education,
        skills: extracted.skills,
      };
    } catch (err) {
      lastError = err as Error;
    }
  }
  throw new Error(`Failed to parse extracted profile: ${lastError?.message}`);
}

// ── IPC handler registration ──────────────────────────────────────

export function registerAiHandlers(): void {
  ipcMain.handle(IPC.AI_EXTRACT_PROFILE, async (_event, resumeInput: string | number[]) => {
    const resumeText = typeof resumeInput === 'string'
      ? resumeInput
      : await extractTextFromPdf(Buffer.from(resumeInput));
    return extractProfileFromText(resumeText);
  });

  ipcMain.handle(IPC.AI_DETECT_ANSWER_CATEGORY, async (_event, question: string) => {
    return detectCategory(question);
  });

  ipcMain.handle(IPC.AI_GENERATE_ANSWER, async (
    _event,
    args: {
      question: string;
      category: AnswerCategory;
      tone: string;
      context: string;
      job?: Pick<Job, 'company' | 'role' | 'jdSummary' | 'jd' | 'url'> | null;
    },
  ) => {
    const profile = loadProfile();
    if (!profile) throw new Error('No profile found. Please complete profile setup first.');

    const { question, category, tone, context, job } = args;
    const toneDesc = TONE_DESCRIPTIONS[tone] ?? tone;
    const categoryDesc = CATEGORY_DESCRIPTIONS[category];
    const jobContext = buildJobContext(job);
    const sharedGuidance = buildWritingGuidance('answer');

    const prompt = `You are helping a job candidate craft a compelling interview answer. Write a single polished response. No preamble, no labels, no meta-commentary. Just the answer itself.

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

    return runQuery(prompt, IPC.AI_GENERATE_ANSWER);
  });

  ipcMain.handle(IPC.AI_REFINE_ANSWER, async (
    _event,
    args: {
      question: string;
      existingAnswer: string;
      refineRequest: string;
      job?: Pick<Job, 'company' | 'role' | 'jdSummary' | 'jd' | 'url'> | null;
    },
  ) => {
    const profile = loadProfile();
    if (!profile) throw new Error('No profile found.');

    const { question, existingAnswer, refineRequest, job } = args;
    const jobContext = buildJobContext(job);
    const sharedGuidance = buildWritingGuidance('answer');

    const prompt = `You are helping a job candidate refine an existing interview answer. Rewrite it incorporating the refinement request. Output ONLY the revised answer text. No preamble, no labels.

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

    return runQuery(prompt, IPC.AI_REFINE_ANSWER);
  });
}
