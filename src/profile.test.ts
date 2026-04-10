import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { createProfileStore } from './profile.js';
import type { Profile } from './types.js';

const TMP = join(process.cwd(), 'tmp-test-profile');
const PROFILE_PATH = join(TMP, 'profile.json');

const sample: Profile = {
  candidate: { name: 'Jane', email: 'j@j.com', location: 'SF, CA', site: 'j.dev' },
  headline: 'Sr. Engineer',
  summary: 'Experienced engineer with 10 years.',
  cv: '# Jane\nSr. Engineer at Acme',
  targets: {
    roles: ['Sr. Software Engineer'],
    salaryMin: 150000,
    salaryMax: 200000,
    remote: 'full',
    dealBreakers: ['no equity'],
    categories: ['engineering'],
    focuses: ['platform'],
  },
  experiences: [
    {
      company: 'Acme',
      role: 'Sr. Engineer',
      period: { start: '2021-03', end: 'present' },
      tags: ['TypeScript', 'React'],
      bullets: ['Built X', 'Led Y'],
      narrative: 'Led frontend platform work.',
    },
  ],
  education: [{ institution: 'UC Davis', degree: 'B.A. Psychology' }],
  skills: ['TypeScript', 'React', 'GraphQL'],
};

describe('createProfileStore', () => {
  let store: ReturnType<typeof createProfileStore>;

  beforeEach(() => {
    mkdirSync(TMP, { recursive: true });
    store = createProfileStore(PROFILE_PATH);
  });

  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  it('throws when profile file does not exist', () => {
    expect(() => store.load()).toThrow('Run pnpm init');
  });

  it('saves and loads a profile round-trip', () => {
    store.save(sample);
    const loaded = store.load();
    expect(loaded.candidate.name).toBe('Jane');
    expect(loaded.targets.salaryMin).toBe(150000);
    expect(loaded.experiences).toHaveLength(1);
    expect(loaded.skills).toContain('TypeScript');
  });

  it('load returns correct targets shape', () => {
    store.save(sample);
    const loaded = store.load();
    expect(loaded.targets.remote).toBe('full');
    expect(loaded.targets.categories).toContain('engineering');
    expect(loaded.targets.focuses).toContain('platform');
  });
});
