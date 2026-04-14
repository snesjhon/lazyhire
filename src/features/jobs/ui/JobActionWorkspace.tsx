/** @jsxImportSource @opentui/react */
import { useKeyboard } from '@opentui/react';
import type {
  InputRenderable,
  SelectOption,
  TextareaOptions,
  TextareaRenderable,
} from '@opentui/core';
import { useEffect, useRef, useState } from 'react';
import { selectColors } from '../../../shared/ui/selectTheme.js';
import type { UiTheme } from '../../../shared/ui/theme.js';
import MultiStepIndicator from '../../../shared/ui/MultiStepIndicator.js';
import {
  JOB_STATUSES,
  type Job,
  type JobStatus,
} from '../../../shared/models/types.js';
import {
  CV_BULLET_LENGTH_PRESETS,
  CV_TEXT_SIZE_PRESETS,
  type CvBulletWordRange,
  type CvTextSizeScale,
} from '../services/generate.js';
import {
  COVER_LETTER_LENGTH_PRESETS,
  type CoverLetterTotalWordCount,
} from '../services/cover-letter.js';

export type JobActionView =
  | 'menu'
  | 'edit-job'
  | 'edit-company'
  | 'edit-role'
  | 'edit-url'
  | 'edit-notes'
  | 'edit-jd'
  | 'status'
  | 'delete'
  | 'generate-cv'
  | 'generate-cover-letter';

const TEXTAREA_SUBMIT_KEY_BINDINGS: NonNullable<
  TextareaOptions['keyBindings']
> = [{ name: 'o', ctrl: true, action: 'submit' }];
export type GenerateCvEditingPhase =
  | 'bullet-preset'
  | 'text-size-preset'
  | 'guidance';

export interface GenerateCvDraft {
  guidance: string;
  bulletWordRange: CvBulletWordRange;
  textSizeScale: CvTextSizeScale;
  selectedBulletPresetId: string;
  selectedTextSizePresetId: string;
  phase: GenerateCvEditingPhase;
}

export type GenerateCoverLetterEditingPhase = 'length-preset' | 'guidance';

export interface GenerateCoverLetterDraft {
  guidance: string;
  totalWordCount: CoverLetterTotalWordCount;
  selectedLengthPresetId: string;
  phase: GenerateCoverLetterEditingPhase;
}

type GenerateCvState =
  | { step: 'editing' }
  | { step: 'submitting' }
  | { step: 'success'; pdfPath: string | null }
  | { step: 'error'; message: string };

type GenerateArtifact = 'cv' | 'cover-letter';

function parentViewFor(view: JobActionView): JobActionView {
  if (
    view === 'edit-company' ||
    view === 'edit-role' ||
    view === 'edit-url' ||
    view === 'edit-notes' ||
    view === 'edit-jd'
  ) {
    return 'edit-job';
  }
  return 'menu';
}

interface Props {
  theme: UiTheme;
  job: Job;
  width: number;
  height: number;
  initialView: JobActionView;
  generateCvDraft: GenerateCvDraft;
  onGenerateCvDraftChange: (draft: GenerateCvDraft) => void;
  generateCoverLetterDraft: GenerateCoverLetterDraft;
  onGenerateCoverLetterDraftChange: (draft: GenerateCoverLetterDraft) => void;
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
  onGenerateCv: (
    guidance: string,
    bulletWordRange: CvBulletWordRange,
    textSizeScale: CvTextSizeScale,
  ) => Promise<Job>;
  onGenerateCoverLetter: (
    guidance: string,
    totalWordCount: CoverLetterTotalWordCount,
  ) => Promise<Job>;
}

export default function JobActionWorkspace({
  theme,
  job,
  width,
  height,
  initialView,
  generateCvDraft,
  onGenerateCvDraftChange,
  generateCoverLetterDraft,
  onGenerateCoverLetterDraftChange,
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
  const generateArtifact: GenerateArtifact | null =
    view === 'generate-cv'
      ? 'cv'
      : view === 'generate-cover-letter'
        ? 'cover-letter'
        : null;
  const currentCvPhase = generateCvDraft.phase;
  const currentCoverLetterPhase = generateCoverLetterDraft.phase;
  const selectedBulletPreset =
    CV_BULLET_LENGTH_PRESETS.find(
      (preset) => preset.id === generateCvDraft.selectedBulletPresetId,
    ) ?? CV_BULLET_LENGTH_PRESETS.find((preset) => preset.id === 'balanced')!;
  const selectedTextSizePreset =
    CV_TEXT_SIZE_PRESETS.find(
      (preset) => preset.id === generateCvDraft.selectedTextSizePresetId,
    ) ?? CV_TEXT_SIZE_PRESETS.find((preset) => preset.id === 'balanced')!;
  const selectedCoverLetterPreset =
    COVER_LETTER_LENGTH_PRESETS.find(
      (preset) => preset.id === generateCoverLetterDraft.selectedLengthPresetId,
    ) ??
    COVER_LETTER_LENGTH_PRESETS.find((preset) => preset.id === 'balanced')!;
  const generateCvSteps = [
    {
      label: 'Bullet length',
      summary: `${selectedBulletPreset.name} (${generateCvDraft.bulletWordRange.min}-${generateCvDraft.bulletWordRange.max} words)`,
    },
    {
      label: 'Text size',
      summary: `${selectedTextSizePreset.name} (${generateCvDraft.textSizeScale.bodyPt}pt base copy)`,
    },
    {
      label: 'Guidance',
      summary: generateCvDraft.guidance.trim()
        ? 'Custom notes added'
        : 'No extra notes',
    },
  ];
  const generateCoverLetterSteps = [
    {
      label: 'Total length',
      summary: `${selectedCoverLetterPreset.name} (${generateCoverLetterDraft.totalWordCount.target} words)`,
    },
    {
      label: 'Guidance',
      summary: generateCoverLetterDraft.guidance.trim()
        ? 'Custom notes added'
        : 'No extra notes',
    },
  ];

  function updateGenerateCvDraft(patch: Partial<GenerateCvDraft>) {
    onGenerateCvDraftChange({
      ...generateCvDraft,
      ...patch,
    });
  }

  function updateGenerateCoverLetterDraft(
    patch: Partial<GenerateCoverLetterDraft>,
  ) {
    onGenerateCoverLetterDraftChange({
      ...generateCoverLetterDraft,
      ...patch,
    });
  }

  useEffect(() => {
    setView(initialView);
    setEditJdDraft(job.jd);
    setGenerateCvState({
      step: 'editing',
    });
    if (initialView === 'edit-company') setMetadataDraft(job.company);
    if (initialView === 'edit-role') setMetadataDraft(job.role);
    if (initialView === 'edit-url') setMetadataDraft(job.url);
    if (initialView === 'edit-notes') setMetadataDraft(job.notes);
  }, [initialView, job.id]);

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
      if (
        generateCvState.step === 'editing' &&
        ((view === 'generate-cv' && currentCvPhase === 'guidance') ||
          (view === 'generate-cover-letter' &&
            currentCoverLetterPhase === 'guidance'))
      ) {
        guidanceInputRef.current?.focus();
      }
    }
  }, [
    currentCoverLetterPhase,
    currentCvPhase,
    generateCvState.step,
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
    setView(parentViewFor(view));
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
      description: 'Create a tailored 3-4 paragraph cover letter PDF',
      value: 'generate-cover-letter',
    },
    {
      name: 'Edit job',
      description: job.role || 'Company, role, link, notes, and JD',
      value: 'edit-job',
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
  ];

  const editJobOptions: SelectOption[] = [
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
      name: 'Back to actions',
      description: 'Return to the main action list',
      value: 'back',
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
      currentCvPhase === 'guidance'
    ) {
      updateGenerateCvDraft({ phase: 'text-size-preset' });
    } else if (
      view === 'generate-cv' &&
      generateCvState.step === 'editing' &&
      currentCvPhase === 'text-size-preset'
    ) {
      updateGenerateCvDraft({ phase: 'bullet-preset' });
    } else if (
      view === 'generate-cover-letter' &&
      generateCvState.step === 'editing' &&
      currentCoverLetterPhase === 'guidance'
    ) {
      updateGenerateCoverLetterDraft({ phase: 'length-preset' });
    } else {
      setGenerateCvState({ step: 'editing' });
      setView(parentViewFor(view));
    }
  });

  useKeyboard((key) => {
    if (view !== 'generate-cv' || generateCvState.step !== 'editing') return;
    if (key.name === '1') updateGenerateCvDraft({ phase: 'bullet-preset' });
    if (key.name === '2') updateGenerateCvDraft({ phase: 'text-size-preset' });
    if (key.name === '3') updateGenerateCvDraft({ phase: 'guidance' });
  });

  useKeyboard((key) => {
    if (view !== 'generate-cover-letter' || generateCvState.step !== 'editing')
      return;
    if (key.name === '1')
      updateGenerateCoverLetterDraft({ phase: 'length-preset' });
    if (key.name === '2') updateGenerateCoverLetterDraft({ phase: 'guidance' });
  });

  return (
    <box flexDirection="column" overflow="hidden">
      <text fg={theme.brand} marginBottom={1}>
        <strong>
          {view === 'menu'
            ? `Company: ${job.company}`
            : view === 'edit-job'
              ? `Job details for #${job.id}. Enter to edit, esc to return.`
              : (view === 'generate-cv' || view === 'generate-cover-letter') &&
                  generateCvState.step === 'editing'
                ? generateArtifact === 'cv' &&
                  (currentCvPhase === 'bullet-preset' ||
                    currentCvPhase === 'text-size-preset')
                  ? currentCvPhase === 'bullet-preset'
                    ? 'enter=choose bullet length, esc=back'
                    : 'enter=choose text size, esc=back'
                  : generateArtifact === 'cover-letter' &&
                      currentCoverLetterPhase === 'length-preset'
                    ? 'enter=choose total length, esc=back'
                    : generateArtifact === 'cv'
                      ? 'ctrl-o=generate, 1-3=jump between steps, esc=back'
                      : 'ctrl-o=generate, 1-2=jump between steps, esc=back'
                : generateCvState.step === 'submitting'
                  ? generateArtifact === 'cover-letter'
                    ? 'Generating cover letter...'
                    : 'Generating CV...'
                  : 'esc=back'}
        </strong>
      </text>

      <box height={Math.max(6, height - 2)} overflow="hidden">
        {view === 'menu' ? (
          <select
            height={Math.max(6, height - 10)}
            width={Math.max(20, width)}
            focused
            options={menuOptions}
            // showDescription={false}
            {...selectColors(theme)}
            onSelect={(_, option) => {
              const value = String(option?.value ?? '');
              if (value === 'answer') onStartAnswer();
              if (value === 'evaluate') onEvaluate();
              if (value === 'generate-cv') setView('generate-cv');
              if (value === 'generate-cover-letter')
                setView('generate-cover-letter');
              if (value === 'edit-job') setView('edit-job');
              if (value === 'edit-company') setView('edit-company');
              if (value === 'status') setView('status');
              if (value === 'open-cv') onOpenCv();
              if (value === 'open-cover-letter') onOpenCoverLetter();
              if (value === 'open-link') onOpenLink();
              if (value === 'delete') setView('delete');
            }}
          />
        ) : null}

        {view === 'edit-job' ? (
          <select
            height={Math.max(6, height - 2)}
            width={Math.max(20, width)}
            focused
            options={editJobOptions}
            showDescription
            itemSpacing={0}
            {...selectColors(theme)}
            onSelect={(_, option) => {
              const value = String(option?.value ?? '');
              if (value === 'edit-company') setView('edit-company');
              if (value === 'edit-role') setView('edit-role');
              if (value === 'edit-url') setView('edit-url');
              if (value === 'edit-notes') setView('edit-notes');
              if (value === 'edit-jd') setView('edit-jd');
              if (value === 'back') setView('menu');
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
            onContentChange={() =>
              setEditJdDraft(editJdInputRef.current?.plainText ?? '')
            }
            onSubmit={() => {
              onSaveEditJd(editJdInputRef.current?.plainText.trim() ?? '');
              setView(parentViewFor(view));
            }}
            focused
          />
        ) : null}

        {view === 'generate-cv' || view === 'generate-cover-letter' ? (
          generateCvState.step === 'editing' ? (
            <box flexDirection="column" width={Math.max(20, width)} rowGap={1}>
              {generateArtifact === 'cv' ? (
                <MultiStepIndicator
                  theme={theme}
                  steps={generateCvSteps}
                  activeIndex={
                    currentCvPhase === 'bullet-preset'
                      ? 0
                      : currentCvPhase === 'text-size-preset'
                        ? 1
                        : 2
                  }
                />
              ) : generateArtifact === 'cover-letter' ? (
                <MultiStepIndicator
                  theme={theme}
                  steps={generateCoverLetterSteps}
                  activeIndex={currentCoverLetterPhase === 'length-preset' ? 0 : 1}
                />
              ) : null}

              {generateArtifact === 'cv' &&
              currentCvPhase === 'bullet-preset' ? (
                <select
                  height={Math.max(6, height - 7)}
                  width={Math.max(20, width)}
                  focused
                  options={CV_BULLET_LENGTH_PRESETS.map((preset) => ({
                    name: preset.name,
                    description: preset.description,
                    value: preset.id,
                  }))}
                  selectedIndex={CV_BULLET_LENGTH_PRESETS.findIndex(
                    (preset) =>
                      preset.id === generateCvDraft.selectedBulletPresetId,
                  )}
                  showDescription
                  itemSpacing={0}
                  {...selectColors(theme)}
                  onChange={(_, option) => {
                    const preset = CV_BULLET_LENGTH_PRESETS.find(
                      (entry) => entry.id === option?.value,
                    );
                    if (!preset) return;
                    updateGenerateCvDraft({
                      selectedBulletPresetId: preset.id,
                      bulletWordRange: preset.range,
                    });
                  }}
                  onSelect={(_, option) => {
                    const preset = CV_BULLET_LENGTH_PRESETS.find(
                      (entry) => entry.id === option?.value,
                    );
                    if (!preset) return;
                    updateGenerateCvDraft({
                      selectedBulletPresetId: preset.id,
                      bulletWordRange: preset.range,
                      phase: 'text-size-preset',
                    });
                  }}
                />
              ) : generateArtifact === 'cv' &&
                currentCvPhase === 'text-size-preset' ? (
                <select
                  height={Math.max(6, height - 7)}
                  width={Math.max(20, width)}
                  focused
                  options={CV_TEXT_SIZE_PRESETS.map((preset) => ({
                    name: preset.name,
                    description: preset.description,
                    value: preset.id,
                  }))}
                  selectedIndex={CV_TEXT_SIZE_PRESETS.findIndex(
                    (preset) =>
                      preset.id === generateCvDraft.selectedTextSizePresetId,
                  )}
                  showDescription
                  itemSpacing={0}
                  {...selectColors(theme)}
                  onChange={(_, option) => {
                    const preset = CV_TEXT_SIZE_PRESETS.find(
                      (entry) => entry.id === option?.value,
                    );
                    if (!preset) return;
                    updateGenerateCvDraft({
                      selectedTextSizePresetId: preset.id,
                      textSizeScale: preset.scale,
                    });
                  }}
                  onSelect={(_, option) => {
                    const preset = CV_TEXT_SIZE_PRESETS.find(
                      (entry) => entry.id === option?.value,
                    );
                    if (!preset) return;
                    updateGenerateCvDraft({
                      selectedTextSizePresetId: preset.id,
                      textSizeScale: preset.scale,
                      phase: 'guidance',
                    });
                  }}
                />
              ) : generateArtifact === 'cover-letter' &&
                currentCoverLetterPhase === 'length-preset' ? (
                <select
                  height={Math.max(6, height - 7)}
                  width={Math.max(20, width)}
                  focused
                  options={COVER_LETTER_LENGTH_PRESETS.map((preset) => ({
                    name: preset.name,
                    description: preset.description,
                    value: preset.id,
                  }))}
                  selectedIndex={COVER_LETTER_LENGTH_PRESETS.findIndex(
                    (preset) =>
                      preset.id ===
                      generateCoverLetterDraft.selectedLengthPresetId,
                  )}
                  showDescription
                  itemSpacing={0}
                  {...selectColors(theme)}
                  onChange={(_, option) => {
                    const preset = COVER_LETTER_LENGTH_PRESETS.find(
                      (entry) => entry.id === option?.value,
                    );
                    if (!preset) return;
                    updateGenerateCoverLetterDraft({
                      selectedLengthPresetId: preset.id,
                      totalWordCount: preset.totalWordCount,
                    });
                  }}
                  onSelect={(_, option) => {
                    const preset = COVER_LETTER_LENGTH_PRESETS.find(
                      (entry) => entry.id === option?.value,
                    );
                    if (!preset) return;
                    updateGenerateCoverLetterDraft({
                      selectedLengthPresetId: preset.id,
                      totalWordCount: preset.totalWordCount,
                      phase: 'guidance',
                    });
                  }}
                />
              ) : (
                <textarea
                  ref={guidanceInputRef}
                  height={Math.max(
                    6,
                    height - (generateArtifact === 'cv' ? 10 : 5),
                  )}
                  initialValue={
                    generateArtifact === 'cv'
                      ? generateCvDraft.guidance
                      : generateCoverLetterDraft.guidance
                  }
                  placeholder={
                    generateArtifact === 'cover-letter'
                      ? 'Optional cover letter guidance.'
                      : 'Optional tailoring guidance.'
                  }
                  keyBindings={TEXTAREA_SUBMIT_KEY_BINDINGS}
                  onContentChange={() => {
                    const guidance = guidanceInputRef.current?.plainText ?? '';
                    if (generateArtifact === 'cv') {
                      updateGenerateCvDraft({ guidance });
                    }
                    if (generateArtifact === 'cover-letter') {
                      updateGenerateCoverLetterDraft({ guidance });
                    }
                  }}
                  onSubmit={async () => {
                    setGenerateCvState({ step: 'submitting' });
                    try {
                      const guidance =
                        guidanceInputRef.current?.plainText ?? '';
                      if (generateArtifact === 'cv') {
                        updateGenerateCvDraft({ guidance, phase: 'guidance' });
                      }
                      if (generateArtifact === 'cover-letter') {
                        updateGenerateCoverLetterDraft({
                          guidance,
                          phase: 'guidance',
                        });
                      }
                      const updated =
                        generateArtifact === 'cover-letter'
                          ? await onGenerateCoverLetter(
                              guidance,
                              generateCoverLetterDraft.totalWordCount,
                            )
                          : await onGenerateCv(
                              guidance,
                              generateCvDraft.bulletWordRange,
                              generateCvDraft.textSizeScale,
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
              )}
            </box>
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
                  name:
                    generateArtifact === 'cover-letter'
                      ? 'Open cover letter'
                      : 'Open CV',
                  description:
                    generateCvState.pdfPath ??
                    (generateArtifact === 'cover-letter'
                      ? 'Generated cover letter is ready to open'
                      : 'Generated CV is ready to open'),
                  value:
                    generateArtifact === 'cover-letter'
                      ? 'open-cover-letter'
                      : 'open-cv',
                },
                ...(generateArtifact === 'cv' ||
                generateArtifact === 'cover-letter'
                  ? [
                      {
                        name: 'Edit and regenerate',
                        description:
                          'Return to the current choices and regenerate',
                        value: 'edit',
                      },
                    ]
                  : []),
                {
                  name: 'Back to detail',
                  description:
                    'Close actions and return to the job detail view',
                  value: 'back',
                },
              ]}
              {...selectColors(theme)}
              onSelect={(_, option) => {
                if (option?.value === 'open-cv') onOpenCv();
                if (option?.value === 'open-cover-letter') onOpenCoverLetter();
                if (option?.value === 'edit') {
                  if (generateArtifact === 'cv') {
                    updateGenerateCvDraft({ phase: 'guidance' });
                  }
                  if (generateArtifact === 'cover-letter') {
                    updateGenerateCoverLetterDraft({ phase: 'guidance' });
                  }
                  setGenerateCvState({ step: 'editing' });
                }
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
                  name: 'Edit current settings',
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
              {...selectColors(theme)}
              onSelect={(_, option) => {
                if (option?.value === 'retry') {
                  if (generateArtifact === 'cv') {
                    updateGenerateCvDraft({ phase: 'guidance' });
                  }
                  if (generateArtifact === 'cover-letter') {
                    updateGenerateCoverLetterDraft({ phase: 'guidance' });
                  }
                  setGenerateCvState({ step: 'editing' });
                }
                if (option?.value === 'back') {
                  if (generateArtifact === 'cv') {
                    updateGenerateCvDraft({ phase: 'guidance' });
                  }
                  if (generateArtifact === 'cover-letter') {
                    updateGenerateCoverLetterDraft({ phase: 'guidance' });
                  }
                  setGenerateCvState({ step: 'editing' });
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
            {...selectColors(theme)}
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
            {...selectColors(theme)}
            onSelect={(_, option) => {
              if (option?.value === 'yes') onDelete();
              else setView('menu');
            }}
          />
        ) : null}

        <box flexDirection="row" columnGap={1} marginTop={1}>
          <text fg={theme.footer} content="Submit: enter" />
          <text fg={theme.muted} content="|" />
          <text fg={theme.footer} content="Go Back: esc" />
        </box>
      </box>
    </box>
  );
}
