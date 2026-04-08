# Profile Init & Single Source of Truth — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the three-file profile setup with a single `profile/profile.json`, add `npm run init` wizard that builds it from a resume PDF, and add a Profile screen in the TUI for editing targets.

**Architecture:** `src/types.ts` defines `Profile` as the contract. `src/profile.ts` exposes `loadProfile()` / `saveProfile()` (sync, JSON-backed). `src/init.tsx` entry point runs the Ink wizard (`src/init/wizard.tsx`) which fetches + parses a PDF, calls Claude to extract structured data, asks follow-up questions, then writes `profile/profile.json`. The main TUI gains a Profile screen (`src/ui/Profile.tsx`) for editing targets post-init.

**Tech Stack:** TypeScript ESM, Ink (React for terminal), `@anthropic-ai/claude-code` SDK, `pdf-parse` (new — PDF text extraction), native `fetch` (Node 18+, PDF URL download), vitest

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Modify | `src/types.ts` | Remove `CandidateConfig`; new flat `Profile` shape |
| Modify | `src/profile.ts` | JSON-based `createProfileStore` factory + default exports |
| Create | `src/profile.test.ts` | Tests for load/save via `createProfileStore` |
| Modify | `src/claude/evaluation.ts` | `buildConfigSummary` reads `profile.targets` directly |
| Modify | `src/claude/generate.ts` | `GenerateInput` uses `candidate`/`education` instead of `config` |
| Modify | `src/claude/generate.test.ts` | Update `buildGeneratePrompt` test to new shape |
| Modify | `src/scan.ts` | `rankJob`/`runScan` accept `Profile` instead of `CandidateConfig` |
| Modify | `src/ui/Scan.tsx` | Pass `profile` instead of `profile.config` to `runScan` |
| Modify | `src/ui/JobDetail.tsx` | `loadProfile()` is sync — remove `.then()` wrapper |
| Modify | `src/ui/Generate.tsx` | `loadProfile()` is sync — remove `await` |
| Create | `src/init/pdf.ts` | Fetch PDF from URL or path; extract text via `pdf-parse` |
| Create | `src/init/extract.ts` | Claude extraction prompt + `parseExtractionResult` |
| Create | `src/init/extract.test.ts` | Tests for `parseExtractionResult` |
| Create | `src/init/wizard.tsx` | Ink multi-step wizard component |
| Create | `src/init.tsx` | Entry point: renders Ink `<Wizard />` |
| Create | `src/ui/Profile.tsx` | Profile view + edit targets screen |
| Modify | `src/ui/App.tsx` | Add `profile` to screen enum + render `<Profile />` |
| Modify | `src/ui/Dashboard.tsx` | Add `p` keybinding → profile screen |
| Modify | `package.json` | Add `"init": "tsx src/init.tsx"` script |

---

## Task 1: Update Profile type + profile loader

**Files:**
- Modify: `src/types.ts`
- Modify: `src/profile.ts`
- Create: `src/profile.test.ts`

- [ ] **Step 1: Write failing test for `createProfileStore`**

Create `src/profile.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createProfileStore } from './profile.js';
import type { Profile } from './types.js';

const TMP = join(process.cwd(), 'tmp-test-profile');
const PROFILE_PATH = join(TMP, 'profile.json');

const sample: Profile = {
  candidate: { name: 'Jane', email: 'j@j.com', location: 'SF, CA', site: 'j.dev' },
  headline: 'Sr. Engineer',
  summary: 'Experienced engineer with 10 years.',
  cv: '# Jane\nSr. Engineer at Acme',
  targets: {
    roles: ['Sr. Software Engineer'],
    salaryMin: 150000,
    salaryMax: 200000,
    remote: 'full',
    dealBreakers: ['no equity'],
    archetypes: ['platform'],
  },
  experiences: [
    {
      company: 'Acme',
      role: 'Sr. Engineer',
      period: { start: '2021-03', end: 'present' },
      tags: ['TypeScript', 'React'],
      bullets: ['Built X', 'Led Y'],
      narrative: 'Led frontend platform work.',
    },
  ],
  education: [{ institution: 'UC Davis', degree: 'B.A. Psychology' }],
  skills: ['TypeScript', 'React', 'GraphQL'],
};

describe('createProfileStore', () => {
  let store: ReturnType<typeof createProfileStore>;

  beforeEach(() => {
    mkdirSync(TMP, { recursive: true });
    store = createProfileStore(PROFILE_PATH);
  });

  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  it('throws when profile file does not exist', () => {
    expect(() => store.load()).toThrow('Run npm run init');
  });

  it('saves and loads a profile round-trip', () => {
    store.save(sample);
    const loaded = store.load();
    expect(loaded.candidate.name).toBe('Jane');
    expect(loaded.targets.salaryMin).toBe(150000);
    expect(loaded.experiences).toHaveLength(1);
    expect(loaded.skills).toContain('TypeScript');
  });

  it('load returns correct targets shape', () => {
    store.save(sample);
    const loaded = store.load();
    expect(loaded.targets.remote).toBe('full');
    expect(loaded.targets.archetypes).toContain('platform');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- profile
```

Expected: FAIL — `createProfileStore` not found.

- [ ] **Step 3: Update `src/types.ts` — remove `CandidateConfig`, add new `Profile`**

Replace the existing `CandidateConfig` interface and `Profile` interface with:

```typescript
export interface Profile {
  candidate: {
    name: string;
    email: string;
    location: string;
    site: string;
    github?: string;
    linkedin?: string;
  };
  headline: string;
  summary: string;
  cv: string;  // raw text extracted from PDF resume; used verbatim in Claude prompts
  targets: {
    roles: string[];
    salaryMin: number;
    salaryMax: number;
    remote: 'full' | 'hybrid' | 'any';
    dealBreakers: string[];
    archetypes: string[];
  };
  experiences: Experience[];
  education: Array<{ institution: string; degree: string }>;
  skills: string[];
}
```

Remove the `CandidateConfig` interface entirely. Remove `CandidateConfig` from all exports in this file.

- [ ] **Step 4: Rewrite `src/profile.ts`**

```typescript
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { Profile } from './types.js';

export function createProfileStore(profilePath: string) {
  function load(): Profile {
    if (!existsSync(profilePath)) {
      throw new Error('Profile not found. Run npm run init to set up your profile.');
    }
    return JSON.parse(readFileSync(profilePath, 'utf8')) as Profile;
  }

  function save(profile: Profile): void {
    writeFileSync(profilePath, JSON.stringify(profile, null, 2), 'utf8');
  }

  return { load, save };
}

const DEFAULT_PATH = join(process.cwd(), 'profile', 'profile.json');
const defaultStore = createProfileStore(DEFAULT_PATH);
export const loadProfile = defaultStore.load;
export const saveProfile = defaultStore.save;
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test -- profile
```

Expected: PASS — 3 tests.

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/profile.ts src/profile.test.ts
git commit -m "refactor: consolidate Profile type — remove CandidateConfig, JSON-backed loader"
```

---

## Task 2: Update `evaluation.ts` for new Profile shape

**Files:**
- Modify: `src/claude/evaluation.ts`

Note: `evaluation.test.ts` tests `buildEvalPrompt` via `EvalInput` directly (not `Profile`), so it needs no changes.

- [ ] **Step 1: Update `buildConfigSummary` in `src/claude/evaluation.ts`**

The function currently reads `profile.config`. Replace it:

```typescript
function buildConfigSummary(profile: Profile): string {
  return [
    `Target roles: ${profile.targets.roles.join(', ')}`,
    `Salary target: $${profile.targets.salaryMin.toLocaleString()} – $${profile.targets.salaryMax.toLocaleString()}`,
    `Remote preference: ${profile.targets.remote}`,
    `Preferred archetypes: ${profile.targets.archetypes.join(', ')}`,
    `Deal-breakers: ${profile.targets.dealBreakers.join(', ')}`,
  ].join('\n');
}
```

- [ ] **Step 2: Run tests**

```bash
npm test -- evaluation
```

Expected: PASS — all existing tests pass (they test `EvalInput` shapes, not Profile).

- [ ] **Step 3: Commit**

```bash
git add src/claude/evaluation.ts
git commit -m "refactor: evaluation.ts reads profile.targets directly"
```

---

## Task 3: Update `generate.ts`, `scan.ts`, and affected UI files

**Files:**
- Modify: `src/claude/generate.ts`
- Modify: `src/claude/generate.test.ts`
- Modify: `src/scan.ts`
- Modify: `src/ui/Scan.tsx`
- Modify: `src/ui/JobDetail.tsx`
- Modify: `src/ui/Generate.tsx`

- [ ] **Step 1: Update `generate.test.ts` for new `GenerateInput` shape**

Replace the `buildGeneratePrompt` test (lines 33–50 of the current file):

```typescript
describe('buildGeneratePrompt', () => {
  it('includes archetype in prompt', () => {
    const prompt = buildGeneratePrompt({
      jd: 'Platform engineering role',
      archetype: 'platform',
      cv: '# Jane',
      experienceContext: '--- Acme ---',
      candidate: { name: 'Jane', email: 'j@j.com', location: 'SF', site: 'j.dev' },
      education: [{ institution: 'UC Davis', degree: 'B.A. Psychology' }],
    });
    expect(prompt).toContain('platform');
    expect(prompt).toContain('Platform engineering role');
    expect(prompt).toContain('Jane');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- generate
```

Expected: FAIL — `buildGeneratePrompt` still expects `config`.

- [ ] **Step 3: Update `GenerateInput` and `buildGeneratePrompt` in `src/claude/generate.ts`**

Replace the `GenerateInput` interface:

```typescript
export interface GenerateInput {
  jd: string;
  archetype: string;
  cv: string;
  experienceContext: string;
  candidate: {
    name: string;
    email: string;
    location: string;
    site: string;
  };
  education: Array<{ institution: string; degree: string }>;
}
```

Remove the `CandidateConfig` import from the top of the file.

Update the candidate info block in `buildGeneratePrompt` (replace the `input.config.candidate.*` and `input.config.education` references):

```typescript
## Candidate Info

Name: ${input.candidate.name}
Email: ${input.candidate.email}
Location: ${input.candidate.location}
Site: ${input.candidate.site}

Education (static, use exactly as-is):
${input.education.map((e) => `- ${e.institution}: ${e.degree}`).join('\n')}
```

Update `generateCV` to pass the new fields:

```typescript
export async function generateCV(
  job: { jd: string; archetype: string | null },
  profile: Profile
): Promise<GeneratedCV> {
  const prompt = buildGeneratePrompt({
    jd: job.jd,
    archetype: job.archetype ?? 'platform',
    cv: profile.cv,
    experienceContext: buildExperienceContext(profile.experiences),
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
```

- [ ] **Step 4: Update `rankJob` and `runScan` in `src/scan.ts`**

Change the `CandidateConfig` import to `Profile`. Replace the `rankJob` signature and body:

```typescript
import type { ScanJob, Profile } from './types.js';

function rankJob(job: ScanJob, profile: Profile): number {
  let score = 0;
  const titleLower = job.title.toLowerCase();

  // Role keyword match (up to 3 points)
  for (const role of profile.targets.roles) {
    const words = role.toLowerCase().split(' ').filter((w) => w.length > 2);
    const allMatch = words.every((w) => titleLower.includes(w));
    const someMatch = words.some((w) => titleLower.includes(w));
    if (allMatch) { score += 3; break; }
    if (someMatch) { score += 1; }
  }

  // Seniority boost
  if (SENIORITY_WORDS.some((w) => titleLower.includes(w))) score += 2;

  // Archetype alignment
  for (const arch of profile.targets.archetypes) {
    const kws = ARCHETYPE_KEYWORDS[arch] ?? [];
    if (kws.some((k) => titleLower.includes(k))) { score += 1; break; }
  }

  // Remote match
  const snippet = (job.snippet ?? '').toLowerCase();
  if (profile.targets.remote === 'full' && (snippet.includes('remote') || titleLower.includes('remote'))) {
    score += 1;
  }

  return score;
}
```

Update `runScan` signature. Change the first parameter from `config: CandidateConfig` to `profile: Profile`. Change line 95 from `const roleKeywords = config.targets.roles;` to `const roleKeywords = profile.targets.roles;`. Everywhere `rankJob(job, config)` appears, change to `rankJob(job, profile)`.

- [ ] **Step 5: Update `src/ui/Scan.tsx` — pass `profile` instead of `profile.config`**

On line 48-50, change:
```typescript
const results = await runScan(
  profile.config,
  existingUrls,
```
to:
```typescript
const results = await runScan(
  profile,
  existingUrls,
```

- [ ] **Step 6: Make `loadProfile` calls sync in `JobDetail.tsx` and `Generate.tsx`**

In `src/ui/JobDetail.tsx`, find the Evaluate handler (around line 91–108). Replace:

```typescript
if (selected === 'Evaluate') {
  setEvaluating(true);
  loadProfile().then((profile) => {
    const jd = job.jd || `URL: ${job.url}`;
    evaluateJob(jd, profile).then((result) => {
      const reportPath = `output/${job.id}-${job.company.toLowerCase().replace(/\s+/g, '-')}.md`;
      const report = buildReport(job, result);
      writeFileSync(join(process.cwd(), reportPath), report, 'utf8');
      db.updateJob(job.id, {
        status: 'Evaluated',
        score: result.score,
        archetype: result.archetype,
        reportPath,
      });
      setJob({ ...job, status: 'Evaluated', score: result.score, archetype: result.archetype });
      setEvaluating(false);
    });
  });
}
```

With:

```typescript
if (selected === 'Evaluate') {
  setEvaluating(true);
  const profile = loadProfile();
  const jd = job.jd || `URL: ${job.url}`;
  evaluateJob(jd, profile).then((result) => {
    const reportPath = `output/${job.id}-${job.company.toLowerCase().replace(/\s+/g, '-')}.md`;
    const report = buildReport(job, result);
    writeFileSync(join(process.cwd(), reportPath), report, 'utf8');
    db.updateJob(job.id, {
      status: 'Evaluated',
      score: result.score,
      archetype: result.archetype,
      reportPath,
    });
    setJob({ ...job, status: 'Evaluated', score: result.score, archetype: result.archetype });
    setEvaluating(false);
  });
}
```

In `src/ui/Generate.tsx`, in `runGeneration`, replace:
```typescript
const profile = await loadProfile();
```
With:
```typescript
const profile = loadProfile();
```

In `src/ui/Scan.tsx`, replace:
```typescript
const profile = await loadProfile();
```
With:
```typescript
const profile = loadProfile();
```

- [ ] **Step 7: Run all tests**

```bash
npm test
```

Expected: PASS — all tests green.

- [ ] **Step 8: Commit**

```bash
git add src/claude/generate.ts src/claude/generate.test.ts src/scan.ts src/ui/Scan.tsx src/ui/JobDetail.tsx src/ui/Generate.tsx
git commit -m "refactor: generate/scan/ui use new Profile shape"
```

---

## Task 4: Install `pdf-parse` and create PDF extraction utility

**Files:**
- Create: `src/init/pdf.ts`

- [ ] **Step 1: Install `pdf-parse`**

```bash
npm install pdf-parse
npm install --save-dev @types/pdf-parse
```

Expected: package.json updated with `pdf-parse` in dependencies.

- [ ] **Step 2: Create `src/init/pdf.ts`**

```typescript
import { readFileSync } from 'fs';
import { createRequire } from 'module';

// pdf-parse is CommonJS; use createRequire for ESM compatibility
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>;

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const result = await pdfParse(buffer);
  return result.text.trim();
}

export async function fetchPdfFromUrl(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch PDF from ${url}: ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export function readPdfFromPath(filePath: string): Buffer {
  return readFileSync(filePath);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/init/pdf.ts package.json package-lock.json
git commit -m "feat: add PDF text extraction utility"
```

---

## Task 5: Create Claude extraction logic

**Files:**
- Create: `src/init/extract.ts`
- Create: `src/init/extract.test.ts`

- [ ] **Step 1: Write failing tests for `parseExtractionResult`**

Create `src/init/extract.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parseExtractionResult } from './extract.js';

const validResult = {
  candidate: { name: 'Jane Doe', email: 'jane@example.com', location: 'SF, CA', site: 'jane.dev', github: 'github.com/jane', linkedin: null },
  headline: 'Sr. Software Engineer — ex-Acme, fintech',
  summary: 'Experienced engineer with 8 years building frontend systems at scale.',
  experiences: [
    {
      company: 'Acme',
      role: 'Sr. Software Engineer',
      period: { start: '2021-03', end: 'present' },
      tags: ['TypeScript', 'React', 'GraphQL'],
      bullets: ['Led migration to React', 'Improved bundle size by 40%'],
      narrative: 'Led frontend platform work across multiple product teams.',
    },
  ],
  education: [{ institution: 'UC Davis', degree: 'B.A. Psychology' }],
  skills: ['TypeScript', 'React', 'GraphQL'],
  suggestedRoles: ['Sr. Software Engineer', 'Senior Frontend Engineer'],
  suggestedArchetypes: ['platform'],
};

describe('parseExtractionResult', () => {
  it('parses valid extraction JSON', () => {
    const result = parseExtractionResult(JSON.stringify(validResult));
    expect(result.candidate.name).toBe('Jane Doe');
    expect(result.experiences).toHaveLength(1);
    expect(result.suggestedRoles).toContain('Sr. Software Engineer');
  });

  it('parses when wrapped in markdown code fence', () => {
    const fenced = '```json\n' + JSON.stringify(validResult) + '\n```';
    const result = parseExtractionResult(fenced);
    expect(result.candidate.name).toBe('Jane Doe');
  });

  it('throws when candidate is missing', () => {
    const bad = { ...validResult };
    delete (bad as any).candidate;
    expect(() => parseExtractionResult(JSON.stringify(bad))).toThrow('candidate');
  });

  it('throws when experiences is not an array', () => {
    const bad = { ...validResult, experiences: 'wrong' };
    expect(() => parseExtractionResult(JSON.stringify(bad))).toThrow('experiences');
  });

  it('throws when suggestedArchetypes is missing', () => {
    const bad = { ...validResult };
    delete (bad as any).suggestedArchetypes;
    expect(() => parseExtractionResult(JSON.stringify(bad))).toThrow('suggestedArchetypes');
  });

  it('throws on invalid JSON', () => {
    expect(() => parseExtractionResult('not json')).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- extract
```

Expected: FAIL — `parseExtractionResult` not found.

- [ ] **Step 3: Create `src/init/extract.ts`**

```typescript
import { query } from '@anthropic-ai/claude-code';
import type { Profile } from '../types.js';

export interface ExtractionResult {
  candidate: Profile['candidate'];
  headline: string;
  summary: string;
  experiences: Profile['experiences'];
  education: Profile['education'];
  skills: string[];
  suggestedRoles: string[];       // Claude's inferred target roles from the resume
  suggestedArchetypes: string[];  // values from: platform, agentic, pm, architect, fde, transformation
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
  "headline": "string — e.g. 'Sr. Frontend Engineer — ex-[Company], [domain]'",
  "summary": "string — professional summary, 3-4 sentences",
  "experiences": [
    {
      "company": "string",
      "role": "string",
      "period": { "start": "YYYY-MM", "end": "YYYY-MM or 'present'" },
      "tags": ["tech stack and domain keywords for this role"],
      "bullets": ["key accomplishments, 3-6 items"],
      "narrative": "string — 1-2 sentence narrative about this role"
    }
  ],
  "education": [
    { "institution": "string", "degree": "string" }
  ],
  "skills": ["all technical skills mentioned in the resume"],
  "suggestedRoles": ["3-5 job titles this person should target based on their experience"],
  "suggestedArchetypes": ["1-3 values from ONLY this list: platform, agentic, pm, architect, fde, transformation — pick what fits the resume"]
}

OUTPUT ONLY VALID JSON. NO EXPLANATION. NO MARKDOWN CODE FENCES.`;

export function parseExtractionResult(text: string): ExtractionResult {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON found in extraction response');

  const parsed = JSON.parse(jsonMatch[0]) as Partial<ExtractionResult>;

  if (!parsed.candidate) throw new Error('Missing candidate in extraction result');
  if (!Array.isArray(parsed.experiences)) throw new Error('Missing or invalid experiences in extraction result');
  if (!parsed.headline) throw new Error('Missing headline in extraction result');
  if (!Array.isArray(parsed.skills)) throw new Error('Missing skills in extraction result');
  if (!Array.isArray(parsed.suggestedRoles)) throw new Error('Missing suggestedRoles in extraction result');
  if (!Array.isArray(parsed.suggestedArchetypes)) throw new Error('Missing suggestedArchetypes in extraction result');

  return parsed as ExtractionResult;
}

export async function extractProfileFromText(resumeText: string): Promise<ExtractionResult> {
  const prompt = `${EXTRACTION_PROMPT}\n\n---\n\nResume:\n\n${resumeText}`;

  let responseText = '';
  for await (const message of query({ prompt, options: { maxTurns: 1 } })) {
    if (message.type === 'result' && message.subtype === 'success') {
      responseText = message.result;
    }
  }

  return parseExtractionResult(responseText);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- extract
```

Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/init/extract.ts src/init/extract.test.ts
git commit -m "feat: Claude extraction logic for profile init"
```

---

## Task 6: Create the init wizard TUI

**Files:**
- Create: `src/init/wizard.tsx`

- [ ] **Step 1: Create `src/init/wizard.tsx`**

```typescript
import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import MultilineInput from '../ui/MultilineInput.js';
import { fetchPdfFromUrl, readPdfFromPath, extractTextFromPdf } from './pdf.js';
import { extractProfileFromText, type ExtractionResult } from './extract.js';
import { createProfileStore } from '../profile.js';
import type { Profile } from '../types.js';

type Step =
  | { name: 'input' }
  | { name: 'loading'; message: string }
  | { name: 'review'; extracted: ExtractionResult; rawText: string }
  | { name: 'roles'; extracted: ExtractionResult; rawText: string; rolesInput: string }
  | { name: 'salary-min'; extracted: ExtractionResult; rawText: string; roles: string[] }
  | { name: 'salary-max'; extracted: ExtractionResult; rawText: string; roles: string[]; salaryMin: number }
  | { name: 'remote'; extracted: ExtractionResult; rawText: string; roles: string[]; salaryMin: number; salaryMax: number }
  | { name: 'deal-breakers'; extracted: ExtractionResult; rawText: string; roles: string[]; salaryMin: number; salaryMax: number; remote: Profile['targets']['remote']; dealBreakers: string[] }
  | { name: 'done'; profilePath: string }
  | { name: 'error'; message: string };

const PROFILE_DIR = join(process.cwd(), 'profile');
const PROFILE_PATH = join(PROFILE_DIR, 'profile.json');

function buildProfile(extracted: ExtractionResult, rawText: string, targets: Profile['targets']): Profile {
  return {
    candidate: {
      name: extracted.candidate.name,
      email: extracted.candidate.email,
      location: extracted.candidate.location,
      site: extracted.candidate.site,
      ...(extracted.candidate.github ? { github: extracted.candidate.github } : {}),
      ...(extracted.candidate.linkedin ? { linkedin: extracted.candidate.linkedin } : {}),
    },
    headline: extracted.headline,
    summary: extracted.summary,
    cv: rawText,
    targets,
    experiences: extracted.experiences,
    education: extracted.education,
    skills: extracted.skills,
  };
}

export default function Wizard() {
  const [step, setStep] = useState<Step>({ name: 'input' });
  const [remoteCursor, setRemoteCursor] = useState(0);
  const REMOTE_OPTIONS: Profile['targets']['remote'][] = ['full', 'hybrid', 'any'];

  useInput((input, key) => {
    if (step.name === 'review') {
      if (key.return) {
        const rolesInput = step.extracted.suggestedRoles.join(', ');
        setStep({ name: 'roles', extracted: step.extracted, rawText: step.rawText, rolesInput });
      }
      if (key.escape) process.exit(0);
    }

    if (step.name === 'remote') {
      if (key.upArrow) setRemoteCursor((c) => Math.max(0, c - 1));
      if (key.downArrow) setRemoteCursor((c) => Math.min(2, c + 1));
      if (key.return) {
        setStep({
          name: 'deal-breakers',
          extracted: step.extracted,
          rawText: step.rawText,
          roles: step.roles,
          salaryMin: step.salaryMin,
          salaryMax: step.salaryMax,
          remote: REMOTE_OPTIONS[remoteCursor],
          dealBreakers: [],
        });
      }
      if (key.escape) process.exit(0);
    }

  });

  function finishWizard(s: Extract<Step, { name: 'deal-breakers' }>) {
    const targets: Profile['targets'] = {
      roles: s.roles,
      salaryMin: s.salaryMin,
      salaryMax: s.salaryMax,
      remote: s.remote,
      dealBreakers: s.dealBreakers,
      archetypes: s.extracted.suggestedArchetypes.length > 0
        ? s.extracted.suggestedArchetypes
        : ['platform'],
    };
    const profile = buildProfile(s.extracted, s.rawText, targets);
    if (!existsSync(PROFILE_DIR)) mkdirSync(PROFILE_DIR, { recursive: true });
    const store = createProfileStore(PROFILE_PATH);
    store.save(profile);
    setStep({ name: 'done', profilePath: PROFILE_PATH });
  }

  // ── Input step ────────────────────────────────────────────────────────────

  if (step.name === 'input') {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Box marginBottom={1}>
          <Text bold color="cyan">open-positions init</Text>
        </Box>
        <MultilineInput
          label="Resume PDF — enter a URL or local file path"
          hint="Paste URL or path, then Ctrl+C to continue"
          onSubmit={(source) => {
            const s = source.trim();
            if (!s) { process.exit(0); return; }
            setStep({ name: 'loading', message: 'Fetching PDF...' });

            async function run() {
              try {
                let buffer: Buffer;
                if (s.startsWith('http://') || s.startsWith('https://')) {
                  buffer = await fetchPdfFromUrl(s);
                } else {
                  buffer = readPdfFromPath(s);
                }

                setStep({ name: 'loading', message: 'Extracting text...' });
                const rawText = await extractTextFromPdf(buffer);

                setStep({ name: 'loading', message: 'Analyzing resume with Claude...' });
                const extracted = await extractProfileFromText(rawText);

                setStep({ name: 'review', extracted, rawText });
              } catch (err) {
                setStep({ name: 'error', message: String(err) });
              }
            }

            run();
          }}
        />
      </Box>
    );
  }

  // ── Loading step ──────────────────────────────────────────────────────────

  if (step.name === 'loading') {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text bold color="cyan">open-positions init</Text>
        <Text color="yellow">{step.message}</Text>
      </Box>
    );
  }

  // ── Review step ───────────────────────────────────────────────────────────

  if (step.name === 'review') {
    const { extracted } = step;
    return (
      <Box flexDirection="column" paddingX={1}>
        <Box marginBottom={1}><Text bold color="cyan">Resume extracted</Text></Box>
        <Text><Text bold>Name: </Text>{extracted.candidate.name}</Text>
        <Text><Text bold>Email: </Text>{extracted.candidate.email}</Text>
        <Text><Text bold>Location: </Text>{extracted.candidate.location}</Text>
        <Text><Text bold>Experiences: </Text>{extracted.experiences.length} roles found</Text>
        <Text><Text bold>Skills: </Text>{extracted.skills.slice(0, 8).join(', ')}{extracted.skills.length > 8 ? ' ...' : ''}</Text>
        <Box marginTop={1}>
          <Text dimColor>enter to continue  esc to abort</Text>
        </Box>
      </Box>
    );
  }

  // ── Roles step ────────────────────────────────────────────────────────────

  if (step.name === 'roles') {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Box marginBottom={1}><Text bold>Target roles</Text></Box>
        <Text dimColor>Claude suggests (edit as needed, comma-separated):</Text>
        <MultilineInput
          label=""
          hint="Edit roles, then Ctrl+C to continue"
          onSubmit={(value) => {
            const roles = value.split(',').map((r) => r.trim()).filter(Boolean);
            setStep({
              name: 'salary-min',
              extracted: step.extracted,
              rawText: step.rawText,
              roles: roles.length > 0 ? roles : step.extracted.suggestedRoles,
            });
          }}
        />
        <Text dimColor>Current: {step.rolesInput}</Text>
      </Box>
    );
  }

  // ── Salary min step ───────────────────────────────────────────────────────

  if (step.name === 'salary-min') {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Box marginBottom={1}><Text bold>Salary range</Text></Box>
        <MultilineInput
          label="Minimum salary (USD, numbers only)"
          hint="e.g. 150000 — Ctrl+C to continue"
          onSubmit={(value) => {
            const num = parseInt(value.replace(/[^0-9]/g, ''), 10);
            setStep({
              name: 'salary-max',
              extracted: step.extracted,
              rawText: step.rawText,
              roles: step.roles,
              salaryMin: isNaN(num) ? 0 : num,
            });
          }}
        />
      </Box>
    );
  }

  // ── Salary max step ───────────────────────────────────────────────────────

  if (step.name === 'salary-max') {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Box marginBottom={1}><Text bold>Salary range</Text></Box>
        <Text dimColor>Min: ${step.salaryMin.toLocaleString()}</Text>
        <MultilineInput
          label="Maximum salary (USD, numbers only)"
          hint="e.g. 200000 — Ctrl+C to continue"
          onSubmit={(value) => {
            const num = parseInt(value.replace(/[^0-9]/g, ''), 10);
            setStep({
              name: 'remote',
              extracted: step.extracted,
              rawText: step.rawText,
              roles: step.roles,
              salaryMin: step.salaryMin,
              salaryMax: isNaN(num) ? 0 : num,
            });
          }}
        />
      </Box>
    );
  }

  // ── Remote step ───────────────────────────────────────────────────────────

  if (step.name === 'remote') {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Box marginBottom={1}><Text bold>Remote preference</Text></Box>
        {REMOTE_OPTIONS.map((opt, i) => (
          <Text key={opt} color={i === remoteCursor ? 'cyan' : undefined}>
            {i === remoteCursor ? '▶ ' : '  '}{opt}
          </Text>
        ))}
        <Box marginTop={1}><Text dimColor>↑↓ navigate  enter select</Text></Box>
      </Box>
    );
  }

  // ── Deal-breakers step ────────────────────────────────────────────────────

  if (step.name === 'deal-breakers') {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Box marginBottom={1}><Text bold>Deal-breakers</Text></Box>
        {step.dealBreakers.length > 0 && (
          <Box flexDirection="column" marginBottom={1}>
            {step.dealBreakers.map((db, i) => (
              <Text key={i} dimColor>• {db}</Text>
            ))}
          </Box>
        )}
        <MultilineInput
          label="Add a deal-breaker (submit empty to finish)"
          hint="Type a deal-breaker, Ctrl+C to add — Ctrl+C with empty input to finish"
          onSubmit={(value) => {
            const trimmed = value.trim();
            if (trimmed) {
              setStep({ ...step, dealBreakers: [...step.dealBreakers, trimmed] });
            } else {
              finishWizard(step);
            }
          }}
        />
      </Box>
    );
  }

  // ── Done step ─────────────────────────────────────────────────────────────

  if (step.name === 'done') {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text color="green">✓ Profile created</Text>
        <Text dimColor>{step.profilePath}</Text>
        <Box marginTop={1}><Text>Run <Text color="cyan">npm start</Text> to begin.</Text></Box>
      </Box>
    );
  }

  // ── Error step ────────────────────────────────────────────────────────────

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text color="red">✗ Error</Text>
      <Text dimColor>{(step as Extract<Step, { name: 'error' }>).message}</Text>
      <Box marginTop={1}><Text dimColor>Fix the issue and run npm run init again.</Text></Box>
    </Box>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/init/wizard.tsx
git commit -m "feat: init wizard TUI — multi-step profile builder"
```

---

## Task 7: Create `src/init.tsx` entry point + update `package.json`

**Files:**
- Create: `src/init.tsx`
- Modify: `package.json`

- [ ] **Step 1: Create `src/init.tsx`**

```typescript
import React from 'react';
import { render } from 'ink';
import Wizard from './init/wizard.js';

render(<Wizard />);
```

- [ ] **Step 2: Add `init` script to `package.json`**

In the `"scripts"` block, add:

```json
"init": "tsx src/init.tsx"
```

The full scripts block becomes:

```json
"scripts": {
  "start": "tsx src/index.tsx",
  "init": "tsx src/init.tsx",
  "scan": "tsx src/index.tsx --scan",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 3: Verify init script can be invoked**

```bash
npm run init -- --help 2>&1 || true
```

Expected: The script starts (Ink renders) — it will hang waiting for input, which proves it launches. Kill with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add src/init.tsx package.json
git commit -m "feat: npm run init entry point"
```

---

## Task 8: Create Profile screen

**Files:**
- Create: `src/ui/Profile.tsx`

- [ ] **Step 1: Create `src/ui/Profile.tsx`**

```typescript
import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { loadProfile, saveProfile } from '../profile.js';
import MultilineInput from './MultilineInput.js';
import type { Profile } from '../types.js';

type Section = 'menu' | 'edit-roles' | 'edit-salary-min' | 'edit-salary-max' | 'edit-remote' | 'edit-deal-breakers';

const REMOTE_OPTIONS: Profile['targets']['remote'][] = ['full', 'hybrid', 'any'];
const MENU_ITEMS = ['Edit target roles', 'Edit salary range', 'Edit remote preference', 'Edit deal-breakers', 'Back'] as const;

interface Props {
  onBack: () => void;
}

export default function ProfileScreen({ onBack }: Props) {
  const [profile, setProfile] = useState<Profile>(() => loadProfile());
  const [section, setSection] = useState<Section>('menu');
  const [cursor, setCursor] = useState(0);
  const [remoteCursor, setRemoteCursor] = useState(
    REMOTE_OPTIONS.indexOf(profile.targets.remote)
  );
  const [salaryStagedMin, setSalaryStagedMin] = useState<number | null>(null);

  useInput((input, key) => {
    if (key.escape) { onBack(); return; }

    if (section === 'menu') {
      if (key.upArrow) setCursor((c) => Math.max(0, c - 1));
      if (key.downArrow) setCursor((c) => Math.min(MENU_ITEMS.length - 1, c + 1));
      if (key.return) {
        const selected = MENU_ITEMS[cursor];
        if (selected === 'Back') { onBack(); return; }
        if (selected === 'Edit target roles') setSection('edit-roles');
        if (selected === 'Edit salary range') setSection('edit-salary-min');
        if (selected === 'Edit remote preference') setSection('edit-remote');
        if (selected === 'Edit deal-breakers') setSection('edit-deal-breakers');
      }
    }

    if (section === 'edit-remote') {
      if (key.upArrow) setRemoteCursor((c) => Math.max(0, c - 1));
      if (key.downArrow) setRemoteCursor((c) => Math.min(2, c + 1));
      if (key.return) {
        const updated = {
          ...profile,
          targets: { ...profile.targets, remote: REMOTE_OPTIONS[remoteCursor] },
        };
        saveProfile(updated);
        setProfile(updated);
        setSection('menu');
      }
    }
  });

  // ── Menu ──────────────────────────────────────────────────────────────────

  if (section === 'menu') {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Box marginBottom={1}>
          <Text bold color="cyan">{profile.candidate.name}</Text>
          <Text dimColor> — {profile.headline}</Text>
        </Box>

        <Box marginBottom={1} flexDirection="column">
          <Text dimColor>Roles: {profile.targets.roles.join(', ')}</Text>
          <Text dimColor>Salary: ${profile.targets.salaryMin.toLocaleString()} – ${profile.targets.salaryMax.toLocaleString()}</Text>
          <Text dimColor>Remote: {profile.targets.remote}</Text>
          <Text dimColor>Deal-breakers: {profile.targets.dealBreakers.length > 0 ? profile.targets.dealBreakers.join(', ') : 'none'}</Text>
        </Box>

        <Box flexDirection="column">
          {MENU_ITEMS.map((item, i) => (
            <Text key={item} color={i === cursor ? 'cyan' : undefined}>
              {i === cursor ? '▶ ' : '  '}{item}
            </Text>
          ))}
        </Box>

        <Box marginTop={1}>
          <Text dimColor>↑↓ navigate  enter select  esc back</Text>
        </Box>
      </Box>
    );
  }

  // ── Edit roles ────────────────────────────────────────────────────────────

  if (section === 'edit-roles') {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text dimColor>Current: {profile.targets.roles.join(', ')}</Text>
        <MultilineInput
          label="Target roles (comma-separated)"
          hint="Edit and Ctrl+C to save"
          onSubmit={(value) => {
            const roles = value.split(',').map((r) => r.trim()).filter(Boolean);
            if (roles.length > 0) {
              const updated = { ...profile, targets: { ...profile.targets, roles } };
              saveProfile(updated);
              setProfile(updated);
            }
            setSection('menu');
          }}
        />
      </Box>
    );
  }

  // ── Edit salary min ───────────────────────────────────────────────────────

  if (section === 'edit-salary-min') {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text dimColor>Current min: ${profile.targets.salaryMin.toLocaleString()}</Text>
        <MultilineInput
          label="New minimum salary (USD)"
          hint="Numbers only — Ctrl+C to continue"
          onSubmit={(value) => {
            const num = parseInt(value.replace(/[^0-9]/g, ''), 10);
            if (!isNaN(num)) setSalaryStagedMin(num);
            setSection('edit-salary-max');
          }}
        />
      </Box>
    );
  }

  // ── Edit salary max ───────────────────────────────────────────────────────

  if (section === 'edit-salary-max') {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text dimColor>Current max: ${profile.targets.salaryMax.toLocaleString()}</Text>
        <MultilineInput
          label="New maximum salary (USD)"
          hint="Numbers only — Ctrl+C to save"
          onSubmit={(value) => {
            const max = parseInt(value.replace(/[^0-9]/g, ''), 10);
            const min = salaryStagedMin ?? profile.targets.salaryMin;
            const updated = {
              ...profile,
              targets: {
                ...profile.targets,
                salaryMin: min,
                salaryMax: isNaN(max) ? profile.targets.salaryMax : max,
              },
            };
            saveProfile(updated);
            setProfile(updated);
            setSalaryStagedMin(null);
            setSection('menu');
          }}
        />
      </Box>
    );
  }

  // ── Edit remote ───────────────────────────────────────────────────────────

  if (section === 'edit-remote') {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Box marginBottom={1}><Text bold>Remote preference</Text></Box>
        {REMOTE_OPTIONS.map((opt, i) => (
          <Text key={opt} color={i === remoteCursor ? 'cyan' : undefined}>
            {i === remoteCursor ? '▶ ' : '  '}{opt}
          </Text>
        ))}
        <Box marginTop={1}><Text dimColor>↑↓ navigate  enter save  esc cancel</Text></Box>
      </Box>
    );
  }

  // ── Edit deal-breakers ────────────────────────────────────────────────────

  if (section === 'edit-deal-breakers') {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Box marginBottom={1}><Text bold>Deal-breakers</Text></Box>
        {profile.targets.dealBreakers.map((db, i) => (
          <Text key={i} dimColor>• {db}</Text>
        ))}
        <MultilineInput
          label="Add a deal-breaker (or leave blank to finish)"
          hint="Ctrl+C to add — submit blank to go back"
          onSubmit={(value) => {
            const trimmed = value.trim();
            if (trimmed) {
              const updated = {
                ...profile,
                targets: {
                  ...profile.targets,
                  dealBreakers: [...profile.targets.dealBreakers, trimmed],
                },
              };
              saveProfile(updated);
              setProfile(updated);
            } else {
              setSection('menu');
            }
          }}
        />
      </Box>
    );
  }

  return null;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/Profile.tsx
git commit -m "feat: Profile screen — view and edit targets in main TUI"
```

---

## Task 9: Wire Profile screen into App and Dashboard

**Files:**
- Modify: `src/ui/App.tsx`
- Modify: `src/ui/Dashboard.tsx`

- [ ] **Step 1: Update `src/ui/App.tsx`**

Add `profile` to the `Screen` union:

```typescript
type Screen =
  | { name: 'dashboard' }
  | { name: 'scan' }
  | { name: 'add' }
  | { name: 'profile' }
  | { name: 'detail'; job: Job }
  | { name: 'generate'; job: Job };
```

Add `ProfileScreen` import and `profile` to the `go` object:

```typescript
import ProfileScreen from './Profile.js';

// inside App():
const go = {
  dashboard: () => setScreen({ name: 'dashboard' }),
  scan:      () => setScreen({ name: 'scan' }),
  add:       () => setScreen({ name: 'add' }),
  profile:   () => setScreen({ name: 'profile' }),
  detail:    (job: Job) => setScreen({ name: 'detail', job }),
  generate:  (job: Job) => setScreen({ name: 'generate', job }),
};
```

Add the profile render block before the `return null`:

```typescript
if (screen.name === 'profile') {
  return <ProfileScreen onBack={go.dashboard} />;
}
```

Pass `onProfile` to Dashboard:

```typescript
if (screen.name === 'dashboard') {
  return <Dashboard onAdd={go.add} onScan={go.scan} onSelect={go.detail} onProfile={go.profile} />;
}
```

- [ ] **Step 2: Update `src/ui/Dashboard.tsx`**

Add `onProfile` to the `Props` interface:

```typescript
interface Props {
  jobs?: Job[];
  onAdd: () => void;
  onScan: () => void;
  onSelect: (job: Job) => void;
  onProfile: () => void;
}
```

Add `onProfile` to the destructured props and the `useInput` handler:

```typescript
export default function Dashboard({ jobs: injectedJobs, onAdd, onScan, onSelect, onProfile }: Props) {
  // ...
  useInput((input, key) => {
    if (key.upArrow) setCursor((c) => Math.max(0, c - 1));
    if (key.downArrow) setCursor((c) => Math.min(Math.max(0, filtered.length - 1), c + 1));
    if (key.tab) setFilterIdx((i) => (i + 1) % FILTERS.length);
    if (key.return && filtered.length > 0) onSelect(filtered[cursor]);
    if (input === 'a') onAdd();
    if (input === 's') onScan();
    if (input === 'p') onProfile();
    if (input === 'q') process.exit(0);
  });
```

Update the footer hint:

```typescript
<Text dimColor>↑↓ navigate  enter select  a add  s scan  p profile  tab filter  q quit</Text>
```

- [ ] **Step 3: Run all tests**

```bash
npm test
```

Expected: PASS — all tests green.

- [ ] **Step 4: Commit**

```bash
git add src/ui/App.tsx src/ui/Dashboard.tsx
git commit -m "feat: wire Profile screen into main TUI — p to open from dashboard"
```

---

## Cleanup

- [ ] **Delete `profile/profile.yml`** — superseded by `profile/profile.json`

```bash
git rm profile/profile.yml
git commit -m "chore: remove profile.yml — replaced by profile.json"
```

- [ ] **Smoke test `npm run init`** — run through the wizard end to end with a real PDF URL or local file; verify `profile/profile.json` is created and `npm start` loads without errors.
