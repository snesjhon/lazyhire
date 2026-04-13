# lazyhire

Terminal-first job search tooling for people who want a tighter application workflow.

`lazyhire` helps you turn a saved resume and a job description into a decision, a tailored resume, a cover letter, and interview-ready answers without bouncing between five different apps.

<!-- Screenshot: hero / dashboard -->
<!-- ![lazyhire dashboard](./docs/screenshots/dashboard.png) -->

## Features

- Resume-based onboarding that builds your candidate profile from a hosted PDF or lets you fill it in manually.
- Job intake from pasted links or raw job descriptions.
- AI job evaluation against your background, preferences, salary range, remote preference, and deal-breakers.
- Tailored resume PDF generation with controllable bullet density.
- Tailored cover letter PDF generation for each role.
- Interview answer drafting with tone selection and answer refinement.
- Local-first storage for jobs, answers, and profile data.
- Keyboard-driven terminal UI built with OpenTUI.

## Capabilities

### 1. Build your profile once

On first launch, `lazyhire` walks through onboarding. You can:

- import a hosted resume PDF
- extract candidate details, experience, skills, and suggested targets
- confirm the extracted summary before creating your profile
- skip import and edit everything manually

Your profile drives every later step: evaluation, resume tailoring, cover letters, and answers.

<!-- Screenshot: onboarding -->
<!-- ![Onboarding](./docs/screenshots/onboarding.png) -->

### 2. Triage jobs by score, not gut feel

You can add a role from:

- a job URL
- a pasted job description

Each job is saved locally with the company, role, job description, notes, generated files, and a fit score tied back to your profile.

<!-- Screenshot: jobs / evaluation -->
<!-- ![Job evaluation](./docs/screenshots/evaluation.png) -->

`lazyhire` evaluates each role against your profile and stores:

- an overall score
- category and focus classification
- requirement matches and gaps
- seniority and role-fit analysis
- a plain recommendation on whether to apply, consider, or discard

This makes it easier to decide where to spend effort before writing anything.

### 3. Generate tailored application material

For a saved job, `lazyhire` can generate:

- a tailored resume PDF
- a tailored cover letter PDF

Resume generation supports multiple bullet-length presets, from tighter bullets to more detailed ones, plus optional guidance for a specific application angle.

Generated files are saved back onto the job record so you can reopen them later.

<!-- Screenshot: CV generation -->
<!-- ![Resume generation](./docs/screenshots/resume-generation.png) -->

### 4. Prep interview answers quickly

The answers workspace can:

- classify an interview question
- generate a polished answer in a chosen tone
- save reusable answers
- refine an existing answer with follow-up instructions

This is useful for building a bank of role-specific answers before recruiter screens and interview loops.

<!-- Screenshot: answers workspace -->
<!-- ![Answers workspace](./docs/screenshots/answers.png) -->

## Install

### Requirements

- `bun`
- `pnpm`
- a working Claude Code setup, since evaluation and generation use `@anthropic-ai/claude-code`

## Workflow

```text
Resume -> Profile -> Add Job -> Evaluate Fit -> Generate Resume / Cover Letter -> Prep Answers
```

That is the intended loop. `lazyhire` is strongest when your profile is accurate and your job descriptions are complete.

## Keyboard Shortcuts

Key bindings are intentionally simple:

- `a` add a job
- `e` evaluate the selected job
- `g` generate a tailored resume
- `c` generate a cover letter
- `w` open the answer workspace
- `s` update job status
- `d` delete the selected job
- `o` open the saved job link
- `Tab` / `Shift+Tab` move between panels
- `[` / `]` cycle filters or config tabs
- `1`, `2`, `3` jump between major panels
- `ctrl-q` quit

## Data

Everything is stored locally under `./.lazyhire`:

- `.lazyhire/candidate.json`
- `.lazyhire/jobs.json`
- `.lazyhire/answers.json`

Generated PDFs are also attached back to the saved job records.

## License

MIT
