export interface CvBulletWordRange {
  min: number;
  max: number;
}

export interface CvTextSizeScale {
  bodyPt: number;
  headingNamePt: number;
  headingSectionPt: number;
  headingRolePt: number;
}

export type GeneratePresetId = 'tight' | 'compact' | 'balanced' | 'detailed' | 'extended';

export interface CvRoleBulletCounts {
  mostRecent: number;
  otherRoles: number;
}

export type CvPageConstraint = 'strict-one-page' | 'flexible-second-page';

export interface CvBulletLengthPreset {
  id: GeneratePresetId;
  name: string;
  description: string;
  range: CvBulletWordRange;
  bulletCounts: CvRoleBulletCounts;
  pageConstraint: CvPageConstraint;
}

export interface CvTextSizePreset {
  id: GeneratePresetId;
  name: string;
  description: string;
  scale: CvTextSizeScale;
}

export const DEFAULT_CV_BULLET_WORD_RANGE: CvBulletWordRange = { min: 25, max: 44 };

export const CV_BULLET_LENGTH_PRESETS: CvBulletLengthPreset[] = [
  {
    id: 'tight',
    name: 'Tight',
    description: 'Lean bullets (16-24 words), fewer per role — always fits one page',
    range: { min: 16, max: 24 },
    bulletCounts: { mostRecent: 2, otherRoles: 1 },
    pageConstraint: 'strict-one-page',
  },
  {
    id: 'compact',
    name: 'Compact',
    description: 'Short but specific bullets (20-32 words) — always fits one page',
    range: { min: 20, max: 32 },
    bulletCounts: { mostRecent: 3, otherRoles: 2 },
    pageConstraint: 'strict-one-page',
  },
  {
    id: 'balanced',
    name: 'Balanced',
    description: 'Default medium-length bullets (25-44 words) — always fits one page',
    range: DEFAULT_CV_BULLET_WORD_RANGE,
    bulletCounts: { mostRecent: 3, otherRoles: 2 },
    pageConstraint: 'strict-one-page',
  },
  {
    id: 'detailed',
    name: 'Detailed',
    description: 'Richer implementation detail (32-52 words), more bullets per role — may extend to a second page',
    range: { min: 32, max: 52 },
    bulletCounts: { mostRecent: 4, otherRoles: 3 },
    pageConstraint: 'flexible-second-page',
  },
  {
    id: 'extended',
    name: 'Extended',
    description: 'Most expansive bullets (40-60 words), most bullets per role — may extend to a second page',
    range: { min: 40, max: 60 },
    bulletCounts: { mostRecent: 5, otherRoles: 4 },
    pageConstraint: 'flexible-second-page',
  },
];

export const DEFAULT_CV_TEXT_SIZE_SCALE: CvTextSizeScale = {
  bodyPt: 10,
  headingNamePt: 20,
  headingSectionPt: 11,
  headingRolePt: 10.5,
};

export const CV_TEXT_SIZE_PRESETS: CvTextSizePreset[] = [
  {
    id: 'tight',
    name: 'Tight',
    description: 'Smallest resume text, 9pt base body copy',
    scale: { bodyPt: 9, headingNamePt: 18, headingSectionPt: 10, headingRolePt: 9.5 },
  },
  {
    id: 'compact',
    name: 'Compact',
    description: 'Slightly smaller text, 9.5pt base body copy',
    scale: { bodyPt: 9.5, headingNamePt: 19, headingSectionPt: 10.5, headingRolePt: 10 },
  },
  {
    id: 'balanced',
    name: 'Balanced',
    description: 'Default text scale, 10pt base body copy',
    scale: DEFAULT_CV_TEXT_SIZE_SCALE,
  },
  {
    id: 'detailed',
    name: 'Detailed',
    description: 'Near-maximum text, 10.5pt base body copy',
    scale: { bodyPt: 10.5, headingNamePt: 21, headingSectionPt: 11.5, headingRolePt: 11 },
  },
  {
    id: 'extended',
    name: 'Extended',
    description: 'Largest resume text, 11pt base body copy',
    scale: { bodyPt: 11, headingNamePt: 22, headingSectionPt: 12, headingRolePt: 11.5 },
  },
];

export const TONE_OPTIONS = ['Professional', 'Storytelling', 'Concise', 'Enthusiastic', 'Humble'] as const;
export type Tone = (typeof TONE_OPTIONS)[number];
export const DEFAULT_TONE: Tone = 'Professional';

export interface CoverLetterTotalWordCount {
  target: number;
}

export interface CoverLetterLengthPreset {
  id: 'tight' | 'balanced' | 'extended';
  name: string;
  description: string;
  totalWordCount: CoverLetterTotalWordCount;
}

export const DEFAULT_COVER_LETTER_TOTAL_WORD_COUNT: CoverLetterTotalWordCount = { target: 280 };

export const COVER_LETTER_LENGTH_PRESETS: CoverLetterLengthPreset[] = [
  {
    id: 'tight',
    name: 'Tight',
    description: 'Shorter letter, about 150 words total',
    totalWordCount: { target: 150 },
  },
  {
    id: 'balanced',
    name: 'Balanced',
    description: 'Default letter, about 280 words total',
    totalWordCount: DEFAULT_COVER_LETTER_TOTAL_WORD_COUNT,
  },
  {
    id: 'extended',
    name: 'Extended',
    description: 'Longer letter, about 400 words total',
    totalWordCount: { target: 400 },
  },
];
