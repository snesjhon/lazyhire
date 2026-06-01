import { ipcMain, BrowserWindow } from 'electron';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { query } from '@anthropic-ai/claude-code';
import puppeteer from 'puppeteer-core';
import { IPC } from '@shared/ipc-channels';
import { loadProfile } from '../services/profile.js';
import { getClaudeQueryOptions } from '../services/claude.js';
import { buildWritingGuidance, buildSharedWritingGuidance, buildArtifactWritingGuidance } from '../services/writing-guidance.js';
import { extractTextFromPdf } from '../services/pdf.js';
import { findChrome } from '../services/chrome.js';
import { db } from '../services/db.js';
import { DATA_DIR } from '../services/paths.js';
import type { AnswerCategory, EvaluationResult, GeneratedCV, GeneratedCoverLetter, Job, Profile } from '@shared/types';

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
    const raw = await runQuery(prompt, IPC.AI_EVALUATE);
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

const RESUME_PROMPT = (profile: Profile, job: Pick<Job, 'company' | 'role' | 'jd' | 'jdSummary'>) => `You are writing a tailored, ATS-optimized resume for a specific job application.

## Candidate Profile
Name: ${profile.candidate.name}
Email: ${profile.candidate.email}
Location: ${profile.candidate.location}
Site: ${profile.candidate.site}
${profile.candidate.github ? `GitHub: ${profile.candidate.github}` : ''}
${profile.candidate.linkedin ? `LinkedIn: ${profile.candidate.linkedin}` : ''}
Headline: ${profile.headline}
Summary: ${profile.summary}
Skills: ${profile.skills.join(', ')}
Experiences:
${profile.experiences.map((e) => `
Company: ${e.company}
Role: ${e.role}
Period: ${e.period.start} - ${e.period.end}
Bullets:
${e.bullets.map((b) => `  - ${b}`).join('\n')}`).join('\n')}
Education:
${profile.education.map((e) => `- ${e.degree} at ${e.institution}`).join('\n')}

## Target Job
Company: ${job.company}
Role: ${job.role}
Job Description:
${(job.jdSummary || job.jd || '').slice(0, 2000)}

## Task
Generate a tailored resume optimized for this specific job. Return ONLY valid JSON matching this exact schema. No explanation. No markdown fences.

{
  "name": <string>,
  "title": <string: a headline/title tailored to this role>,
  "contact": { "email": <string>, "location": <string>, "site": <string> },
  "skills": <string[]: 8-12 skills most relevant to this job, ordered by relevance>,
  "roles": [
    {
      "company": <string>,
      "role": <string>,
      "period": { "start": <string: YYYY-MM>, "end": <string: YYYY-MM or "Present"> },
      "bullets": <string[]: 3-5 tailored achievement bullets, quantified where possible>
    }
  ],
  "education": [{ "institution": <string>, "degree": <string> }]
}

${buildSharedWritingGuidance()}
${buildArtifactWritingGuidance('cv')}

OUTPUT ONLY VALID JSON. NO EXPLANATION. NO MARKDOWN CODE FENCES.`;

const COVER_LETTER_PROMPT = (profile: Profile, job: Pick<Job, 'company' | 'role' | 'jd' | 'jdSummary'>) => `You are writing a tailored cover letter for a job application.

## Candidate Profile
Name: ${profile.candidate.name}
Email: ${profile.candidate.email}
Location: ${profile.candidate.location}
Site: ${profile.candidate.site}
Headline: ${profile.headline}
Summary: ${profile.summary}
Skills: ${profile.skills.join(', ')}
${profile.experiences.slice(0, 3).map((e) => `- ${e.role} at ${e.company}: ${e.narrative || e.bullets.slice(0, 2).join('; ')}`).join('\n')}

## Target Job
Company: ${job.company}
Role: ${job.role}
Job Description:
${(job.jdSummary || job.jd || '').slice(0, 2000)}

## Task
Generate a compelling, concise cover letter (3 paragraphs). Return ONLY valid JSON matching this exact schema. No explanation. No markdown fences.

{
  "name": <string>,
  "contact": { "email": <string>, "location": <string>, "site": <string> },
  "company": <string>,
  "role": <string>,
  "paragraphs": <string[]: exactly 3 paragraphs — opening hook, body with evidence, closing>
}

${buildSharedWritingGuidance()}
${buildArtifactWritingGuidance('cover-letter')}

OUTPUT ONLY VALID JSON. NO EXPLANATION. NO MARKDOWN CODE FENCES.`;

// ── PDF rendering ─────────────────────────────────────────────────

async function renderToPdf(html: string, outputPath: string): Promise<void> {
  const browser = await puppeteer.launch({
    executablePath: findChrome(),
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.pdf({ path: outputPath, format: 'Letter', margin: { top: '0.75in', bottom: '0.75in', left: '0.75in', right: '0.75in' } });
  } finally {
    await browser.close();
  }
}

function buildResumeHtml(cv: GeneratedCV): string {
  const roles = cv.roles.map((r) => `
    <div class="role">
      <div class="role-header">
        <span class="company">${r.company}</span>
        <span class="period">${r.period.start} – ${r.period.end}</span>
      </div>
      <div class="role-title">${r.role}</div>
      <ul>${r.bullets.map((b) => `<li>${b}</li>`).join('')}</ul>
    </div>`).join('');

  const education = cv.education.map((e) => `<div class="edu"><strong>${e.institution}</strong> — ${e.degree}</div>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Georgia, serif; font-size: 10.5pt; color: #111; line-height: 1.45; }
    h1 { font-size: 18pt; font-weight: bold; letter-spacing: -0.02em; }
    .title { font-size: 11pt; color: #444; margin-top: 2px; margin-bottom: 8px; }
    .contact { font-size: 9.5pt; color: #555; margin-bottom: 16px; }
    .contact span + span::before { content: " · "; }
    h2 { font-size: 10pt; text-transform: uppercase; letter-spacing: 0.08em; color: #555; border-bottom: 0.5px solid #ccc; padding-bottom: 2px; margin: 14px 0 8px; }
    .skills { font-size: 9.5pt; color: #222; }
    .role { margin-bottom: 12px; }
    .role-header { display: flex; justify-content: space-between; }
    .company { font-weight: bold; }
    .period { font-size: 9.5pt; color: #666; }
    .role-title { font-style: italic; color: #444; margin-bottom: 3px; }
    ul { padding-left: 16px; }
    li { margin-bottom: 2px; font-size: 9.5pt; }
    .edu { margin-bottom: 4px; font-size: 9.5pt; }
  </style></head><body>
    <h1>${cv.name}</h1>
    <div class="title">${cv.title}</div>
    <div class="contact">
      <span>${cv.contact.email}</span>
      <span>${cv.contact.location}</span>
      ${cv.contact.site ? `<span>${cv.contact.site}</span>` : ''}
    </div>
    <h2>Skills</h2>
    <div class="skills">${cv.skills.join(' · ')}</div>
    <h2>Experience</h2>
    ${roles}
    <h2>Education</h2>
    ${education}
  </body></html>`;
}

function buildCoverLetterHtml(cl: GeneratedCoverLetter): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Georgia, serif; font-size: 11pt; color: #111; line-height: 1.6; }
    .header { margin-bottom: 32px; }
    h1 { font-size: 16pt; font-weight: bold; }
    .contact { font-size: 9.5pt; color: #555; margin-top: 4px; }
    .contact span + span::before { content: " · "; }
    .salutation { margin-bottom: 16px; }
    p { margin-bottom: 14px; }
    .closing { margin-top: 24px; }
  </style></head><body>
    <div class="header">
      <h1>${cl.name}</h1>
      <div class="contact">
        <span>${cl.contact.email}</span>
        <span>${cl.contact.location}</span>
        ${cl.contact.site ? `<span>${cl.contact.site}</span>` : ''}
      </div>
    </div>
    <div class="salutation">Hiring Team, ${cl.company}</div>
    <div class="body">
      ${cl.paragraphs.map((p) => `<p>${p}</p>`).join('')}
    </div>
    <div class="closing">Sincerely,<br><strong>${cl.name}</strong></div>
  </body></html>`;
}

// ── IPC handler registration ──────────────────────────────────────

export function registerAiHandlers(): void {
  ipcMain.handle(IPC.AI_EVALUATE, async (_event, { jobId }: { jobId: string }) => {
    const job = db.readJobs().find((j) => j.id === jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);
    const profile = loadProfile();
    return evaluateJob(job, profile);
  });

  ipcMain.handle(IPC.AI_GENERATE_RESUME, async (_event, { jobId }: { jobId: string }) => {
    const job = db.readJobs().find((j) => j.id === jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);
    const profile = loadProfile();

    const prompt = RESUME_PROMPT(profile, job);
    let lastError: Error | null = null;
    let cv: GeneratedCV | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const raw = await runQuery(prompt, IPC.AI_GENERATE_RESUME);
      try {
        const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        cv = JSON.parse(cleaned) as GeneratedCV;
        break;
      } catch (err) {
        lastError = err as Error;
      }
    }
    if (!cv) throw new Error(`Failed to generate resume: ${lastError?.message}`);

    const pdfDir = join(DATA_DIR, 'pdfs');
    mkdirSync(pdfDir, { recursive: true });
    const filename = `resume_${jobId}_${Date.now()}.pdf`;
    const pdfPath = join(pdfDir, filename);
    const html = buildResumeHtml(cv);
    await renderToPdf(html, pdfPath);

    db.updateJob(jobId, { pdfPath });
    return { pdfPath };
  });

  ipcMain.handle(IPC.AI_GENERATE_COVER_LETTER, async (_event, { jobId }: { jobId: string }) => {
    const job = db.readJobs().find((j) => j.id === jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);
    const profile = loadProfile();

    const prompt = COVER_LETTER_PROMPT(profile, job);
    let lastError: Error | null = null;
    let cl: GeneratedCoverLetter | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const raw = await runQuery(prompt, IPC.AI_GENERATE_COVER_LETTER);
      try {
        const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        cl = JSON.parse(cleaned) as GeneratedCoverLetter;
        break;
      } catch (err) {
        lastError = err as Error;
      }
    }
    if (!cl) throw new Error(`Failed to generate cover letter: ${lastError?.message}`);

    const pdfDir = join(DATA_DIR, 'pdfs');
    mkdirSync(pdfDir, { recursive: true });
    const filename = `cover_${jobId}_${Date.now()}.pdf`;
    const pdfPath = join(pdfDir, filename);
    const html = buildCoverLetterHtml(cl);
    await renderToPdf(html, pdfPath);

    db.updateJob(jobId, { coverLetterPdfPath: pdfPath });
    return { pdfPath };
  });

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
