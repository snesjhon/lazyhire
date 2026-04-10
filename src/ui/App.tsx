import React, { useEffect, useMemo, useState } from 'react';
import { spawn } from 'child_process';
import { Box, Text, useStdout } from 'ink';
import {
  FocusScope,
  FocusTrap,
  Router,
  Screen,
  useFocusScope,
  useNavigation,
} from 'giggles';
import {
  Badge,
  Confirm,
  Panel,
  Select,
  Spinner,
  Viewport,
} from 'giggles/ui';
import { db } from '../db.js';
import {
  JOB_STATUSES,
  type Job,
  type JobStatus,
} from '../types.js';
import {
  createPendingJob,
  evaluateAndPersistJob,
  generateAndPersistPdf,
  hydrateJobFromUrl,
  saveJob,
} from '../job-actions.js';
import MultilineInput from './MultilineInput.js';
import PasteInput from './PasteInput.js';
import ProfileScreen from './Profile.js';
import Scan from './Scan.js';
import AnswersScreen from './Answers.js';

type View = 'dashboard' | 'scan';
type Overlay =
  | 'none'
  | 'job-actions'
  | 'intake-menu'
  | 'intake-url'
  | 'intake-jd'
  | 'edit-jd'
  | 'delete'
  | 'status'
  | 'generate-cv';
type Flash = {
  message: string;
  variant: 'info' | 'success' | 'error' | 'warning';
};

const FILTERS: Array<'All' | JobStatus> = ['All', ...JOB_STATUSES];
const INTAKE_OPTIONS = [
  { label: 'Paste job link', value: 'intake-url' as const },
  { label: 'Paste job description', value: 'intake-jd' as const },
];
type JobAction =
  | 'view-detail'
  | 'evaluate'
  | 'generate-cv'
  | 'edit-jd'
  | 'edit-status'
  | 'open-pdf'
  | 'delete'
  | 'open-link'
  | 'cancel';

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

function footerSegment(label: string, key: string): string {
  return `${label}: ${key}`;
}

function DetailDialog({
  childFocusKey,
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  childFocusKey: string;
  children: React.ReactNode;
}) {
  const scope = useFocusScope({
    keybindings: {
      escape: onClose,
    },
  });

  useEffect(() => {
    scope.focusChild(childFocusKey);
  }, [childFocusKey, scope.id]);

  return (
    <FocusTrap>
      <FocusScope handle={scope}>
        <Panel title={title} borderColor="green">
          {children}
        </Panel>
      </FocusScope>
    </FocusTrap>
  );
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
  const [editJdValue, setEditJdValue] = useState('');
  const [cvGuidance, setCvGuidance] = useState('');
  const [jobCount, setJobCount] = useState(0);
  const [activePanel, setActivePanel] = useState<'jobs' | 'detail'>('jobs');

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
  const jobOptions = filteredJobs.map((job) => ({
    label: `#${job.id} ${clip(job.company || 'Unknown', 16)} ${clip(job.role || 'Untitled', 24)} ${scoreDisplay(job.score)}`,
    value: job.id,
  }));
  const jobActionOptions: Array<{ label: string; value: JobAction }> = selectedJob
    ? [
        { label: 'View Detail', value: 'view-detail' },
        {
          label: selectedJob.score === null ? 'Evaluate Job' : 'Re-evaluate Job',
          value: 'evaluate',
        },
        { label: 'Generate CV', value: 'generate-cv' },
        { label: 'Edit JD', value: 'edit-jd' },
        { label: 'Edit Status', value: 'edit-status' },
        ...(selectedJob.pdfPath
          ? [{ label: 'Open Last Generated CV', value: 'open-pdf' as const }]
          : []),
        ...(selectedJob.url
          ? [{ label: 'Open Link', value: 'open-link' as const }]
          : []),
        { label: 'Delete', value: 'delete' },
        { label: 'Cancel', value: 'cancel' },
      ]
    : [];
  let modalOverlay: React.ReactNode = null;

  if (overlay === 'job-actions' && selectedJob) {
    modalOverlay = (
      <DetailDialog
        title={`Job Actions · #${selectedJob.id}`}
        onClose={() => setOverlay('none')}
        childFocusKey="modal-select"
      >
        <Box flexDirection="column" gap={1}>
          <Text bold>
            {selectedJob.company || 'Unknown Company'} · {selectedJob.role || 'Untitled Role'}
          </Text>
          <Select
            focusKey="modal-select"
            options={jobActionOptions}
            onSubmit={(value) => handleJobAction(selectedJob, value)}
            render={({ option, highlighted }) => (
              <Text color={highlighted ? 'cyan' : undefined}>
                {highlighted ? '▶ ' : '  '}
                {option.label}
              </Text>
            )}
          />
        </Box>
      </DetailDialog>
    );
  } else if (overlay === 'intake-menu') {
    modalOverlay = (
      <DetailDialog
        title="Add Job"
        onClose={() => setOverlay('none')}
        childFocusKey="modal-select"
      >
          <Select
            focusKey="modal-select"
            options={INTAKE_OPTIONS}
            onSubmit={(value) => setOverlay(value)}
            render={({ option, highlighted }) => (
              <Text color={highlighted ? 'cyan' : undefined}>
                {highlighted ? '▶ ' : '  '}
                {option.label}
              </Text>
            )}
          />
      </DetailDialog>
    );
  } else if (overlay === 'intake-url') {
    modalOverlay = (
      <DetailDialog
        title="Paste Job Link"
        onClose={() => setOverlay('none')}
        childFocusKey="modal-input"
      >
          <PasteInput
            focusKey="modal-input"
            label="Job URL"
            value={intakeUrl}
            onChange={setIntakeUrl}
            onSubmit={(value) => void handleIntakeUrl(value)}
            placeholder="https://company.example/jobs/123"
          />
      </DetailDialog>
    );
  } else if (overlay === 'intake-jd') {
    modalOverlay = (
      <DetailDialog
        title="Paste Job Description"
        onClose={() => setOverlay('none')}
        childFocusKey="modal-input"
      >
          <MultilineInput
            focusKey="modal-input"
            label="Job description"
            hint="Enter submits, Ctrl+N inserts a new line"
            value={intakeJd}
            onChange={setIntakeJd}
            onSubmit={(value) => void handleIntakeJd(value)}
          />
      </DetailDialog>
    );
  } else if (overlay === 'edit-jd' && selectedJob) {
    modalOverlay = (
      <DetailDialog
        title={`Edit Job Description · #${selectedJob.id}`}
        onClose={() => setOverlay('none')}
        childFocusKey="modal-input"
      >
        <MultilineInput
          focusKey="modal-input"
          label="Job description"
          hint="Enter saves, Ctrl+N inserts a new line"
          value={editJdValue}
          onChange={setEditJdValue}
          onSubmit={(value) => runJdUpdate(selectedJob, value)}
        />
      </DetailDialog>
    );
  } else if (overlay === 'status' && selectedJob) {
    modalOverlay = (
      <DetailDialog
        title="Update Status"
        onClose={() => setOverlay('none')}
        childFocusKey="modal-select"
      >
          <Select
            focusKey="modal-select"
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
      </DetailDialog>
    );
  } else if (overlay === 'delete' && selectedJob) {
    modalOverlay = (
      <DetailDialog
        title="Delete Job"
        onClose={() => setOverlay('none')}
        childFocusKey="modal-confirm"
      >
        <Box flexDirection="column" gap={1}>
          <Text>Delete #{selectedJob.id} from the queue?</Text>
          <Text dimColor>
            {selectedJob.company || 'Unknown Company'} · {selectedJob.role || 'Untitled Role'}
          </Text>
          <Confirm
            focusKey="modal-confirm"
            message="Press y to delete or n to cancel."
            onSubmit={(confirmed) => {
              if (confirmed) {
                runDeleteJob(selectedJob);
                return;
              }
              setOverlay('none');
            }}
          />
        </Box>
      </DetailDialog>
    );
  } else if (overlay === 'generate-cv' && selectedJob) {
    modalOverlay = (
      <DetailDialog
        title="Generate CV"
        onClose={() => setOverlay('none')}
        childFocusKey="modal-guidance"
      >
        <Box flexDirection="column" gap={1}>
          <Text>Optional tailoring guidance for this application.</Text>
          <Text dimColor>
            Include any preferred title, technologies to emphasize, achievements to foreground,
            or company-specific tone.
          </Text>
          <MultilineInput
            focusKey="modal-guidance"
            label="Guidance"
            hint="Enter submits, Ctrl+N inserts a new line"
            value={cvGuidance}
            onChange={setCvGuidance}
            onSubmit={(value) => void runGenerate(selectedJob, value)}
            placeholder="Preferred title, emphasis areas, must-highlight wins..."
          />
        </Box>
      </DetailDialog>
    );
  }

  function cycleFilter(direction: 1 | -1) {
    const index = FILTERS.indexOf(selectedFilter);
    const nextIndex = (index + direction + FILTERS.length) % FILTERS.length;
    setSelectedFilter(FILTERS[nextIndex]!);
  }

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
      refreshJobs();
      setSelectedId(saved.id);

      try {
        const updated = await evaluateAndPersistJob(saved);
        refreshJobs();
        setSelectedId(updated.id);
        setMessage(
          `Added and evaluated #${updated.id} ${updated.company} — ${updated.role}`,
        );
      } catch (error) {
        setMessage(
          `Saved #${saved.id} ${saved.company} — ${saved.role}; evaluation failed: ${String(error)}`,
          'warning',
        );
      }
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

  async function runGenerate(job: Job | null, guidance: string) {
    if (!job) return;
    const finishTask = startTask(`Generating resume CV for #${job.id}`);
    setOverlay('none');
    try {
      const updated = await generateAndPersistPdf(job, guidance);
      refreshJobs();
      setSelectedId(updated.id);
      setCvGuidance('');
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

  function runJdUpdate(job: Job | null, jd: string) {
    if (!job) return;
    db.updateJob(job.id, { jd: jd.trim() });
    refreshJobs();
    setEditJdValue('');
    setMessage(`Updated job description for #${job.id}`);
    setOverlay('none');
  }

  function runDeleteJob(job: Job | null) {
    if (!job) return;
    db.removeJob(job.id);
    refreshJobs();
    setMessage(`Deleted #${job.id} ${job.company || job.role || 'job'}`);
    setOverlay('none');
  }

  function openExternalTarget(
    target: string,
    successMessage: string,
    missingMessage: string,
  ) {
    if (!target.trim()) {
      setMessage(missingMessage, 'warning');
      return;
    }

    const command = browserCommand(target);
    if (!command) {
      setMessage(
        `Opening external targets is not supported on ${process.platform}.`,
        'error',
      );
      return;
    }

    const child = spawn(command.command, command.args, {
      detached: true,
      stdio: 'ignore',
    });
    child.on('error', (error) => {
      setMessage(`Failed to open target: ${String(error)}`, 'error');
    });
    child.unref();
    setMessage(successMessage, 'info');
  }

  function openSelectedJobUrl(job: Job | null) {
    if (!job?.url?.trim()) {
      setMessage('No job URL available to open.', 'warning');
      return;
    }

    openExternalTarget(
      job.url,
      `Opened #${job.id} job link.`,
      'No job URL available to open.',
    );
  }

  function openGeneratedCv(job: Job | null) {
    if (!job?.pdfPath?.trim()) {
      setMessage('No generated CV available to open.', 'warning');
      return;
    }

    setOverlay('none');
    openExternalTarget(
      job.pdfPath,
      `Opened generated CV for #${job.id}.`,
      'No generated CV available to open.',
    );
  }

  function openJobActions(job: Job | null) {
    if (!job) return;
    setOverlay('job-actions');
  }

  function handleJobAction(job: Job | null, action: JobAction) {
    if (!job) return;

    if (action === 'cancel') {
      setOverlay('none');
      return;
    }

    if (action === 'view-detail') {
      setOverlay('none');
      setActivePanel('detail');
      root.focusChild('detail');
      return;
    }

    if (action === 'evaluate') {
      setOverlay('none');
      void runEvaluate(job);
      return;
    }

    if (action === 'generate-cv') {
      setCvGuidance('');
      setOverlay('generate-cv');
      return;
    }

    if (action === 'edit-jd') {
      setEditJdValue(job.jd);
      setOverlay('edit-jd');
      return;
    }

    if (action === 'edit-status') {
      setOverlay('status');
      return;
    }

    if (action === 'open-pdf') {
      openGeneratedCv(job);
      return;
    }

    if (action === 'delete') {
      setOverlay('delete');
      return;
    }

    if (action === 'open-link') {
      setOverlay('none');
      openSelectedJobUrl(job);
    }
  }

  const root = useFocusScope({
    keybindings: ({ focusChild }) => ({
      '1': () => navigation.reset('dashboard'),
      '2': () => navigation.push('scan'),
      '3': () => navigation.push('profile'),
      '4': () => navigation.push('answers'),
      q: () => process.exit(0),
      h: () => {
        setActivePanel('jobs');
        focusChild('jobs');
      },
      l: () => {
        if (!selectedJob) return;
        setActivePanel('detail');
        focusChild('detail');
      },
      tab: () => cycleFilter(1),
      'shift+tab': () => cycleFilter(-1),
      a: () => setOverlay('intake-menu'),
      enter: () => openJobActions(selectedJob),
      o: () => openSelectedJobUrl(selectedJob),
      e: () => void runEvaluate(selectedJob),
      d: () => {
        if (selectedJob) setOverlay('delete');
      },
      g: () => {
        if (selectedJob) {
          setCvGuidance('');
          setOverlay('generate-cv');
        }
      },
      s: () => {
        if (selectedJob) setOverlay('status');
      },
    }),
  });

  useEffect(() => {
    root.focusChild('jobs');
  }, [root.id]);

  useEffect(() => {
    if (activePanel === 'detail' && !selectedJob) {
      setActivePanel('jobs');
      root.focusChild('jobs');
    }
  }, [activePanel, root.id, selectedJob]);

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
            <Text color="gray">[4] Answers</Text>
          </Box>
          {flash ? (
            <Text color={flashColor(flash.variant)}>
              {clip(flash.message, Math.max(20, appWidth - 44))}
            </Text>
          ) : (
            <Text dimColor>{jobCount} jobs</Text>
          )}
        </Box>

        <Box marginBottom={1} gap={2} flexWrap="wrap">
          {FILTERS.map((filter) => {
            const selected = filter === selectedFilter;
            return (
              <Text
                key={filter}
                color={selected ? 'black' : 'gray'}
                backgroundColor={selected ? 'cyan' : undefined}
                bold={selected}
              >
                {selected ? ` ${filter} ` : filter}
              </Text>
            );
          })}
        </Box>

        <Box gap={1} flexGrow={1}>
          <Panel
            title={`Queue ${selectedFilter === 'All' ? '' : `· ${selectedFilter}`}`.trim()}
            width={queueWidth}
            borderColor={activePanel === 'jobs' ? 'green' : 'gray'}
          >
            {jobOptions.length === 0 ? (
              <Text dimColor>No jobs yet. Press `a` to add one.</Text>
            ) : (
              <Select
                focusKey="jobs"
                options={jobOptions}
                value={selectedId ?? undefined}
                onChange={setSelectedId}
                onHighlight={setSelectedId}
                onSubmit={(value) => {
                  setSelectedId(value);
                  const job = filteredJobs.find((item) => item.id === value) ?? null;
                  openJobActions(job);
                }}
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

          <Box width={detailWidth} flexDirection="column" gap={1}>
            <Panel
              title="Detail"
              borderColor={activePanel === 'detail' ? 'green' : 'gray'}
              flexGrow={1}
            >
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
                  <Viewport
                    focusKey="detail"
                    height={Math.max(8, appHeight - (modalOverlay ? 34 : 22))}
                  >
                    <Text>{jobPreview(selectedJob)}</Text>
                  </Viewport>
                </Box>
              ) : (
                <Text dimColor>Select a job to inspect it.</Text>
              )}
            </Panel>

            {modalOverlay}
          </Box>
        </Box>

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

        <Box justifyContent="space-between" marginTop={1}>
          <Box
            width={appWidth - 2}
            borderTop
            borderColor="gray"
            paddingTop={1}
            flexWrap="wrap"
          >
            <Text color="blueBright">
              {footerSegment('Filter', 'tab')}
            </Text>
            <Text color="gray"> | </Text>
            <Text color="blueBright">
              {footerSegment('Panels', 'h/l')}
            </Text>
            <Text color="gray"> | </Text>
            <Text color="blueBright">
              {footerSegment('Move', 'j/k')}
            </Text>
            <Text color="gray"> | </Text>
            <Text color="blueBright">
              {footerSegment('Select', 'enter')}
            </Text>
            <Text color="gray"> | </Text>
            <Text color="blueBright">
              {footerSegment('Add', 'a')}
            </Text>
            <Text color="gray"> | </Text>
            <Text color="blueBright">
              {footerSegment('Edit', 'e')}
            </Text>
            <Text color="gray"> | </Text>
            <Text color="blueBright">
              {footerSegment('Delete', 'd')}
            </Text>
            <Text color="gray"> | </Text>
            <Text color="blueBright">
              {footerSegment('Status', 's')}
            </Text>
            <Text color="gray"> | </Text>
            <Text color="blueBright">
              {footerSegment('Generate', 'g')}
            </Text>
            <Text color="gray"> | </Text>
            <Text color="blueBright">
              {footerSegment('Open', 'o')}
            </Text>
            <Text color="gray"> | </Text>
            <Text color="blueBright">
              {footerSegment('Quit', 'q')}
            </Text>
          </Box>
        </Box>

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

function AnswersRoute() {
  const navigation = useNavigation();
  return <AnswersScreen onBack={() => navigation.pop()} />;
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
      <Screen name="answers" component={AnswersRoute} />
    </Router>
  );
}
