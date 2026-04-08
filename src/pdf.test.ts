import { describe, it, expect } from 'vitest';
import { injectCV } from './pdf.js';
import type { GeneratedCV } from './types.js';

const cv: GeneratedCV = {
  name: 'Jane Doe',
  title: 'Sr. Engineer',
  contact: { email: 'jane@example.com', location: 'SF, CA', site: 'jane.dev' },
  skills: ['TypeScript', 'React', 'Node.js'],
  roles: [
    {
      company: 'Acme',
      role: 'Senior Engineer',
      period: { start: '2022-03', end: 'present' },
      bullets: ['Built distributed platform', 'Led team of 6 engineers'],
    },
  ],
  education: [{ institution: 'UC Davis', degree: 'B.A. Psychology' }],
};

const minimalTemplate = `<body>
<h1>{{NAME}}</h1>
<div class="contact">{{EMAIL}} {{LOCATION}} {{SITE}}</div>
<div>{{SUMMARY}}</div>
<div>{{SKILLS}}</div>
<div>{{ROLES}}</div>
<div>{{EDUCATION}}</div>
</body>`;

describe('injectCV', () => {
  it('replaces NAME placeholder', () => {
    const html = injectCV(minimalTemplate, cv, 'Experienced platform engineer.');
    expect(html).toContain('Jane Doe');
  });

  it('replaces SKILLS placeholder', () => {
    const html = injectCV(minimalTemplate, cv, '');
    expect(html).toContain('TypeScript');
    expect(html).toContain('React');
  });

  it('replaces ROLES with experience bullets', () => {
    const html = injectCV(minimalTemplate, cv, '');
    expect(html).toContain('Acme');
    expect(html).toContain('Built distributed platform');
  });

  it('no unreplaced placeholders remain', () => {
    const html = injectCV(minimalTemplate, cv, 'Summary here.');
    expect(html).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });
});
