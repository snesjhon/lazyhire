import { describe, expect, it } from 'vitest';
import type { AnswerEntry, Profile } from '../../../shared/models/types.js';
import {
  buildGenerateCoverLetterPrompt,
  parseGeneratedCoverLetter,
} from './cover-letter.js';

const profile: Profile = {
  candidate: {
    name: 'Jane Doe',
    email: 'jane@example.com',
    location: 'San Francisco, CA',
    site: 'jane.dev',
  },
  headline: 'Senior Product Engineer',
  summary: 'Product-minded engineer who ships high-quality web apps.',
  cv: 'Resume text',
  targets: {
    roles: ['Senior Engineer'],
    salaryMin: 180000,
    salaryMax: 220000,
    remote: 'full',
    dealBreakers: [],
    categories: ['engineering'],
    focuses: ['frontend'],
  },
  experiences: [
    {
      company: 'Acme',
      role: 'Senior Engineer',
      period: { start: '2022-01', end: 'present' },
      tags: ['react', 'typescript'],
      bullets: ['Built core product surfaces'],
      narrative: 'Owned product delivery across frontend initiatives.',
    },
  ],
  education: [{ institution: 'UC Davis', degree: 'B.A. Psychology' }],
  skills: ['TypeScript', 'React', 'Node.js'],
};

const answers: AnswerEntry[] = [
  {
    id: '001',
    question: 'Why this company?',
    category: 'motivation',
    answer: 'I like teams that move with urgency and stay close to the customer.',
    tone: 'Concise',
    context: 'Keep me direct and not overly flattering.',
    originJobId: '001',
    company: 'Acme',
    role: 'Senior Product Engineer',
    added: '2026-04-08',
    revised: '2026-04-09',
  },
];

describe('cover-letter prompt builder', () => {
  it('includes answer-derived voice references and strict shape requirements', () => {
    const prompt = buildGenerateCoverLetterPrompt({
      job: {
        company: 'Acme',
        role: 'Senior Product Engineer',
        url: 'https://acme.test/jobs/1',
        jd: 'Build frontend systems for customers.',
        jdSummary: 'Frontend role focused on customer-facing systems.',
      },
      profile,
      tailoringNotes: 'Emphasize product judgment.',
    }, answers);

    expect(prompt).toContain('## Saved Answers Voice Reference');
    expect(prompt).toContain('Tone: Concise');
    expect(prompt).toContain('Keep me direct and not overly flattering.');
    expect(prompt).toContain('exactly 2 paragraphs');
    expect(prompt).toContain('about 100 words total');
  });
});

describe('cover-letter parser', () => {
  it('parses the generated JSON payload', () => {
    const parsed = parseGeneratedCoverLetter(`{
      "name": "Jane Doe",
      "contact": {
        "email": "jane@example.com",
        "location": "San Francisco, CA",
        "site": "jane.dev"
      },
      "company": "Acme",
      "role": "Senior Product Engineer",
      "paragraphs": [
        "I am excited about this role.",
        "I would bring strong product judgment."
      ]
    }`);

    expect(parsed.company).toBe('Acme');
    expect(parsed.paragraphs).toHaveLength(2);
  });
});
