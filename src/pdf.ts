import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import puppeteer from 'puppeteer';
import type { GeneratedCV, Theme } from './types.js';

export function injectCV(template: string, cv: GeneratedCV, summary: string): string {
  const skillsHtml = cv.skills.join(' · ');

  const rolesHtml = cv.roles.map((r) => `
    <div class="role">
      <div class="role-header">
        <span class="role-title">${r.role}</span>
        <span class="role-period">${r.period.start} – ${r.period.end}</span>
      </div>
      <div class="role-company">${r.company}</div>
      <ul>${r.bullets.map((b) => `<li>${b}</li>`).join('')}</ul>
    </div>`).join('');

  const eduHtml = cv.education.map((e) => `
    <div class="edu"><strong>${e.institution}</strong><br>${e.degree}</div>`).join('');

  const sidebarSkillsHtml = cv.skills.map((s) => `<div class="skill">· ${s}</div>`).join('');
  const sidebarEduHtml = cv.education.map((e) =>
    `<div class="edu"><strong>${e.institution}</strong><br>${e.degree}</div>`
  ).join('');

  return template
    .replace(/\{\{NAME\}\}/g, cv.name)
    .replace(/\{\{TITLE\}\}/g, cv.title)
    .replace(/\{\{EMAIL\}\}/g, cv.contact.email)
    .replace(/\{\{LOCATION\}\}/g, cv.contact.location)
    .replace(/\{\{SITE\}\}/g, cv.contact.site)
    .replace(/\{\{SUMMARY\}\}/g, summary)
    .replace(/\{\{SKILLS\}\}/g, skillsHtml)
    .replace(/\{\{ROLES\}\}/g, rolesHtml)
    .replace(/\{\{EDUCATION\}\}/g, eduHtml)
    .replace(/\{\{SIDEBAR_SKILLS\}\}/g, sidebarSkillsHtml)
    .replace(/\{\{SIDEBAR_EDUCATION\}\}/g, sidebarEduHtml);
}

export async function renderPDF(cv: GeneratedCV, summary: string, theme: Theme, outputPath: string): Promise<void> {
  const templatePath = join(process.cwd(), 'themes', `${theme}.html`);
  const template = readFileSync(templatePath, 'utf8');
  const html = injectCV(template, cv, summary);

  mkdirSync(dirname(outputPath), { recursive: true });
  const tmpHtml = join(process.cwd(), 'output', `_tmp-${Date.now()}.html`);
  writeFileSync(tmpHtml, html, 'utf8');

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 816, height: 1056, deviceScaleFactor: 1 });
  await page.goto(`file://${tmpHtml}`, { waitUntil: 'networkidle0' });
  await page.pdf({
    path: outputPath,
    format: 'Letter',
    margin: { top: '0', bottom: '0', left: '0', right: '0' },
    scale: 1,
    printBackground: true,
  });
  await browser.close();

  // Clean up temp html
  import('fs').then(({ unlinkSync }) => {
    try { unlinkSync(tmpHtml); } catch { /* ignore */ }
  });
}
