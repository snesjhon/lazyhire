import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, it, expect } from 'vitest';
import { injectCV, injectCoverLetter } from './pdf.js';
import type { GeneratedCV, GeneratedCoverLetter } from '../../../shared/models/types.js';

const cv: GeneratedCV = {
  name: 'Jane Doe',
  title: 'Sr. Engineer',
  contact: { email: 'jane@example.com', location: 'SF, CA', site: 'jane.dev' },
  skills: ['**TypeScript**', 'React', '**Node.js**'],
  roles: [
    {
      company: 'Acme',
      role: 'Senior Engineer',
      period: { start: '2022-03', end: 'present' },
      bullets: ['Built **distributed platform** for **10k+ nodes**', 'Led team of 6 engineers'],
    },
  ],
  education: [{ institution: 'UC Davis', degree: 'B.A. Psychology' }],
};

const minimalTemplate = `<body>
<h1>{{NAME}}</h1>
<div class="contact">{{EMAIL}} | {{LOCATION}} | {{SITE}}</div>
<div>{{SKILLS}}</div>
<div>{{ROLES}}</div>
<div>{{EDUCATION}}</div>
</body>`;

const coverLetter: GeneratedCoverLetter = {
  name: 'Jane Doe',
  contact: { email: 'jane@example.com', location: 'SF, CA', site: 'jane.dev' },
  company: 'Acme',
  role: 'Senior Product Engineer',
  paragraphs: [
    'I am excited to apply for the Senior Product Engineer role at Acme.',
    'I would bring product judgment, technical depth, and clear communication.',
  ],
};

describe('injectCV', () => {
  it('replaces NAME placeholder', () => {
    const html = injectCV(minimalTemplate, cv);
    expect(html).toContain('Jane Doe');
  });

  it('replaces SKILLS placeholder', () => {
    const html = injectCV(minimalTemplate, cv);
    expect(html).toContain('TypeScript');
    expect(html).toContain('React');
    expect(html).toContain('<span class="emphasis">TypeScript</span>, React, <span class="emphasis">Node.js</span>');
    expect(html).not.toContain('·');
  });

  it('replaces ROLES with experience bullets', () => {
    const html = injectCV(minimalTemplate, cv);
    expect(html).toContain('Acme');
    expect(html).toContain('Built <span class="emphasis">distributed platform</span> for <span class="emphasis">10k+ nodes</span>');
    expect(html).toContain('Senior Engineer');
    expect(html).toContain('Mar 2022');
  });

  it('renders education as a single ATS-safe line per entry', () => {
    const html = injectCV(minimalTemplate, cv);
    expect(html).toContain('<p><strong>UC Davis</strong> | B.A. Psychology</p>');
    expect(html).not.toContain('</strong></p>\n      <p>B.A. Psychology</p>');
  });

  it('no unreplaced placeholders remain', () => {
    const html = injectCV(minimalTemplate, cv);
    expect(html).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });

  it('uses the canonical full-height resume template without decorative separators', () => {
    const template = readFileSync(
      join(process.cwd(), 'src', 'features', 'jobs', 'templates', 'resume.html'),
      'utf8',
    );
    expect(template).toContain('{{NAME}}');
    expect(template).toContain('{{ROLES}}');
    expect(template).toMatch(/display\s*:\s*flex/i);
    expect(template).toContain('min-height: 100vh');
    expect(template).toContain('id="experience"');
    expect(template).toContain('.emphasis');
    expect(template).toContain('text-decoration: underline');
    expect(template).not.toContain('font-weight: 600');
    expect(template).not.toContain('·');
  });
});

describe('injectCoverLetter', () => {
  it('replaces cover letter placeholders', () => {
    const template = `<body>
<h1>{{NAME}}</h1>
<div>{{COMPANY}} / {{ROLE}}</div>
<p>{{PARAGRAPH_ONE}}</p>
<p>{{PARAGRAPH_TWO}}</p>
</body>`;

    const html = injectCoverLetter(template, coverLetter);

    expect(html).toContain('Jane Doe');
    expect(html).toContain('Acme / Senior Product Engineer');
    expect(html).toContain('I am excited to apply');
    expect(html).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });

  it('uses the canonical cover letter template', () => {
    const template = readFileSync(
      join(process.cwd(), 'src', 'features', 'jobs', 'templates', 'cover-letter.html'),
      'utf8',
    );
    expect(template).toContain('{{PARAGRAPH_ONE}}');
    expect(template).toContain('{{PARAGRAPH_TWO}}');
    expect(template).toContain('{{COMPANY}}');
    expect(template).toContain('Dear {{COMPANY}} Hiring Team,');
    expect(template).toContain('Thank you for your time and consideration,');
    expect(template).toContain('min-height: 100vh');
    expect(template).toContain('font-family: Arial, sans-serif');
    expect(template).toContain('font-size: 12.75pt');
  });
});
