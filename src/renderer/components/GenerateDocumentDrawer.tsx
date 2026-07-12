import { useState } from 'react';
import type { Job } from '@shared/types';
import {
  CV_BULLET_LENGTH_PRESETS,
  CV_TEXT_SIZE_PRESETS,
  COVER_LETTER_LENGTH_PRESETS,
  DEFAULT_CV_BULLET_WORD_RANGE,
  DEFAULT_CV_TEXT_SIZE_SCALE,
  DEFAULT_COVER_LETTER_TOTAL_WORD_COUNT,
  type CvBulletWordRange,
  type CvTextSizeScale,
  type CoverLetterTotalWordCount,
} from '@shared/generate-presets';
import Drawer from './Drawer';
import Icon from './Icon';

type DocType = 'resume' | 'cover-letter';

type ResumePhase = 'bullet-preset' | 'text-size-preset' | 'guidance';
type CoverLetterPhase = 'length-preset' | 'guidance';

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
    };

interface Props {
  type: DocType;
  job: Job;
  onClose: () => void;
  onSubmit: (submission: GenerateSubmission) => void;
}

function StepIndicator({ steps, activeIndex }: { steps: string[]; activeIndex: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
      {steps.map((label, i) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, flex: i < steps.length - 1 ? 1 : undefined }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                fontWeight: 600,
                flexShrink: 0,
                background: i <= activeIndex ? 'var(--accent)' : 'var(--bg-overlay)',
                color: i <= activeIndex ? '#fff' : 'var(--text-muted)',
                border: i <= activeIndex ? 'none' : '1px solid var(--border)',
              }}
            >
              {i < activeIndex ? <Icon name="check" size={10} style={{ color: '#fff' }} /> : i + 1}
            </span>
            <span style={{ fontSize: 11, color: i <= activeIndex ? 'var(--text-primary)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {presets.map((preset) => (
        <button
          key={preset.id}
          onClick={() => onSelect(preset)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 2,
            padding: '10px 12px',
            textAlign: 'left',
            borderRadius: 'var(--radius)',
            border: preset.id === selectedId ? '1px solid var(--accent)' : '1px solid var(--border)',
            background: preset.id === selectedId ? 'var(--accent-dim)' : 'var(--bg-elevated)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 600 }}>{preset.name}</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{preset.description}</span>
        </button>
      ))}
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

  const [guidance, setGuidance] = useState('');

  const title = isResume ? 'Generate Resume' : 'Generate Cover Letter';

  function handleGenerate() {
    if (isResume) {
      onSubmit({ type: 'resume', job, tailoringNotes: guidance, bulletWordRange, textSizeScale });
    } else {
      onSubmit({ type: 'cover-letter', job, tailoringNotes: guidance, totalWordCount });
    }
    onClose();
  }

  const resumeSteps = ['Bullet length', 'Text size', 'Guidance'];
  const resumeActiveIndex = resumePhase === 'bullet-preset' ? 0 : resumePhase === 'text-size-preset' ? 1 : 2;
  const coverLetterSteps = ['Total length', 'Guidance'];
  const coverLetterActiveIndex = coverLetterPhase === 'length-preset' ? 0 : 1;

  return (
    <Drawer open title={title} onClose={onClose} width={380}>
      {isResume ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <StepIndicator steps={resumeSteps} activeIndex={resumeActiveIndex} />

          {resumePhase === 'bullet-preset' ? (
            <PresetList
              presets={CV_BULLET_LENGTH_PRESETS}
              selectedId={bulletPresetId}
              onSelect={(preset) => {
                setBulletPresetId(preset.id);
                setBulletWordRange(preset.range);
                setResumePhase('text-size-preset');
              }}
            />
          ) : resumePhase === 'text-size-preset' ? (
            <PresetList
              presets={CV_TEXT_SIZE_PRESETS}
              selectedId={textSizePresetId}
              onSelect={(preset) => {
                setTextSizePresetId(preset.id);
                setTextSizeScale(preset.scale);
                setResumePhase('guidance');
              }}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                Tailoring guidance
              </label>
              <textarea
                autoFocus
                rows={7}
                value={guidance}
                onChange={(e) => setGuidance(e.target.value)}
                placeholder="Optional. E.g. emphasize backend/systems work, downplay early-career roles, lead with the platform migration."
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  color: 'var(--text-primary)',
                  padding: '8px 10px',
                  outline: 'none',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  fontSize: 12,
                }}
              />
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <button
              className="btn btn-ghost"
              onClick={() =>
                setResumePhase(resumePhase === 'guidance' ? 'text-size-preset' : resumePhase === 'text-size-preset' ? 'bullet-preset' : 'bullet-preset')
              }
              disabled={resumePhase === 'bullet-preset'}
              style={{ visibility: resumePhase === 'bullet-preset' ? 'hidden' : 'visible' }}
            >
              Back
            </button>
            {resumePhase === 'guidance' && (
              <button className="btn btn-primary" onClick={handleGenerate}>
                <Icon name="sparkle" size={14} /> Generate
              </button>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <StepIndicator steps={coverLetterSteps} activeIndex={coverLetterActiveIndex} />

          {coverLetterPhase === 'length-preset' ? (
            <PresetList
              presets={COVER_LETTER_LENGTH_PRESETS}
              selectedId={lengthPresetId}
              onSelect={(preset) => {
                setLengthPresetId(preset.id);
                setTotalWordCount(preset.totalWordCount);
                setCoverLetterPhase('guidance');
              }}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                Cover letter guidance
              </label>
              <textarea
                autoFocus
                rows={7}
                value={guidance}
                onChange={(e) => setGuidance(e.target.value)}
                placeholder="Optional. E.g. mention the referral, focus on the platform rebuild story, keep the tone direct."
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  color: 'var(--text-primary)',
                  padding: '8px 10px',
                  outline: 'none',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  fontSize: 12,
                }}
              />
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <button
              className="btn btn-ghost"
              onClick={() => setCoverLetterPhase('length-preset')}
              disabled={coverLetterPhase === 'length-preset'}
              style={{ visibility: coverLetterPhase === 'length-preset' ? 'hidden' : 'visible' }}
            >
              Back
            </button>
            {coverLetterPhase === 'guidance' && (
              <button className="btn btn-primary" onClick={handleGenerate}>
                <Icon name="sparkle" size={14} /> Generate
              </button>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}
