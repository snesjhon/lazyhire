export const SHARED_NON_NEGOTIABLES = [
  'Do not fabricate, invent, or exaggerate facts, metrics, or experience',
  'Sound human, specific, and professional, not generic or AI-generated',
  'Never use em dashes or en dashes. Use commas, periods, or conjunctions instead',
  'Do not use filler openers such as "Absolutely", "Certainly", "Great question", "I am passionate about", or "Throughout my career"',
  'Avoid clichés, canned corporate phrasing, and empty intensifiers',
  'Use plain, readable language unless domain-specific terminology is genuinely necessary',
  'Vary sentence rhythm and avoid repeating the same word or phrase in nearby sentences',
  'Make every sentence earn its place. Cut restatement and low-information padding',
] as const;

export type WritingArtifact = 'cv' | 'cover-letter' | 'answer';

const ARTIFACT_VOICE_GUIDANCE: Record<WritingArtifact, readonly string[]> = {
  cv: [
    'Maintain a highly professional, ATS-safe voice',
    'Write with precision, specificity, and high information density',
    'Use implied first person only. Do not write "I"',
  ],
  'cover-letter': [
    'Maintain a professional, polished voice with a slightly warmer tone than a CV',
    'Connect motivation to evidence with a clear narrative through-line',
    'Sound sincere and direct, never flattering, performative, or generic',
  ],
  answer: [
    'Maintain a conversational-professional voice that sounds natural when spoken aloud',
    'Use "I" naturally, like a real person in conversation, not like a cover letter',
    'Keep the response grounded, direct, and specific to the question being answered',
  ],
};

function toBulletList(lines: readonly string[]): string {
  return lines.map((line) => `- ${line}`).join('\n');
}

export function buildSharedWritingGuidance(): string {
  return `## Shared Writing Constraints

${toBulletList(SHARED_NON_NEGOTIABLES)}`;
}

export function buildArtifactWritingGuidance(artifact: WritingArtifact): string {
  return `## ${artifact === 'cv' ? 'CV' : artifact === 'cover-letter' ? 'Cover Letter' : 'Answer'} Voice

${toBulletList(ARTIFACT_VOICE_GUIDANCE[artifact])}`;
}

export function buildWritingGuidance(artifact: WritingArtifact): string {
  return `${buildSharedWritingGuidance()}

${buildArtifactWritingGuidance(artifact)}`;
}
