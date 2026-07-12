import { ipcMain } from 'electron';
import { join } from 'path';
import { query } from '@anthropic-ai/claude-code';
import { IPC } from '@shared/ipc-channels';
import { loadProfile } from '../services/profile.js';
import { getClaudeQueryOptions } from '../services/claude.js';
import { buildWritingGuidance } from '../services/writing-guidance.js';
import { extractTextFromPdf, fetchPdfFromUrl } from '../services/pdf.js';
import { db, answersDb } from '../services/db.js';
import { DATA_DIR } from '../services/paths.js';
import {
  renderPDF,
  renderCoverLetterPDF,
  buildResumeFilename,
  buildCoverLetterFilename,
} from '../services/jobs.js';
import {
  CV_BULLET_LENGTH_PRESETS,
  CV_TEXT_SIZE_PRESETS,
  DEFAULT_CV_BULLET_WORD_RANGE,
  DEFAULT_CV_TEXT_SIZE_SCALE,
  DEFAULT_COVER_LETTER_TOTAL_WORD_COUNT,
  type CvBulletWordRange,
  type CvTextSizeScale,
  type CoverLetterTotalWordCount,
  type CvPageConstraint,
} from '@shared/generate-presets';
import type {
  AnswerCategory,
  AnswerEntry,
  EvaluationResult,
  GeneratedCV,
  GeneratedCoverLetter,
  Job,
  Profile,
} from '@shared/types';
import GENERATE_CV_PROMPT from '../prompts/generate-cv.md?raw';
import GENERATE_COVER_LETTER_PROMPT from '../prompts/generate-cover-letter.md?raw';

// ── Shared helpers ─────────────────────────────────────────────────

// The Claude Code SDK's own debug/spawn diagnostics (child process args,
// raw stderr) are not meant for end users — we intentionally don't wire
// them up to any UI-facing progress channel.
async function runQuery(prompt: string): Promise<string> {
  let result = '';
  for await (const message of query({
    prompt,
    options: getClaudeQueryOptions({ maxTurns: 1 }),
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
    `Location: ${profile.candidate.location}`,
    `Email: ${profile.candidate.email}`,
    `Site: ${profile.candidate.site}`,
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
    const raw = await runQuery(prompt);
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

// ── Job evaluation ────────────────────────────────────────────────

const VALID_RECOMMENDATIONS = new Set(['apply', 'consider', 'discard']);

const EVALUATE_PROMPT_TEMPLATE = (profile: Profile, job: Pick<Job, 'company' | 'role' | 'jd' | 'jdSummary' | 'url'>) => `You are a rigorous career advisor evaluating a candidate's fit for a job opening.

## Candidate Profile
Name: ${profile.candidate.name}
Headline: ${profile.headline}
Summary: ${profile.summary}
Skills: ${profile.skills.join(', ')}
Target roles: ${profile.targets.roles.join(', ')}
${profile.experiences.slice(0, 5).map((e) => `- ${e.role} at ${e.company}: ${e.bullets.slice(0, 2).join('; ')}`).join('\n')}

## Job
Company: ${job.company}
Role: ${job.role}
${job.url ? `URL: ${job.url}` : ''}
Job Description:
${(job.jdSummary || job.jd || '').slice(0, 3000)}

## Task
Evaluate how well this candidate fits this job. Return ONLY valid JSON matching this exact schema. No explanation. No markdown fences.

{
  "score": <float 0.0-5.0 with one decimal place representing overall fit, e.g. 4.8 or 2.3>,
  "category": <one of: "engineering" | "product" | "design" | "data" | "architecture" | "research" | "consulting" | "operations" | "leadership" | "go_to_market">,
  "focus": <one of: "platform" | "frontend" | "backend" | "full_stack" | "forward_deployed" | "product_design" | "technical_pm" | "ux_research" | "analytics" | "ai" | "developer_relations" | "solutions_architecture" | null>,
  "recommendation": <"apply" | "consider" | "discard">,
  "jobSummary": {
    "company": <string: one sentence about the company>,
    "alignments": <string[]: 3-5 specific ways this candidate is well suited>,
    "gaps": <string[]: 2-4 specific gaps or concerns>
  },
  "blockA": {
    "tldr": <string: 1-2 sentence role summary>,
    "domain": <string: primary domain, e.g. "Developer tooling", "Fintech">,
    "function": <string: e.g. "Backend Engineering", "Product Management">,
    "seniority": <string: e.g. "Senior", "Staff", "Director">,
    "remote": <string: e.g. "Remote", "Hybrid (NYC)", "On-site">,
    "teamSize": <string | null: e.g. "10-20 engineers" or null if unknown>
  },
  "blockB": {
    "matches": [{ "requirement": <string>, "cvEvidence": <string> }],
    "gaps": [{ "requirement": <string>, "blocker": <boolean: is this a hard dealbreaker?>, "mitigation": <string: how candidate could address this> }]
  },
  "blockC": {
    "analysis": <string: 2-3 sentences on overall fit and key considerations>,
    "seniorityAnalysis": <string: 1-2 sentences on seniority alignment>
  },
  "blockD": <string[]: 3-5 smart questions the candidate should ask in interviews>,
  "blockE": <string: 2-3 sentence personalized cover letter hook — why this specific company and role excites this candidate>,
  "blockF": [{ "requirement": <string: key role requirement>, "story": <string: STAR-format story from candidate's background that demonstrates this> }]
}

OUTPUT ONLY VALID JSON. NO EXPLANATION. NO MARKDOWN CODE FENCES.`;

async function evaluateJob(job: Job, profile: Profile): Promise<EvaluationResult> {
  const prompt = EVALUATE_PROMPT_TEMPLATE(profile, job);
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const raw = await runQuery(prompt);
    try {
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const result = JSON.parse(cleaned) as EvaluationResult;
      if (!VALID_RECOMMENDATIONS.has(result.recommendation)) {
        result.recommendation = result.score >= 4.0 ? 'apply' : result.score >= 2.5 ? 'consider' : 'discard';
      }
      return result;
    } catch (err) {
      lastError = err as Error;
    }
  }
  throw new Error(`Failed to parse evaluation result: ${lastError?.message}`);
}

// ── Resume generation ─────────────────────────────────────────────

const BULLET_WORD_RANGE_TOKEN = '{{BULLET_WORD_RANGE}}';
const TEXT_SIZE_NAME_TOKEN = '{{TEXT_SIZE_NAME}}';
const TEXT_SIZE_BODY_PT_TOKEN = '{{TEXT_SIZE_BODY_PT}}';
const MOST_RECENT_BULLET_COUNT_TOKEN = '{{MOST_RECENT_BULLET_COUNT}}';
const OTHER_ROLE_BULLET_COUNT_TOKEN = '{{OTHER_ROLE_BULLET_COUNT}}';
const PAGE_FIT_INSTRUCTION_TOKEN = '{{PAGE_FIT_INSTRUCTION}}';
const TOTAL_WORD_COUNT_TOKEN = '{{TOTAL_WORD_COUNT}}';

const PAGE_FIT_INSTRUCTIONS: Record<CvPageConstraint, string> = {
  'strict-one-page':
    'Fit the entire resume comfortably on one page. Trim bullet detail and de-prioritize lower-signal roles if needed to preserve this.',
  'flexible-second-page':
    "Prioritize rich, relevant detail over page count — it's fine to use a second page if the candidate's experience genuinely supports this level of detail. Do not pad or invent content just to fill space, and do not compress meaningfully useful detail just to force a single page.",
};

function buildExperienceContext(experiences: Profile['experiences']): string {
  return experiences
    .map(
      (e) => `--- ${e.company} | ${e.role} | ${e.period.start} to ${e.period.end} ---
Tags: ${e.tags.join(', ')}
Bullets:
${e.bullets.map((b) => `- ${b}`).join('\n')}
Narrative:
${e.narrative.trim()}`,
    )
    .join('\n\n');
}

function buildGenerateCvPrompt(
  job: Pick<Job, 'jd' | 'url' | 'category' | 'focus'>,
  profile: Profile,
  tailoringNotes: string,
  bulletWordRange: CvBulletWordRange,
  textSizeScale: CvTextSizeScale,
): string {
  const textSizePreset =
    CV_TEXT_SIZE_PRESETS.find((preset) => preset.scale.bodyPt === textSizeScale.bodyPt) ??
    CV_TEXT_SIZE_PRESETS.find((preset) => preset.id === 'balanced')!;
  const bulletLengthPreset =
    CV_BULLET_LENGTH_PRESETS.find(
      (preset) => preset.range.min === bulletWordRange.min && preset.range.max === bulletWordRange.max,
    ) ?? CV_BULLET_LENGTH_PRESETS.find((preset) => preset.id === 'balanced')!;

  const promptTemplate = GENERATE_CV_PROMPT.replace(BULLET_WORD_RANGE_TOKEN, `${bulletWordRange.min}-${bulletWordRange.max}`)
    .replace(TEXT_SIZE_NAME_TOKEN, textSizePreset.name.toLowerCase())
    .replace(TEXT_SIZE_BODY_PT_TOKEN, String(textSizeScale.bodyPt))
    .replace(MOST_RECENT_BULLET_COUNT_TOKEN, String(bulletLengthPreset.bulletCounts.mostRecent))
    .replace(OTHER_ROLE_BULLET_COUNT_TOKEN, String(bulletLengthPreset.bulletCounts.otherRoles))
    .replace(PAGE_FIT_INSTRUCTION_TOKEN, PAGE_FIT_INSTRUCTIONS[bulletLengthPreset.pageConstraint]);

  return `${promptTemplate}

---

${buildWritingGuidance('cv')}

---

## Job Description

${job.jd || `URL: ${job.url}`}

---

## Detected Category: ${job.category ?? 'engineering'}

## Detected Focus: ${job.focus ?? 'none'}

---

## Candidate CV

${profile.cv}

---

## Experience Database

${buildExperienceContext(profile.experiences)}

---

## Candidate Info

Name: ${profile.candidate.name}
Email: ${profile.candidate.email}
Location: ${profile.candidate.location}
Site: ${profile.candidate.site}

Education (static, use exactly as-is):
${profile.education.map((e) => `- ${e.institution}: ${e.degree}`).join('\n')}

## Application Guidance

${tailoringNotes.trim() || 'No additional guidance provided. Infer the strongest truthful framing from the JD and experience database.'}

OUTPUT ONLY VALID JSON. NO EXPLANATION. NO MARKDOWN.`;
}

function parseGeneratedCV(text: string): GeneratedCV {
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON found in resume generation response');

  const parsed = JSON.parse(jsonMatch[0]) as Partial<GeneratedCV>;
  if (!parsed.name) throw new Error('Missing name in generated resume');
  if (!Array.isArray(parsed.roles) || parsed.roles.length === 0) {
    throw new Error('Missing or empty roles in generated resume');
  }
  if (!Array.isArray(parsed.skills)) throw new Error('Missing skills in generated resume');

  // Guard: strip any education entries that leaked into the roles array (no bullets = not a role)
  parsed.roles = parsed.roles.filter((r) => Array.isArray(r.bullets) && r.bullets.length > 0);
  if (parsed.roles.length === 0) {
    throw new Error('All roles were filtered out — possible education/roles mix-up in generation');
  }

  return parsed as GeneratedCV;
}

// ── Cover letter generation ────────────────────────────────────────

function selectRelevantAnswers(answers: AnswerEntry[], job: Pick<Job, 'company' | 'role'>): AnswerEntry[] {
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
    .map((answer) =>
      [
        `Question: ${answer.question}`,
        `Tone: ${answer.tone}`,
        answer.context.trim() ? `Candidate Notes: ${answer.context.trim()}` : '',
        `Answer Sample: ${answer.answer.trim()}`,
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n\n---\n\n');
}

function buildGenerateCoverLetterPrompt(
  job: Pick<Job, 'company' | 'role' | 'jdSummary' | 'jd' | 'url'>,
  profile: Profile,
  tailoringNotes: string,
  totalWordCount: CoverLetterTotalWordCount,
  tone: string,
): string {
  const relevantAnswers = selectRelevantAnswers(answersDb.readAnswers(), job);
  const promptTemplate = GENERATE_COVER_LETTER_PROMPT.replace(TOTAL_WORD_COUNT_TOKEN, String(totalWordCount.target));
  const toneDesc = TONE_DESCRIPTIONS[tone] ?? tone;

  return `${promptTemplate}

---

${buildWritingGuidance('cover-letter')}

---

## Candidate Background

${buildProfileSummary(profile)}

---

## Company and Role Context

${buildJobContext(job)}

---

## Desired Tone

${tone}: ${toneDesc}

---

## Saved Answers Voice Reference

Use these to mirror sentence discipline and boundaries. Reuse the style, not the wording — the desired tone above takes priority.

${buildAnswerVoiceContext(relevantAnswers)}

---

## Application Guidance

${tailoringNotes.trim() || 'No additional guidance provided. Use the strongest truthful fit from the role and candidate background.'}

OUTPUT ONLY VALID JSON. NO EXPLANATION. NO MARKDOWN.`;
}

function parseGeneratedCoverLetter(text: string): GeneratedCoverLetter {
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON found in cover letter generation response');

  const parsed = JSON.parse(jsonMatch[0]) as Partial<GeneratedCoverLetter>;
  if (!parsed.name) throw new Error('Missing name in generated cover letter');
  if (!parsed.contact?.email) throw new Error('Missing contact in generated cover letter');
  if (!parsed.company) throw new Error('Missing company in generated cover letter');
  if (!parsed.role) throw new Error('Missing role in generated cover letter');
  if (!Array.isArray(parsed.paragraphs) || parsed.paragraphs.length < 3 || parsed.paragraphs.length > 4) {
    throw new Error('Generated cover letter must contain 3-4 paragraphs');
  }

  return {
    ...parsed,
    paragraphs: parsed.paragraphs.map((paragraph) => String(paragraph)),
  } as GeneratedCoverLetter;
}

// ── IPC handler registration ──────────────────────────────────────

export function registerAiHandlers(): void {
  ipcMain.handle(IPC.AI_EVALUATE, async (_event, { jobId }: { jobId: string }) => {
    const job = db.readJobs().find((j) => j.id === jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);
    const profile = loadProfile();
    return evaluateJob(job, profile);
  });

  ipcMain.handle(IPC.AI_GENERATE_RESUME, async (
    _event,
    args: {
      jobId: string;
      tailoringNotes?: string;
      bulletWordRange?: CvBulletWordRange;
      textSizeScale?: CvTextSizeScale;
    },
  ) => {
    const job = db.readJobs().find((j) => j.id === args.jobId);
    if (!job) throw new Error(`Job ${args.jobId} not found`);
    const profile = loadProfile();

    const tailoringNotes = args.tailoringNotes ?? '';
    const bulletWordRange = args.bulletWordRange ?? DEFAULT_CV_BULLET_WORD_RANGE;
    const textSizeScale = args.textSizeScale ?? DEFAULT_CV_TEXT_SIZE_SCALE;

    const prompt = buildGenerateCvPrompt(job, profile, tailoringNotes, bulletWordRange, textSizeScale);
    let lastError: Error | null = null;
    let cv: GeneratedCV | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const raw = await runQuery(prompt);
      try {
        cv = parseGeneratedCV(raw);
        break;
      } catch (err) {
        lastError = err as Error;
      }
    }
    if (!cv) throw new Error(`Failed to generate resume: ${lastError?.message}`);

    // Contact info comes from the profile record, not the model, so it can't drift
    // from the real data even if the model mishandles it.
    cv.name = profile.candidate.name;
    cv.contact = {
      email: profile.candidate.email,
      location: profile.candidate.location,
      site: profile.candidate.site,
    };

    const filename = buildResumeFilename(profile.candidate.name, job.company);
    const pdfPath = join(DATA_DIR, 'output', filename);
    await renderPDF(cv, pdfPath, textSizeScale);

    db.updateJob(job.id, { pdfPath, theme: 'resume' });
    return { pdfPath };
  });

  ipcMain.handle(IPC.AI_GENERATE_COVER_LETTER, async (
    _event,
    args: {
      jobId: string;
      tailoringNotes?: string;
      totalWordCount?: CoverLetterTotalWordCount;
      tone?: string;
    },
  ) => {
    const job = db.readJobs().find((j) => j.id === args.jobId);
    if (!job) throw new Error(`Job ${args.jobId} not found`);
    const profile = loadProfile();

    const tailoringNotes = args.tailoringNotes ?? '';
    const totalWordCount = args.totalWordCount ?? DEFAULT_COVER_LETTER_TOTAL_WORD_COUNT;
    const tone = args.tone ?? 'Professional';

    const prompt = buildGenerateCoverLetterPrompt(job, profile, tailoringNotes, totalWordCount, tone);
    let lastError: Error | null = null;
    let cl: GeneratedCoverLetter | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const raw = await runQuery(prompt);
      try {
        cl = parseGeneratedCoverLetter(raw);
        break;
      } catch (err) {
        lastError = err as Error;
      }
    }
    if (!cl) throw new Error(`Failed to generate cover letter: ${lastError?.message}`);

    // Contact/name/company/role come from the profile and job records, not the model,
    // so they can't drift from the real data even if the model mishandles them.
    cl.name = profile.candidate.name;
    cl.contact = {
      email: profile.candidate.email,
      location: profile.candidate.location,
      site: profile.candidate.site,
    };
    cl.company = job.company;
    cl.role = job.role;

    const filename = buildCoverLetterFilename(profile.candidate.name, job.company);
    const coverLetterPdfPath = join(DATA_DIR, 'output', filename);
    await renderCoverLetterPDF(cl, coverLetterPdfPath);

    db.updateJob(job.id, { coverLetterPdfPath, theme: 'cover-letter' });
    return { pdfPath: coverLetterPdfPath };
  });

  ipcMain.handle(IPC.AI_EXTRACT_PROFILE, async (_event, resumeInput: string | number[]) => {
    const resumeText = typeof resumeInput === 'string'
      ? resumeInput
      : await extractTextFromPdf(Buffer.from(resumeInput));
    return extractProfileFromText(resumeText);
  });

  ipcMain.handle(IPC.AI_EXTRACT_PROFILE_FROM_URL, async (_event, url: string) => {
    const pdfBuffer = await fetchPdfFromUrl(url);
    const resumeText = await extractTextFromPdf(pdfBuffer);
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

    return runQuery(prompt);
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

    return runQuery(prompt);
  });
}
