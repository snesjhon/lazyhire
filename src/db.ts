import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import type { AnswerEntry, Job } from './types.js';
import { normalizeJobClassification } from './taxonomy.js';

const DEFAULT_PATH = join(process.cwd(), 'profile', 'jobs.json');

export function createDb(dbPath = DEFAULT_PATH) {
  function readJobs(): Job[] {
    if (!existsSync(dbPath)) return [];
    const rawJobs = JSON.parse(readFileSync(dbPath, 'utf8')) as Array<Job & Record<string, unknown>>;
    return rawJobs.map((job) => ({
      ...job,
      ...normalizeJobClassification(job),
      notes: typeof job.notes === 'string' ? job.notes : '',
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

// Default singleton — used by the app
export const db = createDb();

const DEFAULT_ANSWERS_PATH = join(process.cwd(), 'profile', 'answers.json');

export function createAnswersDb(dbPath = DEFAULT_ANSWERS_PATH) {
  function readAnswers(): AnswerEntry[] {
    if (!existsSync(dbPath)) return [];
    return JSON.parse(readFileSync(dbPath, 'utf8')) as AnswerEntry[];
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
