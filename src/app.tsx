/** @jsxImportSource @opentui/react */
import type { ThemeMode } from '@opentui/core';
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
  generateAndPersistCoverLetterPdf,
  generateAndPersistPdf,
  hydrateJobFromUrl,
  inferFromJdText,
  saveJob,
  summarizeJobDescription,
} from './services/jobs/jobs.js';
import type { Job, JobStatus } from './types.js';
import { answersDb } from './db.js';
import DashboardScreen from './screens/DashboardScreen.js';
import TasksIndicator from './components/TasksIndicator.js';
import type { Flash, FocusTarget, Overlay } from './ui.js';
import { scoreDisplay, type FlashVariant } from './lib/utils.js';
import type { JobActionView } from './components/JobActionWorkspace.js';
import type { ProfileActionView } from './components/ProfileActionWorkspace.js';
import { resolveUiTheme } from './theme.js';
import {
  hasProfile,
  loadProfileOrDefault,
  saveProfile,
} from './profile.js';

const JOB_FILTERS = ['Queue', 'Applied', 'Interview', 'Offer', 'Rejected', 'Discarded'] as const;

type JobFilter = (typeof JOB_FILTERS)[number];

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
  const initialProfileExists = hasProfile();
  const activeRenderer = useRenderer();
  const { width, height } = useTerminalDimensions();
  const appWidth = Math.max(width, 80);
  const appHeight = Math.max(height, 24);
  const [focus, setFocus] = useState<FocusTarget>('jobs');
  const [detailSource, setDetailSource] = useState<'status' | 'jobs' | 'profile' | 'answers'>('jobs');
  const [filter, setFilter] = useState<JobFilter>('Queue');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<Overlay>('none');
  const [answerJobId, setAnswerJobId] = useState<string | null>(null);
  const [jobActionState, setJobActionState] = useState<{
    jobId: string;
    view: JobActionView;
  } | null>(null);
  const [profileActionView, setProfileActionView] = useState<ProfileActionView | null>(
    null,
  );
  const [flash, setFlashState] = useState<Flash | null>(null);
  const [tasks, setTasks] = useState<string[]>([]);
  const [refreshToken, setRefreshToken] = useState(0);
  const [themeMode, setThemeMode] = useState<ThemeMode | null>(
    activeRenderer.themeMode,
  );
  const [profile, setProfileState] = useState(() => loadProfileOrDefault());
  const [requiresOnboarding, setRequiresOnboarding] = useState(
    !initialProfileExists,
  );
  const [showInitWizard, setShowInitWizard] = useState(!initialProfileExists);

  const jobs = useMemo(() => db.readJobs(), [refreshToken]);
  const answers = useMemo(() => answersDb.readAnswers(), [refreshToken]);
  const theme = useMemo(() => resolveUiTheme(themeMode), [themeMode]);

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
  const contentHeight = Math.max(12, appHeight - 1);

  useEffect(() => {
    const handleThemeMode = (nextMode: ThemeMode) => setThemeMode(nextMode);
    setThemeMode(activeRenderer.themeMode);
    activeRenderer.on('theme_mode', handleThemeMode);
    return () => {
      activeRenderer.off('theme_mode', handleThemeMode);
    };
  }, [activeRenderer]);

  useEffect(() => {
    if (!flash) return;
    const timeout = setTimeout(() => setFlashState(null), 2500);
    return () => clearTimeout(timeout);
  }, [flash]);

  useEffect(() => {
    if (!requiresOnboarding) return;
    if (showInitWizard) {
      setProfileActionView(null);
      setDetailSource('profile');
      setFocus('detail');
      return;
    }
    setDetailSource('profile');
    setFocus('profile');
  }, [requiresOnboarding]);

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
    setOverlay('none');
    setFocus('jobs');
    const updated = await generateAndPersistPdf(job, guidance);
    refreshJobs();
    setSelectedJobId(updated.id);
    return updated;
  }

  async function runGenerateCoverLetter(job: Job, guidance: string) {
    setOverlay('none');
    setFocus('jobs');
    const updated = await generateAndPersistCoverLetterPdf(job, guidance);
    refreshJobs();
    setSelectedJobId(updated.id);
    return updated;
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
    setFocus('jobs');
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
    setFocus('jobs');
    setFlash(`Updated metadata for #${jobId}`);
  }

  function handleSaveStatus(jobId: string, status: JobStatus) {
    db.updateJob(jobId, { status });
    refreshJobs();
    setOverlay('none');
    setJobActionState({ jobId, view: 'menu' });
    setFocus('jobs');
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
    setDetailSource('jobs');
  }

  function closeAnswerWorkspace() {
    setAnswerJobId(null);
    setFocus('jobs');
  }

  function openJobActions(view: JobActionView = 'menu') {
    if (!selectedJob) return;
    setOverlay('none');
    setAnswerJobId(null);
    setJobActionState({ jobId: selectedJob.id, view });
    setDetailSource('jobs');
    setFocus('jobs');
  }

  function closeJobActionWorkspace() {
    setJobActionState(null);
    setFocus('jobs');
  }

  function openProfileActions(view: ProfileActionView) {
    setOverlay('none');
    setAnswerJobId(null);
    setJobActionState(null);
    setProfileActionView(view);
    setDetailSource('profile');
    setFocus('profile');
  }

  function closeProfileActionWorkspace() {
    if (requiresOnboarding) {
      setProfileActionView(null);
      setShowInitWizard(true);
      setFocus('detail');
      setDetailSource('profile');
      return;
    }
    setProfileActionView(null);
    setFocus('profile');
  }

  function handleSaveProfile(nextProfile: typeof profile, message: string) {
    saveProfile(nextProfile);
    setProfileState(nextProfile);
    setRequiresOnboarding(false);
    setShowInitWizard(false);
    setProfileActionView(null);
    setDetailSource('profile');
    setFocus('profile');
    setFlash(message);
  }

  function chooseManualOnboarding() {
    setShowInitWizard(false);
    setProfileActionView('candidate');
    setDetailSource('profile');
    setFocus('profile');
  }

  function startAnswerWorkspace() {
    if (!selectedJob) return;
    setJobActionState(null);
    setAnswerJobId(selectedJob.id);
    setDetailSource('jobs');
    setFocus('jobs');
  }

  function activeConfigTarget(): Extract<FocusTarget, 'profile' | 'answers'> {
    return detailSource === 'answers' ? 'answers' : 'profile';
  }

  function setConfigTab(
    tab: Extract<FocusTarget, 'profile' | 'answers'>,
    nextFocus: FocusTarget = focus,
  ) {
    setDetailSource(tab);
    setFocus(nextFocus === 'detail' ? 'detail' : tab);
  }

  function cycleFocusedPanel(direction: -1 | 1) {
    const panel = focus === 'detail' ? detailSource : focus;

    if (panel === 'jobs') {
      const filterIndex = JOB_FILTERS.indexOf(filter);
      setFilter(
        JOB_FILTERS[
          (filterIndex + direction + JOB_FILTERS.length) % JOB_FILTERS.length
        ]!,
      );
      return;
    }

    if (panel === 'profile' || panel === 'answers') {
      const nextTab = panel === 'profile' ? 'answers' : 'profile';
      setConfigTab(nextTab, focus);
    }
  }

  function quit() {
    activeRenderer.destroy();
    process.exit(0);
  }

  useKeyboard((key) => {
    const PANEL_ORDER: Array<'status' | 'jobs' | 'profile'> = [
      'status',
      'jobs',
      'profile',
    ];
    const configTarget = activeConfigTarget();

    if (key.ctrl && key.name === 'c') quit();
    if (key.name === 'q') quit();

    if (overlay !== 'none') {
      if (key.name === 'escape') closeOverlay();
      return;
    }
    if (requiresOnboarding) return;
    if (answerJobId || jobActionState || profileActionView) return;
    if (key.name === '0') setFocus('detail');
    if (key.name === '1') {
      setFocus('status');
      setDetailSource('status');
    }
    if (key.name === '2') {
      setFocus('jobs');
      setDetailSource('jobs');
    }
    if (key.name === '3') {
      setFocus(configTarget);
      setDetailSource(configTarget);
    }
    if (key.name === 'tab') {
      let currentPanel: 'status' | 'jobs' | 'profile' = 'status';
      if (focus === 'jobs') currentPanel = 'jobs';
      if (focus === 'profile' || focus === 'answers') currentPanel = 'profile';
      const currentIndex = PANEL_ORDER.indexOf(currentPanel);
      const step = key.shift ? -1 : 1;
      const nextIndex =
        (currentIndex + step + PANEL_ORDER.length) % PANEL_ORDER.length;
      const nextPanel = PANEL_ORDER[nextIndex]!;
      setFocus(nextPanel === 'profile' ? configTarget : nextPanel);
      if (nextPanel !== 'profile') setDetailSource(nextPanel);
      return;
    }
    if (key.sequence === '[') cycleFocusedPanel(-1);
    if (key.sequence === ']') cycleFocusedPanel(1);
    if (key.name === 'a') setOverlay('add');
    if (key.name === 'e' && selectedJob) void runEvaluate(selectedJob);
    if (key.name === 'g' && selectedJob) openJobActions('generate-cv');
    if (key.name === 'c' && selectedJob) openJobActions('generate-cover-letter');
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
      <DashboardScreen
        theme={theme}
        contentHeight={contentHeight}
        queueWidth={queueWidth}
        detailWidth={detailWidth}
        filter={filter}
        filters={JOB_FILTERS}
        jobs={jobs}
        filteredJobs={filteredJobs}
        answers={answers}
        profile={profile}
        selectedJob={selectedJob}
        selectedIndex={selectedIndex}
        focus={focus}
        detailSource={detailSource}
        overlay={overlay}
        onFilterChange={setFilter}
        isAnswering={selectedJob?.id === answerJobId}
        jobActionView={
          selectedJob?.id === jobActionState?.jobId ? jobActionState?.view ?? null : null
        }
        profileActionView={profileActionView}
        showInitWizard={showInitWizard}
        onJobSelect={setSelectedJobId}
        onCycleFilter={(direction) =>
          setFilter(
            JOB_FILTERS[
              (JOB_FILTERS.indexOf(filter) + direction + JOB_FILTERS.length) % JOB_FILTERS.length
            ]!,
          )}
        onOpenActions={() => openJobActions('menu')}
        onCloseAnswer={closeAnswerWorkspace}
        onAnswerSaved={(message) => {
          refreshJobs();
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
        onOpenGeneratedCoverLetter={() =>
          selectedJob &&
          openTarget(
            selectedJob.coverLetterPdfPath,
            `Opened generated cover letter for #${selectedJob.id}.`,
            'No generated cover letter available.',
          )}
        onSaveMetadata={(patch) => selectedJob && handleSaveMetadata(selectedJob.id, patch)}
        onSaveEditJd={(jd) => selectedJob && handleSaveEditJd(selectedJob.id, jd)}
        onSaveStatus={(status) => selectedJob && handleSaveStatus(selectedJob.id, status)}
        onDeleteJob={() => selectedJob && handleConfirmDelete(selectedJob.id)}
        onGenerateCv={(guidance) =>
          selectedJob ? runGenerate(selectedJob, guidance) : Promise.reject(new Error('No job selected'))
        }
        onGenerateCoverLetter={(guidance) =>
          selectedJob
            ? runGenerateCoverLetter(selectedJob, guidance)
            : Promise.reject(new Error('No job selected'))
        }
        onOpenProfileActions={openProfileActions}
        onCloseProfileActions={closeProfileActionWorkspace}
        onSaveProfile={handleSaveProfile}
        onCompleteInit={handleSaveProfile}
        onChooseManualOnboarding={chooseManualOnboarding}
        onAddUrl={handleAddUrl}
        onAddJd={handleAddJd}
        onOverlayChange={setOverlay}
        onCloseOverlay={closeOverlay}
      />

      <TasksIndicator tasks={tasks} theme={theme} />
    </box>
  );
}
