import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { db } from '../db.js';
import { JOB_STATUSES } from '../types.js';
import { evaluateAndPersistJob } from '../job-actions.js';
import type { Job, JobStatus } from '../types.js';

type Action = 'menu' | 'status' | 'notes';

interface Props {
  job: Job;
  onBack: () => void;
  onGenerate: (job: Job) => void;
}

const MENU_ITEMS = ['Evaluate', 'Generate CV', 'Update status', 'Edit notes', 'Back'] as const;

export default function JobDetail({ job: initialJob, onBack, onGenerate }: Props) {
  const [job, setJob] = useState(initialJob);
  const [action, setAction] = useState<Action>('menu');
  const [cursor, setCursor] = useState(0);
  const [statusCursor, setStatusCursor] = useState(
    JOB_STATUSES.indexOf(job.status as JobStatus)
  );
  const [evaluating, setEvaluating] = useState(false);

  useInput((input, key) => {
    if (key.escape) { onBack(); return; }

    if (action === 'menu') {
      if (key.upArrow) setCursor((c) => Math.max(0, c - 1));
      if (key.downArrow) setCursor((c) => Math.min(MENU_ITEMS.length - 1, c + 1));
      if (key.return) {
        const selected = MENU_ITEMS[cursor];
        if (selected === 'Back') onBack();
        if (selected === 'Update status') setAction('status');
        if (selected === 'Edit notes') setAction('notes');
        if (selected === 'Generate CV') onGenerate(job);
        if (selected === 'Evaluate') {
          setEvaluating(true);
          evaluateAndPersistJob(job).then((updated) => {
            setJob(updated);
            setEvaluating(false);
          });
        }
      }
    }

    if (action === 'status') {
      if (key.upArrow) setStatusCursor((c) => Math.max(0, c - 1));
      if (key.downArrow) setStatusCursor((c) => Math.min(JOB_STATUSES.length - 1, c + 1));
      if (key.return) {
        const newStatus = JOB_STATUSES[statusCursor];
        db.updateJob(job.id, { status: newStatus });
        setJob({ ...job, status: newStatus });
        setAction('menu');
      }
    }
  });

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Header */}
      <Box marginBottom={1} flexDirection="column">
        <Text bold color="cyan">{job.company}</Text>
        <Text>{job.role}</Text>
        <Box gap={2}>
          <Text dimColor>#{job.id}</Text>
          <Text dimColor>{job.added}</Text>
          {job.score !== null && <Text color="cyan">Score: {job.score.toFixed(1)}</Text>}
          <Text>{job.status}</Text>
        </Box>
        {job.url && <Text dimColor>{job.url.slice(0, 60)}</Text>}
      </Box>

      {evaluating && <Text color="yellow">Evaluating with Claude...</Text>}

      {/* Menu */}
      {action === 'menu' && !evaluating && (
        <Box flexDirection="column">
          {MENU_ITEMS.map((item, i) => (
            <Text key={item} color={i === cursor ? 'cyan' : undefined}>
              {i === cursor ? '▶ ' : '  '}{item}
            </Text>
          ))}
        </Box>
      )}

      {/* Status picker */}
      {action === 'status' && (
        <Box flexDirection="column">
          <Box marginBottom={1}><Text bold>Select status:</Text></Box>
          {JOB_STATUSES.map((s, i) => (
            <Text key={s} color={i === statusCursor ? 'cyan' : undefined}>
              {i === statusCursor ? '▶ ' : '  '}{s}
            </Text>
          ))}
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>↑↓ navigate  enter select  esc back</Text>
      </Box>
    </Box>
  );
}
