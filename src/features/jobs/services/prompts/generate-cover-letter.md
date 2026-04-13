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
    "Second paragraph",
    "Optional third paragraph",
    "Optional fourth paragraph"
  ]
}

Rules:
- Write 3-4 paragraphs
- Target about {{TOTAL_WORD_COUNT}} words total across the full letter
- Keep it standard and reusable, not ornate
- Use truthful evidence only
- Use the candidate's actual voice cues and boundaries from the saved answers
- Mention the company and role naturally
- Paragraph 1 should connect motivation and fit
- Middle paragraphs should provide concrete evidence and role-specific alignment
- Final paragraph should close with concrete value and a simple forward-looking line
- Do not include a greeting, signoff, or signature line, the PDF template adds those
- No markdown, no bullets, no labels
