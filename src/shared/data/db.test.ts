import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { createDb } from './db.js';
import type { Job } from '../models/types.js';

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
  category: null,
  focus: null,
  reportPath: null,
  pdfPath: null,
  coverLetterPdfPath: null,
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

  it('removes a job by id', () => {
    db.addJob(makeJob({ id: '001' }));
    db.addJob(makeJob({ id: '002', company: 'Beta' }));
    db.removeJob('001');
    expect(db.readJobs()).toEqual([makeJob({ id: '002', company: 'Beta' })]);
  });

  it('throws when removing non-existent id', () => {
    expect(() => db.removeJob('999')).toThrow('Job 999 not found');
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
