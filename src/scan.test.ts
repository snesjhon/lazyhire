import { describe, it, expect } from 'vitest';
import {
  shortlistJobs,
  pageMatchesProfile,
  canonicalizeJobUrl,
  normalizeCompanyKey,
  keepBestJobPerCompany,
  findOfficialMatch,
  isLikelyAtsBoardRoot,
} from './scan.js';
import type { Profile, ScanJob } from './types.js';

const profile: Profile = {
  candidate: { name: 'Jane', email: 'j@j.com', location: 'SF, CA', site: 'j.dev' },
  headline: 'Staff Platform Engineer',
  summary: 'Platform and frontend engineering leader.',
  cv: '# Jane',
  targets: {
    roles: ['Platform Engineer', 'Software Engineer'],
    salaryMin: 180000,
    salaryMax: 250000,
    remote: 'full',
    dealBreakers: [],
    archetypes: ['platform'],
  },
  experiences: [
    {
      company: 'Acme',
      role: 'Senior Platform Engineer',
      period: { start: '2022-01', end: 'present' },
      tags: ['TypeScript', 'React', 'Infrastructure'],
      bullets: ['Built platform systems'],
      narrative: 'Led internal platform work.',
    },
  ],
  education: [],
  skills: ['TypeScript', 'React', 'Infrastructure'],
};

function makeJob(index: number, title = `Senior Platform Engineer ${index}`): ScanJob {
  return {
    title,
    company: `Company ${index}`,
    url: `https://example.com/jobs/${index}`,
    source: 'greenhouse',
    score: 0,
    snippet: 'Remote United States',
  };
}

describe('shortlistJobs', () => {
  it('filters out off-target roles like solutions engineer', () => {
    const jobs: ScanJob[] = [
      makeJob(1, 'Senior Platform Engineer'),
      makeJob(2, 'Solutions Engineer'),
      makeJob(3, 'Forward Deployed Engineer'),
    ];

    const shortlisted = shortlistJobs(jobs, profile);

    expect(shortlisted.map((job) => job.title)).toEqual(['Senior Platform Engineer']);
  });

  it('caps the shortlist at 50 relevant jobs', () => {
    const jobs = Array.from({ length: 60 }, (_, index) => makeJob(index + 1));

    const shortlisted = shortlistJobs(jobs, profile);

    expect(shortlisted).toHaveLength(50);
    expect(shortlisted[0]?.score).toBeGreaterThanOrEqual(shortlisted[49]?.score ?? 0);
  });
});

describe('scan normalization', () => {
  it('canonicalizes job urls for duplicate detection', () => {
    expect(canonicalizeJobUrl('https://jobs.example.com/role/123/?utm_source=linkedin#apply'))
      .toBe('https://jobs.example.com/role/123');
  });

  it('normalizes company names across minor variations', () => {
    expect(normalizeCompanyKey('Figma, Inc.')).toBe('figma');
    expect(normalizeCompanyKey('Vercel LLC')).toBe('vercel');
  });

  it('recognizes ats board roots instead of single posting urls', () => {
    expect(isLikelyAtsBoardRoot('https://jobs.lever.co/cscgeneration-2', 'lever')).toBe(true);
    expect(isLikelyAtsBoardRoot('https://jobs.lever.co/cscgeneration-2/922436c6-071f-42a0-beb', 'lever')).toBe(false);
    expect(isLikelyAtsBoardRoot('https://job-boards.greenhouse.io/figma', 'greenhouse')).toBe(true);
  });
});

describe('official ats reconciliation', () => {
  it('rehydrates stale discovery links to the live official posting', () => {
    const discoveryJob: ScanJob = {
      ...makeJob(1, 'Senior Front End Engineer'),
      company: 'CSC Generation',
      url: 'https://jobs.lever.co/cscgeneration-2/922436c6-071f-42a0-beb',
      source: 'websearch',
    };
    const officialJobs: ScanJob[] = [
      {
        ...makeJob(2, 'Senior Front End Engineer'),
        company: 'CSC Generation',
        url: 'https://jobs.lever.co/cscgeneration-2/11111111-2222-3333-4444-555555555555',
        source: 'lever',
      },
      {
        ...makeJob(3, 'Software Engineering Manager'),
        company: 'CSC Generation',
        url: 'https://jobs.lever.co/cscgeneration-2/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        source: 'lever',
      },
    ];

    const match = findOfficialMatch(discoveryJob, officialJobs);

    expect(match?.url).toBe('https://jobs.lever.co/cscgeneration-2/11111111-2222-3333-4444-555555555555');
  });
});

describe('keepBestJobPerCompany', () => {
  it('keeps only the strongest posting per normalized company', () => {
    const jobs: ScanJob[] = [
      { ...makeJob(1, 'Platform Engineer'), company: 'Figma', score: 5, source: 'greenhouse' },
      { ...makeJob(2, 'Software Engineer'), company: 'Figma, Inc.', score: 4, source: 'websearch' },
      { ...makeJob(3, 'Staff Platform Engineer'), company: 'Vercel LLC', score: 6, source: 'ashby' },
    ];

    const deduped = keepBestJobPerCompany(jobs);

    expect(deduped).toHaveLength(2);
    expect(deduped.find((job) => normalizeCompanyKey(job.company) === 'figma')?.title).toBe('Platform Engineer');
    expect(deduped.find((job) => normalizeCompanyKey(job.company) === 'vercel')?.title).toBe('Staff Platform Engineer');
  });

  it('drops companies that already exist in the tracker', () => {
    const jobs: ScanJob[] = [
      { ...makeJob(1, 'Platform Engineer'), company: 'Figma', score: 5, source: 'greenhouse' },
      { ...makeJob(2, 'Staff Platform Engineer'), company: 'Vercel', score: 6, source: 'ashby' },
    ];

    const deduped = keepBestJobPerCompany(jobs, new Set(['figma']));

    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.company).toBe('Vercel');
  });
});

describe('pageMatchesProfile', () => {
  const remoteJob = makeJob(99, 'Senior Platform Engineer');

  it('requires a full-remote signal for full remote profiles', () => {
    expect(pageMatchesProfile(remoteJob, profile, {
      title: 'Senior Platform Engineer',
      text: 'Join our hybrid team in San Francisco three days per week.',
    })).toBe(false);

    expect(pageMatchesProfile(remoteJob, profile, {
      title: 'Senior Platform Engineer',
      text: 'This is a fully remote role open across the United States.',
    })).toBe(true);
  });

  it('rejects closed or missing job pages', () => {
    expect(pageMatchesProfile(remoteJob, profile, {
      title: '404 Not Found',
      text: 'This job is no longer available.',
    })).toBe(false);
  });

  it('rejects pages that violate deal-breakers', () => {
    const strictProfile: Profile = {
      ...profile,
      targets: {
        ...profile.targets,
        dealBreakers: ['contract'],
      },
    };

    expect(pageMatchesProfile(remoteJob, strictProfile, {
      title: 'Senior Platform Engineer',
      text: 'Fully remote contract role for a platform engineer.',
    })).toBe(false);
  });
});
