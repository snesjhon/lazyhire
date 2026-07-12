import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import type { AnswerEntry, DiscoveredStore, Job } from '@shared/types';
import { normalizeJobClassification } from './taxonomy.js';
import { DATA_DIR } from './paths.js';

// ── Jobs DB ────────────────────────────────────────────────────────

const DEFAULT_JOBS_PATH = join(DATA_DIR, 'jobs.json');

export function createDb(dbPath = DEFAULT_JOBS_PATH) {
  function readJobs(): Job[] {
    if (!existsSync(dbPath)) return [];
    const rawJobs = JSON.parse(readFileSync(dbPath, 'utf8')) as Array<Job & Record<string, unknown>>;
    return rawJobs.map((job) => ({
      ...job,
      ...normalizeJobClassification(job),
      notes: typeof job.notes === 'string' ? job.notes : '',
      coverLetterPdfPath:
        typeof job.coverLetterPdfPath === 'string' ? job.coverLetterPdfPath : null,
    }));
  }

  function writeJobs(jobs: Job[]): void {
    mkdirSync(dirname(dbPath), { recursive: true });
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

  function removeJob(id: string): void {
    const jobs = readJobs();
    const nextJobs = jobs.filter((job) => job.id !== id);
    if (nextJobs.length === jobs.length) throw new Error(`Job ${id} not found`);
    writeJobs(nextJobs);
  }

  function nextId(): string {
    const jobs = readJobs();
    if (jobs.length === 0) return '001';
    const max = Math.max(...jobs.map((j) => parseInt(j.id, 10)));
    return String(max + 1).padStart(3, '0');
  }

  return { readJobs, writeJobs, addJob, updateJob, removeJob, nextId };
}

export const db = createDb();

// ── Answers DB ─────────────────────────────────────────────────────

const DEFAULT_ANSWERS_PATH = join(DATA_DIR, 'answers.json');

export function createAnswersDb(dbPath = DEFAULT_ANSWERS_PATH) {
  function readAnswers(): AnswerEntry[] {
    if (!existsSync(dbPath)) return [];
    const rawAnswers = JSON.parse(readFileSync(dbPath, 'utf8')) as Array<
      AnswerEntry & Record<string, unknown>
    >;
    return rawAnswers.map((answer) => ({
      ...answer,
      originJobId:
        typeof answer.originJobId === 'string' ? answer.originJobId : null,
      company: typeof answer.company === 'string' ? answer.company : null,
      role: typeof answer.role === 'string' ? answer.role : null,
    }));
  }

  function writeAnswers(answers: AnswerEntry[]): void {
    mkdirSync(dirname(dbPath), { recursive: true });
    writeFileSync(dbPath, JSON.stringify(answers, null, 2), 'utf8');
  }

  function addAnswer(answer: AnswerEntry): void {
    const answers = readAnswers();
    answers.push(answer);
    writeAnswers(answers);
  }

  function updateAnswer(id: string, patch: Partial<AnswerEntry>): void {
    const answers = readAnswers();
    const idx = answers.findIndex((a) => a.id === id);
    if (idx === -1) throw new Error(`Answer ${id} not found`);
    answers[idx] = { ...answers[idx], ...patch };
    writeAnswers(answers);
  }

  function removeAnswer(id: string): void {
    const answers = readAnswers();
    const next = answers.filter((a) => a.id !== id);
    if (next.length === answers.length) throw new Error(`Answer ${id} not found`);
    writeAnswers(next);
  }

  function nextAnswerId(): string {
    const answers = readAnswers();
    if (answers.length === 0) return '001';
    const max = Math.max(...answers.map((a) => parseInt(a.id, 10)));
    return String(max + 1).padStart(3, '0');
  }

  return { readAnswers, writeAnswers, addAnswer, updateAnswer, removeAnswer, nextAnswerId };
}

export const answersDb = createAnswersDb();

// ── Discovered DB ──────────────────────────────────────────────────

const DISCOVERED_PATH = join(DATA_DIR, 'discovered.json');

const EMPTY_DISCOVERED_STORE: DiscoveredStore = {
  batch: [],
  lastSourcedAt: '',
  companyIndex: {},
};

function readDiscovered(): DiscoveredStore {
  if (!existsSync(DISCOVERED_PATH)) return { ...EMPTY_DISCOVERED_STORE };
  try {
    return JSON.parse(readFileSync(DISCOVERED_PATH, 'utf8')) as DiscoveredStore;
  } catch {
    return { ...EMPTY_DISCOVERED_STORE };
  }
}

function writeDiscovered(store: DiscoveredStore): void {
  mkdirSync(dirname(DISCOVERED_PATH), { recursive: true });
  writeFileSync(DISCOVERED_PATH, JSON.stringify(store, null, 2), 'utf8');
}

export const discoveredDb = { readDiscovered, writeDiscovered };

// ── Dismissed DB ───────────────────────────────────────────────────

const DISMISSED_PATH = join(DATA_DIR, 'dismissed.json');

function readDismissed(): string[] {
  if (!existsSync(DISMISSED_PATH)) return [];
  try {
    const data = JSON.parse(readFileSync(DISMISSED_PATH, 'utf8')) as { urls?: string[] };
    return data.urls ?? [];
  } catch {
    return [];
  }
}

function writeDismissed(urls: string[]): void {
  mkdirSync(dirname(DISMISSED_PATH), { recursive: true });
  writeFileSync(DISMISSED_PATH, JSON.stringify({ urls }, null, 2), 'utf8');
}

function addDismissed(url: string): void {
  const urls = readDismissed();
  if (!urls.includes(url)) {
    urls.push(url);
    writeDismissed(urls);
  }
}

function isDismissed(url: string): boolean {
  return readDismissed().includes(url);
}

export const dismissedDb = { readDismissed, writeDismissed, addDismissed, isDismissed };
