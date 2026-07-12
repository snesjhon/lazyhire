import { useState } from 'react';
import { IPC } from '@shared/ipc-channels';
import type { Profile } from '@shared/types';
import Button from '../../components/Button';
import Input from '../../components/Input';
import Spinner from '../../components/Spinner';
import ProfileEditForm from './ProfileEditForm';

type Step = 'start' | 'extracting' | 'review' | 'saving';

interface ProfileSetupProps {
  onComplete: (p: Profile) => void;
  /** 'embedded' renders inside the Profile tab; 'full' renders as a standalone welcome card. */
  variant?: 'embedded' | 'full';
}

export default function ProfileSetup({ onComplete, variant = 'embedded' }: ProfileSetupProps) {
  const [step, setStep] = useState<Step>('start');
  const [url, setUrl] = useState('');
  const [draft, setDraft] = useState<Profile | null>(null);
  const [error, setError] = useState('');

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setError('');
    setStep('extracting');
    try {
      let result: Profile;
      if (file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const uint8 = new Uint8Array(arrayBuffer);
        result = await window.api.invoke(IPC.AI_EXTRACT_PROFILE, Array.from(uint8)) as Profile;
      } else {
        const text = await file.text();
        result = await window.api.invoke(IPC.AI_EXTRACT_PROFILE, text) as Profile;
      }
      setDraft(result);
      setStep('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extraction failed');
      setStep('start');
    }
  }

  async function handleUrlSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;

    setError('');
    setStep('extracting');
    try {
      const result = await window.api.invoke(IPC.AI_EXTRACT_PROFILE_FROM_URL, trimmed) as Profile;
      setDraft(result);
      setStep('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not fetch a resume from that URL');
      setStep('start');
    }
  }

  async function handleSave() {
    if (!draft) return;
    setStep('saving');
    try {
      await window.api.invoke(IPC.PROFILE_SAVE, draft);
      onComplete(draft);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
      setStep('review');
    }
  }

  const outerPadding = variant === 'full' ? 0 : 40;

  if (step === 'extracting' || step === 'saving') {
    return (
      <div style={{ padding: outerPadding, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Spinner size={14} />
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {step === 'extracting' ? 'Extracting profile…' : 'Saving…'}
        </span>
      </div>
    );
  }

  if (step === 'review' && draft) {
    return (
      <div style={{
        padding: variant === 'full' ? 0 : 32,
        maxWidth: 640,
        width: variant === 'full' ? 640 : undefined,
        maxHeight: variant === 'full' ? '72vh' : undefined,
        height: variant === 'full' ? undefined : '100%',
        overflow: 'auto',
      }}>
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Review extracted profile</h2>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Edit any fields before saving.</p>
        </div>

        <ProfileEditForm profile={draft} onChange={setDraft} />

        {error && <p style={{ marginTop: 12, fontSize: 12, color: 'var(--red)' }}>{error}</p>}

        <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
          <Button variant="primary" onClick={handleSave}>Save profile</Button>
          <Button variant="ghost" onClick={() => { setStep('start'); setDraft(null); }}>
            Start over
          </Button>
        </div>
      </div>
    );
  }

  // start
  return (
    <div style={{ padding: outerPadding, maxWidth: 420, width: '100%' }}>
      {variant === 'embedded' && (
        <>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Set up your profile</h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 28, lineHeight: 1.6 }}>
            Upload your resume or paste a link to one, and Claude will extract your profile automatically.
          </p>
        </>
      )}

      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: '10px 16px',
          background: 'var(--accent)',
          color: '#fff',
          borderRadius: 'var(--radius)',
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 500,
          width: '100%',
        }}
      >
        Upload resume (PDF or text)
        <input
          type="file"
          accept=".pdf,.txt,.md"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </label>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0' }}>
        <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>OR</span>
        <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
      </div>

      <form onSubmit={handleUrlSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Input
          placeholder="https://example.com/resume.pdf"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <Button type="submit" variant="secondary" disabled={!url.trim()}>
          Fetch from URL
        </Button>
      </form>

      {error && <p style={{ marginTop: 16, fontSize: 12, color: 'var(--red)' }}>{error}</p>}
    </div>
  );
}
