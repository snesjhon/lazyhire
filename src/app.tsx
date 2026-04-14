/** @jsxImportSource @opentui/react */
import type { ThemeMode } from '@opentui/core';
import {
  useKeyboard,
  useRenderer,
  useTerminalDimensions,
} from '@opentui/react';
import { spawn } from 'child_process';
import { useEffect, useMemo, useState } from 'react';
import { db } from './shared/data/db.js';
import {
  createPendingJob,
  evaluateAndPersistJob,
  generateAndPersistCoverLetterPdf,
  generateAndPersistPdf,
  hydrateJobFromUrl,
  inferFromJdText,
  saveJob,
} from './features/jobs/services/jobs.js';
import type { Job, JobStatus } from './shared/models/types.js';
import { answersDb } from './shared/data/db.js';
import DashboardScreen from './features/dashboard/ui/DashboardScreen.js';
import DashboardOverlay from './features/dashboard/ui/DashboardOverlay.js';
import TasksIndicator from './shared/app-shell/TasksIndicator.js';
import InitWorkspace from './features/init/ui/InitWorkspace.js';
import ProfileActionWorkspace from './features/profile/ui/ProfileActionWorkspace.js';
import type { Flash, FocusTarget, JobIntakeState } from './shared/ui/state.js';
import { scoreDisplay, type FlashVariant } from './shared/lib/utils.js';
import AnswerWorkspace from './features/answers/ui/AnswerWorkspace.js';
import type { AnswerDraft } from './features/answers/ui/AnswerWorkspace.js';
import JobActionWorkspace from './features/jobs/ui/JobActionWorkspace.js';
import type {
  GenerateCvDraft,
  GenerateCoverLetterDraft,
  JobActionView,
} from './features/jobs/ui/JobActionWorkspace.js';
import type { ProfileActionView } from './features/profile/ui/ProfileActionWorkspace.js';
import { resolveUiTheme } from './shared/ui/theme.js';
import {
  createEmptyProfile,
  hasProfile,
  loadProfileOrDefault,
  saveProfile,
} from './shared/models/profile.js';
import type {
  CvBulletWordRange,
  CvTextSizeScale,
} from './features/jobs/services/generate.js';
import {
  DEFAULT_CV_BULLET_WORD_RANGE,
  DEFAULT_CV_TEXT_SIZE_SCALE,
} from './features/jobs/services/generate.js';
import {
  DEFAULT_COVER_LETTER_TOTAL_WORD_COUNT,
  type CoverLetterTotalWordCount,
} from './features/jobs/services/cover-letter.js';

const JOB_FILTERS = [
  'Queue',
  'Applied',
  'Interview',
  'Offer',
  'Rejected',
  'Discarded',
] as const;

type JobFilter = (typeof JOB_FILTERS)[number];

function createDefaultGenerateCvDraft(): GenerateCvDraft {
  return {
    guidance: '',
    bulletWordRange: DEFAULT_CV_BULLET_WORD_RANGE,
    textSizeScale: DEFAULT_CV_TEXT_SIZE_SCALE,
    selectedBulletPresetId: 'balanced',
    selectedTextSizePresetId: 'balanced',
    phase: 'bullet-preset',
  };
}

function createDefaultGenerateCoverLetterDraft(): GenerateCoverLetterDraft {
  return {
    guidance: '',
    totalWordCount: DEFAULT_COVER_LETTER_TOTAL_WORD_COUNT,
    selectedLengthPresetId: 'balanced',
    phase: 'length-preset',
  };
}

function createDefaultAnswerDraft(job: Pick<Job, 'company'>): AnswerDraft {
  return {
    step: 'ask-question',
    question: '',
    questionDraft: '',
    category: 'other',
    tone: '',
    contextDraft: '',
    refineDraft: '',
    generatedAnswer: '',
    statusLine: `Write a question for ${job.company || 'this company'}.`,
  };
}

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
  const [detailSource, setDetailSource] = useState<
    'status' | 'jobs' | 'profile' | 'answers'
  >('jobs');
  const [filter, setFilter] = useState<JobFilter>('Queue');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [jobIntakeState, setJobIntakeState] = useState<JobIntakeState>('none');
  const [evaluatingMessage, setEvaluatingMessage] = useState<string | null>(
    null,
  );
  const [addUrlFailureMessage, setAddUrlFailureMessage] = useState<
    string | null
  >(null);
  const [answerJobId, setAnswerJobId] = useState<string | null>(null);
  const [jobActionState, setJobActionState] = useState<{
    jobId: string;
    view: JobActionView;
  } | null>(null);
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, AnswerDraft>>(
    {},
  );
  const [generateCvDrafts, setGenerateCvDrafts] = useState<
    Record<string, GenerateCvDraft>
  >({});
  const [generateCoverLetterDrafts, setGenerateCoverLetterDrafts] = useState<
    Record<string, GenerateCoverLetterDraft>
  >({});
  const [profileActionView, setProfileActionView] =
    useState<ProfileActionView | null>(null);
  const [onboardingInitialView, setOnboardingInitialView] =
    useState<ProfileActionView>('candidate');
  const [flash, setFlashState] = useState<Flash | null>(null);
  const [tasks, setTasks] = useState<string[]>([]);
  const [refreshToken, setRefreshToken] = useState(0);
  const [themeMode, setThemeMode] = useState<ThemeMode | null>(
    activeRenderer.themeMode,
  );
  const [profile, setProfileState] = useState(() => loadProfileOrDefault());
  const [onboardingProfile, setOnboardingProfile] = useState(() =>
    createEmptyProfile(),
  );
  const [requiresOnboarding, setRequiresOnboarding] =
    useState(!initialProfileExists);
  const [showInitWizard, setShowInitWizard] = useState(!initialProfileExists);

  const jobs = useMemo(() => db.readJobs(), [refreshToken]);
  const answers = useMemo(() => answersDb.readAnswers(), [refreshToken]);
  const theme = useMemo(() => resolveUiTheme(themeMode), [themeMode]);

  const filteredJobs = useMemo(() => {
    const next = jobs.filter((job) => {
      if (filter === 'Queue') {
        return job.status === 'Evaluated';
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
    if (
      jobActionState &&
      !jobs.some((job) => job.id === jobActionState.jobId)
    ) {
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

  function startJobIntakeEvaluation(message: string) {
    setAddUrlFailureMessage(null);
    setEvaluatingMessage(message);
    setJobIntakeState('evaluating');
    setAnswerJobId(null);
    setJobActionState(null);
    setDetailSource('jobs');
    setFocus('detail');
  }

  function stopJobIntakeEvaluation(nextFocus: FocusTarget = 'jobs') {
    setEvaluatingMessage(null);
    setJobIntakeState('none');
    setFocus(nextFocus);
  }

  function showAddUrlFailure(message: string) {
    setEvaluatingMessage(null);
    setAddUrlFailureMessage(message);
    setJobIntakeState('crawl-failed');
    setAnswerJobId(null);
    setJobActionState(null);
    setDetailSource('jobs');
    setFocus('detail');
  }

  async function handleAddUrl(url: string) {
    url = url.trim();
    if (!url) {
      setJobIntakeState('none');
      setFocus('jobs');
      return;
    }
    let shouldCloseJobIntake = true;
    const finishTask = startTask('Hydrating and evaluating link');
    startJobIntakeEvaluation(
      'Please wait while the job link is hydrated and evaluated.',
    );
    try {
      const hydrated = await hydrateJobFromUrl(url);
      const saved = saveJob(createPendingJob(hydrated));
      refreshJobs();
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
      shouldCloseJobIntake = false;
      showAddUrlFailure(
        `Couldn't crawl the site. Would you like to add it manually instead?\n\n${String(error)}`,
      );
      setFlash(
        'Could not crawl the job link. Paste the JD manually instead.',
        'warning',
      );
    } finally {
      finishTask();
      if (shouldCloseJobIntake) stopJobIntakeEvaluation();
    }
  }

  async function handleAddJd(jd: string) {
    jd = jd.trim();
    if (!jd) {
      setJobIntakeState('none');
      setFocus('jobs');
      return;
    }
    if (/^https?:\/\//i.test(jd)) {
      await handleAddUrl(jd);
      return;
    }
    const finishTask = startTask('Saving and evaluating pasted JD');
    startJobIntakeEvaluation(
      'Please wait while the pasted job description is evaluated.',
    );
    try {
      const { company, role } = inferFromJdText(jd);
      const saved = saveJob(
        createPendingJob({
          company,
          role,
          url: '',
          jd,
        }),
      );
      refreshJobs();
      const updated = await evaluateAndPersistJob(saved);
      refreshJobs();
      setSelectedJobId(updated.id);
      setFlash(
        `Added and evaluated #${updated.id} ${updated.company} — ${updated.role}`,
      );
    } catch (error) {
      setFlash(`JD intake failed: ${String(error)}`, 'error');
    } finally {
      stopJobIntakeEvaluation();
      finishTask();
    }
  }

  async function runEvaluate(job: Job) {
    const finishTask = startTask(`Evaluating #${job.id}`);
    setJobIntakeState('none');
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

  async function runGenerate(
    job: Job,
    guidance: string,
    bulletWordRange: CvBulletWordRange,
    textSizeScale: CvTextSizeScale,
  ) {
    setJobIntakeState('none');
    setFocus('jobs');
    const updated = await generateAndPersistPdf(
      job,
      guidance,
      bulletWordRange,
      textSizeScale,
    );
    refreshJobs();
    setSelectedJobId(updated.id);
    return updated;
  }

  async function runGenerateCoverLetter(
    job: Job,
    guidance: string,
    totalWordCount: CoverLetterTotalWordCount,
  ) {
    setJobIntakeState('none');
    setFocus('jobs');
    const updated = await generateAndPersistCoverLetterPdf(
      job,
      guidance,
      totalWordCount,
    );
    refreshJobs();
    setSelectedJobId(updated.id);
    return updated;
  }

  function handleSaveEditJd(jobId: string, jd: string) {
    const trimmedJd = jd.trim();
    db.updateJob(jobId, {
      jd: trimmedJd,
      jdSummary: '',
    });
    refreshJobs();
    setJobIntakeState('none');
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
    setJobIntakeState('none');
    setJobActionState({ jobId, view: 'menu' });
    setFocus('jobs');
    setFlash(`Updated metadata for #${jobId}`);
  }

  function handleSaveStatus(jobId: string, status: JobStatus) {
    db.updateJob(jobId, { status });
    refreshJobs();
    setJobIntakeState('none');
    setJobActionState({ jobId, view: 'menu' });
    setFocus('jobs');
    setFlash(`Updated #${jobId} to ${status}`);
  }

  function handleConfirmDelete(jobId: string) {
    db.removeJob(jobId);
    refreshJobs();
    setJobIntakeState('none');
    setJobActionState(null);
    setFocus('jobs');
    setFlash(`Deleted #${jobId}`);
  }

  function closeJobIntake() {
    if (jobIntakeState === 'evaluating') return;
    setAddUrlFailureMessage(null);
    setJobIntakeState('none');
    setFocus('jobs');
    setDetailSource('jobs');
  }

  function closeAnswerWorkspace() {
    setAnswerJobId(null);
    setFocus('jobs');
  }

  function updateAnswerDraft(jobId: string, draft: AnswerDraft) {
    setAnswerDrafts((current) => ({
      ...current,
      [jobId]: draft,
    }));
  }

  function openJobActions(view: JobActionView = 'menu') {
    if (!selectedJob) return;
    setJobIntakeState('none');
    setAnswerJobId(null);
    setJobActionState({ jobId: selectedJob.id, view });
    setDetailSource('jobs');
    setFocus('jobs');
  }

  function closeJobActionWorkspace() {
    setJobActionState(null);
    setFocus('jobs');
  }

  function updateGenerateCvDraft(jobId: string, draft: GenerateCvDraft) {
    setGenerateCvDrafts((current) => ({
      ...current,
      [jobId]: draft,
    }));
  }

  function updateGenerateCoverLetterDraft(
    jobId: string,
    draft: GenerateCoverLetterDraft,
  ) {
    setGenerateCoverLetterDrafts((current) => ({
      ...current,
      [jobId]: draft,
    }));
  }

  function openProfileActions(view: ProfileActionView) {
    setJobIntakeState('none');
    setAnswerJobId(null);
    setJobActionState(null);
    setProfileActionView(view);
    setDetailSource('profile');
    setFocus('profile');
  }

  function closeProfileActionWorkspace() {
    if (requiresOnboarding) {
      setProfileActionView(null);
      setOnboardingInitialView('candidate');
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
    setOnboardingInitialView('candidate');
    setRequiresOnboarding(false);
    setShowInitWizard(false);
    setProfileActionView(null);
    setDetailSource('profile');
    setFocus('profile');
    setFlash(message);
  }

  function chooseManualOnboarding(nextProfile?: typeof profile) {
    setOnboardingProfile(nextProfile ?? createEmptyProfile());
    setShowInitWizard(false);
    setOnboardingInitialView(nextProfile ? 'salary-min' : 'candidate');
    setProfileActionView(nextProfile ? 'salary-min' : 'candidate');
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
    if (key.ctrl && key.name === 'q') quit();

    if (jobIntakeState !== 'none') {
      if (key.name === 'escape' && jobIntakeState !== 'evaluating')
        closeJobIntake();
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
    if (key.name === 'a') setJobIntakeState('choose-source');
    if (key.name === 'e' && selectedJob) void runEvaluate(selectedJob);
    if (key.name === 'g' && selectedJob) openJobActions('generate-cv');
    if (key.name === 'c' && selectedJob)
      openJobActions('generate-cover-letter');
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

  const dashboardDetailPane =
    jobIntakeState !== 'none'
      ? {
          kind: 'job-intake' as const,
          state: jobIntakeState,
          render: ({ width, height }: { width: number; height: number }) => (
            <DashboardOverlay
              theme={theme}
              jobIntakeState={jobIntakeState}
              width={width}
              height={height}
              evaluatingMessage={evaluatingMessage}
              addUrlFailureMessage={addUrlFailureMessage}
              onAddUrl={handleAddUrl}
              onAddJd={handleAddJd}
              onRetryAddManually={() => {
                setAddUrlFailureMessage(null);
                setJobIntakeState('paste-description');
                setFocus('detail');
              }}
              onJobIntakeStateChange={setJobIntakeState}
              onClose={closeJobIntake}
            />
          ),
        }
      : selectedJob && selectedJob.id === answerJobId
        ? {
            kind: 'answer' as const,
            jobId: selectedJob.id,
            render: ({ width, height }: { width: number; height: number }) => (
              <AnswerWorkspace
                theme={theme}
                job={selectedJob}
                width={width}
                height={height}
                draft={
                  answerDrafts[selectedJob.id] ??
                  createDefaultAnswerDraft(selectedJob)
                }
                onDraftChange={(draft) => {
                  updateAnswerDraft(selectedJob.id, draft);
                }}
                onClose={closeAnswerWorkspace}
                onSaved={(message) => {
                  refreshJobs();
                  closeAnswerWorkspace();
                  setFlash(message);
                }}
              />
            ),
          }
        : selectedJob &&
            jobActionState &&
            selectedJob.id === jobActionState.jobId
          ? {
              kind: 'job-actions' as const,
              jobId: selectedJob.id,
              render: ({
                width,
                height,
              }: {
                width: number;
                height: number;
              }) => (
                <JobActionWorkspace
                  theme={theme}
                  job={selectedJob}
                  width={width}
                  height={height}
                  initialView={jobActionState?.view ?? 'menu'}
                  generateCvDraft={
                    generateCvDrafts[selectedJob.id] ??
                    createDefaultGenerateCvDraft()
                  }
                  onGenerateCvDraftChange={(draft) => {
                    updateGenerateCvDraft(selectedJob.id, draft);
                  }}
                  generateCoverLetterDraft={
                    generateCoverLetterDrafts[selectedJob.id] ??
                    createDefaultGenerateCoverLetterDraft()
                  }
                  onGenerateCoverLetterDraftChange={(draft) => {
                    updateGenerateCoverLetterDraft(selectedJob.id, draft);
                  }}
                  onClose={closeJobActionWorkspace}
                  onStartAnswer={startAnswerWorkspace}
                  onEvaluate={() => void runEvaluate(selectedJob)}
                  onOpenLink={() =>
                    openTarget(
                      selectedJob.url,
                      `Opened job link for #${selectedJob.id}.`,
                      'No job URL available.',
                    )
                  }
                  onOpenCv={() =>
                    openTarget(
                      selectedJob.pdfPath,
                      `Opened generated CV for #${selectedJob.id}.`,
                      'No generated CV available.',
                    )
                  }
                  onOpenCoverLetter={() =>
                    openTarget(
                      selectedJob.coverLetterPdfPath,
                      `Opened generated cover letter for #${selectedJob.id}.`,
                      'No generated cover letter available.',
                    )
                  }
                  onSaveMetadata={(patch) =>
                    handleSaveMetadata(selectedJob.id, patch)
                  }
                  onSaveEditJd={(jd) => handleSaveEditJd(selectedJob.id, jd)}
                  onSaveStatus={(status) =>
                    handleSaveStatus(selectedJob.id, status)
                  }
                  onDelete={() => handleConfirmDelete(selectedJob.id)}
                  onGenerateCv={(guidance, bulletWordRange, textSizeScale) =>
                    runGenerate(
                      selectedJob,
                      guidance,
                      bulletWordRange,
                      textSizeScale,
                    )
                  }
                  onGenerateCoverLetter={(guidance, totalWordCount) =>
                    runGenerateCoverLetter(
                      selectedJob,
                      guidance,
                      totalWordCount,
                    )
                  }
                />
              ),
            }
          : profileActionView
            ? {
                kind: 'profile-actions' as const,
                render: ({
                  width,
                  height,
                }: {
                  width: number;
                  height: number;
                }) => (
                  <ProfileActionWorkspace
                    theme={theme}
                    profile={profile}
                    width={width}
                    height={height}
                    initialView={profileActionView}
                    onClose={closeProfileActionWorkspace}
                    onSave={handleSaveProfile}
                  />
                ),
              }
            : null;

  if (requiresOnboarding) {
    return (
      <box
        flexDirection="column"
        width={appWidth}
        height={appHeight}
        paddingX={1}
      >
        <box
          border
          borderColor={theme.borderActive}
          height={Math.max(8, appHeight - 2)}
          padding={1}
          overflow="hidden"
        >
          {showInitWizard ? (
            <InitWorkspace
              theme={theme}
              width={Math.max(20, appWidth - 6)}
              height={Math.max(8, appHeight - 6)}
              onChooseManual={chooseManualOnboarding}
            />
          ) : (
            <ProfileActionWorkspace
              theme={theme}
              profile={onboardingProfile}
              width={Math.max(20, appWidth - 6)}
              height={Math.max(8, appHeight - 6)}
              initialView={profileActionView ?? onboardingInitialView}
              mode="wizard"
              onClose={closeProfileActionWorkspace}
              onSave={handleSaveProfile}
            />
          )}
        </box>

        <box
          flexDirection="row"
          columnGap={1}
          flexWrap="wrap"
          position="absolute"
          bottom={1}
        >
          <text fg={theme.footer} content="Actions: <enter>" />
          <text fg={theme.muted} content="|" />
          <text fg={theme.footer} content="Move: j / k" />
          <text fg={theme.muted} content="|" />
          <text
            fg={theme.footer}
            content={showInitWizard ? 'Back: esc' : 'Save: <enter>'}
          />
        </box>

        <TasksIndicator tasks={tasks} theme={theme} />
      </box>
    );
  }

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
        detailPane={dashboardDetailPane}
        onFilterChange={setFilter}
        onJobSelect={setSelectedJobId}
        onCycleFilter={(direction) =>
          setFilter(
            JOB_FILTERS[
              (JOB_FILTERS.indexOf(filter) + direction + JOB_FILTERS.length) %
                JOB_FILTERS.length
            ]!,
          )
        }
        onOpenActions={() => openJobActions('menu')}
        onOpenProfileActions={openProfileActions}
      />

      <TasksIndicator tasks={tasks} theme={theme} />
    </box>
  );
}
