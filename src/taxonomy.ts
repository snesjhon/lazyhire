import type { Job, Profile } from './types.js';

type Classification = Pick<Job, 'category' | 'focus'>;
type TargetPrefs = Pick<Profile['targets'], 'categories' | 'focuses'>;

const LEGACY_ARCHETYPE_MAP: Record<string, Classification> = {
  platform: { category: 'engineering', focus: 'platform' },
  agentic: { category: 'engineering', focus: 'agentic_systems' },
  pm: { category: 'product', focus: 'technical_pm' },
  architect: { category: 'architecture', focus: 'solutions_architecture' },
  fde: { category: 'engineering', focus: 'forward_deployed' },
  transformation: { category: 'operations', focus: 'transformation' },
};

function normalizeTerm(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return normalized || null;
}

function uniqueTerms(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

export function classificationFromLegacyArchetype(value: unknown): Classification {
  const key = normalizeTerm(value);
  if (!key) return { category: null, focus: null };
  return LEGACY_ARCHETYPE_MAP[key] ?? { category: null, focus: key };
}

export function normalizeJobClassification(raw: unknown): Classification {
  const record = (raw ?? {}) as Record<string, unknown>;
  const category = normalizeTerm(record.category);
  const focus = normalizeTerm(record.focus);
  if (category || focus) return { category, focus };
  return classificationFromLegacyArchetype(record.archetype);
}

export function normalizeTargetPreferences(raw: unknown): TargetPrefs {
  const record = (raw ?? {}) as Record<string, unknown>;
  const currentCategories = Array.isArray(record.categories)
    ? record.categories.map(normalizeTerm)
    : [];
  const currentFocuses = Array.isArray(record.focuses)
    ? record.focuses.map(normalizeTerm)
    : [];

  const legacy = Array.isArray(record.archetypes)
    ? record.archetypes.map(classificationFromLegacyArchetype)
    : [];

  return {
    categories: uniqueTerms([
      ...currentCategories,
      ...legacy.map((item) => item.category),
    ]),
    focuses: uniqueTerms([
      ...currentFocuses,
      ...legacy.map((item) => item.focus),
    ]),
  };
}
