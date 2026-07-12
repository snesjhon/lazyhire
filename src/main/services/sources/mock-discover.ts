import type { ScanJob } from '@shared/types';

// Local flow-testing stand-in for the real Common Crawl / Greenhouse / Ashby
// fetchers. Never touches the network. Mirrors the exact function signatures
// of ../sources/commoncrawl.ts, ../sources/greenhouse.ts, and ../sources/ashby.ts
// so callers can swap between mock and real implementations transparently.

interface MockCompany {
  slug: string;
  name: string;
  ats: 'greenhouse' | 'ashby';
}

const MOCK_COMPANIES: MockCompany[] = [
  { slug: 'acme-labs', name: 'Acme Labs', ats: 'greenhouse' },
  { slug: 'northwind-systems', name: 'Northwind Systems', ats: 'greenhouse' },
  { slug: 'brightpath-health', name: 'Brightpath Health', ats: 'greenhouse' },
  { slug: 'fernwood-analytics', name: 'Fernwood Analytics', ats: 'greenhouse' },
  { slug: 'lumen-cloud', name: 'Lumen Cloud', ats: 'greenhouse' },
  { slug: 'kestrel-robotics', name: 'Kestrel Robotics', ats: 'greenhouse' },
  { slug: 'harborlight-fintech', name: 'Harborlight Fintech', ats: 'greenhouse' },
  { slug: 'orbital-commerce', name: 'Orbital Commerce', ats: 'greenhouse' },
  { slug: 'pinecrest-data', name: 'Pinecrest Data', ats: 'greenhouse' },
  { slug: 'redshift-media', name: 'Redshift Media', ats: 'greenhouse' },
  { slug: 'silverline-edtech', name: 'Silverline Edtech', ats: 'greenhouse' },
  { slug: 'tanager-security', name: 'Tanager Security', ats: 'greenhouse' },
  { slug: 'meridian-works', name: 'Meridian Works', ats: 'ashby' },
  { slug: 'cobalt-platform', name: 'Cobalt Platform', ats: 'ashby' },
  { slug: 'driftwood-labs', name: 'Driftwood Labs', ats: 'ashby' },
  { slug: 'ironvale-systems', name: 'Ironvale Systems', ats: 'ashby' },
  { slug: 'quietstorm-ai', name: 'Quietstorm AI', ats: 'ashby' },
  { slug: 'summit-govtech', name: 'Summit Govtech', ats: 'ashby' },
  { slug: 'basalt-consumer', name: 'Basalt Consumer', ats: 'ashby' },
  { slug: 'wrenfield-saas', name: 'Wrenfield SaaS', ats: 'ashby' },
  { slug: 'copperline-data', name: 'Copperline Data', ats: 'ashby' },
  { slug: 'gladewood-health', name: 'Gladewood Health', ats: 'ashby' },
  { slug: 'thornbury-commerce', name: 'Thornbury Commerce', ats: 'ashby' },
  { slug: 'vellum-editorial', name: 'Vellum Editorial', ats: 'ashby' },
];

const MOCK_TITLES = [
  'Senior Software Engineer',
  'Staff Backend Engineer',
  'Frontend Engineer',
  'Platform Engineer',
  'Full Stack Engineer',
  'Senior Product Engineer',
  'Infrastructure Engineer',
  'Principal Engineer',
  'Backend Engineer, Distributed Systems',
];

const MOCK_LOCATIONS = ['Remote', 'Remote (US)', 'San Francisco, CA', 'New York, NY', 'Remote (Global)'];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hashSlug(slug: string): number {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function slugToName(slug: string): string {
  return slug.split(/[-_]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function seededJobsFor(slug: string, companyName: string, ats: 'greenhouse' | 'ashby'): ScanJob[] {
  const hash = hashSlug(slug);
  const jobCount = 1 + (hash % 3);
  const company = companyName || slugToName(slug);
  const jobs: ScanJob[] = [];
  for (let i = 0; i < jobCount; i++) {
    const title = MOCK_TITLES[(hash + i * 7) % MOCK_TITLES.length];
    const location = MOCK_LOCATIONS[(hash + i * 3) % MOCK_LOCATIONS.length];
    const boardHost = ats === 'greenhouse' ? 'boards.greenhouse.io' : 'jobs.ashbyhq.com';
    jobs.push({
      title,
      company,
      url: `https://${boardHost}/${slug}/jobs/mock-${hash}-${i}`,
      source: ats,
      score: 0,
      snippet: location,
    });
  }
  return jobs;
}

export async function fetchCCCrawlId(): Promise<string> {
  await sleep(150);
  return 'mock-crawl-id';
}

export async function fetchGreenhouseSlugs(): Promise<string[]> {
  await sleep(300);
  return MOCK_COMPANIES.filter((c) => c.ats === 'greenhouse').map((c) => c.slug);
}

export async function fetchAshbySlugs(): Promise<string[]> {
  await sleep(300);
  return MOCK_COMPANIES.filter((c) => c.ats === 'ashby').map((c) => c.slug);
}

export async function fetchGreenhouse(slug: string, companyName: string): Promise<ScanJob[]> {
  await sleep(60);
  return seededJobsFor(slug, companyName, 'greenhouse');
}

export async function fetchAshby(slug: string, companyName: string): Promise<ScanJob[]> {
  await sleep(60);
  return seededJobsFor(slug, companyName, 'ashby');
}
