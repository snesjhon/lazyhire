import { describe, it, expect } from 'vitest';
import { parseGeneratedCV, buildGeneratePrompt } from './generate.js';

describe('parseGeneratedCV', () => {
  it('parses valid CV JSON', () => {
    const json = JSON.stringify({
      name: 'Jane Doe',
      title: 'Sr. Software Engineer',
      contact: { email: 'jane@example.com', location: 'SF, CA', site: 'jane.dev' },
      skills: ['TypeScript', 'React'],
      roles: [
        {
          company: 'Acme',
          role: 'Senior Engineer',
          period: { start: '2022-03', end: 'present' },
          bullets: ['Built X', 'Led Y'],
        },
      ],
      education: [{ institution: 'UC Davis', degree: 'B.A. Psychology' }],
    });

    const result = parseGeneratedCV(json);
    expect(result.name).toBe('Jane Doe');
    expect(result.skills).toHaveLength(2);
    expect(result.roles[0].bullets).toHaveLength(2);
  });

  it('throws on missing roles', () => {
    expect(() => parseGeneratedCV('{"name":"Jane","skills":[]}')).toThrow();
  });
});

describe('buildGeneratePrompt', () => {
  it('includes archetype in prompt', () => {
    const prompt = buildGeneratePrompt({
      jd: 'Platform engineering role',
      archetype: 'platform',
      cv: '# Jane',
      experienceContext: '--- Acme ---',
      candidate: { name: 'Jane', email: 'j@j.com', location: 'SF', site: 'j.dev' },
      education: [{ institution: 'UC Davis', degree: 'B.A. Psychology' }],
    });
    expect(prompt).toContain('platform');
    expect(prompt).toContain('Platform engineering role');
    expect(prompt).toContain('Jane');
  });
});
