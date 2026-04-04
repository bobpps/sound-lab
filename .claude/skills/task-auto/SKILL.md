---
name: task-auto
description: >
  Fully autonomous GitHub issue implementation with superpowers-driven planning,
  adaptive TDD/subagent-driven execution, alignment checking, and code-critic
  review. Delegates heavy work to subagents invoking superpowers skills.
  Zero-touch execution — no user interaction after launch.
disable-model-invocation: true
---

# Task Auto

Implement a GitHub issue in this repository through a fully autonomous
orchestrator that delegates heavy work to subagents invoking superpowers
skills, uses a dedicated git worktree, persistent markdown artifacts,
adaptive execution strategy, mandatory alignment checking, and architectural
criticism before PR creation.

## Overview

Use this skill when the goal is zero-touch task execution:

- take a GitHub issue number
- gather context without asking the user
- delegate analysis, planning, and implementation to focused subagents
- verify, review, and align in isolated agent contexts
- run architectural criticism before finalizing
- create the commit, push, and PR automatically
- update the GitHub issue automatically
- remove the worktree after the PR flow

Do not ask the user for clarification, approval, or a cleanup choice. This
skill is for autonomous execution, not interactive collaboration.

## Prerequisites

Before any other action, confirm that all required skills are available in
the current session's system-reminder skills list:

- `superpowers:writing-plans`
- `superpowers:test-driven-development`
- `superpowers:subagent-driven-development`
- `code-critic`

If any skill is missing, stop immediately:

> Cannot proceed: required skill `{missing-skill}` is not available.
> Install the Superpowers plugin and ensure the code-critic skill is present.

Do not continue past this check if any prerequisite is missing.

## Repository Defaults

Use these repository-specific defaults unless the current task context provides
something more precise:

| Item             | Default                                                          |
| ---------------- | ---------------------------------------------------------------- |
| Task provider    | GitHub Issues via `gh` CLI                                       |
| Repo             | `bobpps/sound-lab`                                               |
| Base branch      | `main`                                                           |
| Branch pattern   | `feat/<issue-number>-<short-slug>` (e.g. `feat/12-tts-provider`) |
| Worktree root    | `.claude/worktrees/`                                             |
| Build            | `npm run build`                                                  |
| Full test        | `npm test`                                                       |
| File-scoped test | `npx vitest run {TEST_FILE}` (run from `backend/`)              |
| Lint             | `npm run lint --workspace=frontend`                              |
| Push             | `git push -u origin HEAD`                                        |
| PR               | `gh pr create --base main`                                       |

Read the project guidance before planning or editing:

- `CLAUDE.md` (root)
- `backend/CLAUDE.md`
- `frontend/CLAUDE.md`
- `backend/src/db/interfaces.ts` when the task touches data layer

## Hard Rules

These rules are mandatory.

1. Check prerequisites before any work. Stop if any required skill is
   missing.
2. Require a GitHub issue number as input. If no issue number is available,
   do not use this skill.
3. Create or resume the task worktree before any implementation work.
4. Perform all task edits inside that worktree only.
5. Delegate analysis to an agent and save `analysis.md` before planning.
6. Delegate planning to an agent that invokes `superpowers:writing-plans` and
   save `plan.md` before any code or documentation changes.
7. Delegate execution to an agent that invokes the appropriate superpowers
   methodology: `superpowers:test-driven-development` for small plans (≤3
   tasks) or `superpowers:subagent-driven-development` for larger plans.
8. Run alignment check after implementation to compare the result against the
   original analysis. Save `alignment-check.md`.
9. Run code-critic after alignment check. Save `code-critic.md`.
10. Resolve uncertainty autonomously through repository files, GitHub issue
    details, related issues, web research, and other available trusted
    sources before taking a best-effort decision.
11. Never ask the user for clarification or approval once execution starts.
12. Use the adaptive return loop: if reviews find issues, return to the
    appropriate step based on severity and re-run downstream steps.
13. Create the commit, push, PR, and final GitHub comment automatically when
    the release gate is satisfied.
14. Remove the worktree after PR creation.
15. Leave the main workspace unchanged after cleanup.

## Project-Specific Rules

### Dual-DB Migrations

When the task requires database changes:

- Create migration SQL in both `backend/src/db/local/migrations/` and
  `backend/src/db/supabase/migrations/`.
- Update TypeScript types in `backend/src/db/types.ts` to match the new schema.
- Update interfaces in `backend/src/db/interfaces.ts` if repository contracts
  change.
- Implement the change in both `backend/src/db/local/` and
  `backend/src/db/supabase/` repository implementations.
- Add tests using in-memory SQLite via `createTestDb()`.

### Repository Contract

Every method added to a repository interface must be implemented in both
the local (SQLite) and Supabase backends. Breaking this contract is a
blocking issue.

### ESM Imports

All import paths must include the `.js` extension. No exceptions.

### Commit Message Format

Use conventional commits derived from the issue context:

- `feat: ...` for new features
- `fix: ...` for bug fixes
- `refactor: ...` for restructuring
- `test: ...` for test-only changes
- `docs: ...` for documentation
- `chore: ...` for tooling and config

Include the issue reference: `feat: add TTS provider registry (#12)`

### Code Quality

Follow the rules from `CLAUDE.md`. Additionally:

- Prefix unused variables with `_`.
- All repository methods return `Promise<T>` — even SQLite wrappers.
- "Not found" returns `null`, never throws. Only constraint violations throw.
- API keys must be encrypted via `crypto.ts` before storage.

## Artifact Contract

Store all task artifacts inside the worktree under `tasks/<issue-number>/`.

| File                 | Purpose                                                          | Required |
| -------------------- | ---------------------------------------------------------------- | -------- |
| `task-context.md`    | Normalized issue record and repo context                         | Yes      |
| `analysis.md`        | Initial understanding, assumptions, risks, unknowns              | Yes      |
| `plan.md`            | Implementation plan (from superpowers:writing-plans)             | Yes      |
| `execution-log.md`   | Research expansion, decisions, deviations, TDD exceptions        | Yes      |
| `review.md`          | Final diff summary and verification checkpoint                   | Yes      |
| `alignment-check.md` | Comparison of implementation against the initial analysis        | Yes      |
| `code-critic.md`     | Architectural criticism findings                                 | Yes      |
| `finalization.md`    | Commit, push, PR, GitHub update, and cleanup outcomes            | Yes      |

Use concise markdown. Keep these files readable for audit and post-hoc review.

## Autonomous Decision Ladder

When the task is unclear, expand context in this order:

1. repository code and guidance files
2. GitHub issue details, comments, and labels
3. related GitHub issues when they materially clarify scope, dependencies,
   blockers, or expected behavior
4. web research and official external documentation when current facts matter
5. any other trustworthy source available to the agent

If ambiguity remains after that ladder, choose the narrowest change that is:

- consistent with the issue text
- consistent with repository guidance
- consistent with repository architecture
- reversible
- unlikely to expand scope unnecessarily

Record the reasoning in `execution-log.md`.

## Error Handling

- If the GitHub issue cannot be found, record the failure in `finalization.md`
  and stop.
- If documentation conflicts with the GitHub issue, flag the discrepancy in
  `execution-log.md` and choose the interpretation most consistent with the
  issue text and repository guidance.
- If implementation reveals the task is larger than expected, record the scope
  concern in `execution-log.md` and implement the narrowest correct subset.
- If blocked by missing information, record the blocker in `finalization.md`
  and stop.

## Workflow

### 1. Check Prerequisites

Confirm that all required skills are present in the system-reminder skills
list: `superpowers:writing-plans`, `superpowers:test-driven-development`,
`superpowers:subagent-driven-development`, and `code-critic`.

If any skill is missing, stop with an error message listing the missing
skills. Do not proceed.

### 2. Resolve Task from GitHub

Extract the GitHub issue number from the user request.

Read via `gh issue view <number> --repo bobpps/sound-lab`:

- the issue body
- the issue comments (`--comments`)
- labels and assignees

Read related issues only when they materially improve task understanding.

### 3. Create or Resume the Worktree and Build `task-context.md`

Resolve the branch name:

- derive from issue: `feat/<issue-number>-<slug>` where slug is 2-3
  lowercase words from the issue title (e.g. `feat/12-tts-provider`)

Use this worktree path: `.claude/worktrees/<branch-name>`

If that worktree already exists:

- resume it
- inspect the current repo state and existing task artifacts
- refresh stale artifacts instead of creating conflicting copies

If the worktree does not exist:

- create it from `origin/main` when available
- otherwise create it from local `main`

If the worktree has unexpected dirty changes unrelated to the task:

- inspect the changes
- decide whether they are resumable task work or a real blocker
- if they are a real blocker, record it in `finalization.md` and stop

Write `tasks/<issue-number>/task-context.md` with at least:

- issue number, title, URL
- branch name, worktree path
- labels or priority when available
- concise issue description
- useful comment summary
- related issues read, if any
- likely repo files or directories relevant to the task

### 4. AGENT: Research and Analysis

Dispatch a general-purpose agent via the Agent tool.

Provide in the agent prompt:

- full text of `task-context.md`
- worktree path as working directory
- paths to guidance files: `CLAUDE.md`, `backend/CLAUDE.md`,
  `frontend/CLAUDE.md`
- the autonomous decision ladder for context expansion

Instruct the agent to:

- read relevant codebase files based on the task description
- read project guidance files
- expand all unknowns autonomously using the decision ladder
- write `tasks/<issue-number>/analysis.md` with: what the task requires,
  constraints from project guidance, key files or systems involved, risks,
  assumptions, unknowns resolved and how
- write initial entries to `tasks/<issue-number>/execution-log.md`

This agent does not invoke any superpowers skill. It performs pure research
and writes artifacts to disk.

After the agent completes, read `analysis.md` to verify it exists and is
substantive.

### 5. (Skipped in Auto Version)

Autonomous expansion happens inside the step 4 agent. There is no
interactive question-asking phase.

### 6. AGENT: Write Plan

Dispatch a general-purpose agent via the Agent tool.

Provide in the agent prompt:

- full text of `task-context.md`
- full text of `analysis.md`
- worktree path as working directory
- paths to guidance files

Instruct the agent to:

- invoke `superpowers:writing-plans` skill via the Skill tool
- follow its methodology to create a plan with bite-sized tasks
- **OVERRIDE:** save the plan to `tasks/<issue-number>/plan.md` instead of the
  default `docs/superpowers/plans/` path
- **OVERRIDE:** do NOT offer the execution handoff choice at the end — the
  parent session decides execution strategy
- include the plan header with goal, architecture, tech stack
- ensure each task has files, steps, and verification commands

After the agent completes, read `plan.md`. Count the number of top-level
tasks (headings matching `### Task N` or similar). This count determines the
execution strategy in step 8.

### 7. Post the Start Comment to GitHub

Before implementation starts, post a concise comment to the GitHub issue via
`gh issue comment <number>` summarizing:

- current understanding of the task
- the implementation direction
- the planned verification approach
- the fact that autonomous work has started in a dedicated worktree

If this comment cannot be posted:

- attempt a reasonable retry or recovery
- if it still fails, record the failure in `execution-log.md`
- continue only if the task work itself remains meaningful without the comment

### 8. AGENT: Execute (Adaptive)

Choose the execution strategy based on the task count from step 6.

#### Path A: Small Plan (≤3 top-level tasks) — TDD

Dispatch a general-purpose agent via the Agent tool.

Provide in the agent prompt:

- full text of `plan.md` (all tasks)
- full text of `task-context.md`
- full text of `analysis.md`
- worktree path as working directory
- paths to all project guidance files

Instruct the agent to:

- invoke `superpowers:test-driven-development` skill via the Skill tool
- follow TDD methodology (RED-GREEN-REFACTOR) for each task in the plan
- invoke `superpowers:verification-before-completion` before claiming any
  task is done — run verification commands and provide evidence
- work through all tasks sequentially
- commit after each meaningful unit of work
- update `tasks/<issue-number>/execution-log.md` with decisions, deviations,
  findings
- if TDD is not applicable for a task slice, record why in execution-log.md

#### Path B: Large Plan (>3 top-level tasks) — Subagent-Driven

Dispatch a general-purpose agent via the Agent tool.

Provide in the agent prompt:

- full text of `plan.md` (all tasks)
- full text of `task-context.md`
- full text of `analysis.md`
- worktree path as working directory

Instruct the agent to:

- invoke `superpowers:subagent-driven-development` skill via the Skill tool
- follow the subagent-driven methodology: one implementer subagent per task
  with spec reviewer and quality reviewer after each
- **OVERRIDE:** do NOT invoke `superpowers:finishing-a-development-branch` at
  the end — report results back to the parent session
- update `tasks/<issue-number>/execution-log.md` with decisions, deviations,
  findings

### 9. Verify

Run broad verification in the worktree regardless of which execution path
was used:

- `npm run build`
- `npm test`
- `npm run lint --workspace=frontend`

If verification fails:

- dispatch a fix agent with the failing output and instruct it to fix the
  issue in the worktree
- re-run verification after the fix
- if it still fails, record the blocker in `execution-log.md` and
  `finalization.md` and stop

Do not proceed past this step without clean verification output.

### 10. AGENT: Review

Dispatch a general-purpose agent via the Agent tool.

Provide in the agent prompt:

- full text of `plan.md`
- full text of `analysis.md`
- git diff summary (files changed in the worktree vs main)
- worktree path as working directory

Instruct the agent to:

- invoke `superpowers:requesting-code-review` skill via the Skill tool to
  dispatch a code-reviewer subagent for a holistic final review
- write `tasks/<issue-number>/review.md` with: diff summary, files changed,
  verification outcomes, known limitations, PR readiness status
- classify any found issues by severity: **Minor**, **Major**, or
  **Fundamental**

### 11. AGENT: Alignment Check

Dispatch a general-purpose agent via the Agent tool.

Provide in the agent prompt:

- full text of `analysis.md`
- full text of `plan.md`
- full text of `review.md`
- full text of `execution-log.md`
- git diff summary
- worktree path as working directory

Instruct the agent to:

- read `analysis.md` for original task understanding, assumptions, risks
- compare against the actual implementation by reading changed files and diff
- write `tasks/<issue-number>/alignment-check.md` with sections:
  - `## Original Analysis Summary`
  - `## What Was Implemented`
  - `## Mismatches` (with severity: Minor / Major / Fundamental for each)
  - `## Corrections Made`
  - `## Final Alignment Verdict`

### 12. AGENT: Code Critic

Dispatch a general-purpose agent via the Agent tool.

Provide in the agent prompt:

- worktree path as working directory
- branch name (for diff against main)

Instruct the agent to:

- invoke the `code-critic` skill via the Skill tool
- let code-critic analyze changes in the branch vs main
- save findings to `tasks/<issue-number>/code-critic.md`
- classify each issue by severity: **Minor**, **Major**, or **Fundamental**

### 13. Autonomous Release Gate and Adaptive Return

Read `review.md`, `alignment-check.md`, and `code-critic.md`.

**If all clean** (no blocking issues, alignment verdict positive, no critical
critic findings): proceed to step 14.

**If issues found**, classify the highest-severity issue across all three
artifacts:

**Minor** (small code quality fix, missing edge case test, style issue):

- return to step 8 with instructions to fix the specific issues
- re-run steps 9 → 10 → 11 → 12 → 13

**Major** (wrong approach, architectural issue, plan gap, missed requirement):

- return to step 6 with feedback about what needs replanning
- re-run steps 6 → 8 → 9 → 10 → 11 → 12 → 13

**Fundamental** (wrong task interpretation, invalid analysis assumptions):

- return to step 4 with feedback about what was misunderstood
- re-run steps 4 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13

**Escalation heuristic:** if the same issue persists after 2 loops at the
same severity level, escalate to the next level (Minor → Major, Major →
Fundamental). If a Fundamental issue persists after 2 loops, record it as a
technical blocker in `finalization.md` and stop.

Do not ask the user. Classify severity and loop or proceed autonomously.

### 14. Finalize Automatically

When the release gate is satisfied:

1. Stage the intended files, including all task artifacts from
   `tasks/<issue-number>/`. Artifacts are part of the audit trail and must be
   committed to the branch.
2. Create any missing commit needed for the branch.
3. Push the branch.
4. Create the PR against `main` linking the issue: `Closes #<issue-number>`.
5. Post a final GitHub issue comment with:
   - what was implemented
   - what was verified
   - the PR link
   - any notable follow-up information
6. Remove the worktree.

Write `finalization.md` with the final outcomes:

- commit or branch status
- push result
- PR link or failure
- GitHub comment result
- worktree cleanup result

If push, PR creation, or worktree removal fails:

- attempt the smallest reasonable recovery
- record the exact failure in `finalization.md`
- stop after the failure is documented

## Delegation Rules

The parent session is the orchestrator. Agents handle bounded work.

Parent session owns:

- prerequisites check
- GitHub issue reads and comments
- worktree lifecycle (create, resume, delete)
- artifact oversight (reading agent outputs, deciding next step)
- adaptive return decisions (severity classification, loop control)
- verification (step 9)
- commit, push, PR, and cleanup side effects

Agents own:

- codebase exploration and analysis (step 4)
- plan creation via `superpowers:writing-plans` (step 6)
- implementation via `superpowers:test-driven-development` or
  `superpowers:subagent-driven-development` (step 8)
- code review via `superpowers:requesting-code-review` (step 10)
- alignment comparison (step 11)
- architectural criticism via `code-critic` (step 12)

Agents must NOT:

- create or delete the worktree
- push, create the PR, or remove the worktree
- post GitHub comments
- bypass the release gate or adaptive return loop
- perform unrelated cleanup

## Resume Rules

When the task is resumed in an existing worktree:

- read `task-context.md`, `analysis.md`, `plan.md`, `execution-log.md`,
  `review.md`, `alignment-check.md`, `code-critic.md`, and
  `finalization.md` when present
- reconcile them with the current repo state
- refresh stale sections instead of starting a parallel task record

Treat the existing artifact set as the source of continuity.

## Common Mistakes

### Asking the user anyway

Do not ask the user for clarification, approval, or cleanup choices during
the run. Expand context and decide autonomously.

### Treating related issues as mandatory reading

Read related issues only when they materially improve understanding.

### Skipping prerequisites check

Do not proceed without verifying that all required skills are available.
The workflow depends on superpowers skills and code-critic.

### Not providing overrides to superpowers skills

When dispatching agents that invoke superpowers skills, always include the
required overrides:

- `superpowers:writing-plans`: save to `tasks/<issue-number>/plan.md`, skip
  execution handoff
- `superpowers:subagent-driven-development`: skip
  `finishing-a-development-branch`

### Proceeding to PR despite unresolved issues

Do not create the PR if `review.md`, `alignment-check.md`, or
`code-critic.md` contain unresolved Major or Fundamental issues.

### Running code-critic after finalization

Code-critic must run before the release gate, not after PR creation.

### Not classifying issue severity

When issues are found in steps 10-12, always classify them as Minor, Major,
or Fundamental to determine the correct return point.

### Switching the main workspace

Do not change the main workspace branch in autonomous mode. Clean up the
worktree and leave the main workspace unchanged.

### Breaking the dual-DB contract

When adding or modifying repository methods, both local (SQLite) and
Supabase implementations must be updated. A change to only one backend is
a blocking issue.

### Missing .js extensions

ESM imports without `.js` extensions will break at runtime. Every import
path must include the extension.

## Red Flags

Stop and correct the workflow if any of these happen:

- prerequisites were not checked
- implementation started before `analysis.md`
- code changes started before `plan.md`
- the execution agent was not given the correct superpowers skill override
- the user is about to be asked for clarification or approval
- the PR is about to be created before `alignment-check.md` and
  `code-critic.md`
- the final GitHub comment is being skipped
- the main workspace is about to be switched automatically
- an issue was found but severity was not classified
- a repository interface was changed without both implementations updated

## Bottom Line

Check prerequisites, use a dedicated worktree, delegate heavy work to
focused agents that invoke superpowers skills, persist reasoning on disk,
verify the implementation, run alignment check and code-critic, loop back
via adaptive return when issues arise, and create the PR only after all
gates are green.
