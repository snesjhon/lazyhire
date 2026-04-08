import React, { useEffect, useMemo, useState } from 'react';
import { spawn } from 'child_process';
import { Box, Text, useStdout } from 'ink';
import {
  FocusScope,
  Router,
  Screen,
  useFocusScope,
  useNavigation,
} from 'giggles';
import {
  Badge,
  Modal,
  Panel,
  Select,
  Spinner,
  TextInput,
  Viewport,
} from 'giggles/ui';
import { db } from '../db.js';
import {
  JOB_STATUSES,
  type Job,
  type JobStatus,
  type Theme,
} from '../types.js';
import {
  createPendingJob,
  evaluateAndPersistJob,
  generateAndPersistPdf,
  hydrateJobFromUrl,
  saveJob,
} from '../job-actions.js';
import MultilineInput from './MultilineInput.js';
import ProfileScreen from './Profile.js';
import Scan from './Scan.js';

type View = 'dashboard' | 'scan';
type Overlay =
  | 'none'
  | 'intake-menu'
  | 'intake-url'
  | 'intake-jd'
  | 'status'
  | 'theme';
type Flash = {
  message: string;
  variant: 'info' | 'success' | 'error' | 'warning';
};

const FILTERS: Array<'All' | JobStatus> = ['All', ...JOB_STATUSES];
const THEMES: Theme[] = ['minimal', 'modern', 'two-column'];
const INTAKE_OPTIONS = [
  { label: 'Paste job link', value: 'intake-url' as const },
  { label: 'Paste job description', value: 'intake-jd' as const },
];

function scoreDisplay(score: number | null): string {
  return score === null ? '—' : score.toFixed(1);
}

function clip(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
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

function flashColor(variant: Flash['variant']): string {
  const colors: Record<Flash['variant'], string> = {
    info: 'cyan',
    success: 'green',
    error: 'red',
    warning: 'yellow',
  };
  return colors[variant];
}

function browserCommand(
  url: string,
): { command: string; args: string[] } | null {
  if (!url.trim()) return null;
  if (process.platform === 'darwin') return { command: 'open', args: [url] };
  if (process.platform === 'win32')
    return { command: 'cmd', args: ['/c', 'start', '', url] };
  if (process.platform === 'linux')
    return { command: 'xdg-open', args: [url] };
  return null;
}

function jobPreview(job: Job): string {
  const lines = [
    `#${job.id}  ${job.company || 'Unknown Company'}`,
    job.role || 'Untitled Role',
    `Status: ${job.status}`,
    `Score: ${scoreDisplay(job.score)}`,
    job.url ? `URL: ${job.url}` : '',
    job.pdfPath ? `PDF: ${job.pdfPath}` : '',
    job.notes ? `Notes: ${job.notes}` : '',
    job.jd ? '' : 'No job description saved.',
    job.jd,
  ].filter(Boolean);

  return lines.join('\n');
}

interface Props {
  initialScreen?: 'dashboard' | 'scan';
}

type DashboardScreenProps = {
  initialView: View;
};

function DashboardScreen({ initialView }: DashboardScreenProps) {
  const { stdout } = useStdout();
  const navigation = useNavigation();
  const terminalWidth = stdout.columns ?? 80;
  const terminalHeight = stdout.rows ?? 24;
  const [selectedFilter, setSelectedFilter] =
    useState<(typeof FILTERS)[number]>('All');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<Overlay>('none');
  const [tasks, setTasks] = useState<string[]>([]);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [intakeUrl, setIntakeUrl] = useState('');
  const [intakeJd, setIntakeJd] = useState('');
  const [jobCount, setJobCount] = useState(0);

  useEffect(() => {
    if (!flash) return;
    const timeout = setTimeout(() => setFlash(null), 2500);
    return () => clearTimeout(timeout);
  }, [flash]);

  useEffect(() => {
    if (initialView === 'scan') {
      navigation.replace('scan');
    }
  }, [initialView, navigation]);

  const jobs = useMemo(() => db.readJobs(), [refreshToken]);
  const filteredJobs = useMemo(() => {
    const next =
      selectedFilter === 'All'
        ? jobs
        : jobs.filter((job) => job.status === selectedFilter);

    return next.slice().sort((a, b) => {
      const aScore = a.score ?? Number.NEGATIVE_INFINITY;
      const bScore = b.score ?? Number.NEGATIVE_INFINITY;
      if (aScore !== bScore) return bScore - aScore;
      if (a.added !== b.added) return b.added.localeCompare(a.added);
      return b.id.localeCompare(a.id);
    });
  }, [jobs, selectedFilter]);

  useEffect(() => {
    setJobCount(jobs.length);
  }, [jobs.length]);

  useEffect(() => {
    if (filteredJobs.length === 0) {
      setSelectedId(null);
      return;
    }

    if (!selectedId || !filteredJobs.some((job) => job.id === selectedId)) {
      setSelectedId(filteredJobs[0]!.id);
    }
  }, [filteredJobs, selectedId]);

  const selectedJob = filteredJobs.find((job) => job.id === selectedId) ?? null;
  const appWidth = Math.max(terminalWidth, 80);
  const appHeight = Math.max(terminalHeight, 24);
  const queueWidth = Math.max(36, Math.floor((appWidth - 5) * 0.42));
  const detailWidth = Math.max(38, appWidth - queueWidth - 5);
  const filterOptions = FILTERS.map((filter) => ({
    label: filter,
    value: filter,
  }));
  const jobOptions = filteredJobs.map((job) => ({
    label: `#${job.id} ${clip(job.company || 'Unknown', 16)} ${clip(job.role || 'Untitled', 24)} ${scoreDisplay(job.score)}`,
    value: job.id,
  }));

  function refreshJobs() {
    setRefreshToken((value) => value + 1);
  }

  function setMessage(
    message: string,
    variant: Flash['variant'] = 'success',
  ) {
    setFlash({ message, variant });
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

  async function handleIntakeUrl(url: string) {
    if (!url.trim()) {
      setOverlay('none');
      return;
    }

    const finishTask = startTask('Hydrating and evaluating link');
    setOverlay('none');
    setIntakeUrl('');

    try {
      const hydrated = await hydrateJobFromUrl(url.trim());
      const saved = saveJob(createPendingJob(hydrated));
      const updated = await evaluateAndPersistJob(saved);
      refreshJobs();
      setSelectedId(updated.id);
      setMessage(
        `Added and evaluated #${updated.id} ${updated.company} — ${updated.role}`,
      );
    } catch (error) {
      const fallback = saveJob(
        createPendingJob({
          company: 'Unknown Company',
          role: 'Pasted Link',
          url: url.trim(),
          jd: '',
        }),
      );
      refreshJobs();
      setSelectedId(fallback.id);
      setMessage(
        `Saved #${fallback.id} as Pending after intake failed: ${String(error)}`,
        'warning',
      );
    } finally {
      finishTask();
    }
  }

  async function handleIntakeJd(jd: string) {
    if (!jd.trim()) {
      setOverlay('none');
      return;
    }

    const finishTask = startTask('Saving and evaluating pasted JD');
    setOverlay('none');
    setIntakeJd('');

    try {
      const saved = saveJob(
        createPendingJob({
          company: 'Manual Intake',
          role: 'Pasted Job Description',
          url: '',
          jd: jd.trim(),
        }),
      );
      const updated = await evaluateAndPersistJob(saved);
      refreshJobs();
      setSelectedId(updated.id);
      setMessage(`Added and evaluated #${updated.id} ${updated.role}`);
    } catch (error) {
      setMessage(`JD intake failed: ${String(error)}`, 'error');
    } finally {
      finishTask();
    }
  }

  async function runEvaluate(job: Job | null) {
    if (!job) return;
    const finishTask = startTask(`Evaluating #${job.id}`);
    try {
      const updated = await evaluateAndPersistJob(job);
      refreshJobs();
      setSelectedId(updated.id);
      setMessage(
        `Evaluated #${updated.id} with score ${updated.score?.toFixed(1) ?? '—'}`,
      );
    } catch (error) {
      setMessage(`Evaluation failed: ${String(error)}`, 'error');
    } finally {
      finishTask();
    }
  }

  async function runGenerate(job: Job | null, theme: Theme) {
    if (!job) return;
    const finishTask = startTask(`Generating ${theme} CV for #${job.id}`);
    setOverlay('none');
    try {
      const updated = await generateAndPersistPdf(job, theme);
      refreshJobs();
      setSelectedId(updated.id);
      setMessage(`Generated CV for #${updated.id}: ${updated.pdfPath}`);
    } catch (error) {
      setMessage(`CV generation failed: ${String(error)}`, 'error');
    } finally {
      finishTask();
    }
  }

  function runStatusUpdate(job: Job | null, newStatus: JobStatus) {
    if (!job) return;
    db.updateJob(job.id, { status: newStatus });
    refreshJobs();
    setMessage(`Updated #${job.id} to ${newStatus}`);
    setOverlay('none');
  }

  function openSelectedJobUrl(job: Job | null) {
    if (!job?.url?.trim()) {
      setMessage('No job URL available to open.', 'warning');
      return;
    }

    const command = browserCommand(job.url);
    if (!command) {
      setMessage(
        `Opening links is not supported on ${process.platform}.`,
        'error',
      );
      return;
    }

    const child = spawn(command.command, command.args, {
      detached: true,
      stdio: 'ignore',
    });
    child.on('error', (error) => {
      setMessage(`Failed to open link: ${String(error)}`, 'error');
    });
    child.unref();
    setMessage(`Opened #${job.id} in browser.`, 'info');
  }

  const root = useFocusScope({
    keybindings: ({ focusChild }) => ({
      '1': () => navigation.reset('dashboard'),
      '2': () => navigation.push('scan'),
      '3': () => navigation.push('profile'),
      q: () => process.exit(0),
      h: () => focusChild('filters'),
      l: () => focusChild('jobs'),
      tab: () =>
        focusChild(selectedJob ? 'jobs' : 'filters'),
      a: () => setOverlay('intake-menu'),
      o: () => openSelectedJobUrl(selectedJob),
      e: () => void runEvaluate(selectedJob),
      g: () => {
        if (selectedJob) setOverlay('theme');
      },
      s: () => {
        if (selectedJob) setOverlay('status');
      },
    }),
  });

  return (
    <FocusScope handle={root}>
      <Box flexDirection="column" paddingX={1} width={appWidth} height={appHeight}>
        <Box justifyContent="space-between" marginBottom={1}>
          <Box gap={2}>
            <Text bold color="cyan">
              open-positions
            </Text>
            <Text color="cyan">[1] Queue</Text>
            <Text color="gray">[2] Scan</Text>
            <Text color="gray">[3] Profile</Text>
          </Box>
          {flash ? (
            <Text color={flashColor(flash.variant)}>
              {clip(flash.message, Math.max(20, appWidth - 44))}
            </Text>
          ) : (
            <Text dimColor>{jobCount} jobs</Text>
          )}
        </Box>

        <Panel title="Filters" borderColor={root.hasFocus ? 'green' : 'gray'}>
          <Select
            focusKey="filters"
            options={filterOptions}
            value={selectedFilter}
            onChange={setSelectedFilter}
            direction="horizontal"
            gap={2}
            render={({ option, highlighted, selected, focused }) => (
              <Text
                color={
                  highlighted || selected
                    ? focused
                      ? 'cyan'
                      : 'green'
                    : 'gray'
                }
                bold={selected}
              >
                {selected ? `[${option.label}]` : option.label}
              </Text>
            )}
          />
        </Panel>

        {tasks.length > 0 && (
          <Box marginTop={1}>
            <Panel title="Tasks" borderColor="yellow" width={appWidth - 2}>
              <Box gap={1}>
                <Spinner color="yellow" />
                <Text>
                  {tasks[0]}
                  {tasks.length > 1 ? ` (+${tasks.length - 1} more)` : ''}
                </Text>
              </Box>
            </Panel>
          </Box>
        )}

        <Box marginTop={1} gap={1} flexGrow={1}>
          <Panel title="Queue" width={queueWidth} borderColor="green">
            {jobOptions.length === 0 ? (
              <Text dimColor>No jobs yet. Press `a` to add one.</Text>
            ) : (
              <Select
                focusKey="jobs"
                options={jobOptions}
                value={selectedId ?? undefined}
                onChange={setSelectedId}
                onHighlight={setSelectedId}
                maxVisible={Math.max(8, appHeight - 14)}
                render={({ option, highlighted, selected, focused }) => {
                  const job = filteredJobs.find((item) => item.id === option.value);
                  if (!job) return <Text>{option.label}</Text>;
                  return (
                    <Box>
                      <Text color={highlighted ? 'cyan' : 'gray'}>
                        {highlighted ? '▶ ' : '  '}
                      </Text>
                      <Text
                        color={highlighted ? 'white' : undefined}
                        bold={selected && focused}
                      >
                        {job.id.padEnd(3)} {clip(job.company || 'Unknown', 16).padEnd(16)}{' '}
                        {clip(job.role || 'Untitled', 24).padEnd(24)}{' '}
                        {scoreDisplay(job.score).padEnd(5)}
                      </Text>
                    </Box>
                  );
                }}
              />
            )}
          </Panel>

          <Panel title="Detail" width={detailWidth} borderColor="green">
            {selectedJob ? (
              <Box flexDirection="column" gap={1}>
                <Box gap={1} flexWrap="wrap">
                  <Badge color="black" background={statusColor(selectedJob.status)}>
                    {selectedJob.status}
                  </Badge>
                  <Text dimColor>#{selectedJob.id}</Text>
                  <Text dimColor>{selectedJob.added}</Text>
                  <Text color="cyan">Score {scoreDisplay(selectedJob.score)}</Text>
                </Box>
                <Text bold>{selectedJob.company || 'Unknown Company'}</Text>
                <Text>{selectedJob.role || 'Untitled Role'}</Text>
                {selectedJob.url ? <Text dimColor>{selectedJob.url}</Text> : null}
                <Viewport height={Math.max(8, appHeight - 22)}>
                  <Text>{jobPreview(selectedJob)}</Text>
                </Viewport>
                <Text dimColor>
                  `a` add  `e` evaluate  `g` generate  `s` status  `o` open link
                </Text>
              </Box>
            ) : (
              <Text dimColor>Select a job to inspect it.</Text>
            )}
          </Panel>
        </Box>

        {overlay === 'intake-menu' && (
          <Modal title="Add Job" onClose={() => setOverlay('none')} width={48}>
            <Select
              options={INTAKE_OPTIONS}
              onSubmit={(value) => setOverlay(value)}
              render={({ option, highlighted }) => (
                <Text color={highlighted ? 'cyan' : undefined}>
                  {highlighted ? '▶ ' : '  '}
                  {option.label}
                </Text>
              )}
            />
          </Modal>
        )}

        {overlay === 'intake-url' && (
          <Modal title="Paste Job Link" onClose={() => setOverlay('none')} width={64}>
            <TextInput
              label="Job URL"
              value={intakeUrl}
              onChange={setIntakeUrl}
              onSubmit={(value) => void handleIntakeUrl(value)}
              placeholder="https://company.example/jobs/123"
            />
          </Modal>
        )}

        {overlay === 'intake-jd' && (
          <Modal
            title="Paste Job Description"
            onClose={() => setOverlay('none')}
            width={72}
          >
            <MultilineInput
              label="Job description"
              hint="Enter submits, Ctrl+N inserts a new line"
              value={intakeJd}
              onChange={setIntakeJd}
              onSubmit={(value) => void handleIntakeJd(value)}
            />
          </Modal>
        )}

        {overlay === 'status' && selectedJob && (
          <Modal title="Update Status" onClose={() => setOverlay('none')} width={40}>
            <Select
              options={JOB_STATUSES.map((status) => ({
                label: status,
                value: status,
              }))}
              value={selectedJob.status}
              onSubmit={(value) => runStatusUpdate(selectedJob, value)}
              render={({ option, highlighted }) => (
                <Text color={highlighted ? statusColor(option.value) : undefined}>
                  {highlighted ? '▶ ' : '  '}
                  {option.label}
                </Text>
              )}
            />
          </Modal>
        )}

        {overlay === 'theme' && selectedJob && (
          <Modal title="Generate CV" onClose={() => setOverlay('none')} width={40}>
            <Select
              options={THEMES.map((theme) => ({ label: theme, value: theme }))}
              onSubmit={(value) => void runGenerate(selectedJob, value)}
              render={({ option, highlighted }) => (
                <Text color={highlighted ? 'cyan' : undefined}>
                  {highlighted ? '▶ ' : '  '}
                  {option.label}
                </Text>
              )}
            />
          </Modal>
        )}
      </Box>
    </FocusScope>
  );
}

function DashboardRoute(props: Record<string, unknown>) {
  return (
    <DashboardScreen
      initialView={(props.initialView as View | undefined) ?? 'dashboard'}
    />
  );
}

function ScanRoute() {
  const navigation = useNavigation();
  return <Scan onBack={() => navigation.pop()} />;
}

function ProfileRoute() {
  const navigation = useNavigation();
  return <ProfileScreen onBack={() => navigation.pop()} />;
}

export default function App({ initialScreen = 'dashboard' }: Props) {
  return (
    <Router
      initialScreen="dashboard"
      initialParams={{ initialView: initialScreen === 'scan' ? 'scan' : 'dashboard' }}
    >
      <Screen name="dashboard" component={DashboardRoute} />
      <Screen name="scan" component={ScanRoute} />
      <Screen name="profile" component={ProfileRoute} />
    </Router>
  );
}
