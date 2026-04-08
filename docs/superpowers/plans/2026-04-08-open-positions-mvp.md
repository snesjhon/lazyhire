# open-positions MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a terminal-first job search TUI that manages a local job database, evaluates JDs with Claude, and generates ATS-optimized CVs with multiple visual themes.

**Architecture:** Ink (React for terminal) owns the entire UI. All screens are Ink components. Claude Code SDK (`@anthropic-ai/claude-code`) handles LLM calls using the user's Claude subscription. All personal data (jobs, CV, config, experiences) lives in a gitignored `profile/` directory. Puppeteer renders PDFs from HTML themes.

**Tech Stack:** TypeScript ESM, Ink 5, React 18, `@anthropic-ai/claude-code` SDK, Puppeteer 22, Vitest, `ink-testing-library`

---

## File Map

| File | Responsibility |
|---|---|
| `src/types.ts` | All shared TypeScript types |
| `src/db.ts` | Read/write `profile/jobs.json` |
| `src/profile.ts` | Load cv.md + config.ts + experiences at runtime |
| `src/index.tsx` | Entry point — renders root App component |
| `src/ui/App.tsx` | Screen router (state enum, no URL routing) |
| `src/ui/Dashboard.tsx` | Navigable job table with status filter |
| `src/ui/MultilineInput.tsx` | Reusable raw-mode multiline input component |
| `src/ui/AddJob.tsx` | Add job by URL or pasted JD |
| `src/ui/JobDetail.tsx` | Single job view + actions (evaluate, generate, status) |
| `src/ui/Generate.tsx` | Theme picker + CV generation progress + output path |
| `src/claude/evaluation.ts` | Call Claude → parse structured EvaluationResult JSON |
| `src/claude/generate.ts` | Call Claude → parse GeneratedCV JSON |
| `src/pdf.ts` | Puppeteer: inject GeneratedCV into theme HTML → PDF |
| `prompts/archetypes.md` | Role archetype detection rules (ported from career-ops) |
| `prompts/evaluation.md` | A-F evaluation instructions, JSON output format |
| `prompts/generate-cv.md` | ATS CV generation instructions, JSON output format |
| `themes/minimal.html` | Single-column, ATS-safe template |
| `themes/modern.html` | Accent color, single-column template |
| `themes/two-column.html` | Sidebar skills + main experience template |
| `profile/config.example.ts` | Example config (committed, gitignored actual) |
| `profile/cv.example.md` | Example CV structure (committed) |
| `profile/experiences/index.example.ts` | Example experience data structure |

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `profile/.gitkeep`
- Create: `output/.gitkeep`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "open-positions",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "tsx src/index.tsx",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@anthropic-ai/claude-code": "^1.0.0",
    "ink": "^5.0.1",
    "puppeteer": "^22.0.0",
    "react": "^18.3.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^18.3.0",
    "ink-testing-library": "^3.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create `.gitignore`**

```
node_modules/
dist/
profile/
output/
*.env
```

- [ ] **Step 4: Create placeholder dirs**

```bash
mkdir -p profile/experiences output src/ui src/claude prompts themes
touch profile/.gitkeep output/.gitkeep
```

- [ ] **Step 5: Install dependencies**

```bash
npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 6: Commit**

```bash
git add package.json tsconfig.json .gitignore src/ prompts/ themes/ profile/.gitkeep output/.gitkeep
git commit -m "feat: project scaffold"
```

---

## Task 2: Shared Types

**Files:**
- Create: `src/types.ts`
- Create: `src/types.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/types.test.ts
import { describe, it, expect } from 'vitest';
import { JOB_STATUSES, isJobStatus } from './types.js';

describe('isJobStatus', () => {
  it('accepts valid statuses', () => {
    expect(isJobStatus('Pending')).toBe(true);
    expect(isJobStatus('Evaluated')).toBe(true);
    expect(isJobStatus('Offer')).toBe(true);
  });

  it('rejects invalid statuses', () => {
    expect(isJobStatus('Foo')).toBe(false);
    expect(isJobStatus('')).toBe(false);
  });

  it('exports all 7 statuses', () => {
    expect(JOB_STATUSES).toHaveLength(7);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- src/types.test.ts
```

Expected: FAIL — `Cannot find module './types.js'`

- [ ] **Step 3: Create `src/types.ts`**

```typescript
// src/types.ts

export const JOB_STATUSES = [
  'Pending',
  'Evaluated',
  'Applied',
  'Interview',
  'Offer',
  'Rejected',
  'Discarded',
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export function isJobStatus(value: string): value is JobStatus {
  return (JOB_STATUSES as readonly string[]).includes(value);
}

export type Theme = 'minimal' | 'modern' | 'two-column';

export interface Job {
  id: string;          // zero-padded, e.g. "001"
  added: string;       // YYYY-MM-DD
  company: string;
  role: string;
  url: string;
  jd: string;          // raw JD text
  status: JobStatus;
  score: number | null;
  archetype: string | null;
  reportPath: string | null;
  pdfPath: string | null;
  theme: Theme | null;
  notes: string;
}

export interface EvaluationResult {
  score: number;
  archetype: string;
  recommendation: 'apply' | 'consider' | 'discard';
  blockA: {
    tldr: string;
    domain: string;
    function: string;
    seniority: string;
    remote: string;
    teamSize: string | null;
  };
  blockB: {
    matches: Array<{ requirement: string; cvEvidence: string }>;
    gaps: Array<{ requirement: string; blocker: boolean; mitigation: string }>;
  };
  blockC: {
    analysis: string;
    seniorityAnalysis: string;
  };
  blockD: string[];
  blockE: string;
  blockF: Array<{ requirement: string; story: string }>;
}

export interface GeneratedCV {
  name: string;
  title: string;
  contact: {
    email: string;
    location: string;
    site: string;
  };
  skills: string[];
  roles: Array<{
    company: string;
    role: string;
    period: { start: string; end: string };
    bullets: string[];
  }>;
  education: Array<{
    institution: string;
    degree: string;
  }>;
}

export interface Experience {
  company: string;
  role: string;
  period: { start: string; end: string };
  tags: string[];
  bullets: string[];
  narrative: string;
}

export interface CandidateConfig {
  candidate: {
    name: string;
    email: string;
    location: string;
    site: string;
  };
  targets: {
    roles: string[];
    salaryMin: number;
    salaryMax: number;
    remote: 'full' | 'hybrid' | 'any';
    dealBreakers: string[];
  };
  archetypes: {
    preferred: string[];
    avoid: string[];
  };
  education: Array<{
    institution: string;
    degree: string;
  }>;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- src/types.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/types.test.ts
git commit -m "feat: shared types and JobStatus guard"
```

---

## Task 3: Data Layer

**Files:**
- Create: `src/db.ts`
- Create: `src/db.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/db.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { createDb } from './db.js';
import type { Job } from './types.js';

const TMP = join(process.cwd(), 'tmp-test-db');
const DB_FILE = join(TMP, 'jobs.json');

const makeJob = (overrides: Partial<Job> = {}): Job => ({
  id: '001',
  added: '2026-04-08',
  company: 'Acme',
  role: 'Sr. Engineer',
  url: 'https://acme.com/job',
  jd: '',
  status: 'Pending',
  score: null,
  archetype: null,
  reportPath: null,
  pdfPath: null,
  theme: null,
  notes: '',
  ...overrides,
});

describe('db', () => {
  let db: ReturnType<typeof createDb>;

  beforeEach(() => {
    mkdirSync(TMP, { recursive: true });
    db = createDb(DB_FILE);
  });

  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  it('reads empty array when file does not exist', () => {
    expect(db.readJobs()).toEqual([]);
  });

  it('adds a job and reads it back', () => {
    const job = makeJob();
    db.addJob(job);
    expect(db.readJobs()).toEqual([job]);
  });

  it('updates a job by id', () => {
    db.addJob(makeJob());
    db.updateJob('001', { status: 'Evaluated', score: 4.2 });
    const jobs = db.readJobs();
    expect(jobs[0].status).toBe('Evaluated');
    expect(jobs[0].score).toBe(4.2);
  });

  it('throws when updating non-existent id', () => {
    expect(() => db.updateJob('999', { status: 'Applied' })).toThrow('Job 999 not found');
  });

  it('nextId returns 001 for empty db', () => {
    expect(db.nextId()).toBe('001');
  });

  it('nextId increments from existing jobs', () => {
    db.addJob(makeJob({ id: '003' }));
    db.addJob(makeJob({ id: '001' }));
    expect(db.nextId()).toBe('004');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- src/db.test.ts
```

Expected: FAIL — `Cannot find module './db.js'`

- [ ] **Step 3: Create `src/db.ts`**

```typescript
// src/db.ts
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { Job } from './types.js';

const DEFAULT_PATH = join(process.cwd(), 'profile', 'jobs.json');

export function createDb(dbPath = DEFAULT_PATH) {
  function readJobs(): Job[] {
    if (!existsSync(dbPath)) return [];
    return JSON.parse(readFileSync(dbPath, 'utf8')) as Job[];
  }

  function writeJobs(jobs: Job[]): void {
    writeFileSync(dbPath, JSON.stringify(jobs, null, 2), 'utf8');
  }

  function addJob(job: Job): void {
    const jobs = readJobs();
    jobs.push(job);
    writeJobs(jobs);
  }

  function updateJob(id: string, patch: Partial<Job>): void {
    const jobs = readJobs();
    const idx = jobs.findIndex((j) => j.id === id);
    if (idx === -1) throw new Error(`Job ${id} not found`);
    jobs[idx] = { ...jobs[idx], ...patch };
    writeJobs(jobs);
  }

  function nextId(): string {
    const jobs = readJobs();
    if (jobs.length === 0) return '001';
    const max = Math.max(...jobs.map((j) => parseInt(j.id, 10)));
    return String(max + 1).padStart(3, '0');
  }

  return { readJobs, writeJobs, addJob, updateJob, nextId };
}

// Default singleton — used by the app
export const db = createDb();
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- src/db.test.ts
```

Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/db.ts src/db.test.ts
git commit -m "feat: data layer with createDb factory"
```

---

## Task 4: Profile Loader + Example Files

**Files:**
- Create: `src/profile.ts`
- Create: `profile/config.example.ts`
- Create: `profile/cv.example.md`
- Create: `profile/experiences/index.example.ts`

- [ ] **Step 1: Create `profile/config.example.ts`**

```typescript
// profile/config.example.ts
// Copy this file to profile/config.ts and fill in your details.
// This file is committed. profile/config.ts is gitignored.
import type { CandidateConfig } from '../src/types.js';

export const config: CandidateConfig = {
  candidate: {
    name: 'Your Name',
    email: 'you@example.com',
    location: 'City, State',
    site: 'yoursite.com',
  },
  targets: {
    roles: ['Sr. Software Engineer', 'Staff Engineer'],
    salaryMin: 150000,
    salaryMax: 200000,
    remote: 'full',
    dealBreakers: ['no on-site only', 'no legacy Java stacks'],
  },
  archetypes: {
    preferred: ['platform', 'agentic'],
    avoid: ['transformation'],
  },
  education: [
    {
      institution: 'Your University',
      degree: 'Your Degree',
    },
  ],
};
```

- [ ] **Step 2: Create `profile/cv.example.md`**

```markdown
# Your Name

**Email:** you@example.com | **Location:** City, State | **Site:** yoursite.com

## Summary

One paragraph. What you do, at what scale, for whom. No clichés.

## Experience

### Company Name — Role Title (YYYY-MM – YYYY-MM)
- Bullet with metric: built X that achieved Y
- Bullet with metric: led Z resulting in W

### Previous Company — Role Title (YYYY-MM – YYYY-MM)
- Bullet with metric
- Bullet with metric

## Skills

TypeScript, React, Node.js, PostgreSQL, AWS, ...

## Education

**University Name** — B.S. Computer Science
```

- [ ] **Step 3: Create `profile/experiences/index.example.ts`**

```typescript
// profile/experiences/index.example.ts
// Copy this file to profile/experiences/index.ts and fill in your experience.
// This file is committed. profile/experiences/index.ts is gitignored.
import type { Experience } from '../../src/types.js';

export const ALL_EXPERIENCES: Experience[] = [
  {
    company: 'Acme Corp',
    role: 'Senior Software Engineer',
    period: { start: '2022-03', end: '2024-01' },
    tags: ['TypeScript', 'platform', 'distributed-systems'],
    bullets: [
      'Led migration of 200+ services to new platform, reducing infra costs 40%',
      'Built internal developer portal used by 80+ engineers daily',
    ],
    narrative: `
      Built and scaled the core platform that all product teams depend on.
      Focused on reliability, developer experience, and cost efficiency.
    `.trim(),
  },
];
```

- [ ] **Step 4: Create `src/profile.ts`**

```typescript
// src/profile.ts
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { CandidateConfig, Experience } from './types.js';

const PROFILE_DIR = join(process.cwd(), 'profile');

export interface Profile {
  cv: string;
  config: CandidateConfig;
  experiences: Experience[];
}

export async function loadProfile(): Promise<Profile> {
  const cvPath = join(PROFILE_DIR, 'cv.md');
  const configPath = join(PROFILE_DIR, 'config.ts');
  const expPath = join(PROFILE_DIR, 'experiences', 'index.ts');

  if (!existsSync(cvPath)) {
    throw new Error(`Missing profile/cv.md — copy profile/cv.example.md to get started`);
  }
  if (!existsSync(configPath)) {
    throw new Error(`Missing profile/config.ts — copy profile/config.example.ts to get started`);
  }
  if (!existsSync(expPath)) {
    throw new Error(`Missing profile/experiences/index.ts — copy the example to get started`);
  }

  const cv = readFileSync(cvPath, 'utf8');

  // Dynamic import so TypeScript config is live-loaded
  const { config } = (await import(/* @vite-ignore */ configPath)) as { config: CandidateConfig };
  const { ALL_EXPERIENCES } = (await import(/* @vite-ignore */ expPath)) as {
    ALL_EXPERIENCES: Experience[];
  };

  return { cv, config, experiences: ALL_EXPERIENCES };
}
```

- [ ] **Step 5: Commit**

```bash
git add src/profile.ts profile/config.example.ts profile/cv.example.md profile/experiences/index.example.ts
git commit -m "feat: profile loader and example files"
```

---

## Task 5: App Shell

**Files:**
- Create: `src/index.tsx`
- Create: `src/ui/App.tsx`

- [ ] **Step 1: Create `src/ui/App.tsx`**

```tsx
// src/ui/App.tsx
import React, { useState } from 'react';
import Dashboard from './Dashboard.js';
import AddJob from './AddJob.js';
import JobDetail from './JobDetail.js';
import Generate from './Generate.js';
import type { Job } from '../types.js';

type Screen =
  | { name: 'dashboard' }
  | { name: 'add' }
  | { name: 'detail'; job: Job }
  | { name: 'generate'; job: Job };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'dashboard' });

  const go = {
    dashboard: () => setScreen({ name: 'dashboard' }),
    add: () => setScreen({ name: 'add' }),
    detail: (job: Job) => setScreen({ name: 'detail', job }),
    generate: (job: Job) => setScreen({ name: 'generate', job }),
  };

  if (screen.name === 'dashboard') {
    return <Dashboard onAdd={go.add} onSelect={go.detail} />;
  }
  if (screen.name === 'add') {
    return <AddJob onBack={go.dashboard} />;
  }
  if (screen.name === 'detail') {
    return <JobDetail job={screen.job} onBack={go.dashboard} onGenerate={go.generate} />;
  }
  if (screen.name === 'generate') {
    return <Generate job={screen.job} onBack={go.dashboard} />;
  }
  return null;
}
```

- [ ] **Step 2: Create `src/index.tsx`**

```tsx
// src/index.tsx
import React from 'react';
import { render } from 'ink';
import App from './ui/App.js';

render(<App />);
```

- [ ] **Step 3: Verify it compiles**

```bash
npx tsx --check src/index.tsx
```

Expected: No errors. (Dashboard/AddJob/etc. don't exist yet — create stub files to satisfy imports.)

Create stubs:

```bash
for f in Dashboard AddJob JobDetail Generate; do
  echo "import React from 'react';\nimport { Text } from 'ink';\nexport default function $f(_: any) { return <Text>$f</Text>; }" > src/ui/$f.tsx
done
```

- [ ] **Step 4: Run the app to verify it starts**

```bash
npm start
```

Expected: Terminal shows stub text for Dashboard. Press Ctrl+C to exit.

- [ ] **Step 5: Commit**

```bash
git add src/index.tsx src/ui/App.tsx src/ui/Dashboard.tsx src/ui/AddJob.tsx src/ui/JobDetail.tsx src/ui/Generate.tsx
git commit -m "feat: app shell and screen router"
```

---

## Task 6: Dashboard Screen

**Files:**
- Modify: `src/ui/Dashboard.tsx`
- Create: `src/ui/Dashboard.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// src/ui/Dashboard.test.tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from 'ink-testing-library';
import Dashboard from './Dashboard.js';
import type { Job } from '../types.js';

const makeJob = (overrides: Partial<Job> = {}): Job => ({
  id: '001', added: '2026-04-08', company: 'Acme', role: 'Sr. Engineer',
  url: 'https://acme.com', jd: '', status: 'Pending', score: null,
  archetype: null, reportPath: null, pdfPath: null, theme: null, notes: '',
  ...overrides,
});

describe('Dashboard', () => {
  it('shows empty state when no jobs', () => {
    const { lastFrame } = render(
      <Dashboard jobs={[]} onAdd={vi.fn()} onSelect={vi.fn()} />
    );
    expect(lastFrame()).toContain('No jobs yet');
  });

  it('renders job rows', () => {
    const jobs = [makeJob(), makeJob({ id: '002', company: 'Beta', status: 'Evaluated', score: 4.2 })];
    const { lastFrame } = render(
      <Dashboard jobs={jobs} onAdd={vi.fn()} onSelect={vi.fn()} />
    );
    expect(lastFrame()).toContain('Acme');
    expect(lastFrame()).toContain('Beta');
    expect(lastFrame()).toContain('4.2');
  });

  it('shows keyboard hint', () => {
    const { lastFrame } = render(
      <Dashboard jobs={[makeJob()]} onAdd={vi.fn()} onSelect={vi.fn()} />
    );
    expect(lastFrame()).toContain('↑↓');
    expect(lastFrame()).toContain('enter');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- src/ui/Dashboard.test.tsx
```

Expected: FAIL

- [ ] **Step 3: Implement `src/ui/Dashboard.tsx`**

```tsx
// src/ui/Dashboard.tsx
import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { db } from '../db.js';
import type { Job, JobStatus } from '../types.js';
import { JOB_STATUSES } from '../types.js';

type Filter = 'All' | JobStatus;
const FILTERS: Filter[] = ['All', ...JOB_STATUSES];

interface Props {
  jobs?: Job[];  // injectable for tests
  onAdd: () => void;
  onSelect: (job: Job) => void;
}

function scoreDisplay(score: number | null): string {
  if (score === null) return '—';
  return score.toFixed(1);
}

function statusColor(status: JobStatus): string {
  const map: Record<JobStatus, string> = {
    Pending: 'yellow',
    Evaluated: 'cyan',
    Applied: 'blue',
    Interview: 'magenta',
    Offer: 'green',
    Rejected: 'red',
    Discarded: 'gray',
  };
  return map[status];
}

export default function Dashboard({ jobs: injectedJobs, onAdd, onSelect }: Props) {
  const jobs = injectedJobs ?? db.readJobs();
  const [cursor, setCursor] = useState(0);
  const [filterIdx, setFilterIdx] = useState(0);

  const filter = FILTERS[filterIdx];
  const filtered = filter === 'All' ? jobs : jobs.filter((j) => j.status === filter);

  useInput((input, key) => {
    if (key.upArrow) setCursor((c) => Math.max(0, c - 1));
    if (key.downArrow) setCursor((c) => Math.min(Math.max(0, filtered.length - 1), c + 1));
    if (key.tab) setFilterIdx((i) => (i + 1) % FILTERS.length);
    if (key.return && filtered.length > 0) onSelect(filtered[cursor]);
    if (input === 'a') onAdd();
    if (input === 'q') process.exit(0);
  });

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">open-positions</Text>
        <Text> — {jobs.length} jobs</Text>
      </Box>

      {/* Filter tabs */}
      <Box marginBottom={1} gap={1}>
        {FILTERS.map((f, i) => (
          <Text key={f} color={i === filterIdx ? 'cyan' : 'gray'}>{f}</Text>
        ))}
        <Text dimColor>(tab to switch)</Text>
      </Box>

      {/* Column headers */}
      <Box>
        <Text bold color="gray">{' #  '}</Text>
        <Text bold color="gray">{'Company           '}</Text>
        <Text bold color="gray">{'Role                       '}</Text>
        <Text bold color="gray">{'Score '}</Text>
        <Text bold color="gray">{'Status      '}</Text>
        <Text bold color="gray">{'Added'}</Text>
      </Box>

      {/* Job rows */}
      {filtered.length === 0 ? (
        <Box marginTop={1}>
          <Text dimColor>No jobs yet. Press <Text color="cyan">a</Text> to add one.</Text>
        </Box>
      ) : (
        filtered.map((job, i) => (
          <Box key={job.id}>
            <Text color={i === cursor ? 'cyan' : undefined} bold={i === cursor}>
              {i === cursor ? '▶ ' : '  '}
            </Text>
            <Text color={i === cursor ? 'white' : undefined}>
              {job.id.padEnd(3)} {job.company.slice(0, 16).padEnd(17)} {job.role.slice(0, 26).padEnd(27)}{' '}
              {scoreDisplay(job.score).padEnd(6)}
            </Text>
            <Text color={statusColor(job.status)}>{job.status.padEnd(12)}</Text>
            <Text dimColor>{job.added}</Text>
          </Box>
        ))
      )}

      {/* Footer */}
      <Box marginTop={1}>
        <Text dimColor>↑↓ navigate  enter select  a add  tab filter  q quit</Text>
      </Box>
    </Box>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- src/ui/Dashboard.test.tsx
```

Expected: PASS (3 tests)

- [ ] **Step 5: Run the app and verify the dashboard renders**

```bash
npm start
```

Expected: Dashboard renders with column headers, empty state message, and keyboard hint.

- [ ] **Step 6: Commit**

```bash
git add src/ui/Dashboard.tsx src/ui/Dashboard.test.tsx
git commit -m "feat: Dashboard screen with navigable job table"
```

---

## Task 7: Multiline Input + AddJob Screen

**Files:**
- Create: `src/ui/MultilineInput.tsx`
- Modify: `src/ui/AddJob.tsx`
- Create: `src/ui/AddJob.test.tsx`

- [ ] **Step 1: Create `src/ui/MultilineInput.tsx`**

```tsx
// src/ui/MultilineInput.tsx
import React, { useState, useEffect } from 'react';
import { Box, Text, useStdin } from 'ink';

interface Props {
  label: string;
  hint?: string;
  onSubmit: (value: string) => void;
}

export default function MultilineInput({ label, hint, onSubmit }: Props) {
  const [lines, setLines] = useState<string[]>(['']);
  const { stdin, setRawMode } = useStdin();

  useEffect(() => {
    setRawMode(true);

    const handleData = (chunk: Buffer) => {
      const char = chunk.toString('utf8');

      if (char === '\x03') {
        // Ctrl+C = submit
        setRawMode(false);
        const value = lines.join('\n').trim();
        onSubmit(value);
        return;
      }

      if (char === '\x1b') return; // skip lone escape

      if (char === '\r' || char === '\n') {
        setLines((prev) => [...prev, '']);
        return;
      }

      if (char === '\x7f' || char === '\x08') {
        // Backspace
        setLines((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last.length > 0) {
            next[next.length - 1] = last.slice(0, -1);
          } else if (next.length > 1) {
            next.pop();
          }
          return next;
        });
        return;
      }

      if (char >= ' ' || char === '\t') {
        setLines((prev) => {
          const next = [...prev];
          next[next.length - 1] += char;
          return next;
        });
      }
    };

    stdin?.on('data', handleData);
    return () => {
      stdin?.off('data', handleData);
      setRawMode(false);
    };
  }, [lines, onSubmit, stdin, setRawMode]);

  return (
    <Box flexDirection="column">
      <Text bold>{label}</Text>
      <Text dimColor>{hint ?? 'Ctrl+C to submit'}</Text>
      <Box flexDirection="column" marginTop={1} borderStyle="single" paddingX={1}>
        {lines.map((line, i) => (
          <Text key={i}>{line}{i === lines.length - 1 ? '█' : ''}</Text>
        ))}
      </Box>
      <Text dimColor>{lines.filter(Boolean).join('\n').length} chars</Text>
    </Box>
  );
}
```

- [ ] **Step 2: Write the failing test for AddJob**

```tsx
// src/ui/AddJob.test.tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from 'ink-testing-library';
import AddJob from './AddJob.js';

describe('AddJob', () => {
  it('renders mode selector on mount', () => {
    const { lastFrame } = render(<AddJob onBack={vi.fn()} />);
    expect(lastFrame()).toContain('Add a job');
  });

  it('shows back hint', () => {
    const { lastFrame } = render(<AddJob onBack={vi.fn()} />);
    expect(lastFrame()).toContain('esc');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npm test -- src/ui/AddJob.test.tsx
```

Expected: FAIL

- [ ] **Step 4: Implement `src/ui/AddJob.tsx`**

```tsx
// src/ui/AddJob.tsx
import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import MultilineInput from './MultilineInput.js';
import { db } from '../db.js';
import type { Job } from '../types.js';

type Mode = 'select' | 'url' | 'jd';

interface Props {
  onBack: () => void;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildJob(partial: Pick<Job, 'url' | 'jd'>): Job {
  return {
    id: db.nextId(),
    added: today(),
    company: '',
    role: '',
    url: partial.url,
    jd: partial.jd,
    status: 'Pending',
    score: null,
    archetype: null,
    reportPath: null,
    pdfPath: null,
    theme: null,
    notes: '',
  };
}

export default function AddJob({ onBack }: Props) {
  const [mode, setMode] = useState<Mode>('select');
  const [saved, setSaved] = useState(false);
  const [savedId, setSavedId] = useState('');

  useInput((input, key) => {
    if (key.escape) onBack();
    if (mode === 'select') {
      if (input === '1') setMode('url');
      if (input === '2') setMode('jd');
    }
  });

  if (saved) {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text color="green">✓ Job #{savedId} added as Pending</Text>
        <Text dimColor>Press esc to go back</Text>
      </Box>
    );
  }

  if (mode === 'select') {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text bold>Add a job</Text>
        <Box marginTop={1} flexDirection="column">
          <Text>1  Paste a URL</Text>
          <Text>2  Paste job description text</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>esc back</Text>
        </Box>
      </Box>
    );
  }

  if (mode === 'url') {
    return (
      <Box flexDirection="column" paddingX={1}>
        <MultilineInput
          label="Job URL"
          hint="Paste URL, then Ctrl+C to save"
          onSubmit={(url) => {
            if (!url) { onBack(); return; }
            const job = buildJob({ url: url.trim(), jd: '' });
            db.addJob(job);
            setSavedId(job.id);
            setSaved(true);
          }}
        />
      </Box>
    );
  }

  // mode === 'jd'
  return (
    <Box flexDirection="column" paddingX={1}>
      <MultilineInput
        label="Paste job description"
        hint="Paste the full JD, then Ctrl+C to save"
        onSubmit={(jd) => {
          if (!jd) { onBack(); return; }
          const job = buildJob({ url: '', jd });
          db.addJob(job);
          setSavedId(job.id);
          setSaved(true);
        }}
      />
    </Box>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test -- src/ui/AddJob.test.tsx
```

Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add src/ui/MultilineInput.tsx src/ui/AddJob.tsx src/ui/AddJob.test.tsx
git commit -m "feat: MultilineInput component and AddJob screen"
```

---

## Task 8: JobDetail Screen

**Files:**
- Modify: `src/ui/JobDetail.tsx`
- Create: `src/ui/JobDetail.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// src/ui/JobDetail.test.tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from 'ink-testing-library';
import JobDetail from './JobDetail.js';
import type { Job } from '../types.js';

const job: Job = {
  id: '001', added: '2026-04-08', company: 'Acme', role: 'Sr. Engineer',
  url: 'https://acme.com/job', jd: 'We are looking for...', status: 'Pending',
  score: null, archetype: null, reportPath: null, pdfPath: null, theme: null, notes: '',
};

describe('JobDetail', () => {
  it('shows company and role', () => {
    const { lastFrame } = render(
      <JobDetail job={job} onBack={vi.fn()} onGenerate={vi.fn()} />
    );
    expect(lastFrame()).toContain('Acme');
    expect(lastFrame()).toContain('Sr. Engineer');
  });

  it('shows Evaluate action for Pending jobs', () => {
    const { lastFrame } = render(
      <JobDetail job={job} onBack={vi.fn()} onGenerate={vi.fn()} />
    );
    expect(lastFrame()).toContain('Evaluate');
  });

  it('shows score for Evaluated jobs', () => {
    const evaluated = { ...job, status: 'Evaluated' as const, score: 4.2 };
    const { lastFrame } = render(
      <JobDetail job={evaluated} onBack={vi.fn()} onGenerate={vi.fn()} />
    );
    expect(lastFrame()).toContain('4.2');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- src/ui/JobDetail.test.tsx
```

Expected: FAIL

- [ ] **Step 3: Implement `src/ui/JobDetail.tsx`**

```tsx
// src/ui/JobDetail.tsx
import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { db } from '../db.js';
import { JOB_STATUSES } from '../types.js';
import type { Job, JobStatus } from '../types.js';

type Action = 'menu' | 'status' | 'notes';

interface Props {
  job: Job;
  onBack: () => void;
  onGenerate: (job: Job) => void;
}

const MENU_ITEMS = ['Evaluate', 'Generate CV', 'Update status', 'Edit notes', 'Back'] as const;

export default function JobDetail({ job: initialJob, onBack, onGenerate }: Props) {
  const [job, setJob] = useState(initialJob);
  const [action, setAction] = useState<Action>('menu');
  const [cursor, setCursor] = useState(0);
  const [statusCursor, setStatusCursor] = useState(
    JOB_STATUSES.indexOf(job.status as JobStatus)
  );
  const [evaluating, setEvaluating] = useState(false);
  const [notes, setNotes] = useState(job.notes);

  useInput((input, key) => {
    if (key.escape) { onBack(); return; }

    if (action === 'menu') {
      if (key.upArrow) setCursor((c) => Math.max(0, c - 1));
      if (key.downArrow) setCursor((c) => Math.min(MENU_ITEMS.length - 1, c + 1));
      if (key.return) {
        const selected = MENU_ITEMS[cursor];
        if (selected === 'Back') onBack();
        if (selected === 'Update status') setAction('status');
        if (selected === 'Edit notes') setAction('notes');
        if (selected === 'Generate CV') onGenerate(job);
        if (selected === 'Evaluate') {
          setEvaluating(true);
          // Actual evaluation happens in Task 10 — placeholder sets status
          setTimeout(() => {
            db.updateJob(job.id, { status: 'Evaluated' });
            setJob({ ...job, status: 'Evaluated' });
            setEvaluating(false);
          }, 100);
        }
      }
    }

    if (action === 'status') {
      if (key.upArrow) setStatusCursor((c) => Math.max(0, c - 1));
      if (key.downArrow) setStatusCursor((c) => Math.min(JOB_STATUSES.length - 1, c + 1));
      if (key.return) {
        const newStatus = JOB_STATUSES[statusCursor];
        db.updateJob(job.id, { status: newStatus });
        setJob({ ...job, status: newStatus });
        setAction('menu');
      }
    }
  });

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Header */}
      <Box marginBottom={1} flexDirection="column">
        <Text bold color="cyan">{job.company}</Text>
        <Text>{job.role}</Text>
        <Box gap={2}>
          <Text dimColor>#{job.id}</Text>
          <Text dimColor>{job.added}</Text>
          {job.score !== null && <Text color="cyan">Score: {job.score.toFixed(1)}</Text>}
          <Text>{job.status}</Text>
        </Box>
        {job.url && <Text dimColor>{job.url.slice(0, 60)}</Text>}
      </Box>

      {evaluating && <Text color="yellow">Evaluating with Claude...</Text>}

      {/* Menu */}
      {action === 'menu' && !evaluating && (
        <Box flexDirection="column">
          {MENU_ITEMS.map((item, i) => (
            <Text key={item} color={i === cursor ? 'cyan' : undefined}>
              {i === cursor ? '▶ ' : '  '}{item}
            </Text>
          ))}
        </Box>
      )}

      {/* Status picker */}
      {action === 'status' && (
        <Box flexDirection="column">
          <Text bold marginBottom={1}>Select status:</Text>
          {JOB_STATUSES.map((s, i) => (
            <Text key={s} color={i === statusCursor ? 'cyan' : undefined}>
              {i === statusCursor ? '▶ ' : '  '}{s}
            </Text>
          ))}
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>↑↓ navigate  enter select  esc back</Text>
      </Box>
    </Box>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- src/ui/JobDetail.test.tsx
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/ui/JobDetail.tsx src/ui/JobDetail.test.tsx
git commit -m "feat: JobDetail screen with status update and action menu"
```

---

## Task 9: Evaluation Prompts

**Files:**
- Create: `prompts/archetypes.md`
- Create: `prompts/evaluation.md`

- [ ] **Step 1: Create `prompts/archetypes.md`**

```markdown
# Role Archetypes
<!-- Based on career-ops by santifer: https://github.com/santifer/career-ops -->

Classify every job into one of these archetypes (or hybrid of 2):

| Archetype | ID | Key signals in JD |
|---|---|---|
| AI Platform / LLMOps | platform | "observability", "evals", "pipelines", "monitoring", "reliability" |
| Agentic / Automation | agentic | "agent", "HITL", "orchestration", "workflow", "multi-agent" |
| Technical AI PM | pm | "PRD", "roadmap", "discovery", "stakeholder", "product manager" |
| AI Solutions Architect | architect | "architecture", "enterprise", "integration", "design", "systems" |
| AI Forward Deployed | fde | "client-facing", "deploy", "prototype", "fast delivery", "field" |
| AI Transformation | transformation | "change management", "adoption", "enablement", "transformation" |

After detecting the archetype, adapt proof points and framing accordingly:
- platform → emphasize observability, evals, pipeline reliability
- agentic → emphasize orchestration, HITL, error handling
- pm → emphasize discovery, metrics, stakeholder management
- architect → emphasize system design, integrations, scale
- fde → emphasize speed of delivery, client outcomes
- transformation → emphasize adoption, organizational change
```

- [ ] **Step 2: Create `prompts/evaluation.md`**

```markdown
# Job Evaluation Instructions
<!-- Based on career-ops by santifer: https://github.com/santifer/career-ops -->

You are evaluating a job posting for a software engineering candidate.

## Your Output

Respond with ONLY valid JSON — no markdown, no code fences, no explanation.

Output format:
{
  "score": <number 1.0-5.0>,
  "archetype": "<one of: platform | agentic | pm | architect | fde | transformation>",
  "recommendation": "<apply | consider | discard>",
  "blockA": {
    "tldr": "<one sentence summary of the role>",
    "domain": "<domain area>",
    "function": "<build | consult | manage | deploy>",
    "seniority": "<junior | mid | senior | staff | principal>",
    "remote": "<full remote | hybrid | onsite>",
    "teamSize": "<string or null if not mentioned>"
  },
  "blockB": {
    "matches": [
      { "requirement": "<JD requirement>", "cvEvidence": "<exact quote or paraphrase from CV>" }
    ],
    "gaps": [
      { "requirement": "<missing requirement>", "blocker": <true|false>, "mitigation": "<specific mitigation strategy>" }
    ]
  },
  "blockC": {
    "analysis": "<salary bracket analysis vs candidate target range>",
    "seniorityAnalysis": "<leveling analysis and strategy>"
  },
  "blockD": ["<red flag 1>", "<red flag 2>"],
  "blockE": "<rewritten Professional Summary tailored to this specific role, 3-4 sentences, no clichés, action verbs, specific metrics>",
  "blockF": [
    { "requirement": "<JD requirement>", "story": "<STAR+R story suggestion from candidate's experience>" }
  ]
}

## Scoring Guide

- 4.5+ → Strong match. recommend: apply
- 4.0-4.4 → Good match. recommend: apply
- 3.5-3.9 → Borderline. recommend: consider
- Below 3.5 → Weak match. recommend: discard

## Scoring Dimensions

Weight each dimension:
- CV match (skills, experience, proof points): 30%
- North Star alignment (archetype match to candidate targets): 25%
- Compensation signal vs target: 15%
- Cultural / growth signals: 15%
- Red flag deductions: -15% max

## Writing Rules

- NEVER invent experience or metrics — only use what is in the CV
- Cite exact lines from the CV when matching requirements
- Be direct and specific — no corporate speak
- Short sentences, action verbs, no passive voice
- If comp is not mentioned: note it as a gap, do not estimate

## Inputs

You will receive:
1. The job description (raw text)
2. The candidate's CV (markdown)
3. The candidate's config (target roles, salary range, preferred archetypes)
4. The experience database (structured bullet points and narratives)
```

- [ ] **Step 3: Commit**

```bash
git add prompts/archetypes.md prompts/evaluation.md
git commit -m "feat: evaluation prompts (ported from career-ops)"
```

---

## Task 10: Claude Evaluation Integration

**Files:**
- Modify: `src/claude/evaluation.ts`
- Create: `src/claude/evaluation.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/claude/evaluation.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseEvaluationResult, buildEvalPrompt } from './evaluation.js';

describe('parseEvaluationResult', () => {
  it('parses valid evaluation JSON', () => {
    const json = JSON.stringify({
      score: 4.2,
      archetype: 'platform',
      recommendation: 'apply',
      blockA: {
        tldr: 'Senior platform role',
        domain: 'platform',
        function: 'build',
        seniority: 'senior',
        remote: 'full remote',
        teamSize: null,
      },
      blockB: {
        matches: [{ requirement: 'TypeScript', cvEvidence: '5 years TypeScript at Acme' }],
        gaps: [],
      },
      blockC: { analysis: 'Within range', seniorityAnalysis: 'Correctly leveled' },
      blockD: [],
      blockE: 'Tailored summary here.',
      blockF: [{ requirement: 'Led migrations', story: 'Led platform migration at Acme' }],
    });

    const result = parseEvaluationResult(json);
    expect(result.score).toBe(4.2);
    expect(result.archetype).toBe('platform');
    expect(result.recommendation).toBe('apply');
    expect(result.blockB.matches).toHaveLength(1);
  });

  it('throws on missing required fields', () => {
    expect(() => parseEvaluationResult('{"score": 4.2}')).toThrow();
  });

  it('throws on invalid JSON', () => {
    expect(() => parseEvaluationResult('not json')).toThrow();
  });
});

describe('buildEvalPrompt', () => {
  it('includes JD in prompt', () => {
    const prompt = buildEvalPrompt({
      jd: 'We need a TypeScript engineer',
      cv: '# Jane Doe\n5 years TypeScript',
      configSummary: 'Targets: Sr Engineer, $150-180k, full remote',
      experienceContext: '--- Acme | 2022-2024 ---',
    });
    expect(prompt).toContain('We need a TypeScript engineer');
    expect(prompt).toContain('Jane Doe');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- src/claude/evaluation.test.ts
```

Expected: FAIL

- [ ] **Step 3: Create `src/claude/evaluation.ts`**

```typescript
// src/claude/evaluation.ts
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
  const { config } = profile;
  return [
    `Target roles: ${config.targets.roles.join(', ')}`,
    `Salary target: $${config.targets.salaryMin.toLocaleString()} – $${config.targets.salaryMax.toLocaleString()}`,
    `Remote preference: ${config.targets.remote}`,
    `Preferred archetypes: ${config.archetypes.preferred.join(', ')}`,
    `Deal-breakers: ${config.targets.dealBreakers.join(', ')}`,
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
    if (message.type === 'result') {
      responseText = message.result ?? '';
    }
  }

  return parseEvaluationResult(responseText);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- src/claude/evaluation.test.ts
```

Expected: PASS (5 tests)

- [ ] **Step 5: Wire evaluation into `JobDetail.tsx`**

Replace the placeholder `setTimeout` in JobDetail's Evaluate handler:

```tsx
// In src/ui/JobDetail.tsx, replace the Evaluate branch:
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

Add `buildReport` helper at the top of `JobDetail.tsx`:

```typescript
import { writeFileSync } from 'fs';
import { join } from 'path';
import { loadProfile } from '../profile.js';
import { evaluateJob } from '../claude/evaluation.js';
import type { EvaluationResult } from '../types.js';

function buildReport(job: Job, r: EvaluationResult): string {
  return `# Evaluation: ${job.company} — ${job.role}

**Date:** ${new Date().toISOString().slice(0, 10)}
**Score:** ${r.score}/5
**Archetype:** ${r.archetype}
**Recommendation:** ${r.recommendation}
**URL:** ${job.url || '(pasted JD)'}

---

## A) Role Summary

${r.blockA.tldr}

- Domain: ${r.blockA.domain}
- Function: ${r.blockA.function}
- Seniority: ${r.blockA.seniority}
- Remote: ${r.blockA.remote}
- Team size: ${r.blockA.teamSize ?? 'not mentioned'}

## B) CV Match

### Matches
${r.blockB.matches.map((m) => `- **${m.requirement}**: ${m.cvEvidence}`).join('\n')}

### Gaps
${r.blockB.gaps.length === 0 ? 'None' : r.blockB.gaps.map((g) => `- **${g.requirement}** (${g.blocker ? 'blocker' : 'nice-to-have'}): ${g.mitigation}`).join('\n')}

## C) Level & Comp

${r.blockC.analysis}

${r.blockC.seniorityAnalysis}

## D) Red Flags

${r.blockD.length === 0 ? 'None' : r.blockD.map((f) => `- ${f}`).join('\n')}

## E) Tailored Summary

${r.blockE}

## F) Interview Stories

${r.blockF.map((f) => `- **${f.requirement}**: ${f.story}`).join('\n')}
`;
}
```

- [ ] **Step 6: Commit**

```bash
git add src/claude/evaluation.ts src/claude/evaluation.test.ts src/ui/JobDetail.tsx
git commit -m "feat: Claude evaluation integration and report generation"
```

---

## Task 11: CV Generation Prompt + Claude Generate

**Files:**
- Create: `prompts/generate-cv.md`
- Create: `src/claude/generate.ts`
- Create: `src/claude/generate.test.ts`

- [ ] **Step 1: Create `prompts/generate-cv.md`**

```markdown
# CV Generation Instructions
<!-- Based on career-ops by santifer: https://github.com/santifer/career-ops -->

You are an ATS-optimized resume generator. Your only output is valid JSON.

## Your Task

Given a job description and the candidate's experience database, produce a tailored one-page CV.

## ATS Rules (follow strictly)

- No tables, columns, icons, or special characters in output
- Select the top 15 skills that best match the job description, ordered by relevance
- Use exact terminology from the JD where it truthfully matches the candidate's experience
- The most recent role gets exactly 3 bullets; all other roles get exactly 2 bullets
- Order roles chronologically (most recent first)
- Do not fabricate, invent, or make up experience — only select and lightly adapt existing bullets
- NEVER use em-dashes (--) anywhere in the output
- Write in first person implied (no "I") — start bullets with action verbs
- No clichés: no "passionate about", "results-oriented", "leveraged", "spearheaded"
- Short sentences. Specific metrics. Action verbs.

## Archetype-Aware Framing

The job archetype determines what to emphasize:
- platform → observability, reliability, scale metrics
- agentic → orchestration, HITL design, error handling
- pm → discovery, product metrics, stakeholder alignment
- architect → system design, integration patterns, scale
- fde → delivery speed, client outcomes, time-to-value
- transformation → adoption rates, org impact, enablement

## Output Format

Respond with ONLY valid JSON — no markdown, no code fences, no explanation:

{
  "name": "string",
  "title": "string — tailored to the JD (e.g. 'Sr. Software Engineer' or 'AI Platform Engineer')",
  "contact": {
    "email": "string",
    "location": "string",
    "site": "string"
  },
  "skills": ["string — 15 items, ordered by JD relevance"],
  "roles": [
    {
      "company": "string",
      "role": "string",
      "period": { "start": "YYYY-MM", "end": "YYYY-MM or present" },
      "bullets": ["string"]
    }
  ],
  "education": [
    { "institution": "string", "degree": "string" }
  ]
}
```

- [ ] **Step 2: Write the failing tests**

```typescript
// src/claude/generate.test.ts
import { describe, it, expect } from 'vitest';
import { parseGeneratedCV, buildGeneratePrompt } from './generate.js';

describe('parseGeneratedCV', () => {
  it('parses valid CV JSON', () => {
    const json = JSON.stringify({
      name: 'Jane Doe',
      title: 'Sr. Software Engineer',
      contact: { email: 'jane@example.com', location: 'SF, CA', site: 'jane.dev' },
      skills: ['TypeScript', 'React'],
      roles: [
        {
          company: 'Acme',
          role: 'Senior Engineer',
          period: { start: '2022-03', end: 'present' },
          bullets: ['Built X', 'Led Y'],
        },
      ],
      education: [{ institution: 'UC Davis', degree: 'B.A. Psychology' }],
    });

    const result = parseGeneratedCV(json);
    expect(result.name).toBe('Jane Doe');
    expect(result.skills).toHaveLength(2);
    expect(result.roles[0].bullets).toHaveLength(2);
  });

  it('throws on missing roles', () => {
    expect(() => parseGeneratedCV('{"name":"Jane","skills":[]}')).toThrow();
  });
});

describe('buildGeneratePrompt', () => {
  it('includes archetype in prompt', () => {
    const prompt = buildGeneratePrompt({
      jd: 'Platform engineering role',
      archetype: 'platform',
      cv: '# Jane',
      experienceContext: '--- Acme ---',
      config: {
        candidate: { name: 'Jane', email: 'j@j.com', location: 'SF', site: 'j.dev' },
        targets: { roles: [], salaryMin: 0, salaryMax: 0, remote: 'full', dealBreakers: [] },
        archetypes: { preferred: [], avoid: [] },
        education: [],
      },
    });
    expect(prompt).toContain('platform');
    expect(prompt).toContain('Platform engineering role');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npm test -- src/claude/generate.test.ts
```

Expected: FAIL

- [ ] **Step 4: Create `src/claude/generate.ts`**

```typescript
// src/claude/generate.ts
import { readFileSync } from 'fs';
import { join } from 'path';
import { query } from '@anthropic-ai/claude-code';
import type { GeneratedCV, CandidateConfig, Experience } from '../types.js';

const GENERATE_PROMPT = readFileSync(join(process.cwd(), 'prompts', 'generate-cv.md'), 'utf8');

export interface GenerateInput {
  jd: string;
  archetype: string;
  cv: string;
  experienceContext: string;
  config: CandidateConfig;
}

export function buildGeneratePrompt(input: GenerateInput): string {
  return `${GENERATE_PROMPT}

---

## Job Description

${input.jd}

---

## Detected Archetype: ${input.archetype}

---

## Candidate CV

${input.cv}

---

## Experience Database

${input.experienceContext}

---

## Candidate Info

Name: ${input.config.candidate.name}
Email: ${input.config.candidate.email}
Location: ${input.config.candidate.location}
Site: ${input.config.candidate.site}

Education (static, use exactly as-is):
${input.config.education.map((e) => `- ${e.institution}: ${e.degree}`).join('\n')}

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
  job: { jd: string; archetype: string | null },
  profile: import('../types.js').Profile & { experiences: Experience[] }
): Promise<GeneratedCV> {
  const prompt = buildGeneratePrompt({
    jd: job.jd,
    archetype: job.archetype ?? 'platform',
    cv: profile.cv,
    experienceContext: buildExperienceContext(profile.experiences),
    config: profile.config,
  });

  let responseText = '';
  for await (const message of query({ prompt, options: { maxTurns: 1 } })) {
    if (message.type === 'result') {
      responseText = message.result ?? '';
    }
  }

  return parseGeneratedCV(responseText);
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test -- src/claude/generate.test.ts
```

Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add prompts/generate-cv.md src/claude/generate.ts src/claude/generate.test.ts
git commit -m "feat: CV generation prompt and Claude integration"
```

---

## Task 12: HTML Themes

**Files:**
- Create: `themes/minimal.html`
- Create: `themes/modern.html`
- Create: `themes/two-column.html`

All themes use `{{PLACEHOLDER}}` tokens injected by `pdf.ts`. One-page strict via CSS.

- [ ] **Step 1: Create `themes/minimal.html`**

```html
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Georgia', serif;
    font-size: 10.5pt;
    color: #111;
    max-height: 10.5in;
    overflow: hidden;
    padding: 0.5in 0.6in;
    line-height: 1.4;
  }
  h1 { font-size: 18pt; font-weight: normal; letter-spacing: -0.5px; }
  .contact { font-size: 9pt; color: #555; margin: 4px 0 14px; }
  .contact a { color: #555; text-decoration: none; }
  .section { margin-bottom: 12px; }
  .section-title {
    font-size: 8pt; text-transform: uppercase; letter-spacing: 1.5px;
    color: #666; border-bottom: 0.5px solid #ccc; padding-bottom: 3px; margin-bottom: 8px;
  }
  .summary { font-size: 10pt; color: #333; }
  .skills { font-size: 9.5pt; color: #333; }
  .role { margin-bottom: 8px; }
  .role-header { display: flex; justify-content: space-between; }
  .role-title { font-weight: bold; font-size: 10.5pt; }
  .role-period { font-size: 9pt; color: #666; }
  .role-company { font-size: 10pt; color: #444; margin-bottom: 3px; }
  ul { padding-left: 14px; }
  li { font-size: 9.5pt; margin-bottom: 2px; color: #222; }
  .edu { font-size: 9.5pt; }
</style>
</head>
<body>
  <h1>{{NAME}}</h1>
  <div class="contact">{{EMAIL}} &nbsp;·&nbsp; {{LOCATION}} &nbsp;·&nbsp; {{SITE}}</div>

  <div class="section">
    <div class="section-title">Summary</div>
    <div class="summary">{{SUMMARY}}</div>
  </div>

  <div class="section">
    <div class="section-title">Skills</div>
    <div class="skills">{{SKILLS}}</div>
  </div>

  <div class="section">
    <div class="section-title">Experience</div>
    {{ROLES}}
  </div>

  <div class="section">
    <div class="section-title">Education</div>
    {{EDUCATION}}
  </div>
</body>
</html>
```

- [ ] **Step 2: Create `themes/modern.html`**

```html
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Helvetica Neue', Arial, sans-serif;
    font-size: 10pt;
    color: #1a1a1a;
    max-height: 10.5in;
    overflow: hidden;
    line-height: 1.45;
  }
  .header {
    background: #1a1a1a; color: white;
    padding: 0.35in 0.5in 0.3in;
  }
  .header h1 { font-size: 20pt; font-weight: 300; letter-spacing: 0.5px; }
  .header .title { font-size: 11pt; color: #aaa; margin: 4px 0; }
  .header .contact { font-size: 8.5pt; color: #bbb; margin-top: 6px; }
  .body { padding: 0.3in 0.5in; }
  .section { margin-bottom: 14px; }
  .section-title {
    font-size: 7.5pt; text-transform: uppercase; letter-spacing: 2px;
    color: #1a1a1a; border-bottom: 1.5px solid #1a1a1a;
    padding-bottom: 4px; margin-bottom: 9px; font-weight: bold;
  }
  .skills { font-size: 9.5pt; }
  .role { margin-bottom: 9px; }
  .role-header { display: flex; justify-content: space-between; align-items: baseline; }
  .role-title { font-weight: 600; font-size: 10.5pt; }
  .role-period { font-size: 8.5pt; color: #888; }
  .role-company { font-size: 9.5pt; color: #555; margin-bottom: 4px; }
  ul { padding-left: 13px; }
  li { font-size: 9pt; margin-bottom: 2px; }
  .edu { font-size: 9.5pt; }
</style>
</head>
<body>
  <div class="header">
    <h1>{{NAME}}</h1>
    <div class="title">{{TITLE}}</div>
    <div class="contact">{{EMAIL}} &nbsp;·&nbsp; {{LOCATION}} &nbsp;·&nbsp; {{SITE}}</div>
  </div>
  <div class="body">
    <div class="section">
      <div class="section-title">Summary</div>
      <p style="font-size:9.5pt;">{{SUMMARY}}</p>
    </div>
    <div class="section">
      <div class="section-title">Skills</div>
      <div class="skills">{{SKILLS}}</div>
    </div>
    <div class="section">
      <div class="section-title">Experience</div>
      {{ROLES}}
    </div>
    <div class="section">
      <div class="section-title">Education</div>
      {{EDUCATION}}
    </div>
  </div>
</body>
</html>
```

- [ ] **Step 3: Create `themes/two-column.html`**

```html
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Helvetica Neue', Arial, sans-serif;
    font-size: 10pt;
    color: #1a1a1a;
    max-height: 10.5in;
    overflow: hidden;
    display: flex;
    height: 100vh;
  }
  .sidebar {
    width: 2.4in;
    background: #f5f5f5;
    padding: 0.4in 0.25in;
    flex-shrink: 0;
  }
  .sidebar h1 { font-size: 14pt; font-weight: 600; line-height: 1.2; margin-bottom: 4px; }
  .sidebar .title { font-size: 9pt; color: #555; margin-bottom: 12px; }
  .sidebar .contact { font-size: 8pt; color: #555; line-height: 1.8; }
  .sidebar .section-title {
    font-size: 7pt; text-transform: uppercase; letter-spacing: 1.5px;
    color: #888; margin: 14px 0 6px; border-bottom: 0.5px solid #ccc; padding-bottom: 3px;
  }
  .sidebar .skill { font-size: 8.5pt; color: #333; margin-bottom: 2px; }
  .sidebar .edu { font-size: 8.5pt; color: #333; line-height: 1.4; margin-bottom: 6px; }
  .main {
    flex: 1;
    padding: 0.4in 0.4in 0.4in 0.3in;
    overflow: hidden;
  }
  .section { margin-bottom: 13px; }
  .section-title {
    font-size: 7.5pt; text-transform: uppercase; letter-spacing: 1.5px;
    color: #555; border-bottom: 0.5px solid #ccc; padding-bottom: 3px; margin-bottom: 8px;
  }
  .summary { font-size: 9.5pt; }
  .role { margin-bottom: 9px; }
  .role-header { display: flex; justify-content: space-between; }
  .role-title { font-weight: 600; font-size: 10pt; }
  .role-period { font-size: 8.5pt; color: #888; }
  .role-company { font-size: 9pt; color: #555; margin-bottom: 3px; }
  ul { padding-left: 12px; }
  li { font-size: 9pt; margin-bottom: 2px; }
</style>
</head>
<body>
  <div class="sidebar">
    <h1>{{NAME}}</h1>
    <div class="title">{{TITLE}}</div>
    <div class="contact">
      {{EMAIL}}<br>{{LOCATION}}<br>{{SITE}}
    </div>
    <div class="section-title">Skills</div>
    {{SIDEBAR_SKILLS}}
    <div class="section-title">Education</div>
    {{SIDEBAR_EDUCATION}}
  </div>
  <div class="main">
    <div class="section">
      <div class="section-title">Summary</div>
      <div class="summary">{{SUMMARY}}</div>
    </div>
    <div class="section">
      <div class="section-title">Experience</div>
      {{ROLES}}
    </div>
  </div>
</body>
</html>
```

- [ ] **Step 4: Commit**

```bash
git add themes/
git commit -m "feat: three CV themes (minimal, modern, two-column)"
```

---

## Task 13: PDF Renderer

**Files:**
- Modify: `src/pdf.ts`
- Create: `src/pdf.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/pdf.test.ts
import { describe, it, expect } from 'vitest';
import { injectCV } from './pdf.js';
import type { GeneratedCV } from './types.js';

const cv: GeneratedCV = {
  name: 'Jane Doe',
  title: 'Sr. Engineer',
  contact: { email: 'jane@example.com', location: 'SF, CA', site: 'jane.dev' },
  skills: ['TypeScript', 'React', 'Node.js'],
  roles: [
    {
      company: 'Acme',
      role: 'Senior Engineer',
      period: { start: '2022-03', end: 'present' },
      bullets: ['Built distributed platform', 'Led team of 6 engineers'],
    },
  ],
  education: [{ institution: 'UC Davis', degree: 'B.A. Psychology' }],
};

const minimalTemplate = `<body>
<h1>{{NAME}}</h1>
<div class="contact">{{EMAIL}} {{LOCATION}} {{SITE}}</div>
<div>{{SUMMARY}}</div>
<div>{{SKILLS}}</div>
<div>{{ROLES}}</div>
<div>{{EDUCATION}}</div>
</body>`;

describe('injectCV', () => {
  it('replaces NAME placeholder', () => {
    const html = injectCV(minimalTemplate, cv, 'Experienced platform engineer.');
    expect(html).toContain('Jane Doe');
  });

  it('replaces SKILLS placeholder', () => {
    const html = injectCV(minimalTemplate, cv, '');
    expect(html).toContain('TypeScript');
    expect(html).toContain('React');
  });

  it('replaces ROLES with experience bullets', () => {
    const html = injectCV(minimalTemplate, cv, '');
    expect(html).toContain('Acme');
    expect(html).toContain('Built distributed platform');
  });

  it('no unreplaced placeholders remain', () => {
    const html = injectCV(minimalTemplate, cv, 'Summary here.');
    expect(html).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- src/pdf.test.ts
```

Expected: FAIL

- [ ] **Step 3: Create `src/pdf.ts`**

```typescript
// src/pdf.ts
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import puppeteer from 'puppeteer';
import type { GeneratedCV, Theme } from './types.js';

export function injectCV(template: string, cv: GeneratedCV, summary: string): string {
  const skillsHtml = cv.skills.join(' · ');

  const rolesHtml = cv.roles.map((r) => `
    <div class="role">
      <div class="role-header">
        <span class="role-title">${r.role}</span>
        <span class="role-period">${r.period.start} – ${r.period.end}</span>
      </div>
      <div class="role-company">${r.company}</div>
      <ul>${r.bullets.map((b) => `<li>${b}</li>`).join('')}</ul>
    </div>`).join('');

  const eduHtml = cv.education.map((e) => `
    <div class="edu"><strong>${e.institution}</strong><br>${e.degree}</div>`).join('');

  const sidebarSkillsHtml = cv.skills.map((s) => `<div class="skill">· ${s}</div>`).join('');
  const sidebarEduHtml = cv.education.map((e) =>
    `<div class="edu"><strong>${e.institution}</strong><br>${e.degree}</div>`
  ).join('');

  return template
    .replace(/\{\{NAME\}\}/g, cv.name)
    .replace(/\{\{TITLE\}\}/g, cv.title)
    .replace(/\{\{EMAIL\}\}/g, cv.contact.email)
    .replace(/\{\{LOCATION\}\}/g, cv.contact.location)
    .replace(/\{\{SITE\}\}/g, cv.contact.site)
    .replace(/\{\{SUMMARY\}\}/g, summary)
    .replace(/\{\{SKILLS\}\}/g, skillsHtml)
    .replace(/\{\{ROLES\}\}/g, rolesHtml)
    .replace(/\{\{EDUCATION\}\}/g, eduHtml)
    .replace(/\{\{SIDEBAR_SKILLS\}\}/g, sidebarSkillsHtml)
    .replace(/\{\{SIDEBAR_EDUCATION\}\}/g, sidebarEduHtml);
}

export async function renderPDF(cv: GeneratedCV, summary: string, theme: Theme, outputPath: string): Promise<void> {
  const templatePath = join(process.cwd(), 'themes', `${theme}.html`);
  const template = readFileSync(templatePath, 'utf8');
  const html = injectCV(template, cv, summary);

  const tmpHtml = join(process.cwd(), 'output', `_tmp-${Date.now()}.html`);
  writeFileSync(tmpHtml, html, 'utf8');

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 816, height: 1056, deviceScaleFactor: 1 });
  await page.goto(`file://${tmpHtml}`, { waitUntil: 'networkidle0' });
  await page.pdf({
    path: outputPath,
    format: 'Letter',
    margin: { top: '0', bottom: '0', left: '0', right: '0' },
    scale: 1,
    printBackground: true,
  });
  await browser.close();

  // Clean up temp html
  import('fs').then(({ unlinkSync }) => {
    try { unlinkSync(tmpHtml); } catch { /* ignore */ }
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- src/pdf.test.ts
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/pdf.ts src/pdf.test.ts
git commit -m "feat: PDF renderer with theme injection"
```

---

## Task 14: Generate Screen

**Files:**
- Modify: `src/ui/Generate.tsx`
- Create: `src/ui/Generate.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// src/ui/Generate.test.tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from 'ink-testing-library';
import Generate from './Generate.js';
import type { Job } from '../types.js';

const job: Job = {
  id: '001', added: '2026-04-08', company: 'Acme', role: 'Sr. Engineer',
  url: 'https://acme.com', jd: 'We need a TypeScript engineer.', status: 'Evaluated',
  score: 4.2, archetype: 'platform', reportPath: null, pdfPath: null, theme: null, notes: '',
};

describe('Generate', () => {
  it('shows theme picker on mount', () => {
    const { lastFrame } = render(<Generate job={job} onBack={vi.fn()} />);
    expect(lastFrame()).toContain('minimal');
    expect(lastFrame()).toContain('modern');
    expect(lastFrame()).toContain('two-column');
  });

  it('shows job context', () => {
    const { lastFrame } = render(<Generate job={job} onBack={vi.fn()} />);
    expect(lastFrame()).toContain('Acme');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- src/ui/Generate.test.tsx
```

Expected: FAIL

- [ ] **Step 3: Implement `src/ui/Generate.tsx`**

```tsx
// src/ui/Generate.tsx
import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { join } from 'path';
import { loadProfile } from '../profile.js';
import { generateCV } from '../claude/generate.js';
import { renderPDF } from '../pdf.js';
import { db } from '../db.js';
import type { Job, Theme } from '../types.js';

const THEMES: Theme[] = ['minimal', 'modern', 'two-column'];

type State = 'pick' | 'generating' | 'done' | 'error';

interface Props {
  job: Job;
  onBack: () => void;
}

export default function Generate({ job, onBack }: Props) {
  const [cursor, setCursor] = useState(0);
  const [state, setState] = useState<State>('pick');
  const [outputPath, setOutputPath] = useState('');
  const [error, setError] = useState('');

  useInput((input, key) => {
    if (key.escape) { onBack(); return; }

    if (state === 'pick') {
      if (key.upArrow) setCursor((c) => Math.max(0, c - 1));
      if (key.downArrow) setCursor((c) => Math.min(THEMES.length - 1, c + 1));
      if (key.return) runGeneration(THEMES[cursor]);
    }

    if (state === 'done' || state === 'error') {
      if (key.return || key.escape) onBack();
    }
  });

  async function runGeneration(theme: Theme) {
    setState('generating');
    try {
      const profile = await loadProfile();
      const cv = await generateCV(
        { jd: job.jd || `URL: ${job.url}`, archetype: job.archetype },
        { ...profile, experiences: profile.experiences }
      );

      const filename = `${job.id}-${job.company.toLowerCase().replace(/\s+/g, '-')}-${theme}.pdf`;
      const path = join(process.cwd(), 'output', filename);
      await renderPDF(cv, cv.roles[0]?.bullets[0] ?? '', theme, path);

      db.updateJob(job.id, { pdfPath: path, theme });
      setOutputPath(path);
      setState('done');
    } catch (err) {
      setError(String(err));
      setState('error');
    }
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">{job.company}</Text>
        <Text> — {job.role}</Text>
      </Box>

      {state === 'pick' && (
        <Box flexDirection="column">
          <Text bold marginBottom={1}>Select a theme:</Text>
          {THEMES.map((t, i) => (
            <Text key={t} color={i === cursor ? 'cyan' : undefined}>
              {i === cursor ? '▶ ' : '  '}{t}
            </Text>
          ))}
          <Box marginTop={1}>
            <Text dimColor>↑↓ navigate  enter generate  esc back</Text>
          </Box>
        </Box>
      )}

      {state === 'generating' && (
        <Box flexDirection="column">
          <Text color="yellow">Generating CV with Claude...</Text>
          <Text dimColor>This may take 15-30 seconds</Text>
        </Box>
      )}

      {state === 'done' && (
        <Box flexDirection="column">
          <Text color="green">✓ CV generated</Text>
          <Text dimColor>{outputPath}</Text>
          <Box marginTop={1}><Text dimColor>Press enter or esc to go back</Text></Box>
        </Box>
      )}

      {state === 'error' && (
        <Box flexDirection="column">
          <Text color="red">✗ Generation failed</Text>
          <Text dimColor>{error}</Text>
          <Box marginTop={1}><Text dimColor>Press enter or esc to go back</Text></Box>
        </Box>
      )}
    </Box>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- src/ui/Generate.test.tsx
```

Expected: PASS (2 tests)

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 6: Smoke test the full app**

```bash
# Ensure profile/ files exist first:
cp profile/config.example.ts profile/config.ts
cp profile/cv.example.md profile/cv.md
cp profile/experiences/index.example.ts profile/experiences/index.ts

npm start
```

Expected: Dashboard renders. Press `a` to add a job. Navigation works.

- [ ] **Step 7: Commit**

```bash
git add src/ui/Generate.tsx src/ui/Generate.test.tsx
git commit -m "feat: Generate screen with theme picker and PDF output"
```

---

## Post-MVP: Spec Self-Review

**Spec coverage check:**

| Spec requirement | Implemented |
|---|---|
| `jobs.json` schema + `db.ts` | ✅ Task 3 |
| `App.tsx` router | ✅ Task 5 |
| `Dashboard.tsx` navigable table | ✅ Task 6 |
| `AddJob.tsx` URL + JD paste | ✅ Task 7 |
| `JobDetail.tsx` with status update | ✅ Task 8 |
| `prompts/evaluation.md` (from career-ops) | ✅ Task 9 |
| `claude/evaluation.ts` | ✅ Task 10 |
| `prompts/generate-cv.md` | ✅ Task 11 |
| `claude/generate.ts` | ✅ Task 11 |
| Three HTML themes | ✅ Task 12 |
| `pdf.ts` Puppeteer renderer | ✅ Task 13 |
| `Generate.tsx` screen | ✅ Task 14 |
| Profile examples | ✅ Task 4 |
| `profile/` gitignored | ✅ Task 1 |
| Portal scanner | 🔜 Post-MVP |
| Multi-offer comparison | 🔜 Post-MVP |
