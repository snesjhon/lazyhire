# open-positions — Design Spec
**Date:** 2026-04-08
**Status:** Approved

## Overview

`open-positions` is a personal, terminal-first job search tool. A TUI (built with Ink) drives the
entire workflow. Claude is invoked only when intelligence is needed — evaluating a job, generating
a CV. Everything else (viewing data, navigating, status updates) is local and instant.

Extracted from [`career-ops`](https://github.com/santifer/career-ops) with credit for evaluation
and comparison logic. Built on patterns from [`snesjhon/internal`](https://github.com/snesjhon/internal).

---

## Stack

| Layer | Choice | Reason |
|---|---|---|
| UI | Ink (React for terminal) | Full dashboard, navigable rows, persistent layout |
| Claude | `@anthropic-ai/claude-code` SDK | Uses Claude subscription, no separate API billing |
| PDF | Puppeteer | Already proven in `internal` |
| Database | `jobs.json` | Git-trackable, human-readable, no binary blobs |
| Language | TypeScript ESM | Consistent with `internal` |

---

## Repo Structure

```
open-positions/
├── src/
│   ├── claude/
│   │   ├── evaluation.ts    # Score a JD → structured report (based on career-ops/oferta.md)
│   │   ├── offers.ts        # Compare N jobs → ranked matrix (based on career-ops/ofertas.md)
│   │   └── generate.ts      # ATS CV generation, theme-aware
│   ├── ui/
│   │   ├── App.tsx          # Root Ink component, routing
│   │   ├── Dashboard.tsx    # Job list table, navigable rows
│   │   ├── AddJob.tsx       # Add job by URL or pasted JD
│   │   ├── JobDetail.tsx    # Single job view + actions
│   │   └── Generate.tsx     # Theme picker + CV generation flow
│   ├── pdf.ts               # Puppeteer HTML→PDF
│   └── db.ts                # Read/write jobs.json
│
├── prompts/
│   ├── evaluation.md        # Ported from career-ops/oferta.md
│   ├── offers.md            # Ported from career-ops/ofertas.md
│   └── archetypes.md        # Ported from career-ops/_shared.md
│
├── themes/
│   ├── minimal.html         # Single-column, ATS-safe, white space
│   ├── modern.html          # Accent color, subtle dividers, still ATS-safe
│   └── two-column.html      # Sidebar for skills, main column for experience
│
├── jobs.json                # Git-tracked job database (starts as empty array)
│
├── profile/                 # .gitignored — personal, never committed
│   ├── cv.md                # Resume source of truth (markdown)
│   ├── experiences/         # Structured experience data (ported from internal)
│   └── config.yml           # Target roles, salary range, deal-breakers, archetypes
│
└── output/                  # .gitignored — generated PDFs + reports
```

---

## Data Layer — `jobs.json`

```json
[
  {
    "id": "001",
    "added": "2026-04-08",
    "company": "Acme Corp",
    "role": "Sr. Software Engineer",
    "url": "https://jobs.acme.com/...",
    "jd": "",
    "status": "Pending",
    "score": null,
    "archetype": null,
    "reportPath": null,
    "pdfPath": null,
    "theme": null,
    "notes": ""
  }
]
```

**Status flow:** `Pending → Evaluated → Applied → Interview → Offer / Rejected / Discarded`

All statuses are plain strings. No normalization scripts needed — the schema enforces them at write time in `db.ts`.

---

## TUI — Ink Components

### `App.tsx` — Router
Manages which screen is active. No URL routing — just a state enum (`dashboard | add | detail | generate`).

### `Dashboard.tsx` — Main view
- Renders `jobs.json` as a navigable table (arrow keys move between rows)
- Columns: `#` | `Company` | `Role` | `Score` | `Status` | `Added`
- Filter bar: filter by status (tab through `All / Pending / Evaluated / Applied / ...`)
- Select a row → navigate to `JobDetail`

### `AddJob.tsx`
Two input modes:
1. **URL** — paste a URL, fetches the page to confirm it's live, saves as `Pending`
2. **JD text** — multiline paste (Ctrl+C to submit, same pattern as `internal`), saves as `Pending`

### `JobDetail.tsx`
Single job view. Actions:
- **Evaluate** → calls `claude/evaluation.ts`, saves score + report, status → `Evaluated`
- **Generate CV** → navigate to `Generate`
- **Update status** → inline select
- **Edit notes** → inline text input
- **Open URL** → `open` the URL in default browser

### `Generate.tsx`
- Theme picker: `minimal | modern | two-column`
- Calls `claude/generate.ts` with job + theme
- Renders PDF via `pdf.ts`
- Shows output path on completion

---

## Claude Integration — `@anthropic-ai/claude-code` SDK

All Claude calls go through `src/claude/`. The SDK's `query()` function is called with a prompt
string built from the relevant `prompts/*.md` file + runtime data (JD, profile, experiences).

```typescript
// src/claude/evaluation.ts (pattern)
import { query } from '@anthropic-ai/claude-code';

export async function evaluateJob(jd: string, profile: Profile): Promise<EvaluationResult> {
  const prompt = buildPrompt('prompts/evaluation.md', { jd, profile });
  const result = await query({ prompt });
  return parseEvaluationResult(result);
}
```

Claude is never called from UI components directly. UI calls `src/claude/*`, which returns typed results.

---

## CV Generation — Themes

All three themes share the same data contract — a typed JSON object out of `generate.ts`.
The ATS logic (keyword injection, archetype framing, summary rewriting) lives entirely in the prompt.
Templates are purely visual — they receive the same JSON and render it differently.

**Constraint:** One page strict. Enforced via Puppeteer `scale` parameter + CSS `max-height` on the
page body. If content overflows, the prompt is instructed to trim to fit.

| Theme | Description |
|---|---|
| `minimal` | Single column, generous white space, no color, maximum ATS compatibility |
| `modern` | Single column with accent color strip, subtle section dividers |
| `two-column` | Left sidebar for skills + contact, right main column for experience |

---

## Evaluation Engine — `prompts/evaluation.md`

Ported from [`career-ops/modes/oferta.md`](https://github.com/santifer/career-ops).

Delivers 6 blocks per evaluation:
- **A** — Role summary (archetype, domain, seniority, remote policy)
- **B** — Proof point mapping (which achievements from cv.md are most relevant)
- **C** — Salary bracket analysis against config target
- **D** — Red flag detection (vague comp, excessive requirements, culture signals)
- **E** — Tailored CV summary rewrite for this specific role
- **F** — STAR story suggestions for likely interview questions

Score: 1.0–5.0. Scores below 3.0 show a discard recommendation.

---

## Multi-Offer Comparison — `prompts/offers.md`

Ported from [`career-ops/modes/ofertas.md`](https://github.com/santifer/career-ops).

10-dimension weighted scoring matrix across selected `Evaluated` jobs.
Produces a ranked table + recommendation with time-to-offer considerations.

---

## Archetype System — `prompts/archetypes.md`

Ported from [`career-ops/modes/_shared.md`](https://github.com/santifer/career-ops).

6 role archetypes with scoring weights. Evaluation and CV generation both read this file
to stay consistent across different role types.

User customizes their target archetypes in `profile/config.yml` — this file is never committed.

---

## Personal Files — `profile/` (gitignored)

| File | Purpose |
|---|---|
| `cv.md` | Resume source of truth. Claude reads this at eval + generate time. |
| `experiences/` | Structured experience data (TypeScript, ported from `internal`) |
| `config.yml` | Target roles, salary range, deal-breakers, archetype preferences |

These files exist only on the user's machine. The repo ships a `profile/config.example.yml`
and a `profile/cv.example.md` to guide setup.

---

## Portal Scanner — `src/scanner/scan.ts` (post-MVP)

WebSearch-based discovery against configured companies and job portals. Deduplicates against
existing `jobs.json` entries by URL. Adds new matches as `Pending` rows.

Treated as a separate phase — does not block the core loop (add → evaluate → generate).

---

## What's Excluded

| Feature | Reason |
|---|---|
| LinkedIn outreach | Out of scope for job search pipeline |
| Application form-filler | Requires live browser session, inherently Claude Code territory |
| Batch parallel workers | Personal tool — serial processing is sufficient |
| Self-updater | Personal repo, no update distribution needed |
| Liveness checker | Scanner pulls from live boards; evaluate-time fetch handles stale URLs |
| Training / project evaluators | Out of scope |

---

## MVP Scope

1. `jobs.json` schema + `db.ts`
2. `App.tsx` router + `Dashboard.tsx` table
3. `AddJob.tsx` (URL + JD paste)
4. `JobDetail.tsx` with status update
5. `claude/evaluation.ts` + `prompts/evaluation.md`
6. `Generate.tsx` + `claude/generate.ts` + three themes
7. `pdf.ts`

Portal scanner and multi-offer comparison are post-MVP.
