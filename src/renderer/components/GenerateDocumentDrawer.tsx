import { useState } from 'react';
import type { Job } from '@shared/types';
import {
  CV_BULLET_LENGTH_PRESETS,
  CV_TEXT_SIZE_PRESETS,
  COVER_LETTER_LENGTH_PRESETS,
  DEFAULT_CV_BULLET_WORD_RANGE,
  DEFAULT_CV_TEXT_SIZE_SCALE,
  DEFAULT_COVER_LETTER_TOTAL_WORD_COUNT,
  TONE_OPTIONS,
  DEFAULT_TONE,
  type CvBulletWordRange,
  type CvTextSizeScale,
  type CoverLetterTotalWordCount,
  type Tone,
} from '@shared/generate-presets';
import Drawer from './Drawer';
import Icon from './Icon';

type DocType = 'resume' | 'cover-letter';

const RESUME_PHASES = ['bullet-preset', 'text-size-preset', 'guidance'] as const;
type ResumePhase = (typeof RESUME_PHASES)[number];
const RESUME_STEP_LABELS = ['Bullet length', 'Text size', 'Guidance'];

const COVER_LETTER_PHASES = ['length-preset', 'tone', 'guidance'] as const;
type CoverLetterPhase = (typeof COVER_LETTER_PHASES)[number];
const COVER_LETTER_STEP_LABELS = ['Total length', 'Tone', 'Guidance'];

export type GenerateSubmission =
  | {
      type: 'resume';
      job: Job;
      tailoringNotes: string;
      bulletWordRange: CvBulletWordRange;
      textSizeScale: CvTextSizeScale;
    }
  | {
      type: 'cover-letter';
      job: Job;
      tailoringNotes: string;
      totalWordCount: CoverLetterTotalWordCount;
      tone: Tone;
    };

interface Props {
  type: DocType;
  job: Job;
  onClose: () => void;
  onSubmit: (submission: GenerateSubmission) => void;
}

function StepIndicator({ steps, activeIndex }: { steps: string[]; activeIndex: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 22 }}>
      {steps.map((label, i) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: i < steps.length - 1 ? 1 : undefined }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 700,
                flexShrink: 0,
                background: i <= activeIndex ? 'var(--accent)' : 'var(--surface-2)',
                color: i <= activeIndex ? '#fff' : 'var(--text-3)',
                border: i <= activeIndex ? 'none' : '1px solid var(--border)',
              }}
            >
              {i < activeIndex ? <Icon name="check" size={12} style={{ color: '#fff' }} /> : i + 1}
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: i === activeIndex ? 600 : 500,
                color: i <= activeIndex ? 'var(--text)' : 'var(--text-3)',
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div style={{ flex: 1, height: 1, background: i < activeIndex ? 'var(--accent)' : 'var(--border)' }} />
          )}
        </div>
      ))}
    </div>
  );
}

function PresetList<T extends { id: string; name: string; description: string }>({
  presets,
  selectedId,
  onSelect,
}: {
  presets: T[];
  selectedId: string;
  onSelect: (preset: T) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {presets.map((preset) => {
        const selected = preset.id === selectedId;
        return (
          <button
            key={preset.id}
            onClick={() => onSelect(preset)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '14px 16px',
              textAlign: 'left',
              borderRadius: 'var(--r-md)',
              border: selected ? '1px solid var(--accent)' : '1px solid var(--border)',
              background: selected ? 'var(--accent-soft)' : 'var(--surface)',
              color: 'var(--text)',
              cursor: 'pointer',
              transition: 'border-color 0.12s, background 0.12s',
            }}
          >
            <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{preset.name}</span>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{preset.description}</span>
            </span>
            <span
              style={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: selected ? 'var(--accent)' : 'transparent',
                border: selected ? 'none' : '1px solid var(--border)',
              }}
            >
              {selected && <Icon name="check" size={11} style={{ color: '#fff' }} />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function TonePicker({ value, onSelect }: { value: Tone; onSelect: (tone: Tone) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--text-3)',
        }}
      >
        Tone
      </label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {TONE_OPTIONS.map((t) => (
          <button
            key={t}
            className={'tone-btn' + (value === t ? ' on' : '')}
            onClick={() => onSelect(t)}
            style={{ padding: '8px 16px', fontSize: 13 }}
          >
            {t}
          </button>
        ))}
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 }}>
        Sets the voice used to write the letter.
      </p>
    </div>
  );
}

function GuidanceStep({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--text-3)',
        }}
      >
        {label}
      </label>
      <textarea
        autoFocus
        rows={9}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-md)',
          color: 'var(--text)',
          padding: '12px 14px',
          outline: 'none',
          resize: 'vertical',
          fontFamily: 'inherit',
          fontSize: 13,
          lineHeight: 1.5,
        }}
      />
    </div>
  );
}

function WizardNav({ onBack, showBack, primaryLabel, onPrimary }: {
  onBack: () => void;
  showBack: boolean;
  primaryLabel: 'Next' | 'Generate';
  onPrimary: () => void;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
      <button
        className="btn btn-ghost"
        onClick={onBack}
        style={{ visibility: showBack ? 'visible' : 'hidden' }}
      >
        Back
      </button>
      <button className="btn btn-primary" onClick={onPrimary}>
        {primaryLabel === 'Generate' ? <Icon name="sparkle" size={14} /> : null}
        {primaryLabel}
      </button>
    </div>
  );
}

export default function GenerateDocumentDrawer({ type, job, onClose, onSubmit }: Props) {
  const isResume = type === 'resume';

  const [resumePhase, setResumePhase] = useState<ResumePhase>('bullet-preset');
  const [coverLetterPhase, setCoverLetterPhase] = useState<CoverLetterPhase>('length-preset');

  const [bulletPresetId, setBulletPresetId] = useState('balanced');
  const [bulletWordRange, setBulletWordRange] = useState<CvBulletWordRange>(DEFAULT_CV_BULLET_WORD_RANGE);
  const [textSizePresetId, setTextSizePresetId] = useState('balanced');
  const [textSizeScale, setTextSizeScale] = useState<CvTextSizeScale>(DEFAULT_CV_TEXT_SIZE_SCALE);
  const [lengthPresetId, setLengthPresetId] = useState('balanced');
  const [totalWordCount, setTotalWordCount] = useState<CoverLetterTotalWordCount>(DEFAULT_COVER_LETTER_TOTAL_WORD_COUNT);
  const [tone, setTone] = useState<Tone>(DEFAULT_TONE);

  const [guidance, setGuidance] = useState('');

  const title = isResume ? 'Generate Resume' : 'Generate Cover Letter';

  function handleGenerate() {
    if (isResume) {
      onSubmit({ type: 'resume', job, tailoringNotes: guidance, bulletWordRange, textSizeScale });
    } else {
      onSubmit({ type: 'cover-letter', job, tailoringNotes: guidance, totalWordCount, tone });
    }
    onClose();
  }

  const resumeIndex = RESUME_PHASES.indexOf(resumePhase);
  const coverLetterIndex = COVER_LETTER_PHASES.indexOf(coverLetterPhase);

  return (
    <Drawer open title={title} onClose={onClose} width={460}>
      {isResume ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <StepIndicator steps={RESUME_STEP_LABELS} activeIndex={resumeIndex} />

          {resumePhase === 'bullet-preset' ? (
            <PresetList
              presets={CV_BULLET_LENGTH_PRESETS}
              selectedId={bulletPresetId}
              onSelect={(preset) => {
                setBulletPresetId(preset.id);
                setBulletWordRange(preset.range);
              }}
            />
          ) : resumePhase === 'text-size-preset' ? (
            <PresetList
              presets={CV_TEXT_SIZE_PRESETS}
              selectedId={textSizePresetId}
              onSelect={(preset) => {
                setTextSizePresetId(preset.id);
                setTextSizeScale(preset.scale);
              }}
            />
          ) : (
            <GuidanceStep
              label="Tailoring guidance"
              placeholder="Optional. E.g. emphasize backend/systems work, downplay early-career roles, lead with the platform migration."
              value={guidance}
              onChange={setGuidance}
            />
          )}

          <WizardNav
            showBack={resumeIndex > 0}
            onBack={() => setResumePhase(RESUME_PHASES[resumeIndex - 1])}
            primaryLabel={resumeIndex === RESUME_PHASES.length - 1 ? 'Generate' : 'Next'}
            onPrimary={() =>
              resumeIndex === RESUME_PHASES.length - 1
                ? handleGenerate()
                : setResumePhase(RESUME_PHASES[resumeIndex + 1])
            }
          />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <StepIndicator steps={COVER_LETTER_STEP_LABELS} activeIndex={coverLetterIndex} />

          {coverLetterPhase === 'length-preset' ? (
            <PresetList
              presets={COVER_LETTER_LENGTH_PRESETS}
              selectedId={lengthPresetId}
              onSelect={(preset) => {
                setLengthPresetId(preset.id);
                setTotalWordCount(preset.totalWordCount);
              }}
            />
          ) : coverLetterPhase === 'tone' ? (
            <TonePicker value={tone} onSelect={setTone} />
          ) : (
            <GuidanceStep
              label="Cover letter guidance"
              placeholder="Optional. E.g. mention the referral, focus on the platform rebuild story, keep the tone direct."
              value={guidance}
              onChange={setGuidance}
            />
          )}

          <WizardNav
            showBack={coverLetterIndex > 0}
            onBack={() => setCoverLetterPhase(COVER_LETTER_PHASES[coverLetterIndex - 1])}
            primaryLabel={coverLetterIndex === COVER_LETTER_PHASES.length - 1 ? 'Generate' : 'Next'}
            onPrimary={() =>
              coverLetterIndex === COVER_LETTER_PHASES.length - 1
                ? handleGenerate()
                : setCoverLetterPhase(COVER_LETTER_PHASES[coverLetterIndex + 1])
            }
          />
        </div>
      )}
    </Drawer>
  );
}
