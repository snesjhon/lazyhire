# Profile Init & Single Source of Truth — Design Spec
**Date:** 2026-04-08
**Status:** Approved

## Overview

Replace the three-file profile setup (`cv.md`, `config.ts`, `experiences/index.ts`) with a single
`profile/profile.json` that is the source of truth for everything: scanning, evaluation, CV
generation, cover letters. A standalone `npm run init` wizard builds this file from the user's
resume PDF. A Profile screen in the main TUI handles future updates without re-running init.

---

## Problem

The current profile setup requires manually copying example files and hand-editing TypeScript.
That's friction for a personal tool. There's no guided path from "I have a resume" to "the tool
is ready to use." And three files (cv.md, config.ts, experiences/index.ts) create redundancy —
all three describe the same person.

---

## Profile Schema

`profile/profile.json` — never committed, never hand-edited.

```typescript
interface Profile {
  candidate: {
    name: string;
    email: string;
    location: string;
    site: string;
    github?: string;
    linkedin?: string;
  };
  headline: string;         // e.g. "Sr. Frontend Engineer — ex-Shopify, AI-embracing"
  summary: string;          // full narrative professional summary
  targets: {
    roles: string[];        // target job titles for scanning + evaluation
    salaryMin: number;      // in USD
    salaryMax: number;
    remote: 'full' | 'hybrid' | 'any';
    dealBreakers: string[];
    archetypes: string[];   // role archetypes for evaluation weighting
  };
  experiences: Experience[];  // tags + bullets, drives keyword matching in scan
  education: Array<{
    institution: string;
    degree: string;
  }>;
  skills: string[];
}
```

`Experience` type is unchanged from current `src/types.ts`.

---

## Architecture

### `npm run init` — `src/init.tsx`

Standalone entry point, separate from the main TUI (`src/index.tsx`). Does not import any job
tracking logic. Runs once to bootstrap `profile/profile.json`.

### `profile/profile.json`

Single file on disk. `src/profile.ts` loads it, validates shape against `Profile` type, and
returns the typed object. If the file is missing, it prints:
> `"Profile not found. Run npm run init to set up your profile."`
...and exits cleanly.

### Profile screen — `src/ui/Profile.tsx`

New screen in the main TUI, reachable from the dashboard. Allows editing individual sections
(targets, salary, deal-breakers, experiences) without re-running init. Writes back to
`profile/profile.json` on save.

---

## Init Wizard Flow

```
Step 1 — Input
  Ask: "Resume PDF — enter a URL or a local file path"
  Accept: https://... URL or /path/to/resume.pdf

Step 2 — Extract
  If URL: fetch PDF bytes
  If path: read from disk
  Extract text via pdf-parse
  Send text to Claude with extraction prompt
  Claude returns: candidate info, experiences, education, skills, headline, summary

Step 3 — Review extraction
  TUI displays what Claude found:
    - Name, email, location
    - N experiences detected
    - Skills list
    - Education
  User confirms or notes corrections (free-text field)

Step 4 — Follow-up questions (things Claude can't infer from a resume)
  Q1: "Target roles?" (Claude pre-fills suggestions from resume, user confirms/edits)
  Q2: "Salary range? Min / Max (USD)"
  Q3: "Remote preference?" (full / hybrid / any)
  Q4: "Deal-breakers?" (Claude suggests common ones, user adds/removes)

Step 5 — Write
  Merge extraction + follow-up answers → profile/profile.json
  Print: "Profile ready. Run npm start to begin."
```

---

## Dependencies

| Addition | Purpose |
|---|---|
| `pdf-parse` | Extract text from PDF (init only) |
| `node-fetch` or native `fetch` | Fetch PDF from URL (Node 18+ has native fetch) |

No other new dependencies. Puppeteer is already present for PDF generation and is not used here.

---

## Changes to Existing Code

| File | Change |
|---|---|
| `src/types.ts` | Update `Profile` type to match new schema; remove `CandidateConfig` |
| `src/profile.ts` | Replace three-file loader with single JSON read + type validation |
| `src/ui/App.tsx` | Add `profile` to screen enum; add Profile screen route |
| `src/ui/Dashboard.tsx` | Add "Profile" nav option |
| `package.json` | Add `"init": "tsx src/init.tsx"` script |
| `profile/cv.md` | Becomes intake artifact only; not read by the app post-init |
| `profile/config.ts` | Deleted (replaced by profile.json) |
| `profile/experiences/` | Deleted (merged into profile.json) |
| `profile/profile.yml` | Deleted (superseded by profile.json) |

---

## What's Excluded

| Feature | Reason |
|---|---|
| LinkedIn import | Too coupled to scraping; URL-to-PDF covers the use case |
| Markdown/text paste input | PDF covers the common case; adds complexity for little gain |
| Multi-profile support | Single-user tool; one profile only |
| Profile versioning / history | Git tracks the file if user opts in; not the tool's job |
