import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { db } from '../db.js';
import type { Job, JobStatus } from '../types.js';
import { JOB_STATUSES } from '../types.js';

type Filter = 'All' | JobStatus;
const FILTERS: Filter[] = ['All', ...JOB_STATUSES];

interface Props {
  jobs?: Job[];  // injectable for tests
  onAdd: () => void;
  onScan: () => void;
  onSelect: (job: Job) => void;
  onProfile: () => void;
}

function scoreDisplay(score: number | null): string {
  if (score === null) return '—';
  return score.toFixed(1);
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

export default function Dashboard({ jobs: injectedJobs, onAdd, onScan, onSelect, onProfile }: Props) {
  const jobs = injectedJobs ?? db.readJobs();
  const [cursor, setCursor] = useState(0);
  const [filterIdx, setFilterIdx] = useState(0);

  const filter = FILTERS[filterIdx];
  const filtered = (filter === 'All' ? jobs : jobs.filter((j) => j.status === filter))
    .slice()
    .sort((a, b) => {
      const aScore = a.score ?? Number.NEGATIVE_INFINITY;
      const bScore = b.score ?? Number.NEGATIVE_INFINITY;
      if (aScore !== bScore) return bScore - aScore;
      if (a.added !== b.added) return b.added.localeCompare(a.added);
      return b.id.localeCompare(a.id);
    });

  useInput((input, key) => {
    if (key.upArrow) setCursor((c) => Math.max(0, c - 1));
    if (key.downArrow) setCursor((c) => Math.min(Math.max(0, filtered.length - 1), c + 1));
    if (key.tab) setFilterIdx((i) => (i + 1) % FILTERS.length);
    if (key.return && filtered.length > 0) onSelect(filtered[cursor]);
    if (input === 'a') onAdd();
    if (input === 's') onScan();
    if (input === 'p') onProfile();
    if (input === 'q') process.exit(0);
  });

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">open-positions</Text>
        <Text> — {jobs.length} jobs</Text>
      </Box>

      {/* Filter tabs */}
      <Box marginBottom={1} gap={1}>
        {FILTERS.map((f, i) => (
          <Text key={f} color={i === filterIdx ? 'cyan' : 'gray'}>{f}</Text>
        ))}
        <Text dimColor>(tab to switch)</Text>
      </Box>

      {/* Column headers */}
      <Box>
        <Text bold color="gray">{' #  '}</Text>
        <Text bold color="gray">{'Company           '}</Text>
        <Text bold color="gray">{'Role                       '}</Text>
        <Text bold color="gray">{'Score '}</Text>
        <Text bold color="gray">{'Status      '}</Text>
        <Text bold color="gray">{'Added'}</Text>
      </Box>

      {/* Job rows */}
      {filtered.length === 0 ? (
        <Box marginTop={1}>
          <Text dimColor>No jobs yet. Press <Text color="cyan">a</Text> to add one.</Text>
        </Box>
      ) : (
        filtered.map((job, i) => (
          <Box key={job.id}>
            <Text color={i === cursor ? 'cyan' : undefined} bold={i === cursor}>
              {i === cursor ? '▶ ' : '  '}
            </Text>
            <Text color={i === cursor ? 'white' : undefined}>
              {job.id.padEnd(3)} {job.company.slice(0, 16).padEnd(17)} {job.role.slice(0, 26).padEnd(27)}{' '}
              {scoreDisplay(job.score).padEnd(6)}
            </Text>
            <Text color={statusColor(job.status)}>{job.status.padEnd(12)}</Text>
            <Text dimColor>{job.added}</Text>
          </Box>
        ))
      )}

      {/* Footer */}
      <Box marginTop={1}>
        <Text dimColor>↑↓ navigate  enter select  a add  s scan  p profile  tab filter  q quit</Text>
      </Box>
    </Box>
  );
}
