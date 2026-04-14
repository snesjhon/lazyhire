/** @jsxImportSource @opentui/react */
import type { InputRenderable, SelectOption } from '@opentui/core';
import { useKeyboard } from '@opentui/react';
import { useEffect, useRef, useState } from 'react';
import BrandLogo from '../../../shared/app-shell/BrandLogo.js';
import {
  buildSuggestedTargets,
  buildProfileFromExtraction,
  extractProfileFromText,
} from '../services/extract.js';
import { extractTextFromPdf, fetchPdfFromUrl } from '../services/pdf.js';
import { selectColors } from '../../../shared/ui/selectTheme.js';
import type { UiTheme } from '../../../shared/ui/theme.js';
import type { Profile } from '../../../shared/models/types.js';

type View = 'menu' | 'url' | 'extracting' | 'error';

interface Props {
  theme: UiTheme;
  width: number;
  height: number;
  onChooseManual: (profile?: Profile) => void;
}

export default function InitWorkspace({
  theme,
  width,
  height,
  onChooseManual,
}: Props) {
  const [view, setView] = useState<View>('menu');
  const [url, setUrl] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const urlInputRef = useRef<InputRenderable>(null);

  useEffect(() => {
    if (view === 'url') urlInputRef.current?.focus();
  }, [view]);

  useKeyboard((key) => {
    if (key.name !== 'escape') return;
    if (view === 'url' || view === 'error') {
      setView('menu');
    }
  });

  async function handleUrlSubmit(value: string) {
    const nextUrl = value.trim();
    if (!nextUrl) return;

    setUrl(nextUrl);
    setErrorMessage('');
    setView('extracting');

    try {
      const pdf = await fetchPdfFromUrl(nextUrl);
      const text = await extractTextFromPdf(pdf);
      const extractedProfile = await extractProfileFromText(text);
      const suggestedTargets = buildSuggestedTargets(extractedProfile);
      const seededProfile = buildProfileFromExtraction({
        rawText: text,
        extracted: extractedProfile,
        corrections: '',
        targets: suggestedTargets,
        extraExperience: [],
      });
      onChooseManual(seededProfile);
    } catch (error) {
      setErrorMessage(String(error));
      setView('error');
    }
  }

  const menuOptions: SelectOption[] = [
    {
      name: 'Resume PDF URL',
      description: 'Fetch a hosted resume PDF and build your profile',
      value: 'url',
    },
    {
      name: 'Fill profile manually',
      description: 'Skip PDF parsing and enter details yourself',
      value: 'manual',
    },
  ];

  const contentWidth = Math.max(20, width);
  const menuWidth = Math.max(34, Math.min(contentWidth, 58));
  const heroWidth = Math.max(menuWidth, 74);
  const subtitle = 'AI-Driven tools to help you land your next job';
  const author = 'Jhonatan Salazar';
  const panelWidth = menuWidth;

  return (
    <box flexDirection="column" overflow="hidden" width={width} height={height}>
      <box height={height} overflow="hidden" alignItems="center" paddingTop={1}>
        <box flexDirection="row" justifyContent="center" width={contentWidth}>
          <box flexDirection="column" width={contentWidth} overflow="hidden">
            <box flexDirection="column" alignItems="center">
              {
                <box marginTop={1}>
                  <BrandLogo theme={theme} variant="hero" width={heroWidth} />
                </box>
              }
              {
                <box alignItems="center">
                  <text fg={theme.muted} marginX="auto" marginY={1}>
                    <strong>{subtitle}</strong>
                  </text>
                  <text fg={theme.muted} content={author} />
                </box>
              }
            </box>
            <box
              marginTop={2}
              flexDirection="row"
              justifyContent="center"
              width={contentWidth}
            >
              <box width={panelWidth} flexDirection="column" overflow="hidden">
                {view === 'menu' && (
                  <>
                    <text fg={theme.subtext} marginBottom={1}>
                      <strong>Choose how to start</strong>
                    </text>
                    <select
                      focused
                      height={Math.max(5, height - 12)}
                      width={menuWidth}
                      options={menuOptions}
                      {...selectColors(theme)}
                      itemSpacing={1}
                      showDescription
                      onSelect={(_, option) => {
                        if (option?.value === 'url') {
                          setView('url');
                          return;
                        }
                        if (option?.value === 'manual') onChooseManual();
                      }}
                    />
                  </>
                )}

                {view === 'url' && (
                  <>
                    <text marginBottom={1} fg={theme.subtext}>
                      <strong>Paste a resume PDF URL and press Enter</strong>
                    </text>
                    <input
                      ref={urlInputRef}
                      value={url}
                      placeholder="https://example.com/resume.pdf"
                      onInput={setUrl}
                      onSubmit={(value: unknown) => {
                        if (typeof value === 'string')
                          void handleUrlSubmit(value);
                      }}
                      focused
                    />
                  </>
                )}

                {view === 'extracting' && (
                  <>
                    <text
                      fg={theme.muted}
                      content="Fetching resume PDF and extracting profile data..."
                    />
                    <text fg={theme.heading} content="Importing Resume" />
                    <text fg={theme.subtext} content={url || 'Working...'} />
                  </>
                )}

                {view === 'error' && (
                  <>
                    <text
                      fg={theme.muted}
                      content="Resume import failed. esc=back"
                    />
                    <text fg={theme.warning} content="Resume import failed" />
                    <text fg={theme.subtext} content={errorMessage} />
                  </>
                )}
              </box>
            </box>
          </box>
        </box>
      </box>
    </box>
  );
}
