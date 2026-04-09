import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { join } from 'path';
import { loadProfile } from '../profile.js';
import { generateCV } from '../claude/generate.js';
import { renderPDF } from '../pdf.js';
import { db } from '../db.js';
import type { Job } from '../types.js';

type State = 'editing' | 'generating' | 'done' | 'error';

interface Props {
  job: Job;
  onBack: () => void;
}

export default function Generate({ job, onBack }: Props) {
  const [state, setState] = useState<State>('editing');
  const [outputPath, setOutputPath] = useState('');
  const [error, setError] = useState('');
  const guidance = '';

  useInput((input, key) => {
    if (key.escape) { onBack(); return; }

    if (state === 'editing') {
      if (key.return) void runGeneration();
    }

    if (state === 'done' || state === 'error') {
      if (key.return || key.escape) onBack();
    }
  });

  async function runGeneration() {
    setState('generating');
    try {
      const profile = loadProfile();
      const cv = await generateCV(
        { jd: job.jd || `URL: ${job.url}`, archetype: job.archetype },
        profile,
        guidance,
      );

      const theme = 'resume';
      const filename = `${job.id}-${job.company.toLowerCase().replace(/\s+/g, '-')}-${theme}.pdf`;
      const path = join(process.cwd(), 'output', filename);
      await renderPDF(cv, path);

      db.updateJob(job.id, { pdfPath: path, theme });
      setOutputPath(path);
      setState('done');
    } catch (err) {
      setError(String(err));
      setState('error');
    }
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">{job.company}</Text>
        <Text> — {job.role}</Text>
      </Box>

      {state === 'editing' && (
        <Box flexDirection="column">
          <Box marginBottom={1}><Text bold>Generate the canonical resume PDF.</Text></Box>
          <Text dimColor>
            This flow now uses one ATS-safe full-height template instead of theme variants.
          </Text>
          <Box marginTop={1}>
            <Text dimColor>enter generate  esc back</Text>
          </Box>
        </Box>
      )}

      {state === 'generating' && (
        <Box flexDirection="column">
          <Text color="yellow">Generating CV with Claude...</Text>
          <Text dimColor>This may take 15-30 seconds</Text>
        </Box>
      )}

      {state === 'done' && (
        <Box flexDirection="column">
          <Text color="green">✓ CV generated</Text>
          <Text dimColor>{outputPath}</Text>
          <Box marginTop={1}><Text dimColor>Press enter or esc to go back</Text></Box>
        </Box>
      )}

      {state === 'error' && (
        <Box flexDirection="column">
          <Text color="red">✗ Generation failed</Text>
          <Text dimColor>{error}</Text>
          <Box marginTop={1}><Text dimColor>Press enter or esc to go back</Text></Box>
        </Box>
      )}
    </Box>
  );
}
