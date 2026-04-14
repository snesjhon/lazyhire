# Background Job Queue Plan

## Goal

Move expensive AI work out of blocking UI handlers and into a persisted background job system so users can queue multiple actions at once:

- fetch and hydrate jobs from URLs
- evaluate jobs
- generate CVs
- generate cover letters

The user should be able to continue navigating and queuing more work while tasks run in the background. The UI should clearly communicate that work is in progress and that results will be available later.

## Why This Is Needed

Today the app runs long-lived work directly from UI event handlers in [src/app.tsx](/Users/snesjhon/Developer/lazyhire/src/app.tsx:343). That means:

- `handleAddUrl()` hydrates and evaluates inline
- `handleAddJd()` evaluates inline
- `runEvaluate()` evaluates inline
- `runGenerate()` generates the CV inline
- `runGenerateCoverLetter()` generates the cover letter inline

The current `tasks` state in [src/app.tsx](/Users/snesjhon/Developer/lazyhire/src/app.tsx:153) and [TasksIndicator.tsx](/Users/snesjhon/Developer/lazyhire/src/shared/app-shell/TasksIndicator.tsx:1) is only in-memory UI state. It does not survive reloads, does not support queueing semantics, and does not expose durable task progress.

Jobs themselves are persisted in a single JSON file through [src/shared/data/db.ts](/Users/snesjhon/Developer/lazyhire/src/shared/data/db.ts:1), and the `Job` model in [src/shared/models/types.ts](/Users/snesjhon/Developer/lazyhire/src/shared/models/types.ts:13) does not currently track background work state beyond a coarse `status`.

## Non-Goals

- No distributed system.
- No external queue like Redis/Bull in the first pass.
- No multi-agent orchestration as a first implementation requirement.
- No major UI rewrite.

This should work as a local-first app with a simple persisted queue and a worker loop in-process.

## Recommended Architecture

### Summary

Introduce a separate persisted task model alongside existing jobs:

- `jobs.json` remains the source of truth for application records
- add `tasks.json` as the source of truth for background work
- UI enqueues tasks and returns immediately
- a worker loop processes queued tasks with bounded concurrency
- tasks update progress/result state as they run
- task completion updates the relevant `Job`

This is enough to support "single Claude provider, many queued requests" because each task becomes its own model call. A single long-lived model session is not required.

### Why Not Multi-Agent First

The real bottleneck is blocking orchestration, not lack of agent decomposition.

Use normal concurrent workers first:

- one task = one unit of work
- workers can run multiple independent tasks concurrently
- concurrency can be capped globally and per task type

Only consider multi-agent later if one individual task needs internal decomposition for quality reasons.

## Proposed Data Model

Add a new persisted task type and database.

### `TaskStatus`

- `queued`
- `running`
- `completed`
- `failed`
- `cancelled`

### `TaskKind`

- `hydrate-job-url`
- `evaluate-job`
- `generate-cv`
- `generate-cover-letter`

### `TaskRecord`

Suggested shape:

```ts
export interface TaskRecord {
  id: string;
  kind: TaskKind;
  status: TaskStatus;
  jobId: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  attemptCount: number;
  maxAttempts: number;
  priority: number;
  dedupeKey: string | null;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: string | null;
  progressLabel: string;
}
```

### Storage

Add:

- `.lazyhire/tasks.json`

Implement a new DB module similar to [src/shared/data/db.ts](/Users/snesjhon/Developer/lazyhire/src/shared/data/db.ts:1):

- `src/shared/data/tasks-db.ts`

Required operations:

- `readTasks()`
- `writeTasks()`
- `addTask()`
- `updateTask()`
- `removeTask()`
- `nextTaskId()`
- `findTaskByDedupeKey()`
- `listRunnableTasks()`

## Task Ownership and Job Coupling

Keep `Job.status` focused on the application pipeline the user cares about:

- `Pending`
- `Evaluated`
- `Applied`
- `Interview`
- `Offer`
- `Rejected`
- `Discarded`

Do not overload `Job.status` with execution state like `running` or `failed`.

Instead, derive execution state from tasks:

- a job can be `Evaluated` and still have a `generate-cv` task running
- a job can be `Pending` because evaluation has been queued but not completed

Add derived selectors such as:

- `getLatestTaskForJob(jobId, kind)`
- `getActiveTasksForJob(jobId)`
- `getTaskSummaryForJob(jobId)`

## Queue Semantics

### Enqueue Rules

Every expensive action becomes "enqueue + return":

- add URL:
  - create a placeholder job in `Pending`
  - enqueue `hydrate-job-url`
  - on success, enqueue `evaluate-job`
- add pasted JD:
  - save the job immediately
  - enqueue `evaluate-job`
- evaluate existing job:
  - enqueue `evaluate-job`
- generate CV:
  - enqueue `generate-cv`
- generate cover letter:
  - enqueue `generate-cover-letter`

### Dedupe Rules

Prevent accidental duplicate work.

Examples:

- only one active `evaluate-job` task per `jobId`
- only one active `hydrate-job-url` task per URL or placeholder job
- only one active `generate-cv` task per `jobId` plus settings fingerprint
- only one active `generate-cover-letter` task per `jobId` plus settings fingerprint

Suggested dedupe key examples:

- `evaluate-job:job-014`
- `hydrate-job-url:https://company.com/role/123`
- `generate-cv:job-014:{guidanceHash}:{bulletPreset}:{textSize}`
- `generate-cover-letter:job-014:{guidanceHash}:{wordCount}`

If a duplicate active task exists, the UI should surface "already queued" instead of creating another one.

### Dependencies

Dependencies should be simple and explicit in the first pass.

Examples:

- `hydrate-job-url` completion enqueues `evaluate-job`
- `generate-cv` may run against the latest saved job data without waiting for evaluation, but quality is better if `jdSummary/category/focus` exist
- if generation requires evaluation, mark it `failed` with a clear error or auto-enqueue evaluation first

Recommendation: require evaluation before generation in v1. That keeps outputs more predictable.

## Worker Design

### First Pass

Run a background worker loop inside the app process.

Suggested modules:

- `src/features/tasks/services/task-types.ts`
- `src/features/tasks/services/task-queue.ts`
- `src/features/tasks/services/task-worker.ts`
- `src/features/tasks/services/task-handlers.ts`

Responsibilities:

- poll `tasks.json` on an interval
- select runnable tasks
- enforce concurrency caps
- mark task `running`
- execute handler
- write `completed` or `failed`
- persist changes to affected job records

### Concurrency

Start conservative:

- global concurrency: `2`
- `hydrate-job-url`: `1`
- `evaluate-job`: `1`
- `generate-cv`: `1`
- `generate-cover-letter`: `1`

This avoids provider saturation and makes race conditions easier to reason about. Increase later if stable.

### Handler Mapping

Reuse the existing service functions where possible:

- `hydrate-job-url` -> `hydrateJobFromUrl()`
- `evaluate-job` -> `evaluateAndPersistJob()`
- `generate-cv` -> `generateAndPersistPdf()`
- `generate-cover-letter` -> `generateAndPersistCoverLetterPdf()`

However, the current functions are UI-oriented and partially coupled to inline flows. Expect a small refactor so handlers can:

- load fresh records from disk
- validate task payloads
- fail safely if the target job was deleted
- write task result metadata

## UI Changes

### Replace Ephemeral `tasks` Banner

Current `tasks: string[]` state in [src/app.tsx](/Users/snesjhon/Developer/lazyhire/src/app.tsx:153) should be replaced or backed by persisted task selectors.

Update [TasksIndicator.tsx](/Users/snesjhon/Developer/lazyhire/src/shared/app-shell/TasksIndicator.tsx:1) to show:

- active task count
- first active task summary
- queued task count if greater than zero

Example copy:

- `Building 3 items: evaluating #014 (+2 more)`

### Job List

Each job row should show task state separately from application state.

Examples:

- `Pending | evaluation queued`
- `Evaluated | CV generating`
- `Evaluated | cover letter failed`

### Detail Pane

Add a background work section in the job detail pane:

- active tasks for this job
- last completed task
- last failed task with retry hint

### Global Activity View

Add a simple activity list in the detail area or status panel:

- queued tasks
- running tasks
- failed tasks
- recently completed tasks

This can be implemented without introducing a new top-level screen.

## Error Handling

Every task should fail independently without blocking the queue.

Required behaviors:

- failed task stores a readable error string
- other queued tasks continue to run
- user can retry failed tasks
- deleting a job should cancel or ignore its future tasks

Suggested retries:

- default `maxAttempts = 1` in v1
- manual retry from UI
- automatic retries can come later for transient failures

## Suggested File-Level Implementation Plan

### Phase 1: Task Persistence and Worker Skeleton

1. Add task types to `src/shared/models/types.ts` or a dedicated task types module.
2. Add `src/shared/data/tasks-db.ts`.
3. Add task queue helpers:
   - enqueue
   - dedupe checks
   - list active tasks
4. Add worker loop service.
5. Initialize the worker loop from the app root.

Deliverable:

- tasks can be persisted and processed without changing most UI interactions yet

### Phase 2: Convert Inline Flows to Queue Submission

Replace direct awaits in [src/app.tsx](/Users/snesjhon/Developer/lazyhire/src/app.tsx:343) with enqueue operations.

Specific changes:

- `handleAddUrl()`:
  - save placeholder job
  - enqueue `hydrate-job-url`
  - return immediately
- `handleAddJd()`:
  - save job
  - enqueue `evaluate-job`
  - return immediately
- `runEvaluate()`:
  - enqueue `evaluate-job`
- `runGenerate()`:
  - enqueue `generate-cv`
- `runGenerateCoverLetter()`:
  - enqueue `generate-cover-letter`

Deliverable:

- no expensive AI calls block keyboard interactions

### Phase 3: UI State and Messaging

1. Replace `tasks` local state with derived persisted task data.
2. Update the task indicator.
3. Add per-job activity summaries in dashboard/detail UI.
4. Add retry actions for failed tasks.

Deliverable:

- the user can see what is queued, running, done, or failed

### Phase 4: Guardrails and Cleanup

1. Add dedupe keys and duplicate prevention.
2. Add cancellation behavior for deleted jobs.
3. Add task payload versioning if needed.
4. Add tests for queue behavior and task handlers.

Deliverable:

- queue is reliable enough for regular use

## Testing Plan

Add tests for:

- enqueueing a task creates a persisted record
- duplicate enqueue requests do not create duplicate active tasks
- worker picks queued tasks and marks them `running`
- successful evaluation updates both task and job
- failed generation marks task `failed` without corrupting the job
- deleting a job while tasks exist does not crash the worker
- `hydrate-job-url` success enqueues `evaluate-job`

Likely test files:

- `src/features/tasks/services/task-queue.test.ts`
- `src/features/tasks/services/task-worker.test.ts`
- integration coverage in `src/features/jobs/services/jobs.test.ts`

## Acceptance Criteria

The implementation is complete when all of the following are true:

- users can queue multiple job-related actions without waiting for each to finish
- the UI remains responsive while tasks run
- task state survives app refresh/restart
- the user can tell which work is queued, running, completed, or failed
- completed tasks update the associated job records
- duplicate requests do not explode cost or create noisy duplicate outputs

## Open Decisions

These should be decided during implementation, but they should not block starting:

1. Should generation tasks require a completed evaluation first, or auto-run from raw JD data?
2. Should the worker poll on an interval, or should queue writes also trigger an immediate wake-up?
3. How much task history should be retained in `tasks.json` before pruning?
4. Should failed tasks remain visible forever or roll into a smaller recent-history window?

## Recommendation

Build this as a persisted local task queue with an in-process worker first.

That solves the user-facing problem:

- queue many job fetches/evaluations
- generate CVs and cover letters in parallel with other work
- tell the user "this is building in the background"
- let them come back when outputs are ready

Multi-agent orchestration should be treated as a later optimization, not the foundation.
