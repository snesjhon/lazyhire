import { describe, it, expect } from 'vitest';
import {
  buildProfileFromExtraction,
  buildSuggestedTargets,
  buildFinalizeProfilePrompt,
  finalizeProfileFromIntake,
  parseExtractionResult,
  parseProfileResult,
} from './extract.js';

const candidate = {
  name: 'Jane Doe',
  email: 'jane@example.com',
  location: 'SF, CA',
  site: 'jane.dev',
  github: 'github.com/jane',
};

const experiences = [
  {
    company: 'Acme',
    role: 'Sr. Software Engineer',
    period: { start: '2021-03', end: 'present' },
    tags: ['TypeScript', 'React', 'GraphQL'],
    bullets: ['Led migration to React', 'Improved bundle size by 40%'],
    narrative: 'Led frontend platform work across multiple product teams.',
  },
];

const education = [{ institution: 'UC Davis', degree: 'B.A. Psychology' }];
const skills = ['TypeScript', 'React', 'GraphQL'];
const headline = 'Sr. Software Engineer — ex-Acme, fintech';
const summary = 'Experienced engineer with 8 years building frontend systems at scale.';
const extraction = {
  candidate,
  headline,
  summary,
  experiences,
  education,
  skills,
  suggestedRoles: ['Senior Frontend Engineer', 'Platform Engineer'],
  suggestedCategories: ['engineering'],
  suggestedFocuses: ['platform'],
};

describe('resume extraction helpers', () => {
  it('parseExtractionResult parses valid extraction json', () => {
    const result = parseExtractionResult(JSON.stringify(extraction));
    expect(result.candidate.name).toBe('Jane Doe');
    expect(result.experiences).toHaveLength(1);
    expect(result.suggestedRoles).toContain('Platform Engineer');
  });

  it('parseExtractionResult throws on invalid json', () => {
    expect(() => parseExtractionResult('not json')).toThrow();
  });

  it('parseExtractionResult extracts the first complete json object from mixed output', () => {
    const result = parseExtractionResult(`Here is the result:\n${JSON.stringify(extraction)}\nDone.`);
    expect(result.candidate.name).toBe('Jane Doe');
    expect(result.skills).toContain('React');
  });

  it('parseExtractionResult throws when the json object is truncated', () => {
    expect(() =>
      parseExtractionResult('{"candidate":{"name":"Jane Doe"},"headline":"Broken')
    ).toThrow(/No JSON found in extraction response/);
  });
});

describe('final profile generation helpers', () => {
  it('buildSuggestedTargets maps extraction suggestions into default targets', () => {
    expect(buildSuggestedTargets(extraction)).toEqual({
      roles: ['Senior Frontend Engineer', 'Platform Engineer'],
      salaryMin: 0,
      salaryMax: 0,
      remote: 'full',
      dealBreakers: [],
      categories: ['engineering'],
      focuses: ['platform'],
    });
  });

  it('buildFinalizeProfilePrompt includes corrections and extra experience', () => {
    const prompt = buildFinalizeProfilePrompt({
      rawText: 'Resume body',
      extracted: extraction,
      corrections: 'Location should be Seattle, WA',
      targets: {
        roles: ['Senior Frontend Engineer'],
        salaryMin: 180000,
        salaryMax: 220000,
        remote: 'full',
        dealBreakers: ['No relocation'],
        categories: ['engineering'],
        focuses: ['platform'],
      },
      extraExperience: ['Led a migration across 4 teams'],
    });

    expect(prompt).toContain('Location should be Seattle, WA');
    expect(prompt).toContain('Senior Frontend Engineer');
    expect(prompt).toContain('Led a migration across 4 teams');
    expect(prompt).toContain('"suggestedCategories"');
    expect(prompt).toContain('"suggestedFocuses"');
  });

  it('buildProfileFromExtraction constructs a valid profile without another model pass', () => {
    const result = buildProfileFromExtraction({
      rawText: 'Resume body',
      extracted: extraction,
      corrections: '',
      targets: {
        roles: ['Senior Frontend Engineer'],
        salaryMin: 180000,
        salaryMax: 220000,
        remote: 'full',
        dealBreakers: ['No relocation'],
        categories: ['engineering'],
        focuses: ['platform'],
      },
      extraExperience: [],
    });

    expect(result).toEqual({
      candidate,
      headline,
      summary,
      cv: 'Resume body',
      targets: {
        roles: ['Senior Frontend Engineer'],
        salaryMin: 180000,
        salaryMax: 220000,
        remote: 'full',
        dealBreakers: ['No relocation'],
        categories: ['engineering'],
        focuses: ['platform'],
      },
      experiences,
      education,
      skills,
    });
  });

  it('finalizeProfileFromIntake returns the local profile when there are no refinements', async () => {
    const result = await finalizeProfileFromIntake({
      rawText: 'Resume body',
      extracted: extraction,
      corrections: '',
      targets: {
        roles: ['Senior Frontend Engineer'],
        salaryMin: 180000,
        salaryMax: 220000,
        remote: 'full',
        dealBreakers: ['No relocation'],
        categories: ['engineering'],
        focuses: ['platform'],
      },
      extraExperience: [],
    });

    expect(result.cv).toBe('Resume body');
    expect(result.summary).toBe(summary);
    expect(result.targets.roles).toEqual(['Senior Frontend Engineer']);
    expect(result.experiences).toEqual(experiences);
  });

  it('parseProfileResult parses valid profile json', () => {
    const profileJson = JSON.stringify({
      candidate,
      headline,
      summary,
      cv: 'Resume body',
      targets: {
        roles: ['Senior Frontend Engineer'],
        salaryMin: 180000,
        salaryMax: 220000,
        remote: 'full',
        dealBreakers: ['No relocation'],
        categories: ['engineering'],
        focuses: ['platform'],
      },
      experiences,
      education,
      skills,
    });

    const result = parseProfileResult(profileJson);
    expect(result.targets.roles).toContain('Senior Frontend Engineer');
    expect(result.cv).toBe('Resume body');
  });

  it('parseProfileResult throws on invalid json', () => {
    expect(() => parseProfileResult('not json')).toThrow();
  });

  it('parseProfileResult extracts the first complete json object from mixed output', () => {
    const profileJson = JSON.stringify({
      candidate,
      headline,
      summary,
      cv: 'Resume body',
      targets: {
        roles: ['Senior Frontend Engineer'],
        salaryMin: 180000,
        salaryMax: 220000,
        remote: 'full',
        dealBreakers: ['No relocation'],
        categories: ['engineering'],
        focuses: ['platform'],
      },
      experiences,
      education,
      skills,
    });

    const result = parseProfileResult(`\`\`\`json\n${profileJson}\n\`\`\``);
    expect(result.candidate.name).toBe('Jane Doe');
    expect(result.cv).toBe('Resume body');
  });
});
