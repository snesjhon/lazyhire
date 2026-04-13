/** @jsxImportSource @opentui/react */
import { useKeyboard } from '@opentui/react';
import { useEffect, useRef, useState } from 'react';
import { db } from '../../../shared/data/db.js';
import { loadProfile } from '../../../shared/models/profile.js';
import Spinner from '../../../shared/ui/Spinner.js';
import type { UiTheme } from '../../../shared/ui/theme.js';
import { normalizeCompanyKey, runScan } from '../scan.js';
import type { SourceStatus } from '../scan.js';

const TOP_RECOMMENDATION_COUNT = 30;

type Phase = 'loading' | 'scanning' | 'done' | 'error';

interface Props {
  appWidth: number;
  appHeight: number;
  theme: UiTheme;
  onBack: () => void;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ScanScreen({ appWidth, theme, onBack }: Props) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [sources, setSources] = useState<SourceStatus[]>([]);
  const [added, setAdded] = useState(0);
  const [recommended, setRecommended] = useState(0);
  const [lowerRanked, setLowerRanked] = useState(0);
  const [error, setError] = useState('');
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;

    async function go() {
      try {
        const profile = loadProfile();
        if (cancelledRef.current) return;

        const existingJobs = db.readJobs();
        const existingUrls = new Set(existingJobs.map((j) => j.url).filter(Boolean));
        const existingCompanies = new Set(
          existingJobs.map((j) => normalizeCompanyKey(j.company)).filter(Boolean),
        );

        setPhase('scanning');

        const results = await runScan(profile, existingUrls, existingCompanies, (update) => {
          if (!cancelledRef.current) {
            setSources((prev) => {
              const idx = prev.findIndex((s) => s.name === update.name);
              if (idx === -1) return [...prev, update];
              const next = [...prev];
              next[idx] = update;
              return next;
            });
          }
        });

        if (cancelledRef.current) return;

        const top = results.slice(0, TOP_RECOMMENDATION_COUNT);
        let count = 0;
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
            category: null,
            focus: null,
            reportPath: null,
            pdfPath: null,
            coverLetterPdfPath: null,
            theme: null,
            notes: '',
          });
          count += 1;
        }

        setAdded(count);
        setRecommended(top.length);
        setLowerRanked(Math.max(0, results.length - top.length));
        setPhase('done');
      } catch (err) {
        if (!cancelledRef.current) {
          setError(String(err));
          setPhase('error');
        }
      }
    }

    void go();
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  useKeyboard((key) => {
    if (key.name === 'escape') onBack();
    if (key.name === 'return' && (phase === 'done' || phase === 'error')) onBack();
  });

  const panelWidth = Math.max(50, Math.floor(appWidth * 0.6));

  return (
    <box flexDirection="column" width={appWidth} paddingX={1}>
      {phase === 'loading' && (
        <box border borderColor={theme.warning} padding={1} width={panelWidth} marginTop={1}>
          <box flexDirection="row" columnGap={1}>
            <Spinner color={theme.warning} />
            <text fg={theme.warning} content="Loading profile…" />
          </box>
        </box>
      )}

      {phase === 'scanning' && (
        <box
          title="Scanning Sources"
          border
          borderColor={theme.warning}
          padding={1}
          width={panelWidth}
          marginTop={1}
          flexDirection="column"
        >
          {sources.length > 0 ? (
            <box flexDirection="column">
              {sources.map((source) => {
                const detail =
                  source.state === 'done'
                    ? `${source.count} jobs`
                    : source.state === 'running'
                      ? 'scanning…'
                      : '';

                return (
                  <box key={source.name} flexDirection="row" columnGap={1}>
                    {source.state === 'done' ? (
                      <text fg={theme.success} content="✓" />
                    ) : source.state === 'error' ? (
                      <text fg={theme.error} content="✗" />
                    ) : (
                      <Spinner color={theme.warning} />
                    )}
                    <text content={source.name.padEnd(14)} />
                    <text fg={theme.muted} content={detail} />
                  </box>
                );
              })}
            </box>
          ) : (
            <text content=" " />
          )}
          <text fg={theme.muted} content="esc to cancel" />
        </box>
      )}

      {phase === 'error' && (
        <box
          title="Scan Failed"
          border
          borderColor={theme.error}
          padding={1}
          width={panelWidth}
          marginTop={1}
          flexDirection="column"
        >
          <text fg={theme.error} content={error} />
          <text fg={theme.muted} content="enter or esc to go back" />
        </box>
      )}

      {phase === 'done' && (
        <box
          title="Scan Complete"
          border
          borderColor={theme.success}
          padding={1}
          width={panelWidth}
          marginTop={1}
          flexDirection="column"
        >
          <text
            content={`${recommended} highest-ranked job${recommended !== 1 ? 's' : ''} added to the top set`}
          />
          <text
            content={`${lowerRanked} lower-ranked job${lowerRanked !== 1 ? 's' : ''} also saved`}
          />
          <text fg={theme.muted} content={`${added} total jobs added to Pending`} />
          <text fg={theme.muted} content="enter or esc to go back" />
        </box>
      )}

      <box flexDirection="row" columnGap={1} position="absolute" bottom={0}>
        <text fg={theme.footer} content="esc=back" />
        <text fg={theme.muted} content="|" />
        <text fg={theme.footer} content="1-3=tabs" />
        <text fg={theme.muted} content="|" />
        <text fg={theme.footer} content="ctrl-q=quit" />
      </box>
    </box>
  );
}
