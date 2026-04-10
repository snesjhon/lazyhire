/** @jsxImportSource @opentui/react */
import { type InputRenderable, type SelectOption, type TextareaRenderable } from '@opentui/core';
import { useEffect, useRef, useState } from 'react';
import type { Job, JobStatus } from '../types.js';
import { JOB_STATUSES } from '../types.js';
import type { JobAction, Overlay } from './types.js';

const TRANSPARENT_BACKGROUND = 'transparent';

interface Props {
  overlay: Overlay;
  selectedJob: Job | null;
  actionOptions: SelectOption[];
  onAction: (action: JobAction) => void;
  onAddUrl: (url: string) => Promise<void>;
  onAddJd: (jd: string) => Promise<void>;
  onOverlayChange: (overlay: Overlay) => void;
  onSaveEditJd: (jobId: string, jd: string) => void;
  onSaveStatus: (jobId: string, status: JobStatus) => void;
  onConfirmDelete: (jobId: string) => void;
  onGenerateCv: (guidance: string) => Promise<void>;
  onClose: () => void;
}

export default function DashboardOverlay({
  overlay,
  selectedJob,
  actionOptions,
  onAction,
  onAddUrl,
  onAddJd,
  onOverlayChange,
  onSaveEditJd,
  onSaveStatus,
  onConfirmDelete,
  onGenerateCv,
  onClose,
}: Props) {
  const [addUrl, setAddUrl] = useState('');
  const [addJd, setAddJd] = useState('');
  const [editJd, setEditJd] = useState('');
  const [cvGuidance, setCvGuidance] = useState('');

  const urlInput = useRef<InputRenderable>(null);
  const jdInput = useRef<TextareaRenderable>(null);
  const editJdInput = useRef<TextareaRenderable>(null);
  const guidanceInput = useRef<TextareaRenderable>(null);

  useEffect(() => {
    if (overlay === 'add-url') { setAddUrl(''); urlInput.current?.focus(); }
    if (overlay === 'add-jd') { setAddJd(''); jdInput.current?.focus(); }
    if (overlay === 'edit-jd') {
      setEditJd(selectedJob?.jd ?? '');
      editJdInput.current?.focus();
    }
    if (overlay === 'generate-cv') { setCvGuidance(''); guidanceInput.current?.focus(); }
  }, [overlay]);

  return (
    <box
      title="Action"
      border
      borderColor="#f5c542"
      marginTop={1}
      padding={1}
      height={9}
      flexDirection="column"
    >
      {overlay === 'actions' && (
        <select
          height={7}
          focused
          options={actionOptions}
          showDescription
          backgroundColor={TRANSPARENT_BACKGROUND}
          focusedBackgroundColor={TRANSPARENT_BACKGROUND}
          selectedBackgroundColor={TRANSPARENT_BACKGROUND}
          onSelect={(_, option) =>
            option?.value && onAction(option.value as JobAction)
          }
        />
      )}

      {overlay === 'add' && (
        <select
          height={5}
          focused
          options={[
            {
              name: 'Paste job link',
              description: 'Hydrate and evaluate a URL',
              value: 'add-url',
            },
            {
              name: 'Paste job description',
              description: 'Save a summary and evaluate it',
              value: 'add-jd',
            },
            {
              name: 'Cancel',
              description: 'Close this menu',
              value: 'none',
            },
          ]}
          backgroundColor={TRANSPARENT_BACKGROUND}
          focusedBackgroundColor={TRANSPARENT_BACKGROUND}
          selectedBackgroundColor={TRANSPARENT_BACKGROUND}
          onSelect={(_, option) =>
            onOverlayChange((option?.value as Overlay | undefined) ?? 'none')
          }
        />
      )}

      {overlay === 'add-url' && (
        <box flexDirection="column">
          <text fg="#868e96" content="Job URL" />
          <input
            ref={urlInput}
            value={addUrl}
            placeholder="https://company.example/jobs/123"
            onInput={setAddUrl}
            onSubmit={(value: unknown) => {
              if (typeof value === 'string') void onAddUrl(value);
            }}
            focused
          />
        </box>
      )}

      {overlay === 'add-jd' && (
        <textarea
          ref={jdInput}
          height={7}
          initialValue={addJd}
          placeholder="Paste the job description. Ctrl+Enter submits."
          keyBindings={[{ name: 'return', ctrl: true, action: 'submit' }]}
          onContentChange={() => setAddJd(jdInput.current?.plainText ?? '')}
          onSubmit={() => void onAddJd(jdInput.current?.plainText ?? '')}
          focused
        />
      )}

      {overlay === 'edit-jd' && selectedJob && (
        <textarea
          ref={editJdInput}
          height={7}
          initialValue={editJd}
          placeholder="Edit job description. Ctrl+Enter saves."
          keyBindings={[{ name: 'return', ctrl: true, action: 'submit' }]}
          onContentChange={() => setEditJd(editJdInput.current?.plainText ?? '')}
          onSubmit={() =>
            onSaveEditJd(
              selectedJob.id,
              editJdInput.current?.plainText.trim() ?? '',
            )
          }
          focused
        />
      )}

      {overlay === 'status' && selectedJob && (
        <select
          height={7}
          focused
          options={JOB_STATUSES.map((status) => ({
            name: status,
            description: `Set #${selectedJob.id} to ${status}`,
            value: status,
          }))}
          selectedIndex={JOB_STATUSES.indexOf(selectedJob.status)}
          backgroundColor={TRANSPARENT_BACKGROUND}
          focusedBackgroundColor={TRANSPARENT_BACKGROUND}
          selectedBackgroundColor={TRANSPARENT_BACKGROUND}
          onSelect={(_, option) => {
            const status = option?.value as JobStatus | undefined;
            if (status) onSaveStatus(selectedJob.id, status);
          }}
        />
      )}

      {overlay === 'delete' && selectedJob && (
        <select
          height={4}
          focused
          options={[
            {
              name: `Delete #${selectedJob.id}`,
              description: `${selectedJob.company || 'Unknown'} · ${selectedJob.role || 'Untitled'}`,
              value: 'yes',
            },
            { name: 'Cancel', description: 'Keep this job', value: 'no' },
          ]}
          backgroundColor={TRANSPARENT_BACKGROUND}
          focusedBackgroundColor={TRANSPARENT_BACKGROUND}
          selectedBackgroundColor={TRANSPARENT_BACKGROUND}
          onSelect={(_, option) => {
            if (option?.value === 'yes') onConfirmDelete(selectedJob.id);
            else onClose();
          }}
        />
      )}

      {overlay === 'generate-cv' && selectedJob && (
        <textarea
          ref={guidanceInput}
          height={7}
          initialValue={cvGuidance}
          placeholder="Optional tailoring guidance. Ctrl+Enter submits."
          keyBindings={[{ name: 'return', ctrl: true, action: 'submit' }]}
          onContentChange={() => setCvGuidance(guidanceInput.current?.plainText ?? '')}
          onSubmit={() =>
            void onGenerateCv(guidanceInput.current?.plainText ?? '')
          }
          focused
        />
      )}
    </box>
  );
}
