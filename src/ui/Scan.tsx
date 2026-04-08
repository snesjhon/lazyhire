import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { FocusScope, useFocusScope, useNavigation } from 'giggles';
import { Panel, Spinner } from 'giggles/ui';
import { db } from '../db.js';
import { loadProfile } from '../profile.js';
import { normalizeCompanyKey, runScan } from '../scan.js';
import type { SourceStatus } from '../scan.js';

type Phase = 'loading' | 'scanning' | 'done' | 'error';
const TOP_RECOMMENDATION_COUNT = 30;

interface Props {
  onBack: () => void;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function Scan({ onBack }: Props) {
  const navigation = useNavigation();
  const [phase, setPhase] = useState<Phase>('loading');
  const [sources, setSources] = useState<SourceStatus[]>([]);
  const [added, setAdded] = useState(0);
  const [recommended, setRecommended] = useState(0);
  const [lowerRanked, setLowerRanked] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function go() {
      try {
        const profile = loadProfile();
        if (cancelled) return;

        const existingJobs = db.readJobs();
        const existingUrls = new Set(
          existingJobs.map((job) => job.url).filter(Boolean),
        );
        const existingCompanies = new Set(
          existingJobs
            .map((job) => normalizeCompanyKey(job.company))
            .filter(Boolean),
        );

        setPhase('scanning');

        const results = await runScan(
          profile,
          existingUrls,
          existingCompanies,
          (update) => {
            if (!cancelled) {
              setSources((prev) => {
                const index = prev.findIndex((source) => source.name === update.name);
                if (index === -1) return [...prev, update];
                const next = [...prev];
                next[index] = update;
                return next;
              });
            }
          },
        );

        if (cancelled) return;

        const recommendedJobs = results.slice(0, TOP_RECOMMENDATION_COUNT);
        let addedCount = 0;

        for (const job of results) {
          db.addJob({
            id: db.nextId(),
            added: today(),
            company: job.company,
            role: job.title,
            url: job.url,
            jd: '',
            status: 'Pending',
            score: job.score,
            archetype: null,
            reportPath: null,
            pdfPath: null,
            theme: null,
            notes: '',
          });
          addedCount += 1;
        }

        setAdded(addedCount);
        setRecommended(recommendedJobs.length);
        setLowerRanked(Math.max(0, results.length - recommendedJobs.length));
        setPhase('done');
      } catch (err) {
        if (!cancelled) {
          setError(String(err));
          setPhase('error');
        }
      }
    }

    void go();
    return () => {
      cancelled = true;
    };
  }, []);

  const root = useFocusScope({
    keybindings: {
      '1': () => navigation.reset('dashboard'),
      '2': () => navigation.reset('scan'),
      '3': () => navigation.push('profile'),
      q: () => process.exit(0),
      escape: () => onBack(),
      enter: () => {
        if (phase === 'done' || phase === 'error') onBack();
      },
    },
  });

  return (
    <FocusScope handle={root}>
      <Box flexDirection="column" paddingX={1}>
        <Text bold color="cyan">
          open-positions scan
        </Text>

        {phase === 'loading' && (
          <Box marginTop={1}>
            <Spinner color="yellow" />
            <Text> Loading profile...</Text>
          </Box>
        )}

        {phase === 'scanning' && (
          <Box marginTop={1}>
            <Panel title="Scanning Sources" borderColor="yellow" width={56}>
              <Box flexDirection="column">
                {sources.map((source) => (
                  <Box key={source.name} gap={1}>
                    <Text
                      color={
                        source.state === 'done'
                          ? 'green'
                          : source.state === 'error'
                            ? 'red'
                            : 'yellow'
                      }
                    >
                      {source.state === 'done'
                        ? '✓'
                        : source.state === 'error'
                          ? '✗'
                          : '·'}
                    </Text>
                    <Text>{source.name.padEnd(12)}</Text>
                    {source.state === 'done' && <Text dimColor>{source.count} jobs</Text>}
                    {source.state === 'running' && <Text dimColor>scanning...</Text>}
                  </Box>
                ))}
                <Text dimColor>esc to go back</Text>
              </Box>
            </Panel>
          </Box>
        )}

        {phase === 'error' && (
          <Box marginTop={1}>
            <Panel title="Scan Failed" borderColor="red" width={64}>
              <Box flexDirection="column">
                <Text color="red">{error}</Text>
                <Text dimColor>enter or esc to go back</Text>
              </Box>
            </Panel>
          </Box>
        )}

        {phase === 'done' && (
          <Box marginTop={1}>
            <Panel title="Scan Complete" borderColor="green" width={64}>
              <Box flexDirection="column">
                <Text>
                  {recommended} highest-ranked job{recommended !== 1 ? 's' : ''} added
                  to the top set
                </Text>
                <Text>
                  {lowerRanked} lower-ranked validated job
                  {lowerRanked !== 1 ? 's' : ''} also saved
                </Text>
                <Text dimColor>{added} total validated jobs added to Pending</Text>
                <Text dimColor>enter or esc to go back</Text>
              </Box>
            </Panel>
          </Box>
        )}
      </Box>
    </FocusScope>
  );
}
