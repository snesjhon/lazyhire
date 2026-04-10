/** @jsxImportSource @opentui/react */
import {
  useKeyboard,
  useRenderer,
  useTerminalDimensions,
} from '@opentui/react';
import { spawn } from 'child_process';
import { useEffect, useMemo, useState } from 'react';
import { db } from './db.js';
import {
  createPendingJob,
  evaluateAndPersistJob,
  generateAndPersistPdf,
  hydrateJobFromUrl,
  inferFromJdText,
  saveJob,
  summarizeJobDescription,
} from './services/jobs/jobs.js';
import { JOB_STATUSES, type Job, type JobStatus } from './types.js';
import AnswersScreen from './screens/AnswersScreen.js';
import DashboardOverlay from './components/DashboardOverlay.js';
import DashboardScreen from './screens/DashboardScreen.js';
import Header from './components/Header.js';
import ProfileScreen from './screens/ProfileScreen.js';
import ScanScreen from './screens/ScanScreen.js';
import TasksIndicator from './components/TasksIndicator.js';
import type { Flash, FocusTarget, Overlay, Screen } from './ui.js';
import { scoreDisplay, type FlashVariant } from './lib/utils.js';
import type { JobActionView } from './components/JobActionWorkspace.js';

const JOB_FILTERS = [
  'Queue',
  'Applied',
  'Interview',
  'Offer',
  'Rejected',
  'Discarded',
] as const;

type JobFilter = (typeof JOB_FILTERS)[number];
export const initialScreen: Screen = process.argv.includes('--scan')
  ? 'scan'
  : 'dashboard';

function browserCommand(
  target: string,
): { command: string; args: string[] } | null {
  if (!target.trim()) return null;
  if (process.platform === 'darwin') return { command: 'open', args: [target] };
  if (process.platform === 'win32')
    return { command: 'cmd', args: ['/c', 'start', '', target] };
  if (process.platform === 'linux')
    return { command: 'xdg-open', args: [target] };
  return null;
}

export default function App() {
  const activeRenderer = useRenderer();
  const { width, height } = useTerminalDimensions();
  const appWidth = Math.max(width, 80);
  const appHeight = Math.max(height, 24);
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [focus, setFocus] = useState<FocusTarget>('jobs');
  const [filter, setFilter] = useState<JobFilter>('Queue');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<Overlay>('none');
  const [answerJobId, setAnswerJobId] = useState<string | null>(null);
  const [jobActionState, setJobActionState] = useState<{
    jobId: string;
    view: JobActionView;
  } | null>(null);
  const [flash, setFlashState] = useState<Flash | null>(null);
  const [tasks, setTasks] = useState<string[]>([]);
  const [refreshToken, setRefreshToken] = useState(0);

  const jobs = useMemo(() => db.readJobs(), [refreshToken]);

  const filteredJobs = useMemo(() => {
    const next = jobs.filter((job) => {
      if (filter === 'Queue') {
        return job.status === 'Pending' || job.status === 'Evaluated';
      }
      return job.status === filter;
    });
    return next.slice().sort((a, b) => {
      const scoreDelta =
        (b.score ?? Number.NEGATIVE_INFINITY) -
        (a.score ?? Number.NEGATIVE_INFINITY);
      if (scoreDelta !== 0) return scoreDelta;
      if (a.added !== b.added) return b.added.localeCompare(a.added);
      return b.id.localeCompare(a.id);
    });
  }, [filter, jobs]);

  const selectedJob =
    filteredJobs.find((job) => job.id === selectedJobId) ??
    filteredJobs[0] ??
    null;
  const selectedIndex = selectedJob
    ? Math.max(
        0,
        filteredJobs.findIndex((job) => job.id === selectedJob.id),
      )
    : 0;

  const queueWidth = Math.max(42, Math.floor(appWidth * 0.47));
  const detailWidth = Math.max(34, appWidth - queueWidth - 5);
  const contentHeight = Math.max(
    10,
    appHeight - (overlay === 'none' ? 10 : 20),
  );
  const detailHeight = Math.max(8, contentHeight - 5);

  useEffect(() => {
    if (!flash) return;
    const timeout = setTimeout(() => setFlashState(null), 2500);
    return () => clearTimeout(timeout);
  }, [flash]);

  useEffect(() => {
    if (filteredJobs.length === 0) {
      setSelectedJobId(null);
      return;
    }
    if (
      !selectedJobId ||
      !filteredJobs.some((job) => job.id === selectedJobId)
    ) {
      setSelectedJobId(filteredJobs[0]!.id);
    }
  }, [filteredJobs, selectedJobId]);

  useEffect(() => {
    if (answerJobId && !jobs.some((job) => job.id === answerJobId)) {
      setAnswerJobId(null);
    }
  }, [answerJobId, jobs]);

  useEffect(() => {
    if (answerJobId && selectedJobId !== answerJobId) {
      setAnswerJobId(null);
    }
  }, [answerJobId, selectedJobId]);

  useEffect(() => {
    if (jobActionState && !jobs.some((job) => job.id === jobActionState.jobId)) {
      setJobActionState(null);
    }
  }, [jobActionState, jobs]);

  useEffect(() => {
    if (jobActionState && selectedJobId !== jobActionState.jobId) {
      setJobActionState(null);
    }
  }, [jobActionState, selectedJobId]);

  function refreshJobs() {
    setRefreshToken((v) => v + 1);
  }

  function setFlash(message: string, variant: FlashVariant = 'success') {
    setFlashState({ message, variant });
  }

  function startTask(label: string): () => void {
    setTasks((current) => [...current, label]);
    return () => {
      setTasks((current) => {
        const index = current.indexOf(label);
        if (index === -1) return current;
        return current.filter((_, i) => i !== index);
      });
    };
  }

  function openTarget(
    target: string | null | undefined,
    successMessage: string,
    missingMessage: string,
  ) {
    if (!target?.trim()) {
      setFlash(missingMessage, 'warning');
      return;
    }
    const command = browserCommand(target);
    if (!command) {
      setFlash(
        `Opening external targets is not supported on ${process.platform}.`,
        'error',
      );
      return;
    }
    const child = spawn(command.command, command.args, {
      detached: true,
      stdio: 'ignore',
    });
    child.on('error', (error) =>
      setFlash(`Failed to open target: ${String(error)}`, 'error'),
    );
    child.unref();
    setFlash(successMessage, 'info');
  }

  async function handleAddUrl(url: string) {
    url = url.trim();
    if (!url) {
      setOverlay('none');
      setFocus('jobs');
      return;
    }
    const finishTask = startTask('Hydrating and evaluating link');
    setOverlay('none');
    setFocus('jobs');
    try {
      const hydrated = await hydrateJobFromUrl(url);
      const saved = saveJob(createPendingJob(hydrated));
      refreshJobs();
      setSelectedJobId(saved.id);
      try {
        const updated = await evaluateAndPersistJob(saved);
        refreshJobs();
        setSelectedJobId(updated.id);
        setFlash(
          `Added and evaluated #${updated.id} ${updated.company} — ${updated.role}`,
        );
      } catch (error) {
        setFlash(
          `Saved #${saved.id}; evaluation failed: ${String(error)}`,
          'warning',
        );
      }
    } catch (error) {
      const fallback = saveJob(
        createPendingJob({
          company: 'Unknown Company',
          role: 'Pasted Link',
          url,
          jd: '',
        }),
      );
      refreshJobs();
      setSelectedJobId(fallback.id);
      setFlash(
        `Saved #${fallback.id} as Pending after intake failed: ${String(error)}`,
        'warning',
      );
    } finally {
      finishTask();
    }
  }

  async function handleAddJd(jd: string) {
    jd = jd.trim();
    if (!jd) {
      setOverlay('none');
      setFocus('jobs');
      return;
    }
    if (/^https?:\/\//i.test(jd)) {
      await handleAddUrl(jd);
      return;
    }
    const finishTask = startTask('Saving and evaluating pasted JD');
    setOverlay('none');
    setFocus('jobs');
    try {
      const { company, role } = inferFromJdText(jd);
      const saved = saveJob(
        createPendingJob({
          company,
          role,
          url: '',
          jd,
          jdSummary: summarizeJobDescription(jd),
        }),
      );
      const updated = await evaluateAndPersistJob(saved);
      refreshJobs();
      setSelectedJobId(updated.id);
      setFlash(
        `Added and evaluated #${updated.id} ${updated.company} — ${updated.role}`,
      );
    } catch (error) {
      setFlash(`JD intake failed: ${String(error)}`, 'error');
    } finally {
      finishTask();
    }
  }

  async function runEvaluate(job: Job) {
    const finishTask = startTask(`Evaluating #${job.id}`);
    setOverlay('none');
    setJobActionState(null);
    setFocus('jobs');
    try {
      const updated = await evaluateAndPersistJob(job);
      refreshJobs();
      setSelectedJobId(updated.id);
      setFlash(
        `Evaluated #${updated.id} with score ${scoreDisplay(updated.score)}`,
      );
    } catch (error) {
      setFlash(`Evaluation failed: ${String(error)}`, 'error');
    } finally {
      finishTask();
    }
  }

  async function runGenerate(job: Job, guidance: string) {
    const finishTask = startTask(`Generating CV for #${job.id}`);
    setOverlay('none');
    setJobActionState({ jobId: job.id, view: 'menu' });
    setFocus('detail');
    try {
      const updated = await generateAndPersistPdf(job, guidance);
      refreshJobs();
      setSelectedJobId(updated.id);
      setFlash(`Generated CV for #${updated.id}: ${updated.pdfPath}`);
    } catch (error) {
      setFlash(`CV generation failed: ${String(error)}`, 'error');
    } finally {
      finishTask();
    }
  }

  function handleSaveEditJd(jobId: string, jd: string) {
    const trimmedJd = jd.trim();
    db.updateJob(jobId, {
      jd: trimmedJd,
      jdSummary: summarizeJobDescription(trimmedJd),
    });
    refreshJobs();
    setOverlay('none');
    setJobActionState({ jobId, view: 'menu' });
    setFocus('detail');
    setFlash(`Updated job description for #${jobId}`);
  }

  function handleSaveMetadata(
    jobId: string,
    patch: Partial<Pick<Job, 'company' | 'role' | 'url' | 'notes'>>,
  ) {
    const cleanPatch = Object.fromEntries(
      Object.entries(patch).map(([key, value]) => [
        key,
        typeof value === 'string' ? value.trim() : value,
      ]),
    ) as Partial<Pick<Job, 'company' | 'role' | 'url' | 'notes'>>;

    db.updateJob(jobId, cleanPatch);
    refreshJobs();
    setSelectedJobId(jobId);
    setOverlay('none');
    setJobActionState({ jobId, view: 'menu' });
    setFocus('detail');
    setFlash(`Updated metadata for #${jobId}`);
  }

  function handleSaveStatus(jobId: string, status: JobStatus) {
    db.updateJob(jobId, { status });
    refreshJobs();
    setOverlay('none');
    setJobActionState({ jobId, view: 'menu' });
    setFocus('detail');
    setFlash(`Updated #${jobId} to ${status}`);
  }

  function handleConfirmDelete(jobId: string) {
    db.removeJob(jobId);
    refreshJobs();
    setOverlay('none');
    setJobActionState(null);
    setFocus('jobs');
    setFlash(`Deleted #${jobId}`);
  }

  function closeOverlay() {
    setOverlay('none');
    setFocus('jobs');
  }

  function closeAnswerWorkspace() {
    setAnswerJobId(null);
    setFocus('detail');
  }

  function openJobActions(view: JobActionView = 'menu') {
    if (!selectedJob) return;
    setOverlay('none');
    setAnswerJobId(null);
    setJobActionState({ jobId: selectedJob.id, view });
    setFocus('detail');
  }

  function closeJobActionWorkspace() {
    setJobActionState(null);
    setFocus('detail');
  }

  function startAnswerWorkspace() {
    if (!selectedJob) return;
    setJobActionState(null);
    setAnswerJobId(selectedJob.id);
    setFocus('detail');
  }

  function quit() {
    activeRenderer.destroy();
    process.exit(0);
  }

  useKeyboard((key) => {
    if (key.ctrl && key.name === 'c') quit();
    if (key.name === 'q') quit();
    if (key.name === '1') setScreen('dashboard');
    if (key.name === '2') setScreen('profile');
    if (key.name === '3') setScreen('answers');

    if (screen !== 'dashboard') return;

    if (overlay !== 'none') {
      if (key.name === 'escape') closeOverlay();
      return;
    }
    if (answerJobId || jobActionState) return;
    if (key.name === 'tab')
      setFilter(
        JOB_FILTERS[(JOB_FILTERS.indexOf(filter) + 1) % JOB_FILTERS.length]!,
      );
    if (key.name === 'h') setFocus('jobs');
    if (key.name === 'l' && selectedJob) setFocus('detail');
    if (key.name === 'a') setOverlay('add');
    if (key.name === 'return' && selectedJob && focus === 'jobs')
      openJobActions('menu');
    if (key.name === 'e' && selectedJob) void runEvaluate(selectedJob);
    if (key.name === 'g' && selectedJob) openJobActions('generate-cv');
    if (key.name === 'w' && selectedJob) startAnswerWorkspace();
    if (key.name === 's' && selectedJob) openJobActions('status');
    if (key.name === 'd' && selectedJob) openJobActions('delete');
    if (key.name === 'o' && selectedJob)
      openTarget(
        selectedJob.url,
        `Opened job link for #${selectedJob.id}.`,
        'No job URL available.',
      );
  });

  return (
    <box
      flexDirection="column"
      width={appWidth}
      height={appHeight}
      paddingX={1}
    >
      <Header
        appWidth={appWidth}
        screen={screen}
        focus={focus}
        overlay={overlay}
        flash={flash}
        jobCount={jobs.length}
        onScreenChange={setScreen}
        onFocusChange={setFocus}
      />

      {screen === 'dashboard' ? (
        <DashboardScreen
          contentHeight={contentHeight}
          queueWidth={queueWidth}
          detailWidth={detailWidth}
          detailHeight={detailHeight}
          filter={filter}
          filters={JOB_FILTERS}
          filteredJobs={filteredJobs}
          selectedJob={selectedJob}
          selectedIndex={selectedIndex}
          focus={focus}
          overlay={overlay}
          isAnswering={selectedJob?.id === answerJobId}
          jobActionView={
            selectedJob?.id === jobActionState?.jobId ? jobActionState.view : null
          }
          onJobSelect={setSelectedJobId}
          onOpenActions={() => openJobActions('menu')}
          onCloseAnswer={closeAnswerWorkspace}
          onAnswerSaved={(message) => {
            closeAnswerWorkspace();
            setFlash(message);
          }}
          onCloseJobActions={closeJobActionWorkspace}
          onStartAnswer={startAnswerWorkspace}
          onEvaluateJob={() => selectedJob && void runEvaluate(selectedJob)}
          onOpenJobLink={() =>
            selectedJob &&
            openTarget(
              selectedJob.url,
              `Opened job link for #${selectedJob.id}.`,
              'No job URL available.',
            )}
          onOpenGeneratedCv={() =>
            selectedJob &&
            openTarget(
              selectedJob.pdfPath,
              `Opened generated CV for #${selectedJob.id}.`,
              'No generated CV available.',
            )}
          onSaveMetadata={(patch) => selectedJob && handleSaveMetadata(selectedJob.id, patch)}
          onSaveEditJd={(jd) => selectedJob && handleSaveEditJd(selectedJob.id, jd)}
          onSaveStatus={(status) => selectedJob && handleSaveStatus(selectedJob.id, status)}
          onDeleteJob={() => selectedJob && handleConfirmDelete(selectedJob.id)}
          onGenerateCv={(guidance) =>
            selectedJob ? runGenerate(selectedJob, guidance) : Promise.resolve()
          }
        />
      ) : screen === 'scan' ? (
        <ScanScreen
          appWidth={appWidth}
          appHeight={appHeight}
          onBack={() => setScreen('dashboard')}
        />
      ) : screen === 'profile' ? (
        <ProfileScreen appWidth={appWidth} appHeight={appHeight} />
      ) : (
        <AnswersScreen appWidth={appWidth} appHeight={appHeight} />
      )}

      {screen === 'dashboard' && overlay !== 'none' && (
        <DashboardOverlay
          overlay={overlay}
          onAddUrl={handleAddUrl}
          onAddJd={handleAddJd}
          onOverlayChange={setOverlay}
          onClose={closeOverlay}
        />
      )}

      <TasksIndicator tasks={tasks} />
    </box>
  );
}
