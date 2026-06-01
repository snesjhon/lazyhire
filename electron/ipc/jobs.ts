import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc-channels';
import { db, answersDb } from '../services/db.js';
import { hydrateJobFromUrl, createPendingJob } from '../services/jobs.js';
import type { AnswerEntry, Job } from '@shared/types';

export function registerJobsHandlers(): void {
  ipcMain.handle(IPC.JOBS_LIST, () => {
    return db.readJobs();
  });

  ipcMain.handle(IPC.JOBS_ADD, (_event, partial: Pick<Job, 'company' | 'role' | 'url' | 'jd'> & Partial<Pick<Job, 'jdSummary'>>) => {
    const job = createPendingJob({ id: db.nextId(), ...partial });
    db.addJob(job);
    return job;
  });

  ipcMain.handle(
    IPC.JOBS_UPDATE,
    (_event, arg1: string | ({ id: string } & Partial<Job>), arg2?: Partial<Job>) => {
      const id = typeof arg1 === 'string' ? arg1 : arg1.id;
      const patch = typeof arg1 === 'string'
        ? (arg2 ?? {})
        : Object.fromEntries(
            Object.entries(arg1).filter(([key]) => key !== 'id'),
          ) as Partial<Job>;

      db.updateJob(id, patch);
    const jobs = db.readJobs();
    return jobs.find((j) => j.id === id) ?? null;
    },
  );

  ipcMain.handle(IPC.JOBS_REMOVE, (_event, id: string) => {
    db.removeJob(id);
  });

  ipcMain.handle(IPC.JOBS_HYDRATE, async (_event, url: string) => {
    const hydrated = await hydrateJobFromUrl(url);
    const job = createPendingJob({ id: db.nextId(), ...hydrated });
    db.addJob(job);
    return job;
  });

  ipcMain.handle(IPC.ANSWERS_LIST, () => {
    return answersDb.readAnswers();
  });

  ipcMain.handle(IPC.ANSWERS_SAVE, (_event, entry: Omit<AnswerEntry, 'id' | 'added' | 'revised'>) => {
    const now = new Date().toISOString();
    const answer: AnswerEntry = {
      ...entry,
      id: answersDb.nextAnswerId(),
      added: now,
      revised: now,
    };
    answersDb.addAnswer(answer);
    return answer;
  });
}
