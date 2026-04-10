/** @jsxImportSource @opentui/react */
import {
  createCliRenderer,
  type InputRenderable,
  type SelectOption,
  type TabSelectRenderable,
  type TextareaRenderable,
} from '@opentui/core';
import {
  createRoot,
  useKeyboard,
  useRenderer,
  useTerminalDimensions,
} from '@opentui/react';
import { spawn } from 'child_process';
import { useEffect, useMemo, useRef, useState } from 'react';
import { db } from './db.js';
import {
  createPendingJob,
  evaluateAndPersistJob,
  generateAndPersistPdf,
  hydrateJobFromUrl,
  saveJob,
} from './job-actions.js';
import { JOB_STATUSES, type Job, type JobStatus } from './types.js';
import AnswersScreen from './ui/AnswersScreen.js';
import ProfileScreen from './ui/ProfileScreen.js';
import ScanScreen from './ui/ScanScreen.js';
import { clip, flashColor, scoreDisplay, type FlashVariant } from './ui/utils.js';

type Screen = 'dashboard' | 'scan' | 'profile' | 'answers';
type FocusTarget = 'tabs' | 'jobs' | 'detail' | 'modal';
type Overlay =
  | 'none'
  | 'actions'
  | 'add'
  | 'add-url'
  | 'add-jd'
  | 'edit-jd'
  | 'status'
  | 'delete'
  | 'generate-cv';
type Flash = { message: string; variant: FlashVariant };
type JobAction =
  | 'detail'
  | 'evaluate'
  | 'generate-cv'
  | 'edit-jd'
  | 'status'
  | 'open-cv'
  | 'open-link'
  | 'delete'
  | 'cancel';

const FILTERS: Array<'All' | JobStatus> = ['All', ...JOB_STATUSES];
const TRANSPARENT_BACKGROUND = 'transparent';
const initialScreen: Screen = process.argv.includes('--scan') ? 'scan' : 'dashboard';
const tabOptions: SelectOption[] = [
  {
    name: 'Queue',
    description: 'Job pipeline',
    value: 'dashboard' satisfies Screen,
  },
  { name: 'Scan', description: 'Find roles', value: 'scan' satisfies Screen },
  {
    name: 'Profile',
    description: 'Candidate data',
    value: 'profile' satisfies Screen,
  },
  {
    name: 'Answers',
    description: 'Saved replies',
    value: 'answers' satisfies Screen,
  },
];

function jobPreview(job: Job): string {
  return [
    `#${job.id}  ${job.company || 'Unknown Company'}`,
    job.role || 'Untitled Role',
    `Status: ${job.status}`,
    `Score: ${scoreDisplay(job.score)}`,
    job.archetype ? `Archetype: ${job.archetype}` : '',
    job.url ? `URL: ${job.url}` : '',
    job.pdfPath ? `PDF: ${job.pdfPath}` : '',
    job.notes ? `Notes: ${job.notes}` : '',
    '',
    job.jd || 'No job description saved.',
  ]
    .filter((line, index) => index === 8 || Boolean(line))
    .join('\n');
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

function screenIndex(screen: Screen): number {
  return Math.max(
    0,
    tabOptions.findIndex((option) => option.value === screen),
  );
}

function App() {
  const activeRenderer = useRenderer();
  const { width, height } = useTerminalDimensions();
  const appWidth = Math.max(width, 80);
  const appHeight = Math.max(height, 24);
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [focus, setFocus] = useState<FocusTarget>('jobs');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<Overlay>('none');
  const [flash, setFlashState] = useState<Flash | null>(null);
  const [tasks, setTasks] = useState<string[]>([]);
  const [refreshToken, setRefreshToken] = useState(0);
  const [addUrl, setAddUrl] = useState('');
  const [addJd, setAddJd] = useState('');
  const [editJd, setEditJd] = useState('');
  const [cvGuidance, setCvGuidance] = useState('');
  const urlInput = useRef<InputRenderable>(null);
  const jdInput = useRef<TextareaRenderable>(null);
  const editJdInput = useRef<TextareaRenderable>(null);
  const guidanceInput = useRef<TextareaRenderable>(null);
  const tabs = useRef<TabSelectRenderable>(null);

  const jobs = useMemo(() => db.readJobs(), [refreshToken]);
  const filteredJobs = useMemo(() => {
    const next =
      filter === 'All' ? jobs : jobs.filter((job) => job.status === filter);
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
  const companyWidth = Math.max(10, Math.floor((queueWidth - 14) * 0.38));
  const roleWidth = Math.max(12, queueWidth - companyWidth - 20);

  const jobOptions: SelectOption[] = filteredJobs.map((job) => ({
    name: `${job.id} ${clip(job.company || 'Unknown', companyWidth).padEnd(companyWidth)} ${clip(job.role || 'Untitled', roleWidth).padEnd(roleWidth)} ${scoreDisplay(job.score).padStart(4)}`,
    description: `${job.status} · ${job.added}${job.archetype ? ` · ${job.archetype}` : ''}`,
    value: job.id,
  }));

  const actionOptions: SelectOption[] = selectedJob
    ? [
        {
          name: 'View detail',
          description: 'Move focus to the detail pane',
          value: 'detail' satisfies JobAction,
        },
        {
          name: selectedJob.score === null ? 'Evaluate job' : 'Re-evaluate job',
          description: 'Score the role against your profile',
          value: 'evaluate' satisfies JobAction,
        },
        {
          name: 'Generate CV',
          description: 'Create a tailored PDF',
          value: 'generate-cv' satisfies JobAction,
        },
        {
          name: 'Edit job description',
          description: 'Update the saved JD text',
          value: 'edit-jd' satisfies JobAction,
        },
        {
          name: 'Update status',
          description: 'Change pipeline state',
          value: 'status' satisfies JobAction,
        },
        ...(selectedJob.pdfPath
          ? [
              {
                name: 'Open generated CV',
                description: selectedJob.pdfPath,
                value: 'open-cv' satisfies JobAction,
              },
            ]
          : []),
        ...(selectedJob.url
          ? [
              {
                name: 'Open job link',
                description: selectedJob.url,
                value: 'open-link' satisfies JobAction,
              },
            ]
          : []),
        {
          name: 'Delete job',
          description: 'Remove this job from the queue',
          value: 'delete' satisfies JobAction,
        },
        {
          name: 'Cancel',
          description: 'Close this menu',
          value: 'cancel' satisfies JobAction,
        },
      ]
    : [];

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
    if (overlay === 'add-url') urlInput.current?.focus();
    if (overlay === 'add-jd') jdInput.current?.focus();
    if (overlay === 'edit-jd') editJdInput.current?.focus();
    if (overlay === 'generate-cv') guidanceInput.current?.focus();
  }, [overlay]);

  useEffect(() => {
    tabs.current?.setSelectedIndex(screenIndex(screen));
  }, [screen]);

  function refreshJobs() {
    setRefreshToken((value) => value + 1);
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
        return current.filter((_, currentIndex) => currentIndex !== index);
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

  async function handleAddUrl(value: string) {
    const url = value.trim();
    if (!url) {
      setOverlay('none');
      setFocus('jobs');
      return;
    }
    const finishTask = startTask('Hydrating and evaluating link');
    setOverlay('none');
    setFocus('jobs');
    setAddUrl('');
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

  async function handleAddJd(value: string) {
    const jd = value.trim();
    if (!jd) {
      setOverlay('none');
      setFocus('jobs');
      return;
    }
    const finishTask = startTask('Saving and evaluating pasted JD');
    setOverlay('none');
    setFocus('jobs');
    setAddJd('');
    try {
      const saved = saveJob(
        createPendingJob({
          company: 'Manual Intake',
          role: 'Pasted Job Description',
          url: '',
          jd,
        }),
      );
      const updated = await evaluateAndPersistJob(saved);
      refreshJobs();
      setSelectedJobId(updated.id);
      setFlash(`Added and evaluated #${updated.id} ${updated.role}`);
    } catch (error) {
      setFlash(`JD intake failed: ${String(error)}`, 'error');
    } finally {
      finishTask();
    }
  }

  async function runEvaluate(job: Job | null) {
    if (!job) return;
    const finishTask = startTask(`Evaluating #${job.id}`);
    setOverlay('none');
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

  async function runGenerate(job: Job | null, guidance: string) {
    if (!job) return;
    const finishTask = startTask(`Generating CV for #${job.id}`);
    setOverlay('none');
    setFocus('jobs');
    setCvGuidance('');
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

  function handleAction(action: JobAction) {
    if (!selectedJob) return;
    if (action === 'cancel') setOverlay('none');
    if (action === 'detail') {
      setOverlay('none');
      setFocus('detail');
    }
    if (action === 'evaluate') void runEvaluate(selectedJob);
    if (action === 'generate-cv') {
      setCvGuidance('');
      setOverlay('generate-cv');
    }
    if (action === 'edit-jd') {
      setEditJd(selectedJob.jd);
      setOverlay('edit-jd');
    }
    if (action === 'status') setOverlay('status');
    if (action === 'open-cv')
      openTarget(
        selectedJob.pdfPath,
        `Opened generated CV for #${selectedJob.id}.`,
        'No generated CV available.',
      );
    if (action === 'open-link')
      openTarget(
        selectedJob.url,
        `Opened job link for #${selectedJob.id}.`,
        'No job URL available.',
      );
    if (action === 'delete') setOverlay('delete');
  }

  function quit() {
    activeRenderer.destroy();
    process.exit(0);
  }

  useKeyboard((key) => {
    if (key.ctrl && key.name === 'c') quit();
    // Global navigation — always active
    if (key.name === 'q') quit();
    if (key.name === '1') setScreen('dashboard');
    if (key.name === '2') setScreen('scan');
    if (key.name === '3') setScreen('profile');
    if (key.name === '4') setScreen('answers');

    // Dashboard-only keys
    if (screen !== 'dashboard') return;

    if (overlay !== 'none') {
      if (key.name === 'escape') {
        setOverlay('none');
        setFocus('jobs');
      }
      return;
    }
    if (key.name === 'tab')
      setFilter(FILTERS[(FILTERS.indexOf(filter) + 1) % FILTERS.length]!);
    if (key.name === 'h') setFocus('jobs');
    if (key.name === 'l' && selectedJob) setFocus('detail');
    if (key.name === 'a') setOverlay('add');
    if (key.name === 'return' && selectedJob && focus === 'jobs')
      setOverlay('actions');
    if (key.name === 'e' && selectedJob) void runEvaluate(selectedJob);
    if (key.name === 'g' && selectedJob) {
      setCvGuidance('');
      setOverlay('generate-cv');
    }
    if (key.name === 's' && selectedJob) setOverlay('status');
    if (key.name === 'd' && selectedJob) setOverlay('delete');
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
      {/* Header: title + tabs + flash/count */}
      <box flexDirection="row" justifyContent="space-between" marginBottom={1}>
        <text fg="#4cc9f0" content="lazyhire" />
        <tab-select
          ref={tabs}
          width={60}
          height={2}
          tabWidth={10}
          options={tabOptions}
          selectedTextColor="#050505"
          selectedBackgroundColor="#4cc9f0"
          backgroundColor={TRANSPARENT_BACKGROUND}
          focusedBackgroundColor={TRANSPARENT_BACKGROUND}
          showDescription={false}
          showUnderline={false}
          focused={focus === 'tabs' && overlay === 'none' && screen === 'dashboard'}
          onSelect={(_, option) => {
            if (option?.value) setScreen(option.value as Screen);
            setFocus('jobs');
          }}
        />
        {flash ? (
          <text
            fg={flashColor(flash.variant)}
            content={clip(flash.message, Math.max(24, appWidth - 40))}
          />
        ) : (
          <text fg="#868e96" content={`${jobs.length} jobs`} />
        )}
      </box>

      {/* Screen content */}
      {screen === 'dashboard' ? (
        <>
          <box flexDirection="row" marginY={1} columnGap={1}>
            {FILTERS.map((item) => (
              <text
                key={item}
                fg={item === filter ? '#050505' : '#868e96'}
                bg={item === filter ? '#4cc9f0' : undefined}
                content={item === filter ? ` ${item} ` : item}
              />
            ))}
          </box>

          <box flexDirection="row" columnGap={1} height={contentHeight}>
            <box
              title={`Queue ${filter === 'All' ? '' : `· ${filter}`}`.trim()}
              border
              borderColor={focus === 'jobs' ? '#57cc99' : '#868e96'}
              width={queueWidth}
              padding={1}
              overflow="hidden"
            >
              {jobOptions.length > 0 ? (
                <select
                  height={contentHeight - 2}
                  width="100%"
                  options={jobOptions}
                  selectedIndex={selectedIndex}
                  showDescription
                  showScrollIndicator
                  backgroundColor={TRANSPARENT_BACKGROUND}
                  focusedBackgroundColor={TRANSPARENT_BACKGROUND}
                  selectedBackgroundColor={TRANSPARENT_BACKGROUND}
                  selectedTextColor="#4cc9f0"
                  selectedDescriptionColor="#868e96"
                  focused={focus === 'jobs' && overlay === 'none'}
                  onChange={(_, option) => {
                    if (option?.value) setSelectedJobId(String(option.value));
                  }}
                  onSelect={(_, option) => {
                    if (option?.value) setSelectedJobId(String(option.value));
                    setOverlay('actions');
                  }}
                />
              ) : (
                <text fg="#868e96" content="No jobs yet. Press a to add one." />
              )}
            </box>

            <box
              title="Detail"
              border
              borderColor={focus === 'detail' ? '#57cc99' : '#868e96'}
              width={detailWidth}
              padding={1}
              flexDirection="column"
              overflow="hidden"
            >
              {selectedJob ? (
                <scrollbox
                  height={detailHeight + 3}
                  width="100%"
                  scrollX={false}
                  scrollY
                  focused={focus === 'detail' && overlay === 'none'}
                  rootOptions={{ overflow: 'hidden' }}
                  wrapperOptions={{ overflow: 'hidden' }}
                  viewportOptions={{ overflow: 'hidden' }}
                  contentOptions={{ overflow: 'hidden' }}
                  scrollbarOptions={{ showArrows: true }}
                >
                  <text
                    width={Math.max(20, detailWidth - 6)}
                    maxWidth={Math.max(20, detailWidth - 6)}
                    wrapMode="char"
                    truncate
                    content={jobPreview(selectedJob)}
                  />
                </scrollbox>
              ) : (
                <text fg="#868e96" content="Select a job to inspect it." />
              )}
            </box>
          </box>
        </>
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

      {/* Dashboard overlays */}
      {screen === 'dashboard' && overlay !== 'none' ? (
        <box
          title="Action"
          border
          borderColor="#f5c542"
          marginTop={1}
          padding={1}
          height={9}
          flexDirection="column"
        >
          {overlay === 'actions' && (
            <select
              height={7}
              focused
              options={actionOptions}
              showDescription
              backgroundColor={TRANSPARENT_BACKGROUND}
              focusedBackgroundColor={TRANSPARENT_BACKGROUND}
              selectedBackgroundColor={TRANSPARENT_BACKGROUND}
              onSelect={(_, option) =>
                option?.value && handleAction(option.value as JobAction)
              }
            />
          )}
          {overlay === 'add' && (
            <select
              height={5}
              focused
              options={[
                {
                  name: 'Paste job link',
                  description: 'Hydrate and evaluate a URL',
                  value: 'add-url',
                },
                {
                  name: 'Paste job description',
                  description: 'Save pasted text and evaluate it',
                  value: 'add-jd',
                },
                {
                  name: 'Cancel',
                  description: 'Close this menu',
                  value: 'none',
                },
              ]}
              backgroundColor={TRANSPARENT_BACKGROUND}
              focusedBackgroundColor={TRANSPARENT_BACKGROUND}
              selectedBackgroundColor={TRANSPARENT_BACKGROUND}
              onSelect={(_, option) =>
                setOverlay((option?.value as Overlay | undefined) ?? 'none')
              }
            />
          )}
          {overlay === 'add-url' && (
            <box flexDirection="column">
              <text fg="#868e96" content="Job URL" />
              <input
                ref={urlInput}
                value={addUrl}
                placeholder="https://company.example/jobs/123"
                onInput={setAddUrl}
                onSubmit={(value: unknown) => {
                  if (typeof value === 'string') void handleAddUrl(value);
                }}
                focused
              />
            </box>
          )}
          {overlay === 'add-jd' && (
            <textarea
              ref={jdInput}
              height={7}
              initialValue={addJd}
              placeholder="Paste the job description. Ctrl+Enter submits."
              keyBindings={[{ name: 'return', ctrl: true, action: 'submit' }]}
              onContentChange={() => setAddJd(jdInput.current?.plainText ?? '')}
              onSubmit={() =>
                void handleAddJd(jdInput.current?.plainText ?? '')
              }
              focused
            />
          )}
          {overlay === 'edit-jd' && selectedJob && (
            <textarea
              ref={editJdInput}
              height={7}
              initialValue={editJd}
              placeholder="Edit job description. Ctrl+Enter saves."
              keyBindings={[{ name: 'return', ctrl: true, action: 'submit' }]}
              onContentChange={() =>
                setEditJd(editJdInput.current?.plainText ?? '')
              }
              onSubmit={() => {
                db.updateJob(selectedJob.id, {
                  jd: editJdInput.current?.plainText.trim() ?? '',
                });
                refreshJobs();
                setOverlay('none');
                setFocus('jobs');
                setFlash(`Updated job description for #${selectedJob.id}`);
              }}
              focused
            />
          )}
          {overlay === 'status' && selectedJob && (
            <select
              height={7}
              focused
              options={JOB_STATUSES.map((status) => ({
                name: status,
                description: `Set #${selectedJob.id} to ${status}`,
                value: status,
              }))}
              selectedIndex={JOB_STATUSES.indexOf(selectedJob.status)}
              backgroundColor={TRANSPARENT_BACKGROUND}
              focusedBackgroundColor={TRANSPARENT_BACKGROUND}
              selectedBackgroundColor={TRANSPARENT_BACKGROUND}
              onSelect={(_, option) => {
                const status = option?.value as JobStatus | undefined;
                if (!status) return;
                db.updateJob(selectedJob.id, { status });
                refreshJobs();
                setOverlay('none');
                setFocus('jobs');
                setFlash(`Updated #${selectedJob.id} to ${status}`);
              }}
            />
          )}
          {overlay === 'delete' && selectedJob && (
            <select
              height={4}
              focused
              options={[
                {
                  name: `Delete #${selectedJob.id}`,
                  description: `${selectedJob.company || 'Unknown'} · ${selectedJob.role || 'Untitled'}`,
                  value: 'yes',
                },
                { name: 'Cancel', description: 'Keep this job', value: 'no' },
              ]}
              backgroundColor={TRANSPARENT_BACKGROUND}
              focusedBackgroundColor={TRANSPARENT_BACKGROUND}
              selectedBackgroundColor={TRANSPARENT_BACKGROUND}
              onSelect={(_, option) => {
                if (option?.value === 'yes') {
                  db.removeJob(selectedJob.id);
                  refreshJobs();
                  setFlash(`Deleted #${selectedJob.id}`);
                }
                setOverlay('none');
                setFocus('jobs');
              }}
            />
          )}
          {overlay === 'generate-cv' && selectedJob && (
            <textarea
              ref={guidanceInput}
              height={7}
              initialValue={cvGuidance}
              placeholder="Optional tailoring guidance. Ctrl+Enter submits."
              keyBindings={[{ name: 'return', ctrl: true, action: 'submit' }]}
              onContentChange={() =>
                setCvGuidance(guidanceInput.current?.plainText ?? '')
              }
              onSubmit={() =>
                void runGenerate(
                  selectedJob,
                  guidanceInput.current?.plainText ?? '',
                )
              }
              focused
            />
          )}
        </box>
      ) : null}

      {/* Tasks indicator */}
      {tasks.length > 0 ? (
        <box border borderColor="#f5c542" marginTop={1} paddingX={1}>
          <text
            fg="#f5c542"
            content={`${tasks[0]}${tasks.length > 1 ? ` (+${tasks.length - 1} more)` : ''}`}
          />
        </box>
      ) : null}

      {/* Footer (dashboard only — other screens render their own) */}
      {screen === 'dashboard' && (
        <box
          flexDirection="row"
          columnGap={1}
          flexWrap="wrap"
          position="absolute"
          bottom={0}
        >
          <text fg="#7aa2f7" content="1-4=tabs" />
          <text fg="#868e96" content="|" />
          <text fg="#7aa2f7" content="tab=filter" />
          <text fg="#868e96" content="|" />
          <text fg="#7aa2f7" content="h/l=panes" />
          <text fg="#868e96" content="|" />
          <text fg="#7aa2f7" content="j/k=move" />
          <text fg="#868e96" content="|" />
          <text fg="#7aa2f7" content="enter=actions" />
          <text fg="#868e96" content="|" />
          <text fg="#7aa2f7" content="a=add" />
          <text fg="#868e96" content="|" />
          <text fg="#7aa2f7" content="e=evaluate" />
          <text fg="#868e96" content="|" />
          <text fg="#7aa2f7" content="g=cv" />
          <text fg="#868e96" content="|" />
          <text fg="#7aa2f7" content="esc=close" />
          <text fg="#868e96" content="|" />
          <text fg="#7aa2f7" content="q=quit" />
        </box>
      )}
    </box>
  );
}

const cliRenderer = await createCliRenderer({ exitOnCtrlC: true });
createRoot(cliRenderer).render(<App />);
