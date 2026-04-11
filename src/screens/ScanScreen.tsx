/** @jsxImportSource @opentui/react */
import { useKeyboard } from '@opentui/react';
import { useEffect, useRef, useState } from 'react';
import { db } from '../db.js';
import { loadProfile } from '../profile.js';
import { normalizeCompanyKey, runScan } from '../scan.js';
import type { SourceStatus } from '../scan.js';

const TOP_RECOMMENDATION_COUNT = 30;
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'] as const;

type Phase = 'loading' | 'scanning' | 'done' | 'error';

interface Props {
  appWidth: number;
  appHeight: number;
  onBack: () => void;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function useSpinner(active: boolean): string {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setFrame((f) => (f + 1) % SPINNER_FRAMES.length), 80);
    return () => clearInterval(id);
  }, [active]);
  return SPINNER_FRAMES[frame]!;
}

export default function ScanScreen({ appWidth, onBack }: Props) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [sources, setSources] = useState<SourceStatus[]>([]);
  const [added, setAdded] = useState(0);
  const [recommended, setRecommended] = useState(0);
  const [lowerRanked, setLowerRanked] = useState(0);
  const [error, setError] = useState('');
  const cancelledRef = useRef(false);
  const spinner = useSpinner(phase === 'loading' || phase === 'scanning');

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

  const sourceLines = sources
    .map((s) => {
      const icon = s.state === 'done' ? '✓' : s.state === 'error' ? '✗' : spinner;
      const detail =
        s.state === 'done' ? `${s.count} jobs` : s.state === 'running' ? 'scanning…' : '';
      return `${icon} ${s.name.padEnd(14)} ${detail}`;
    })
    .join('\n');

  return (
    <box flexDirection="column" width={appWidth} paddingX={1}>
      {phase === 'loading' && (
        <box border borderColor="#f5c542" padding={1} width={panelWidth} marginTop={1}>
          <text fg="#f5c542" content={`${spinner} Loading profile…`} />
        </box>
      )}

      {phase === 'scanning' && (
        <box
          title="Scanning Sources"
          border
          borderColor="#f5c542"
          padding={1}
          width={panelWidth}
          marginTop={1}
          flexDirection="column"
        >
          <text content={sourceLines || ' '} />
          <text fg="#868e96" content="esc to cancel" />
        </box>
      )}

      {phase === 'error' && (
        <box
          title="Scan Failed"
          border
          borderColor="#ff6b6b"
          padding={1}
          width={panelWidth}
          marginTop={1}
          flexDirection="column"
        >
          <text fg="#ff6b6b" content={error} />
          <text fg="#868e96" content="enter or esc to go back" />
        </box>
      )}

      {phase === 'done' && (
        <box
          title="Scan Complete"
          border
          borderColor="#57cc99"
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
          <text fg="#868e96" content={`${added} total jobs added to Pending`} />
          <text fg="#868e96" content="enter or esc to go back" />
        </box>
      )}

      <box flexDirection="row" columnGap={1} position="absolute" bottom={0}>
        <text fg="#7aa2f7" content="esc=back" />
        <text fg="#868e96" content="|" />
        <text fg="#7aa2f7" content="1-3=tabs" />
        <text fg="#868e96" content="|" />
        <text fg="#7aa2f7" content="q=quit" />
      </box>
    </box>
  );
}
