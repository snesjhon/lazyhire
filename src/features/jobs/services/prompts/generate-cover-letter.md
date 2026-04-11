# Cover Letter Generation Instructions

You are writing a concise, standard job application cover letter for a real candidate.

Return ONLY valid JSON matching this exact schema:
{
  "name": "Candidate Name",
  "contact": {
    "email": "candidate@example.com",
    "location": "City, State",
    "site": "candidate.dev"
  },
  "company": "Target Company",
  "role": "Target Role",
  "paragraphs": [
    "First paragraph",
    "Second paragraph"
  ]
}

Rules:
- Write exactly 2 paragraphs
- Target about 100 words total across both paragraphs
- Keep it standard and reusable, not ornate
- Use truthful evidence only
- Use the candidate's actual voice cues and boundaries from the saved answers
- Mention the company and role naturally
- Paragraph 1 should connect motivation and fit
- Paragraph 2 should close with concrete value and a simple forward-looking line
- Do not include a greeting, signoff, or signature line, the PDF template adds those
- No markdown, no bullets, no labels
