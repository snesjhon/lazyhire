import { describe, expect, it } from 'vitest';
import { buildGenerateAnswerPrompt, buildRefineAnswerPrompt } from './answers.js';
import type { Profile } from '../../../shared/models/types.js';

const profile: Profile = {
  candidate: {
    name: 'Jane Doe',
    email: 'jane@example.com',
    location: 'San Francisco, CA',
    site: 'jane.dev',
  },
  headline: 'Senior software engineer',
  summary: 'Engineer focused on reliable product systems.',
  cv: '# Jane Doe',
  targets: {
    roles: ['Senior Software Engineer'],
    salaryMin: 180000,
    salaryMax: 220000,
    remote: 'full',
    dealBreakers: [],
    categories: ['engineering'],
    focuses: ['platform'],
  },
  experiences: [
    {
      company: 'Acme',
      role: 'Senior Engineer',
      period: { start: '2021-01', end: 'present' },
      tags: ['platform'],
      bullets: ['Built internal platform tooling'],
      narrative: 'Led platform improvements across product teams.',
    },
  ],
  education: [{ institution: 'UC Davis', degree: 'B.A. Psychology' }],
  skills: ['TypeScript', 'React', 'Node.js'],
};

describe('answer prompts', () => {
  it('includes shared writing constraints in generation prompts', () => {
    const prompt = buildGenerateAnswerPrompt(
      'Why do you want this role?',
      'motivation',
      'Professional',
      'I care about product quality and reliability.',
      profile,
      { company: 'Acme', role: 'Staff Engineer', jdSummary: 'Build platform systems', jd: '', url: '' },
    );

    expect(prompt).toContain('## Shared Writing Constraints');
    expect(prompt).toContain('Never use em dashes or en dashes');
    expect(prompt).toContain('Use "I" naturally, like a real person in conversation');
    expect(prompt).toContain('## Answer-Specific Rules (follow strictly)');
  });

  it('includes shared writing constraints in refinement prompts', () => {
    const prompt = buildRefineAnswerPrompt(
      'Tell me about yourself',
      'I build product infrastructure.',
      'Make it a bit warmer.',
      profile,
    );

    expect(prompt).toContain('## Shared Writing Constraints');
    expect(prompt).toContain('Do not use filler openers');
    expect(prompt).toContain('Keep the response grounded, direct, and specific');
  });
});
