/** @jsxImportSource @opentui/react */
import { useKeyboard } from '@opentui/react';
import { useState } from 'react';
import { markActed, getBatchPending, loadNextBatch } from '../../scan/discover.js';
import { selectColors } from '../../../shared/ui/selectTheme.js';
import type { UiTheme } from '../../../shared/ui/theme.js';
import type { DiscoveredJob } from '../../../shared/models/types.js';
import { clip } from '../../../shared/lib/utils.js';

const PAGE_SIZE = 10;

interface Props {
  theme: UiTheme;
  width: number;
  height: number;
  onClose: () => void;
  onAddToQueue: (job: DiscoveredJob) => void;
  onOpen: (url: string) => void;
}

export default function DiscoveryChoicesPane({
  theme,
  width,
  height,
  onClose,
  onAddToQueue,
  onOpen,
}: Props) {
  const [pending, setPending] = useState<DiscoveredJob[]>(getBatchPending);
  const [page, setPage] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const totalPages = Math.max(1, Math.ceil(pending.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = pending.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  function removeItem(jobUrl: string) {
    setPending((prev) => {
      const next = prev.filter((j) => j.jobUrl !== jobUrl);
      const newTotalPages = Math.max(1, Math.ceil(next.length / PAGE_SIZE));
      const nextPage = Math.min(safePage, newTotalPages - 1);
      setPage(nextPage);
      const newPageItems = next.slice(nextPage * PAGE_SIZE, (nextPage + 1) * PAGE_SIZE);
      setSelectedIndex((i) => Math.min(i, Math.max(0, newPageItems.length - 1)));
      return next;
    });
  }

  function tryLoadNextBatch() {
    if (loadNextBatch()) {
      setPending(getBatchPending());
      setPage(0);
      setSelectedIndex(0);
    }
  }

  useKeyboard((key) => {
    if (key.name === 'escape') { onClose(); return; }

    if (pending.length === 0) {
      if (key.name === 'n') tryLoadNextBatch();
      return;
    }

    if (key.name === 'n') {
      if (safePage < totalPages - 1) {
        setPage(safePage + 1);
        setSelectedIndex(0);
      }
      return;
    }
    if (key.name === 'p') {
      if (safePage > 0) {
        setPage(safePage - 1);
        setSelectedIndex(0);
      }
      return;
    }

    if (key.name === 'j' || key.name === 'down')
      setSelectedIndex((i) => Math.min(i + 1, pageItems.length - 1));
    if (key.name === 'k' || key.name === 'up')
      setSelectedIndex((i) => Math.max(i - 1, 0));

    const selected = pageItems[selectedIndex];
    if (!selected) return;

    if (key.name === 'a' || key.name === 'return') {
      markActed(selected.jobUrl, 'added');
      onAddToQueue(selected);
      removeItem(selected.jobUrl);
    }
    if (key.name === 'x') {
      markActed(selected.jobUrl, 'passed');
      removeItem(selected.jobUrl);
    }
    if (key.name === 'o') {
      onOpen(selected.jobUrl);
    }
  });

  const companyWidth = Math.max(10, Math.floor((width - 4) * 0.35));
  const roleWidth = Math.max(12, width - companyWidth - 4);

  if (pending.length === 0) {
    return (
      <box flexDirection="column" width={width}>
        <text fg={theme.muted} content="All items acted on. Run a scan to discover more." marginBottom={1} />
        <text fg={theme.footer} content="esc=back" />
      </box>
    );
  }

  const options = pageItems.map((job) => ({
    name: `${clip(job.name, companyWidth).padEnd(companyWidth)} ${clip(job.jobTitle, roleWidth)}`,
    description: job.ats,
    value: job.jobUrl,
  }));

  const pageLabel = `page ${safePage + 1}/${totalPages}`;
  const countLabel = `${pending.length} pending`;

  return (
    <box flexDirection="column" width={width}>
      <box flexDirection="row" columnGap={1} marginBottom={1}>
        <text fg={theme.muted} content={countLabel} />
        <text fg={theme.muted} content="·" />
        <text fg={theme.muted} content={pageLabel} />
      </box>
      <select
        height={Math.max(4, height - 5)}
        width="100%"
        options={options}
        selectedIndex={selectedIndex}
        showDescription
        showScrollIndicator
        itemSpacing={1}
        {...selectColors(theme)}
        selectedTextColor={theme.brand}
        focused
        onChange={(idx) => setSelectedIndex(idx)}
      />
      <box flexDirection="row" columnGap={1} marginTop={1}>
        <text fg={theme.footer} content="a/<enter>=add" />
        <text fg={theme.muted} content="|" />
        <text fg={theme.footer} content="x=pass" />
        <text fg={theme.muted} content="|" />
        <text fg={theme.footer} content="o=open" />
        <text fg={theme.muted} content="|" />
        <text fg={theme.footer} content="p=prev · n=next" />
        <text fg={theme.muted} content="|" />
        <text fg={theme.footer} content="esc=back" />
      </box>
    </box>
  );
}
