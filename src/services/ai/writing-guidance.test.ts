import { describe, expect, it } from 'vitest';
import {
  buildArtifactWritingGuidance,
  buildSharedWritingGuidance,
  buildWritingGuidance,
} from './writing-guidance.js';

describe('writing guidance', () => {
  it('includes shared non-negotiables', () => {
    const guidance = buildSharedWritingGuidance();

    expect(guidance).toContain('Do not fabricate, invent, or exaggerate facts, metrics, or experience');
    expect(guidance).toContain('Never use em dashes or en dashes');
    expect(guidance).toContain('Sound human, specific, and professional, not generic or AI-generated');
  });

  it('provides distinct artifact voice guidance', () => {
    expect(buildArtifactWritingGuidance('cv')).toContain('ATS-safe');
    expect(buildArtifactWritingGuidance('cover-letter')).toContain('slightly warmer tone than a CV');
    expect(buildArtifactWritingGuidance('answer')).toContain('sounds natural when spoken aloud');
  });

  it('composes shared and artifact guidance together', () => {
    const guidance = buildWritingGuidance('cover-letter');

    expect(guidance).toContain('## Shared Writing Constraints');
    expect(guidance).toContain('## Cover Letter Voice');
  });
});
