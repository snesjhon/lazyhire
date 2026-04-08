import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import type { Profile } from './types.js';

export function createProfileStore(profilePath: string) {
  function load(): Profile {
    if (!existsSync(profilePath)) {
      throw new Error('Profile not found. Run pnpm init to set up your profile.');
    }

    return JSON.parse(readFileSync(profilePath, 'utf8')) as Profile;
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
