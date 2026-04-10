import { describe, it, expect } from 'vitest';
import {
  buildFinalizeProfilePrompt,
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
});

describe('final profile generation helpers', () => {
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
});
