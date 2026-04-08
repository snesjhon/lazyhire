import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { join } from 'path';
import { loadProfile } from '../profile.js';
import { generateCV } from '../claude/generate.js';
import { renderPDF } from '../pdf.js';
import { db } from '../db.js';
import type { Job, Theme } from '../types.js';

const THEMES: Theme[] = ['minimal', 'modern', 'two-column'];

type State = 'pick' | 'generating' | 'done' | 'error';

interface Props {
  job: Job;
  onBack: () => void;
}

export default function Generate({ job, onBack }: Props) {
  const [cursor, setCursor] = useState(0);
  const [state, setState] = useState<State>('pick');
  const [outputPath, setOutputPath] = useState('');
  const [error, setError] = useState('');

  useInput((input, key) => {
    if (key.escape) { onBack(); return; }

    if (state === 'pick') {
      if (key.upArrow) setCursor((c) => Math.max(0, c - 1));
      if (key.downArrow) setCursor((c) => Math.min(THEMES.length - 1, c + 1));
      if (key.return) runGeneration(THEMES[cursor]);
    }

    if (state === 'done' || state === 'error') {
      if (key.return || key.escape) onBack();
    }
  });

  async function runGeneration(theme: Theme) {
    setState('generating');
    try {
      const profile = loadProfile();
      const cv = await generateCV(
        { jd: job.jd || `URL: ${job.url}`, archetype: job.archetype },
        profile
      );

      const filename = `${job.id}-${job.company.toLowerCase().replace(/\s+/g, '-')}-${theme}.pdf`;
      const path = join(process.cwd(), 'output', filename);
      await renderPDF(cv, cv.roles[0]?.bullets[0] ?? '', theme, path);

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

      {state === 'pick' && (
        <Box flexDirection="column">
          <Box marginBottom={1}><Text bold>Select a theme:</Text></Box>
          {THEMES.map((t, i) => (
            <Text key={t} color={i === cursor ? 'cyan' : undefined}>
              {i === cursor ? '▶ ' : '  '}{t}
            </Text>
          ))}
          <Box marginTop={1}>
            <Text dimColor>↑↓ navigate  enter generate  esc back</Text>
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
