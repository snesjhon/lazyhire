import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, it, expect } from 'vitest';
import { injectCV } from './pdf.js';
import type { GeneratedCV } from './types.js';

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

  it('no unreplaced placeholders remain', () => {
    const html = injectCV(minimalTemplate, cv);
    expect(html).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });

  it('uses the canonical full-height resume template without decorative separators', () => {
    const template = readFileSync(join(process.cwd(), 'themes', 'resume.html'), 'utf8');
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
