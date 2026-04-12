import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import type { Profile } from './types.js';
import { normalizeTargetPreferences } from './taxonomy.js';

const DATA_DIR = '.lazyhire';
const CANDIDATE_FILE = 'candidate.json';

export function createEmptyProfile(): Profile {
  return {
    candidate: {
      name: '',
      email: '',
      location: '',
      site: '',
    },
    headline: '',
    summary: '',
    cv: '',
    targets: {
      roles: [],
      salaryMin: 0,
      salaryMax: 0,
      remote: 'full',
      dealBreakers: [],
      categories: [],
      focuses: [],
    },
    experiences: [],
    education: [],
    skills: [],
  };
}

export function createProfileStore(profilePath: string) {
  function exists(): boolean {
    return existsSync(profilePath);
  }

  function load(): Profile {
    if (!exists()) {
      throw new Error('Profile not found. Run pnpm init to set up your profile.');
    }

    const raw = JSON.parse(readFileSync(profilePath, 'utf8')) as Profile & {
      targets?: Record<string, unknown>;
    };
    const targets = raw.targets ?? {};
    const normalizedTargets = normalizeTargetPreferences(targets);

    return {
      ...raw,
      targets: {
        roles: Array.isArray(targets.roles) ? targets.roles as string[] : [],
        salaryMin: typeof targets.salaryMin === 'number' ? targets.salaryMin : 0,
        salaryMax: typeof targets.salaryMax === 'number' ? targets.salaryMax : 0,
        remote: targets.remote === 'hybrid' || targets.remote === 'any' ? targets.remote : 'full',
        dealBreakers: Array.isArray(targets.dealBreakers) ? targets.dealBreakers as string[] : [],
        ...normalizedTargets,
      },
    };
  }

  function save(profile: Profile): void {
    mkdirSync(dirname(profilePath), { recursive: true });
    writeFileSync(profilePath, JSON.stringify(profile, null, 2), 'utf8');
  }

  function loadOrDefault(): Profile {
    return exists() ? load() : createEmptyProfile();
  }

  return { exists, load, loadOrDefault, save };
}

const DEFAULT_PATH = join(process.cwd(), DATA_DIR, CANDIDATE_FILE);
const defaultStore = createProfileStore(DEFAULT_PATH);
export const hasProfile = defaultStore.exists;
export const loadProfile = defaultStore.load;
export const loadProfileOrDefault = defaultStore.loadOrDefault;
export const saveProfile = defaultStore.save;
