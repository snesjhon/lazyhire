/** @jsxImportSource @opentui/react */
import type { InputRenderable, SelectOption } from '@opentui/core';
import { useKeyboard } from '@opentui/react';
import { useEffect, useRef, useState } from 'react';
import BrandLogo from '../../../shared/app-shell/BrandLogo.js';
import {
  buildSuggestedTargets,
  extractProfileFromText,
  finalizeProfileFromIntake,
  type ExtractionResult,
} from '../services/extract.js';
import {
  buildResumePreview,
  extractTextFromPdf,
  fetchPdfFromUrl,
  type ResumePreview,
} from '../services/pdf.js';
import type { UiTheme } from '../../../shared/ui/theme.js';
import type { Profile } from '../../../shared/models/types.js';

type View = 'menu' | 'url' | 'extracting' | 'preview' | 'creating' | 'error';

interface Props {
  theme: UiTheme;
  width: number;
  height: number;
  onComplete: (profile: Profile, message: string) => void;
  onChooseManual: () => void;
}

function previewLines(
  preview: ResumePreview,
  extracted: ExtractionResult,
): string[] {
  return [
    `Name: ${extracted.candidate.name || preview.name || 'Unknown'}`,
    `Headline: ${extracted.headline || preview.headline || 'Unknown'}`,
    `Email: ${extracted.candidate.email || preview.email || 'Unknown'}`,
    `Location: ${extracted.candidate.location || 'Unknown'}`,
    `Site: ${extracted.candidate.site || 'None'}`,
    `Suggested roles: ${extracted.suggestedRoles.join(', ') || 'None'}`,
    `Categories: ${extracted.suggestedCategories.join(', ') || 'None'}`,
    `Focuses: ${extracted.suggestedFocuses.join(', ') || 'None'}`,
    `Experiences found: ${extracted.experiences.length}`,
    `Skills found: ${extracted.skills.length}`,
  ];
}

export default function InitWorkspace({
  theme,
  width,
  height,
  onComplete,
  onChooseManual,
}: Props) {
  const [view, setView] = useState<View>('menu');
  const [url, setUrl] = useState('');
  const [preview, setPreview] = useState<ResumePreview | null>(null);
  const [extracted, setExtracted] = useState<ExtractionResult | null>(null);
  const [rawText, setRawText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const urlInputRef = useRef<InputRenderable>(null);

  useEffect(() => {
    if (view === 'url') urlInputRef.current?.focus();
  }, [view]);

  useKeyboard((key) => {
    if (key.name !== 'escape') return;
    if (view === 'url' || view === 'error' || view === 'preview') {
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

      setRawText(text);
      setPreview(buildResumePreview(text));
      setExtracted(extractedProfile);
      setView('preview');
    } catch (error) {
      setErrorMessage(String(error));
      setView('error');
    }
  }

  async function handleCreateProfile() {
    if (!extracted || !rawText) return;

    setErrorMessage('');
    setView('creating');

    try {
      const profile = await finalizeProfileFromIntake({
        rawText,
        extracted,
        corrections: '',
        targets: buildSuggestedTargets(extracted),
        extraExperience: [],
      });
      onComplete(profile, 'Profile created from resume PDF');
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

  return (
    <box flexDirection="column" overflow="hidden" width={width} height={height}>
      <box
        height={height}
        overflow="hidden"
        justifyContent={view === 'menu' ? 'center' : 'flex-start'}
      >
        {view === 'menu' && (
          <box flexDirection="row" justifyContent="center" width={contentWidth}>
            <box flexDirection="column" width={heroWidth} overflow="hidden">
              <box marginTop={1}>
                <BrandLogo theme={theme} variant="hero" width={heroWidth} />
              </box>
              <box alignItems="center">
                <text fg={theme.muted} marginX="auto" marginY={1}>
                  <strong>{subtitle}</strong>
                </text>
                <text fg={theme.muted} content={author} />
              </box>
              <box marginTop={2} flexDirection="row" justifyContent="center">
                <box width={menuWidth} flexDirection="column" overflow="hidden">
                  <text fg={theme.subtext} marginBottom={1}>
                    <strong>Choose how to start</strong>
                  </text>
                  <select
                    focused
                    height={Math.max(5, height - 12)}
                    width={menuWidth}
                    options={menuOptions}
                    backgroundColor={theme.transparent}
                    focusedBackgroundColor={theme.transparent}
                    selectedBackgroundColor={theme.transparent}
                    selectedTextColor={theme.brand}
                    selectedDescriptionColor={theme.subtext}
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
                </box>
              </box>
            </box>
          </box>
        )}

        {view === 'url' && (
          <box flexDirection="row" justifyContent="center" width={contentWidth}>
            <box flexDirection="column" width={heroWidth} overflow="hidden">
              <BrandLogo theme={theme} variant="hero" width={heroWidth} />
              <box alignItems="center">
                <text fg={theme.muted} marginX="auto" marginY={1}>
                  <strong>{subtitle}</strong>
                </text>
                <text fg={theme.muted} content={author} />
              </box>
              <box marginTop={2} flexDirection="row" justifyContent="center">
                <box width={menuWidth} flexDirection="column" overflow="hidden">
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
                </box>
              </box>
            </box>
          </box>
        )}

        {(view === 'extracting' || view === 'creating') && (
          <box flexDirection="column">
            <text
              fg={theme.muted}
              content={
                view === 'extracting'
                  ? 'Fetching resume PDF and extracting profile data...'
                  : 'Finalizing profile from extracted resume data...'
              }
            />
            <text
              fg={theme.heading}
              content={
                view === 'extracting' ? 'Importing Resume' : 'Creating Profile'
              }
            />
            <text
              fg={theme.subtext}
              content={
                view === 'extracting'
                  ? url || 'Working...'
                  : 'Applying extracted resume data to your profile.'
              }
            />
          </box>
        )}

        {view === 'preview' && preview && extracted && (
          <box
            flexDirection="column"
            width={Math.max(20, width)}
            overflow="hidden"
          >
            <text
              fg={theme.muted}
              content="Review the extracted profile summary. Enter to continue."
            />
            <text fg={theme.heading} content="Extracted Resume Summary" />
            <text
              fg={theme.subtext}
              content={previewLines(preview, extracted).join('\n')}
            />
            <box marginTop={1}>
              <select
                focused
                height={Math.max(4, height - 14)}
                width={Math.max(20, width)}
                options={[
                  {
                    name: 'Create profile',
                    description:
                      'Use the extracted resume data and suggested targets',
                    value: 'create',
                  },
                  {
                    name: 'Fill profile manually',
                    description: 'Switch to manual onboarding instead',
                    value: 'manual',
                  },
                  {
                    name: 'Start over',
                    description: 'Paste a different resume PDF URL',
                    value: 'restart',
                  },
                ]}
                backgroundColor={theme.transparent}
                focusedBackgroundColor={theme.transparent}
                selectedBackgroundColor={theme.transparent}
                selectedTextColor={theme.brand}
                showDescription
                onSelect={(_, option) => {
                  if (option?.value === 'create') {
                    void handleCreateProfile();
                    return;
                  }
                  if (option?.value === 'manual') {
                    onChooseManual();
                    return;
                  }
                  if (option?.value === 'restart') {
                    setView('url');
                  }
                }}
              />
            </box>
          </box>
        )}

        {view === 'error' && (
          <box
            flexDirection="column"
            width={Math.max(20, width)}
            overflow="hidden"
          >
            <text fg={theme.muted} content="Resume import failed. esc=back" />
            <text fg={theme.warning} content="Resume import failed" />
            <text fg={theme.subtext} content={errorMessage} />
          </box>
        )}
      </box>
    </box>
  );
}
