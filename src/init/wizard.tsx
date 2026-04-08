import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { join } from 'path';
import MultilineInput from '../ui/MultilineInput.js';
import { fetchPdfFromUrl, readPdfFromPath, extractTextFromPdf } from './pdf.js';
import {
  extractProfileFromText,
  finalizeProfileFromIntake,
  type ExtractionResult,
} from './extract.js';
import { createProfileStore } from '../profile.js';
import type { Profile } from '../types.js';

type Shared = {
  rawText: string;
  extracted: ExtractionResult;
  corrections: string[];
  roles: string[];
  salaryMin: number;
  salaryMax: number;
  remote: Profile['targets']['remote'];
  dealBreakers: string[];
  extraExperience: string[];
};

type Step =
  | { name: 'input' }
  | { name: 'loading'; message: string }
  | { name: 'candidate-review'; rawText: string; extracted: ExtractionResult }
  | { name: 'experience-review'; shared: Shared; index: number }
  | { name: 'education-skills-review'; shared: Shared }
  | { name: 'extra-experience'; shared: Shared }
  | { name: 'roles'; shared: Shared }
  | { name: 'salary-min'; shared: Shared }
  | { name: 'salary-max'; shared: Shared }
  | { name: 'remote'; shared: Shared }
  | { name: 'deal-breakers'; shared: Shared }
  | { name: 'summary'; shared: Shared }
  | { name: 'finalizing' }
  | { name: 'done'; profilePath: string }
  | { name: 'error'; message: string };

const PROFILE_PATH = join(process.cwd(), 'profile', 'profile.json');

function saveProfile(profile: Profile): void {
  createProfileStore(PROFILE_PATH).save(profile);
}

function appendIfMeaningful(items: string[], value: string, ignore: string[] = []): string[] {
  const trimmed = value.trim();
  if (!trimmed) return items;
  if (ignore.includes(trimmed.toLowerCase())) return items;
  return [...items, trimmed];
}

function buildShared(rawText: string, extracted: ExtractionResult, initialCorrection: string): Shared {
  return {
    rawText,
    extracted,
    corrections: appendIfMeaningful([], initialCorrection, ['ok']),
    roles: extracted.suggestedRoles,
    salaryMin: 0,
    salaryMax: 0,
    remote: 'any',
    dealBreakers: [],
    extraExperience: [],
  };
}

export default function Wizard() {
  const [step, setStep] = useState<Step>({ name: 'input' });

  async function finalize(shared: Shared) {
    setStep({ name: 'finalizing' });

    try {
      const profile = await finalizeProfileFromIntake({
        rawText: shared.rawText,
        extracted: shared.extracted,
        corrections: shared.corrections.join('\n'),
        targets: {
          roles: shared.roles,
          salaryMin: shared.salaryMin,
          salaryMax: shared.salaryMax,
          remote: shared.remote,
          dealBreakers: shared.dealBreakers,
          archetypes:
            shared.extracted.suggestedArchetypes.length > 0
              ? shared.extracted.suggestedArchetypes
              : ['platform'],
        },
        extraExperience: shared.extraExperience,
      });

      saveProfile(profile);
      setStep({ name: 'done', profilePath: PROFILE_PATH });
    } catch (err) {
      setStep({ name: 'error', message: String(err) });
    }
  }

  function advanceExperience(shared: Shared, index: number) {
    if (index + 1 >= shared.extracted.experiences.length) {
      setStep({ name: 'education-skills-review', shared });
      return;
    }

    setStep({ name: 'experience-review', shared, index: index + 1 });
  }

  if (step.name === 'input') {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Box marginBottom={1}>
          <Text bold color="cyan">open-positions init</Text>
        </Box>
        <MultilineInput
          label="Resume PDF — enter a URL or local file path"
          hint="Paste URL or path, then Enter to continue"
          onSubmit={(source) => {
            const s = source.trim();
            if (!s) {
              process.exit(0);
              return;
            }

            setStep({ name: 'loading', message: 'Reading resume PDF...' });

            async function run() {
              try {
                let buffer: Buffer;
                if (s.startsWith('http://') || s.startsWith('https://')) {
                  buffer = await fetchPdfFromUrl(s);
                } else {
                  buffer = readPdfFromPath(s);
                }

                setStep({ name: 'loading', message: 'Extracting text from PDF locally...' });
                const rawText = await extractTextFromPdf(buffer);
                setStep({ name: 'loading', message: 'Analyzing resume with Claude...' });
                const extracted = await extractProfileFromText(rawText);
                setStep({ name: 'candidate-review', rawText, extracted });
              } catch (err) {
                setStep({ name: 'error', message: String(err) });
              }
            }

            void run();
          }}
        />
      </Box>
    );
  }

  if (step.name === 'loading') {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text bold color="cyan">open-positions init</Text>
        <Text color="yellow">{step.message}</Text>
      </Box>
    );
  }

  if (step.name === 'candidate-review') {
    const { candidate, headline, summary, suggestedRoles, suggestedArchetypes } = step.extracted;

    return (
      <Box flexDirection="column" paddingX={1}>
        <Text bold color="cyan">Step 1: Candidate Review</Text>
        <Text>Name: {candidate.name}</Text>
        <Text>Email: {candidate.email}</Text>
        <Text>Location: {candidate.location}</Text>
        <Text>Site: {candidate.site || '(none)'}</Text>
        {candidate.github && <Text>GitHub: {candidate.github}</Text>}
        {candidate.linkedin && <Text>LinkedIn: {candidate.linkedin}</Text>}
        <Box marginTop={1} flexDirection="column">
          <Text bold>Headline</Text>
          <Text>{headline}</Text>
        </Box>
        <Box marginTop={1} flexDirection="column">
          <Text bold>Summary</Text>
          <Text>{summary}</Text>
        </Box>
        <Box marginTop={1} flexDirection="column">
          <Text>Suggested roles: {suggestedRoles.join(', ') || '(none)'}</Text>
          <Text>Suggested archetypes: {suggestedArchetypes.join(', ') || '(none)'}</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Type `ok` if this looks right, or type exactly what should change.</Text>
        </Box>
        <MultilineInput
          label="Candidate review"
          hint="Example: Summary should emphasize platform leadership and migration work"
          onSubmit={(value) => {
            const shared = buildShared(step.rawText, step.extracted, value);
            if (shared.extracted.experiences.length > 0) {
              setStep({ name: 'experience-review', shared, index: 0 });
              return;
            }
            setStep({ name: 'education-skills-review', shared });
          }}
        />
      </Box>
    );
  }

  if (step.name === 'experience-review') {
    const experience = step.shared.extracted.experiences[step.index];

    return (
      <Box flexDirection="column" paddingX={1}>
        <Text bold color="cyan">Step 2: Experience {step.index + 1} of {step.shared.extracted.experiences.length}</Text>
        <Text>{experience.company} — {experience.role}</Text>
        <Text>{experience.period.start} to {experience.period.end}</Text>
        <Text>Tags: {experience.tags.join(', ') || '(none)'}</Text>
        <Box marginTop={1} flexDirection="column">
          <Text bold>Narrative</Text>
          <Text>{experience.narrative}</Text>
        </Box>
        <Box marginTop={1} flexDirection="column">
          <Text bold>Bullets</Text>
          {experience.bullets.map((bullet, index) => (
            <Text key={index}>- {bullet}</Text>
          ))}
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Type `ok`, `skip`, or describe what should change for this experience.</Text>
        </Box>
        <MultilineInput
          label={`Experience ${step.index + 1} review`}
          hint="Example: Bullet 2 should mention team size and migration impact"
          onSubmit={(value) => {
            const shared = {
              ...step.shared,
              corrections: appendIfMeaningful(
                step.shared.corrections,
                `Experience ${step.index + 1} (${experience.company} / ${experience.role}): ${value}`,
                ['ok', 'skip']
              ),
            };
            advanceExperience(shared, step.index);
          }}
        />
      </Box>
    );
  }

  if (step.name === 'education-skills-review') {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text bold color="cyan">Step 3: Education And Skills Review</Text>
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Education</Text>
          {step.shared.extracted.education.map((item, index) => (
            <Text key={index}>- {item.institution}: {item.degree}</Text>
          ))}
          {step.shared.extracted.education.length === 0 && <Text>(none)</Text>}
        </Box>
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Skills</Text>
          <Text>{step.shared.extracted.skills.join(', ') || '(none)'}</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Type `ok` or list what should change in education/skills.</Text>
        </Box>
        <MultilineInput
          label="Education/skills review"
          hint="Example: Add mentoring and distributed systems to skills"
          onSubmit={(value) => {
            setStep({
              name: 'extra-experience',
              shared: {
                ...step.shared,
                corrections: appendIfMeaningful(
                  step.shared.corrections,
                  `Education/skills: ${value}`,
                  ['ok']
                ),
              },
            });
          }}
        />
      </Box>
    );
  }

  if (step.name === 'extra-experience') {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text bold color="cyan">Step 4: Add More Experience</Text>
        <Text dimColor>Type more experience/context, or press Enter on an empty input when finished.</Text>
        {step.shared.extraExperience.length > 0 && (
          <Box flexDirection="column" marginTop={1}>
            {step.shared.extraExperience.map((item, index) => (
              <Text key={index}>- {item}</Text>
            ))}
          </Box>
        )}
        <MultilineInput
          label="Additional experience"
          hint="Example: Led architecture reviews across 4 teams"
          onSubmit={(value) => {
            const trimmed = value.trim();
            if (!trimmed || trimmed.toLowerCase() === 'done') {
              setStep({ name: 'roles', shared: step.shared });
              return;
            }

            setStep({
              name: 'extra-experience',
              shared: {
                ...step.shared,
                extraExperience: appendIfMeaningful(step.shared.extraExperience, trimmed),
              },
            });
          }}
        />
      </Box>
    );
  }

  if (step.name === 'roles') {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text bold color="cyan">Step 5: Target Roles</Text>
        <Text dimColor>Claude suggests: {step.shared.extracted.suggestedRoles.join(', ') || '(none)'}</Text>
        <MultilineInput
          label="Which jobs are you targeting? (comma-separated)"
          hint="Edit the suggested roles, then press Enter"
          onSubmit={(value) => {
            const roles = value.split(',').map((role) => role.trim()).filter(Boolean);
            if (roles.length === 0) return;

            setStep({ name: 'salary-min', shared: { ...step.shared, roles } });
          }}
        />
      </Box>
    );
  }

  if (step.name === 'salary-min') {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text bold color="cyan">Step 6: Salary Minimum</Text>
        <MultilineInput
          label="Minimum salary (USD, numbers only)"
          hint="Example: 180000"
          onSubmit={(value) => {
            const salaryMin = parseInt(value.replace(/[^0-9]/g, ''), 10);
            if (Number.isNaN(salaryMin)) return;
            setStep({ name: 'salary-max', shared: { ...step.shared, salaryMin } });
          }}
        />
      </Box>
    );
  }

  if (step.name === 'salary-max') {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text bold color="cyan">Step 7: Salary Maximum</Text>
        <Text dimColor>Min: ${step.shared.salaryMin.toLocaleString()}</Text>
        <MultilineInput
          label="Maximum salary (USD, numbers only)"
          hint="Example: 230000"
          onSubmit={(value) => {
            const salaryMax = parseInt(value.replace(/[^0-9]/g, ''), 10);
            if (Number.isNaN(salaryMax)) return;
            setStep({ name: 'remote', shared: { ...step.shared, salaryMax } });
          }}
        />
      </Box>
    );
  }

  if (step.name === 'remote') {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text bold color="cyan">Step 8: Remote Preference</Text>
        <Text dimColor>Type one of: full, hybrid, any</Text>
        <MultilineInput
          label="Remote preference"
          hint="Example: hybrid"
          onSubmit={(value) => {
            const normalized = value.trim().toLowerCase();
            if (normalized !== 'full' && normalized !== 'hybrid' && normalized !== 'any') return;
            setStep({
              name: 'deal-breakers',
              shared: { ...step.shared, remote: normalized },
            });
          }}
        />
      </Box>
    );
  }

  if (step.name === 'deal-breakers') {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text bold color="cyan">Step 9: Deal-Breakers</Text>
        <Text dimColor>Type a deal-breaker, or press Enter on an empty input when finished.</Text>
        {step.shared.dealBreakers.length > 0 && (
          <Box flexDirection="column" marginTop={1}>
            {step.shared.dealBreakers.map((item, index) => (
              <Text key={index}>- {item}</Text>
            ))}
          </Box>
        )}
        <MultilineInput
          label="Deal-breaker"
          hint="Example: no five-day in-office requirement"
          onSubmit={(value) => {
            const trimmed = value.trim();
            if (!trimmed || trimmed.toLowerCase() === 'done') {
              setStep({ name: 'summary', shared: step.shared });
              return;
            }

            setStep({
              name: 'deal-breakers',
              shared: {
                ...step.shared,
                dealBreakers: appendIfMeaningful(step.shared.dealBreakers, trimmed),
              },
            });
          }}
        />
      </Box>
    );
  }

  if (step.name === 'summary') {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text bold color="cyan">Ready To Generate</Text>
        <Text>Roles: {step.shared.roles.join(', ')}</Text>
        <Text>Archetypes: {step.shared.extracted.suggestedArchetypes.join(', ') || '(none)'}</Text>
        <Text>Salary: ${step.shared.salaryMin.toLocaleString()} - ${step.shared.salaryMax.toLocaleString()}</Text>
        <Text>Remote: {step.shared.remote}</Text>
        <Text>Corrections captured: {step.shared.corrections.length}</Text>
        <Text>Extra experience notes: {step.shared.extraExperience.length}</Text>
        <Text>Deal-breakers: {step.shared.dealBreakers.length}</Text>
        <Box marginTop={1}>
          <Text dimColor>Type `generate` to build the final profile.json.</Text>
        </Box>
        <MultilineInput
          label="Final command"
          hint="Type generate"
          onSubmit={(value) => {
            if (value.trim().toLowerCase() !== 'generate') return;
            void finalize(step.shared);
          }}
        />
      </Box>
    );
  }

  if (step.name === 'finalizing') {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text bold color="cyan">open-positions init</Text>
        <Text color="yellow">Generating final profile.json with Claude...</Text>
      </Box>
    );
  }

  if (step.name === 'done') {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text color="green">✓ Profile created</Text>
        <Text dimColor>{step.profilePath}</Text>
        <Box marginTop={1}>
          <Text>Run <Text color="cyan">pnpm start</Text> to begin.</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text color="red">✗ Error</Text>
      <Text dimColor>{step.message}</Text>
      <Box marginTop={1}>
        <Text dimColor>Fix the issue and run pnpm init again.</Text>
      </Box>
    </Box>
  );
}
