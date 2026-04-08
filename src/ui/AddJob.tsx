import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import MultilineInput from './MultilineInput.js';
import { db } from '../db.js';
import type { Job } from '../types.js';

type Mode = 'select' | 'url' | 'jd';

interface Props {
  onBack: () => void;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildJob(partial: Pick<Job, 'url' | 'jd'>): Job {
  return {
    id: db.nextId(),
    added: today(),
    company: '',
    role: '',
    url: partial.url,
    jd: partial.jd,
    status: 'Pending',
    score: null,
    archetype: null,
    reportPath: null,
    pdfPath: null,
    theme: null,
    notes: '',
  };
}

export default function AddJob({ onBack }: Props) {
  const [mode, setMode] = useState<Mode>('select');
  const [saved, setSaved] = useState(false);
  const [savedId, setSavedId] = useState('');

  useInput((input, key) => {
    if (key.escape) onBack();
    if (mode === 'select') {
      if (input === '1') setMode('url');
      if (input === '2') setMode('jd');
    }
  });

  if (saved) {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text color="green">✓ Job #{savedId} added as Pending</Text>
        <Text dimColor>Press esc to go back</Text>
      </Box>
    );
  }

  if (mode === 'select') {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text bold>Add a job</Text>
        <Box marginTop={1} flexDirection="column">
          <Text>1  Paste a URL</Text>
          <Text>2  Paste job description text</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>esc back</Text>
        </Box>
      </Box>
    );
  }

  if (mode === 'url') {
    return (
      <Box flexDirection="column" paddingX={1}>
        <MultilineInput
          label="Job URL"
          hint="Paste URL, then Enter to save"
          onSubmit={(url) => {
            if (!url) { onBack(); return; }
            const job = buildJob({ url: url.trim(), jd: '' });
            db.addJob(job);
            setSavedId(job.id);
            setSaved(true);
          }}
        />
      </Box>
    );
  }

  // mode === 'jd'
  return (
    <Box flexDirection="column" paddingX={1}>
      <MultilineInput
        label="Paste job description"
        hint="Paste the full JD, then Enter to save"
        onSubmit={(jd) => {
          if (!jd) { onBack(); return; }
          const job = buildJob({ url: '', jd });
          db.addJob(job);
          setSavedId(job.id);
          setSaved(true);
        }}
      />
    </Box>
  );
}
