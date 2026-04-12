/** @jsxImportSource @opentui/react */
import { useKeyboard } from '@opentui/react';
import type {
  InputRenderable,
  SelectOption,
  TextareaOptions,
  TextareaRenderable,
} from '@opentui/core';
import { useEffect, useRef, useState } from 'react';
import type { UiTheme } from '../../../shared/ui/theme.js';
import { JOB_STATUSES, type Job, type JobStatus } from '../../../shared/models/types.js';
import {
  CV_BULLET_LENGTH_PRESETS,
  DEFAULT_CV_BULLET_WORD_RANGE,
  type CvBulletWordRange,
} from '../services/generate.js';

export type JobActionView =
  | 'menu'
  | 'edit-company'
  | 'edit-role'
  | 'edit-url'
  | 'edit-notes'
  | 'edit-jd'
  | 'status'
  | 'delete'
  | 'generate-cv'
  | 'generate-cover-letter';

const TEXTAREA_SUBMIT_KEY_BINDINGS: NonNullable<TextareaOptions['keyBindings']> = [
  { name: 'o', ctrl: true, action: 'submit' },
];
type GenerateCvState =
  | { step: 'editing'; phase: 'preset' | 'guidance' }
  | { step: 'submitting' }
  | { step: 'success'; pdfPath: string | null }
  | { step: 'error'; message: string };

type GenerateArtifact = 'cv' | 'cover-letter';

interface Props {
  theme: UiTheme;
  job: Job;
  width: number;
  height: number;
  initialView: JobActionView;
  onClose: () => void;
  onStartAnswer: () => void;
  onEvaluate: () => void;
  onOpenLink: () => void;
  onOpenCv: () => void;
  onOpenCoverLetter: () => void;
  onSaveMetadata: (
    patch: Partial<Pick<Job, 'company' | 'role' | 'url' | 'notes'>>,
  ) => void;
  onSaveEditJd: (jd: string) => void;
  onSaveStatus: (status: JobStatus) => void;
  onDelete: () => void;
  onGenerateCv: (guidance: string, bulletWordRange: CvBulletWordRange) => Promise<Job>;
  onGenerateCoverLetter: (guidance: string) => Promise<Job>;
}

export default function JobActionWorkspace({
  theme,
  job,
  width,
  height,
  initialView,
  onClose,
  onStartAnswer,
  onEvaluate,
  onOpenLink,
  onOpenCv,
  onOpenCoverLetter,
  onSaveMetadata,
  onSaveEditJd,
  onSaveStatus,
  onDelete,
  onGenerateCv,
  onGenerateCoverLetter,
}: Props) {
  const [view, setView] = useState<JobActionView>(initialView);
  const [metadataDraft, setMetadataDraft] = useState('');
  const [editJdDraft, setEditJdDraft] = useState(job.jd);
  const [cvGuidance, setCvGuidance] = useState('');
  const [cvBulletWordRange, setCvBulletWordRange] = useState<CvBulletWordRange>(
    DEFAULT_CV_BULLET_WORD_RANGE,
  );
  const [selectedCvPresetId, setSelectedCvPresetId] = useState<string>('balanced');
  const [generateCvState, setGenerateCvState] = useState<GenerateCvState>({
    step: 'editing',
    phase: 'preset',
  });

  const metadataInputRef = useRef<InputRenderable>(null);
  const editJdInputRef = useRef<TextareaRenderable>(null);
  const guidanceInputRef = useRef<TextareaRenderable>(null);

  const isTextInputView =
    view === 'edit-company' ||
    view === 'edit-role' ||
    view === 'edit-url' ||
    view === 'edit-notes';
  const generateArtifact: GenerateArtifact | null =
    view === 'generate-cv'
      ? 'cv'
      : view === 'generate-cover-letter'
        ? 'cover-letter'
        : null;

  useEffect(() => {
    setView(initialView);
    setEditJdDraft(job.jd);
    setCvGuidance('');
    setCvBulletWordRange(DEFAULT_CV_BULLET_WORD_RANGE);
    setSelectedCvPresetId('balanced');
    setGenerateCvState({
      step: 'editing',
      phase: initialView === 'generate-cover-letter' ? 'guidance' : 'preset',
    });
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
    if (view === 'generate-cv' || view === 'generate-cover-letter') {
      if (generateCvState.step === 'editing' && generateCvState.phase === 'guidance') {
        setCvGuidance('');
        guidanceInputRef.current?.focus();
      }
    }
  }, [
    generateCvState.step,
    generateCvState.step === 'editing' ? generateCvState.phase : null,
    job.company,
    job.jd,
    job.notes,
    job.role,
    job.url,
    view,
  ]);

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
      name: 'Generate cover letter',
      description: 'Create a tailored two-paragraph cover letter PDF',
      value: 'generate-cover-letter',
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
    ...(job.coverLetterPdfPath
      ? [
          {
            name: 'Open generated cover letter',
            description: job.coverLetterPdfPath,
            value: 'open-cover-letter',
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
    if (
      (view === 'generate-cv' || view === 'generate-cover-letter') &&
      generateCvState.step === 'submitting'
    )
      return;
    if (view === 'menu') onClose();
    else if (
      view === 'generate-cv' &&
      generateCvState.step === 'editing' &&
      generateCvState.phase === 'guidance'
    ) {
      setCvGuidance('');
      setGenerateCvState({ step: 'editing', phase: 'preset' });
    }
    else {
      setGenerateCvState({
        step: 'editing',
        phase: view === 'generate-cover-letter' ? 'guidance' : 'preset',
      });
      setView('menu');
    }
  });

  return (
    <box flexDirection="column" overflow="hidden">
      <text
        fg={theme.muted}
        content={
          view === 'menu'
            ? `Actions for #${job.id}. Enter to run, esc to return.`
            : (view === 'generate-cv' || view === 'generate-cover-letter') &&
                generateCvState.step === 'editing'
              ? generateArtifact === 'cv' && generateCvState.phase === 'preset'
                ? 'enter=choose range, esc=back'
                : 'ctrl-o=generate, esc=back'
              : generateCvState.step === 'submitting'
                ? generateArtifact === 'cover-letter'
                  ? 'Generating cover letter...'
                  : 'Generating CV...'
                : 'esc=back'
        }
      />

      <box height={Math.max(6, height - 2)} overflow="hidden">
        {view === 'menu' ? (
          <select
            height={Math.max(6, height - 2)}
            width={Math.max(20, width)}
            focused
            options={menuOptions}
            showDescription
            itemSpacing={0}
            backgroundColor={theme.transparent}
            focusedBackgroundColor={theme.transparent}
            selectedBackgroundColor={theme.transparent}
            selectedTextColor={theme.brand}
            selectedDescriptionColor={theme.muted}
            onSelect={(_, option) => {
              const value = String(option?.value ?? '');
              if (value === 'answer') onStartAnswer();
              if (value === 'evaluate') onEvaluate();
              if (value === 'generate-cv') setView('generate-cv');
              if (value === 'generate-cover-letter') setView('generate-cover-letter');
              if (value === 'edit-company') setView('edit-company');
              if (value === 'edit-role') setView('edit-role');
              if (value === 'edit-url') setView('edit-url');
              if (value === 'edit-notes') setView('edit-notes');
              if (value === 'edit-jd') setView('edit-jd');
              if (value === 'status') setView('status');
              if (value === 'open-cv') onOpenCv();
              if (value === 'open-cover-letter') onOpenCoverLetter();
              if (value === 'open-link') onOpenLink();
              if (value === 'delete') setView('delete');
              if (value === 'close') onClose();
            }}
          />
        ) : null}

        {isTextInputView ? (
          <box flexDirection="column" width={Math.max(20, width)}>
            <text
              fg={theme.muted}
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

        {view === 'generate-cv' || view === 'generate-cover-letter' ? (
          generateCvState.step === 'editing' ? (
            generateArtifact === 'cv' && generateCvState.phase === 'preset' ? (
              <select
                height={Math.max(6, height - 2)}
                width={Math.max(20, width)}
                focused
                options={CV_BULLET_LENGTH_PRESETS.map((preset) => ({
                  name: preset.name,
                  description: preset.description,
                  value: preset.id,
                }))}
                selectedIndex={CV_BULLET_LENGTH_PRESETS.findIndex(
                  (preset) => preset.id === selectedCvPresetId,
                )}
                showDescription
                itemSpacing={0}
                backgroundColor={theme.transparent}
                focusedBackgroundColor={theme.transparent}
                selectedBackgroundColor={theme.transparent}
                selectedTextColor={theme.brand}
                selectedDescriptionColor={theme.muted}
                onChange={(_, option) => {
                  const preset = CV_BULLET_LENGTH_PRESETS.find(
                    (entry) => entry.id === option?.value,
                  );
                  if (!preset) return;
                  setSelectedCvPresetId(preset.id);
                  setCvBulletWordRange(preset.range);
                }}
                onSelect={(_, option) => {
                  const preset = CV_BULLET_LENGTH_PRESETS.find(
                    (entry) => entry.id === option?.value,
                  );
                  if (!preset) return;
                  setSelectedCvPresetId(preset.id);
                  setCvBulletWordRange(preset.range);
                  setGenerateCvState({ step: 'editing', phase: 'guidance' });
                }}
              />
            ) : (
              <box flexDirection="column" width={Math.max(20, width)} rowGap={1}>
                {generateArtifact === 'cv' ? (
                  <text
                    fg={theme.muted}
                    content={`Bullet length: ${cvBulletWordRange.min}-${cvBulletWordRange.max} words. esc=change range.`}
                  />
                ) : null}
                <textarea
                  ref={guidanceInputRef}
                  height={Math.max(6, height - (generateArtifact === 'cv' ? 7 : 5))}
                  initialValue={cvGuidance}
                  placeholder={
                    generateArtifact === 'cover-letter'
                      ? 'Optional cover letter guidance.'
                      : 'Optional tailoring guidance.'
                  }
                  keyBindings={TEXTAREA_SUBMIT_KEY_BINDINGS}
                  onContentChange={() => setCvGuidance(guidanceInputRef.current?.plainText ?? '')}
                  onSubmit={async () => {
                    setGenerateCvState({ step: 'submitting' });
                    try {
                      const updated = generateArtifact === 'cover-letter'
                        ? await onGenerateCoverLetter(guidanceInputRef.current?.plainText ?? '')
                        : await onGenerateCv(
                            guidanceInputRef.current?.plainText ?? '',
                            cvBulletWordRange,
                          );
                      setGenerateCvState({
                        step: 'success',
                        pdfPath:
                          generateArtifact === 'cover-letter'
                            ? updated.coverLetterPdfPath
                            : updated.pdfPath,
                      });
                    } catch (error) {
                      setGenerateCvState({
                        step: 'error',
                        message:
                          generateArtifact === 'cover-letter'
                            ? `Cover letter generation failed: ${String(error)}`
                            : `CV generation failed: ${String(error)}`,
                      });
                    }
                  }}
                  focused
                />
              </box>
            )
          ) : generateCvState.step === 'submitting' ? (
            <box
              flexDirection="column"
              justifyContent="center"
              height={Math.max(6, height - 5)}
            >
              <text
                fg={theme.warning}
                content={
                  generateArtifact === 'cover-letter'
                    ? `Generating cover letter for #${job.id}...`
                    : `Generating CV for #${job.id}...`
                }
              />
              <text
                fg={theme.muted}
                content="Stay on this screen. This will return with actions when it finishes."
              />
            </box>
          ) : generateCvState.step === 'success' ? (
            <select
              height={Math.max(6, height - 2)}
              width={Math.max(20, width)}
              focused
              options={[
                {
                  name: generateArtifact === 'cover-letter' ? 'Open cover letter' : 'Open CV',
                  description:
                    generateCvState.pdfPath ??
                    (generateArtifact === 'cover-letter'
                      ? 'Generated cover letter is ready to open'
                      : 'Generated CV is ready to open'),
                  value: generateArtifact === 'cover-letter' ? 'open-cover-letter' : 'open-cv',
                },
                {
                  name: 'Back to detail',
                  description: 'Close actions and return to the job detail view',
                  value: 'back',
                },
              ]}
              backgroundColor={theme.transparent}
              focusedBackgroundColor={theme.transparent}
              selectedBackgroundColor={theme.transparent}
              onSelect={(_, option) => {
                if (option?.value === 'open-cv') onOpenCv();
                if (option?.value === 'open-cover-letter') onOpenCoverLetter();
                if (option?.value === 'back') onClose();
              }}
            />
          ) : (
            <select
              height={Math.max(6, height - 2)}
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
                  description:
                    generateArtifact === 'cover-letter'
                      ? 'Return without generating a cover letter'
                      : 'Return without generating a CV',
                  value: 'back',
                },
              ]}
              backgroundColor={theme.transparent}
              focusedBackgroundColor={theme.transparent}
              selectedBackgroundColor={theme.transparent}
              onSelect={(_, option) => {
                if (option?.value === 'retry') {
                  setGenerateCvState({
                    step: 'editing',
                    phase: generateArtifact === 'cover-letter' ? 'guidance' : 'preset',
                  });
                }
                if (option?.value === 'back') {
                  setGenerateCvState({
                    step: 'editing',
                    phase: generateArtifact === 'cover-letter' ? 'guidance' : 'preset',
                  });
                  setView('menu');
                }
              }}
            />
          )
        ) : null}

        {view === 'status' ? (
          <select
            height={Math.max(6, height - 2)}
            width={Math.max(20, width)}
            focused
            options={JOB_STATUSES.map((status) => ({
              name: status,
              description: `Set #${job.id} to ${status}`,
              value: status,
            }))}
            selectedIndex={JOB_STATUSES.indexOf(job.status)}
            backgroundColor={theme.transparent}
            focusedBackgroundColor={theme.transparent}
            selectedBackgroundColor={theme.transparent}
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
            backgroundColor={theme.transparent}
            focusedBackgroundColor={theme.transparent}
            selectedBackgroundColor={theme.transparent}
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
