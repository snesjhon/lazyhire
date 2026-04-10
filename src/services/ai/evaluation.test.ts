import { describe, it, expect } from 'vitest';
import { parseEvaluationResult, buildEvalPrompt } from './evaluation.js';

describe('parseEvaluationResult', () => {
  it('parses valid evaluation JSON', () => {
    const json = JSON.stringify({
      score: 4.2,
      archetype: 'platform',
      recommendation: 'apply',
      blockA: {
        tldr: 'Senior platform role',
        domain: 'platform',
        function: 'build',
        seniority: 'senior',
        remote: 'full remote',
        teamSize: null,
      },
      blockB: {
        matches: [{ requirement: 'TypeScript', cvEvidence: '5 years TypeScript at Acme' }],
        gaps: [],
      },
      blockC: { analysis: 'Within range', seniorityAnalysis: 'Correctly leveled' },
      blockD: [],
      blockE: 'Tailored summary here.',
      blockF: [{ requirement: 'Led migrations', story: 'Led platform migration at Acme' }],
    });

    const result = parseEvaluationResult(json);
    expect(result.score).toBe(4.2);
    expect(result.archetype).toBe('platform');
    expect(result.recommendation).toBe('apply');
    expect(result.blockB.matches).toHaveLength(1);
  });

  it('throws on missing required fields', () => {
    expect(() => parseEvaluationResult('{"score": 4.2}')).toThrow();
  });

  it('throws on invalid JSON', () => {
    expect(() => parseEvaluationResult('not json')).toThrow();
  });
});

describe('buildEvalPrompt', () => {
  it('includes JD in prompt', () => {
    const prompt = buildEvalPrompt({
      jd: 'We need a TypeScript engineer',
      cv: '# Jane Doe\n5 years TypeScript',
      configSummary: 'Targets: Sr Engineer, $150-180k, full remote',
      experienceContext: '--- Acme | 2022-2024 ---',
    });
    expect(prompt).toContain('We need a TypeScript engineer');
    expect(prompt).toContain('Jane Doe');
  });
});
