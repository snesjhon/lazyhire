/** @jsxImportSource @opentui/react */
import { useKeyboard } from '@opentui/react';
import type {
  InputRenderable,
  SelectOption,
  TextareaOptions,
  TextareaRenderable,
} from '@opentui/core';
import { useEffect, useRef, useState } from 'react';
import { JOB_STATUSES, type Job, type JobStatus } from '../types.js';

export type JobActionView =
  | 'menu'
  | 'edit-company'
  | 'edit-role'
  | 'edit-url'
  | 'edit-notes'
  | 'edit-jd'
  | 'status'
  | 'delete'
  | 'generate-cv';

const TRANSPARENT = 'transparent';
const TEXTAREA_SUBMIT_KEY_BINDINGS: NonNullable<TextareaOptions['keyBindings']> = [
  { name: 'o', ctrl: true, action: 'submit' },
];
type GenerateCvState =
  | { step: 'editing' }
  | { step: 'submitting' }
  | { step: 'success'; pdfPath: string | null }
  | { step: 'error'; message: string };

interface Props {
  job: Job;
  width: number;
  height: number;
  initialView: JobActionView;
  onClose: () => void;
  onStartAnswer: () => void;
  onEvaluate: () => void;
  onOpenLink: () => void;
  onOpenCv: () => void;
  onSaveMetadata: (
    patch: Partial<Pick<Job, 'company' | 'role' | 'url' | 'notes'>>,
  ) => void;
  onSaveEditJd: (jd: string) => void;
  onSaveStatus: (status: JobStatus) => void;
  onDelete: () => void;
  onGenerateCv: (guidance: string) => Promise<Job>;
}

export default function JobActionWorkspace({
  job,
  width,
  height,
  initialView,
  onClose,
  onStartAnswer,
  onEvaluate,
  onOpenLink,
  onOpenCv,
  onSaveMetadata,
  onSaveEditJd,
  onSaveStatus,
  onDelete,
  onGenerateCv,
}: Props) {
  const [view, setView] = useState<JobActionView>(initialView);
  const [metadataDraft, setMetadataDraft] = useState('');
  const [editJdDraft, setEditJdDraft] = useState(job.jd);
  const [cvGuidance, setCvGuidance] = useState('');
  const [generateCvState, setGenerateCvState] = useState<GenerateCvState>({
    step: 'editing',
  });

  const metadataInputRef = useRef<InputRenderable>(null);
  const editJdInputRef = useRef<TextareaRenderable>(null);
  const guidanceInputRef = useRef<TextareaRenderable>(null);

  const isTextInputView =
    view === 'edit-company' ||
    view === 'edit-role' ||
    view === 'edit-url' ||
    view === 'edit-notes';
  const isTextAreaView = view === 'edit-jd' || view === 'generate-cv';

  useEffect(() => {
    setView(initialView);
    setEditJdDraft(job.jd);
    setCvGuidance('');
    setGenerateCvState({ step: 'editing' });
    if (initialView === 'edit-company') setMetadataDraft(job.company);
    if (initialView === 'edit-role') setMetadataDraft(job.role);
    if (initialView === 'edit-url') setMetadataDraft(job.url);
    if (initialView === 'edit-notes') setMetadataDraft(job.notes);
  }, [initialView, job.company, job.id, job.jd, job.notes, job.role, job.url]);

  useEffect(() => {
    if (view === 'edit-company') {
      setMetadataDraft(job.company);
      metadataInputRef.current?.focus();
    }
    if (view === 'edit-role') {
      setMetadataDraft(job.role);
      metadataInputRef.current?.focus();
    }
    if (view === 'edit-url') {
      setMetadataDraft(job.url);
      metadataInputRef.current?.focus();
    }
    if (view === 'edit-notes') {
      setMetadataDraft(job.notes);
      metadataInputRef.current?.focus();
    }
    if (view === 'edit-jd') {
      setEditJdDraft(job.jd);
      editJdInputRef.current?.focus();
    }
    if (view === 'generate-cv') {
      if (generateCvState.step === 'editing') {
        setCvGuidance('');
        guidanceInputRef.current?.focus();
      }
    }
  }, [generateCvState.step, job.company, job.jd, job.notes, job.role, job.url, view]);

  function saveMetadata() {
    const value = metadataDraft.trim();
    if (view === 'edit-company') onSaveMetadata({ company: value });
    if (view === 'edit-role') onSaveMetadata({ role: value });
    if (view === 'edit-url') onSaveMetadata({ url: value });
    if (view === 'edit-notes') onSaveMetadata({ notes: value });
    setView('menu');
  }

  const menuOptions: SelectOption[] = [
    {
      name: 'Answer question',
      description: 'Open the answer workspace for this job',
      value: 'answer',
    },
    {
      name: job.score === null ? 'Evaluate job' : 'Re-evaluate job',
      description: 'Score the role against your profile',
      value: 'evaluate',
    },
    {
      name: 'Generate CV',
      description: 'Create a tailored PDF for this role',
      value: 'generate-cv',
    },
    {
      name: 'Edit company',
      description: job.company || 'Unknown Company',
      value: 'edit-company',
    },
    {
      name: 'Edit role',
      description: job.role || 'Untitled Role',
      value: 'edit-role',
    },
    {
      name: 'Edit URL',
      description: job.url || 'No job URL saved',
      value: 'edit-url',
    },
    {
      name: 'Edit notes',
      description: job.notes || 'No notes saved',
      value: 'edit-notes',
    },
    {
      name: 'Edit job description',
      description: 'Update the saved JD text',
      value: 'edit-jd',
    },
    {
      name: 'Update status',
      description: `Current: ${job.status}`,
      value: 'status',
    },
    ...(job.pdfPath
      ? [
          {
            name: 'Open generated CV',
            description: job.pdfPath,
            value: 'open-cv',
          },
        ]
      : []),
    {
      name: 'Open job link',
      description: job.url || 'No job URL saved',
      value: 'open-link',
    },
    {
      name: 'Delete job',
      description: `Remove #${job.id} from the queue`,
      value: 'delete',
    },
    {
      name: 'Back to detail',
      description: 'Close actions and return to job detail',
      value: 'close',
    },
  ];

  useKeyboard((key) => {
    if (key.name !== 'escape') return;
    if (view === 'generate-cv' && generateCvState.step === 'submitting') return;
    if (view === 'menu') onClose();
    else {
      setGenerateCvState({ step: 'editing' });
      setView('menu');
    }
  });

  return (
    <box flexDirection="column" overflow="hidden">
      <text
        fg="#868e96"
        content={
          view === 'menu'
            ? `Actions for #${job.id}. Enter to run, esc to return.`
            : view === 'generate-cv' && generateCvState.step === 'editing'
              ? 'ctrl-o=generate · esc=back'
              : generateCvState.step === 'submitting'
                ? 'Generating CV...'
                : 'esc=back'
        }
      />

      <box marginTop={1} height={Math.max(6, height - 4)} overflow="hidden">
        {view === 'menu' ? (
          <select
            height={Math.max(6, height - 4)}
            width={Math.max(20, width)}
            focused
            options={menuOptions}
            showDescription
            itemSpacing={1}
            backgroundColor={TRANSPARENT}
            focusedBackgroundColor={TRANSPARENT}
            selectedBackgroundColor={TRANSPARENT}
            selectedTextColor="#4cc9f0"
            selectedDescriptionColor="#868e96"
            onSelect={(_, option) => {
              const value = String(option?.value ?? '');
              if (value === 'answer') onStartAnswer();
              if (value === 'evaluate') onEvaluate();
              if (value === 'generate-cv') setView('generate-cv');
              if (value === 'edit-company') setView('edit-company');
              if (value === 'edit-role') setView('edit-role');
              if (value === 'edit-url') setView('edit-url');
              if (value === 'edit-notes') setView('edit-notes');
              if (value === 'edit-jd') setView('edit-jd');
              if (value === 'status') setView('status');
              if (value === 'open-cv') onOpenCv();
              if (value === 'open-link') onOpenLink();
              if (value === 'delete') setView('delete');
              if (value === 'close') onClose();
            }}
          />
        ) : null}

        {isTextInputView ? (
          <box flexDirection="column" width={Math.max(20, width)}>
            <text
              fg="#868e96"
              content={
                view === 'edit-company'
                  ? 'Company'
                  : view === 'edit-role'
                    ? 'Role / title'
                    : view === 'edit-url'
                      ? 'URL'
                      : 'Notes'
              }
            />
            <input
              ref={metadataInputRef}
              value={metadataDraft}
              onInput={setMetadataDraft}
              onSubmit={() => saveMetadata()}
              focused
            />
          </box>
        ) : null}

        {view === 'edit-jd' ? (
          <textarea
            ref={editJdInputRef}
            height={Math.max(6, height - 5)}
            initialValue={editJdDraft}
            placeholder="Edit job description."
            keyBindings={TEXTAREA_SUBMIT_KEY_BINDINGS}
            onContentChange={() => setEditJdDraft(editJdInputRef.current?.plainText ?? '')}
            onSubmit={() => {
              onSaveEditJd(editJdInputRef.current?.plainText.trim() ?? '');
              setView('menu');
            }}
            focused
          />
        ) : null}

        {view === 'generate-cv' ? (
          generateCvState.step === 'editing' ? (
            <textarea
              ref={guidanceInputRef}
              height={Math.max(6, height - 5)}
              initialValue={cvGuidance}
              placeholder="Optional tailoring guidance."
              keyBindings={TEXTAREA_SUBMIT_KEY_BINDINGS}
              onContentChange={() => setCvGuidance(guidanceInputRef.current?.plainText ?? '')}
              onSubmit={async () => {
                setGenerateCvState({ step: 'submitting' });
                try {
                  const updated = await onGenerateCv(
                    guidanceInputRef.current?.plainText ?? '',
                  );
                  setGenerateCvState({
                    step: 'success',
                    pdfPath: updated.pdfPath,
                  });
                } catch (error) {
                  setGenerateCvState({
                    step: 'error',
                    message: `CV generation failed: ${String(error)}`,
                  });
                }
              }}
              focused
            />
          ) : generateCvState.step === 'submitting' ? (
            <box
              flexDirection="column"
              justifyContent="center"
              height={Math.max(6, height - 5)}
            >
              <text fg="#f5c542" content={`Generating CV for #${job.id}...`} />
              <text
                fg="#868e96"
                content="Stay on this screen. This will return with actions when it finishes."
              />
            </box>
          ) : generateCvState.step === 'success' ? (
            <select
              height={Math.max(6, height - 4)}
              width={Math.max(20, width)}
              focused
              options={[
                {
                  name: 'Open CV',
                  description:
                    generateCvState.pdfPath ?? 'Generated CV is ready to open',
                  value: 'open-cv',
                },
                {
                  name: 'Back to detail',
                  description: 'Close actions and return to the job detail view',
                  value: 'back',
                },
              ]}
              backgroundColor={TRANSPARENT}
              focusedBackgroundColor={TRANSPARENT}
              selectedBackgroundColor={TRANSPARENT}
              onSelect={(_, option) => {
                if (option?.value === 'open-cv') onOpenCv();
                if (option?.value === 'back') onClose();
              }}
            />
          ) : (
            <select
              height={Math.max(6, height - 4)}
              width={Math.max(20, width)}
              focused
              options={[
                {
                  name: 'Try again',
                  description: generateCvState.message,
                  value: 'retry',
                },
                {
                  name: 'Back to actions',
                  description: 'Return without generating a CV',
                  value: 'back',
                },
              ]}
              backgroundColor={TRANSPARENT}
              focusedBackgroundColor={TRANSPARENT}
              selectedBackgroundColor={TRANSPARENT}
              onSelect={(_, option) => {
                if (option?.value === 'retry') setGenerateCvState({ step: 'editing' });
                if (option?.value === 'back') {
                  setGenerateCvState({ step: 'editing' });
                  setView('menu');
                }
              }}
            />
          )
        ) : null}

        {view === 'status' ? (
          <select
            height={Math.max(6, height - 4)}
            width={Math.max(20, width)}
            focused
            options={JOB_STATUSES.map((status) => ({
              name: status,
              description: `Set #${job.id} to ${status}`,
              value: status,
            }))}
            selectedIndex={JOB_STATUSES.indexOf(job.status)}
            backgroundColor={TRANSPARENT}
            focusedBackgroundColor={TRANSPARENT}
            selectedBackgroundColor={TRANSPARENT}
            onSelect={(_, option) => {
              const status = option?.value as JobStatus | undefined;
              if (!status) return;
              onSaveStatus(status);
              setView('menu');
            }}
          />
        ) : null}

        {view === 'delete' ? (
          <select
            height={4}
            width={Math.max(20, width)}
            focused
            options={[
              {
                name: `Delete #${job.id}`,
                description: `${job.company || 'Unknown'} · ${job.role || 'Untitled'}`,
                value: 'yes',
              },
              {
                name: 'Cancel',
                description: 'Keep this job',
                value: 'no',
              },
            ]}
            backgroundColor={TRANSPARENT}
            focusedBackgroundColor={TRANSPARENT}
            selectedBackgroundColor={TRANSPARENT}
            onSelect={(_, option) => {
              if (option?.value === 'yes') onDelete();
              else setView('menu');
            }}
          />
        ) : null}
      </box>
    </box>
  );
}
