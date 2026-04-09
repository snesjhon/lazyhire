import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import type { Job } from './types.js';

const DEFAULT_PATH = join(process.cwd(), 'profile', 'jobs.json');

export function createDb(dbPath = DEFAULT_PATH) {
  function readJobs(): Job[] {
    if (!existsSync(dbPath)) return [];
    return JSON.parse(readFileSync(dbPath, 'utf8')) as Job[];
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
