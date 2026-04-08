import { describe, expect, it } from 'vitest';
import { inferRoleAndCompanyFromSignals } from './job-actions.js';

describe('inferRoleAndCompanyFromSignals', () => {
  it('prefers JSON-LD job metadata when available', () => {
    const result = inferRoleAndCompanyFromSignals({
      pageTitle: 'Apply for Senior Platform Engineer at Acme',
      metaTitle: '',
      ogTitle: '',
      h1: 'Apply for Senior Platform Engineer',
      companyText: '',
      jsonLdTitle: 'Senior Platform Engineer',
      jsonLdCompany: 'Acme',
    }, 'https://jobs.example.com/roles/123');

    expect(result).toEqual({
      role: 'Senior Platform Engineer',
      company: 'Acme',
    });
  });

  it('parses role and company from ATS title separators', () => {
    const result = inferRoleAndCompanyFromSignals({
      pageTitle: 'Senior Product Engineer | Figma',
      metaTitle: '',
      ogTitle: '',
      h1: '',
      companyText: '',
      jsonLdTitle: '',
      jsonLdCompany: '',
    }, 'https://boards.greenhouse.io/figma/jobs/123');

    expect(result).toEqual({
      role: 'Senior Product Engineer',
      company: 'Figma',
    });
  });

  it('uses heading for role and page company text when title is generic', () => {
    const result = inferRoleAndCompanyFromSignals({
      pageTitle: 'Careers',
      metaTitle: '',
      ogTitle: '',
      h1: 'Staff Software Engineer, Platform',
      companyText: 'Notion',
      jsonLdTitle: '',
      jsonLdCompany: '',
    }, 'https://jobs.ashbyhq.com/notion/abcd');

    expect(result).toEqual({
      role: 'Staff Software Engineer, Platform',
      company: 'Notion',
    });
  });

  it('falls back to the hostname when no company signal exists', () => {
    const result = inferRoleAndCompanyFromSignals({
      pageTitle: 'Engineering Manager',
      metaTitle: '',
      ogTitle: '',
      h1: '',
      companyText: '',
      jsonLdTitle: '',
      jsonLdCompany: '',
    }, 'https://jobs.example.com/roles/123');

    expect(result).toEqual({
      role: 'Engineering Manager',
      company: 'Jobs Example',
    });
  });
});
