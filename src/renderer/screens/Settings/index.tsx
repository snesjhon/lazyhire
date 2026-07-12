import { useState, useEffect } from 'react';
import { IPC } from '@shared/ipc-channels';
import Select from '../../components/Select';
import Button from '../../components/Button';

const MODEL_OPTIONS = [
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (Recommended)' },
  { value: 'claude-opus-4-8',   label: 'Claude Opus 4.8' },
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
];

type SettingsState = { model: string; outputDir: string | null; defaultOutputDir: string };

export default function Settings() {
  const [model, setModel] = useState('claude-sonnet-4-6');
  const [outputDir, setOutputDir] = useState<string | null>(null);
  const [defaultOutputDir, setDefaultOutputDir] = useState('');
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    window.api.invoke(IPC.SETTINGS_READ).then((s) => {
      const settings = s as SettingsState;
      if (settings?.model) setModel(settings.model);
      setOutputDir(settings?.outputDir ?? null);
      setDefaultOutputDir(settings?.defaultOutputDir ?? '');
    }).catch(() => {});
  }, []);

  async function handleModelChange(value: string) {
    setModel(value);
    try {
      await window.api.invoke(IPC.SETTINGS_SAVE, { model: value });
      setFlash(true);
      setTimeout(() => setFlash(false), 1800);
    } catch {}
  }

  async function handleChooseOutputDir() {
    try {
      const result = await window.api.invoke(IPC.SETTINGS_CHOOSE_OUTPUT_DIR) as SettingsState | null;
      if (result) setOutputDir(result.outputDir);
    } catch {}
  }

  async function handleResetOutputDir() {
    try {
      await window.api.invoke(IPC.SETTINGS_SAVE, { outputDir: null });
      setOutputDir(null);
    } catch {}
  }

  async function handleOpenOutputDir() {
    try {
      await window.api.invoke(IPC.SHELL_OPEN_PATH, outputDir || defaultOutputDir);
    } catch {}
  }

  return (
    <div style={{ padding: 32, maxWidth: 480, color: 'var(--text-primary)' }}>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Settings</h2>
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>App configuration</p>
      </div>

      <section style={{ marginBottom: 32 }}>
        <Select
          label="Model"
          value={model}
          options={MODEL_OPTIONS}
          onChange={(e) => handleModelChange(e.target.value)}
          style={{ maxWidth: 340 }}
        />
        {flash && (
          <p style={{ marginTop: 8, fontSize: 11, color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>
            ✓ Saved
          </p>
        )}
        <p style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          Uses your local Claude Code installation. Make sure you're logged in via the{' '}
          <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>claude</code>{' '}
          CLI.
        </p>
      </section>

      <section style={{ borderTop: '1px solid var(--border)', paddingTop: 20, marginBottom: 32 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 8 }}>
          Output folder
        </label>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--text-secondary)',
            background: 'var(--bg-secondary, rgba(128,128,128,0.08))',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '8px 10px',
            marginBottom: 8,
            wordBreak: 'break-all',
          }}
        >
          {outputDir || defaultOutputDir}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Button variant="secondary" size="sm" onClick={handleChooseOutputDir}>
            Choose Folder…
          </Button>
          <Button variant="ghost" size="sm" onClick={handleOpenOutputDir}>
            Open Folder
          </Button>
          {outputDir && (
            <Button variant="ghost" size="sm" onClick={handleResetOutputDir}>
              Use Default
            </Button>
          )}
        </div>
        <p style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          Resumes and cover letters are saved here. Defaults to{' '}
          <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
            ~/.lazyhire/output
          </code>.
        </p>
      </section>

      <section style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Version</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>
            2.0.0
          </span>
        </div>
      </section>
    </div>
  );
}
