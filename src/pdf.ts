import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import puppeteer from 'puppeteer';
import type { GeneratedCV } from './types.js';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderInlineMarkup(value: string): string {
  const escaped = escapeHtml(value);
  return escaped.replace(/\*\*(.+?)\*\*/g, '<span class="emphasis">$1</span>');
}

function formatPeriod(period: { start: string; end: string }): string {
  const formatMonth = (ym: string): string => {
    const [year, month] = ym.split('-');
    const monthNumber = Number.parseInt(month ?? '', 10);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    if (!year || Number.isNaN(monthNumber) || monthNumber < 1 || monthNumber > 12) return ym;
    return `${months[monthNumber - 1]} ${year}`;
  };

  return `${formatMonth(period.start)} – ${period.end === 'present' ? 'Present' : formatMonth(period.end)}`;
}

export function injectCV(template: string, cv: GeneratedCV): string {
  const skillsHtml = renderInlineMarkup(cv.skills.join(', '));
  const rolesHtml = cv.roles.map((role) => `
    <div class="role">
      <h3>${renderInlineMarkup(role.company)}</h3>
      <p class="role-meta"><em>${renderInlineMarkup(role.role)} | ${formatPeriod(role.period)}</em></p>
      <ul>${role.bullets.map((bullet) => `<li>${renderInlineMarkup(bullet)}</li>`).join('')}</ul>
    </div>
  `).join('');
  const educationHtml = cv.education.map((entry) => `
    <div class="edu">
      <p><strong>${renderInlineMarkup(entry.institution)}</strong></p>
      <p>${renderInlineMarkup(entry.degree)}</p>
    </div>
  `).join('');

  return template
    .replace(/\{\{NAME\}\}/g, renderInlineMarkup(cv.name))
    .replace(/\{\{TITLE\}\}/g, renderInlineMarkup(cv.title))
    .replace(/\{\{EMAIL\}\}/g, renderInlineMarkup(cv.contact.email))
    .replace(/\{\{LOCATION\}\}/g, renderInlineMarkup(cv.contact.location))
    .replace(/\{\{SITE\}\}/g, renderInlineMarkup(cv.contact.site))
    .replace(/\{\{SKILLS\}\}/g, skillsHtml)
    .replace(/\{\{ROLES\}\}/g, rolesHtml)
    .replace(/\{\{EDUCATION\}\}/g, educationHtml);
}

export async function renderPDF(cv: GeneratedCV, outputPath: string): Promise<void> {
  const templatePath = join(process.cwd(), 'themes', 'resume.html');
  const template = readFileSync(templatePath, 'utf8');
  const html = injectCV(template, cv);

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
    margin: { top: '0.3in', bottom: '0.3in', left: '0.45in', right: '0.45in' },
    scale: 1,
    printBackground: false,
  });
  await browser.close();

  import('fs').then(({ unlinkSync }) => {
    try { unlinkSync(tmpHtml); } catch { /* ignore */ }
  });
}
