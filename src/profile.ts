import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import type { Profile } from './types.js';
import { normalizeTargetPreferences } from './taxonomy.js';

export function createProfileStore(profilePath: string) {
  function load(): Profile {
    if (!existsSync(profilePath)) {
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

  return { load, save };
}

const DEFAULT_PATH = join(process.cwd(), 'profile', 'profile.json');
const defaultStore = createProfileStore(DEFAULT_PATH);
export const loadProfile = defaultStore.load;
export const saveProfile = defaultStore.save;
