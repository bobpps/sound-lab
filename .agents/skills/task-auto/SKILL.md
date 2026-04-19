---
name: task-auto
description: "Autonomous Codex workflow for implementing a GitHub issue in sound-lab. Use only when explicitly invoked as $task-auto with a GitHub issue number or when the user asks for end-to-end GitHub issue implementation. Creates or resumes a dedicated .agents/worktrees worktree, writes task artifacts, researches, plans, implements, verifies, reviews, checks alignment, runs code-critic, then commits, pushes, opens a PR, pauses by default with a worktree UI review server for human approval, comments on the issue, and cleans up. Supports an explicit no-human-review flag for fully autonomous cleanup."
---

# Task Auto

## Purpose

Implement a GitHub issue in this repository with minimal user interaction.
Use a dedicated git worktree, persistent markdown artifacts, planning before
editing, verification gates, alignment checking, and `$code-critic` before PR
creation.

Active system and developer instructions always override this skill. If a
required action is forbidden by the active instructions or environment, record
the blocker in `finalization.md` and stop cleanly.

## Preconditions

- Require a GitHub issue number. If none is available, do not use this skill.
- Require `gh` CLI access to `bobpps/sound-lab`.
- Require git access to the repository remote.
- Require the `$code-critic` skill for the final architecture criticism pass.
- Use Codex subagents only when the user request and active instructions permit
  delegation. Otherwise perform the same phases locally and keep the same
  artifact contract.

Do not ask the user for clarification or approval after execution starts unless
the active system/developer instructions require it, the task cannot continue
without external credentials, or the workflow reaches an enabled Human Review
Gate before worktree cleanup.

## Invocation Flags

By default this skill enables the Human Review Gate: after PR creation it starts
a UI from the task worktree, stops for human review, and removes the worktree
only after explicit approval.

Disable the Human Review Gate only when the invocation includes an explicit
No Human Review flag or instruction such as:

- `--no-human-review`
- `no_human_review=true`
- `human_review=false`
- `review_gate=none`
- a natural-language request to run fully autonomously without local human review

When the No Human Review flag is set, the workflow runs fully autonomously
through final issue comment and worktree cleanup.

## Repository Defaults

| Item | Default |
| --- | --- |
| Task provider | GitHub Issues via `gh` CLI |
| Repo | `bobpps/sound-lab` |
| Base branch | `main` |
| Branch pattern | `feat/<issue-number>-<short-slug>` |
| Worktree root | `.agents/worktrees/` |
| Build | `npm run build` |
| Full test | `npm test` |
| Backend file-scoped test | `npx vitest run {TEST_FILE}` from `backend/` |
| Frontend lint | `npm run lint --workspace=frontend` |
| Push | `git push -u origin HEAD` |
| PR | `gh pr create --base main` |

Read project guidance before planning or editing:

- `CLAUDE.md`
- `backend/CLAUDE.md`
- `frontend/CLAUDE.md`
- `backend/src/db/interfaces.ts` when the task touches the data layer

The files are still the repository guidance source even though their names are
Claude-specific.

## Hard Rules

1. Resolve the GitHub issue before implementation.
2. Create or resume the task worktree before editing.
3. Perform all task edits inside the task worktree only.
4. Save `task-context.md`, `analysis.md`, and `plan.md` before code changes.
5. Use TDD where practical. If tests-first is not practical for a slice, record
   why in `execution-log.md`.
6. Run verification before review and finalization.
7. Run an alignment check against the original analysis.
8. Run `$code-critic` before the release gate.
9. If review, alignment, or code-critic finds issues, loop back to the right
   phase based on severity.
10. Create the commit, push, PR, and final GitHub comment only after gates pass.
11. If the Human Review Gate is enabled, start a UI review server from the task
    worktree and stop for human approval before posting the final issue comment
    or removing the worktree.
12. If the Human Review Gate is enabled, remove the worktree only after the
    human explicitly approves cleanup. Otherwise remove it automatically after
    finalization.
13. Leave the main workspace branch and files unchanged.

## Project-Specific Rules

### Dual-DB Migrations

When database schema or repository contracts change:

- Create migration SQL in both `backend/src/db/local/migrations/` and
  `backend/src/db/supabase/migrations/`.
- Update `backend/src/db/types.ts`.
- Update `backend/src/db/interfaces.ts` if contracts change.
- Implement both local SQLite and Supabase repository paths.
- Add tests using in-memory SQLite via `createTestDb()`.

Every repository interface method must be implemented by both backends.

### ESM Imports

All relative TypeScript import paths must include the `.js` extension.

### Data Rules

- Repository methods return `Promise<T>`, including SQLite wrappers.
- "Not found" returns `null`; only constraint violations throw.
- API keys must be encrypted via `crypto.ts`.
- Prefix intentionally unused variables with `_`.

### Commit Message Format

Use conventional commits with the issue reference, for example:

```text
feat: add TTS provider registry (#12)
fix: handle missing provider config (#34)
```

## Artifact Contract

Store all artifacts inside the worktree under `tasks/<issue-number>/`.

| File | Purpose |
| --- | --- |
| `task-context.md` | Normalized issue record and repo context |
| `analysis.md` | Requirements, constraints, key files, risks, assumptions |
| `plan.md` | Implementation plan with tasks, files, and checks |
| `execution-log.md` | Decisions, deviations, research, TDD exceptions |
| `review.md` | Diff summary, verification, readiness, reviewer findings |
| `alignment-check.md` | Comparison of implementation to original analysis |
| `code-critic.md` | Findings from `$code-critic` |
| `finalization.md` | Commit, push, PR, comment, and cleanup outcomes |

Keep artifacts concise and useful for audit.

## Workflow

### 1. Resolve The Issue

Extract the issue number from the user request. Read the issue, labels,
assignees, and comments:

```bash
gh issue view <number> --repo bobpps/sound-lab --comments
```

Read related issues only when they materially clarify scope, dependencies, or
expected behavior.

### 2. Create Or Resume The Worktree

Derive the branch name as `feat/<issue-number>-<slug>`, where the slug is two
or three lowercase words from the issue title.

Use `.agents/worktrees/<branch-name>` as the worktree path. If the worktree
already exists, resume it and reconcile existing artifacts with the current git
state. If it does not exist, create it from `origin/main` when available,
otherwise from local `main`.

If the worktree contains unexpected dirty changes, inspect them. Treat resumable
task work as continuity; treat unrelated or unsafe changes as a blocker and
record it in `finalization.md`.

### 3. Write `task-context.md`

Include:

- issue number, title, URL
- branch name and worktree path
- labels, assignees, and priority when available
- concise issue description
- useful comment summary
- related issues read, if any
- likely repo areas involved

### 4. Analyze

Read the project guidance and relevant code. Expand unknowns using this ladder:

1. repository files and guidance
2. GitHub issue details and comments
3. related GitHub issues
4. official external documentation or web research when current facts matter
5. other trusted sources available in the environment

Write `analysis.md` with requirements, constraints, involved systems, risks,
assumptions, and resolved unknowns. Start `execution-log.md` with the research
path and decisions.

### 5. Plan

Write `plan.md` before editing. Include:

- goal and scope
- relevant architecture and tech stack
- task list with files or directories
- test and verification commands per task
- risks and rollback notes when useful

Keep tasks small enough that each can be verified.

### 6. Post Start Comment

Post a concise issue comment that autonomous work has started, with the current
understanding, implementation direction, and verification approach.

If posting fails, retry once when reasonable, record the failure in
`execution-log.md`, and continue only if implementation remains meaningful.

### 7. Implement

Follow the plan. Use tests first where practical:

1. write or update a failing test
2. implement the smallest change that passes
3. refactor while keeping tests green

When delegation is permitted, split work into bounded scopes and tell each
worker that other agents may be editing the codebase. Workers must not push,
create PRs, delete worktrees, or perform unrelated cleanup.

Update `execution-log.md` with decisions, deviations, and any skipped TDD
rationale.

### 8. Verify

Run broad verification from the worktree:

```bash
npm run build
npm test
npm run lint --workspace=frontend
```

If a command fails, fix the cause and rerun verification. Do not proceed to the
release gate without clean verification or a documented blocker.

### 9. Review

Review the final diff against `main`. Write `review.md` with:

- changed files and behavioral summary
- verification commands and outcomes
- known limitations
- issues classified as Minor, Major, or Fundamental
- PR readiness status

### 10. Alignment Check

Compare `analysis.md`, `plan.md`, and the actual diff. Write
`alignment-check.md` with:

- original analysis summary
- what was implemented
- mismatches with severity
- corrections made
- final alignment verdict

### 11. Code Critic

Use `$code-critic` on the worktree changes against `main`. Save the result as
`tasks/<issue-number>/code-critic.md`. Classify any issue as Minor, Major, or
Fundamental if the critic output does not already do so.

### 12. Release Gate

Read `review.md`, `alignment-check.md`, and `code-critic.md`.

- If all are clean, proceed to finalization.
- If the highest issue is Minor, fix it and rerun verification, review,
  alignment, and code-critic.
- If the highest issue is Major, replan from step 5, then rerun downstream
  steps.
- If the highest issue is Fundamental, redo analysis from step 4, then rerun
  downstream steps.

If the same issue survives two loops at the same severity, escalate one level.
If a Fundamental issue survives two loops, record the technical blocker in
`finalization.md` and stop.

### 13. Finalize

When gates pass:

1. Stage intended implementation files and task artifacts.
2. Create any missing commit.
3. Push the branch.
4. Create a PR against `main` that links the issue with `Closes #<number>`.
5. If the Human Review Gate is enabled, start a worktree UI review environment:
   - Run the app from the task worktree, not the main checkout.
   - Use the normal dev command when possible. If default ports are occupied,
     use alternate free ports and document them.
   - Include backend and frontend URLs, process IDs, and any special commands
     in `finalization.md`.
   - Open the relevant UI route in the browser when browser tooling is
     available, and run a quick console/screenshot sanity check when practical.
6. If the Human Review Gate is enabled, stop and ask the human to review the PR
   and the running worktree UI. Do not continue cleanup until the human
   explicitly says to proceed.
7. If the human requests changes, keep the worktree, implement the requested
   fixes, rerun verification/review/alignment/code-critic as needed, update the
   PR branch, and return to the Human Review Gate.
8. If the Human Review Gate is enabled and approval is granted, stop the review
   servers unless the human asks to keep them running.
9. Post a final issue comment with implemented scope, verification, PR link,
   and notable follow-up information.
10. Remove the worktree.

Write `finalization.md` with commit or branch status, push result, PR link,
GitHub comment result, Human Review Gate status, UI review server details when
enabled, human approval status when applicable, and worktree cleanup result. If
any finalization step fails, attempt the smallest reasonable recovery, record
the exact failure, and stop.

## Common Mistakes

- Starting code changes before `analysis.md` and `plan.md`.
- Asking the user for clarification during an autonomous run instead of
  expanding context and making a narrow, reversible decision.
- Creating a PR before review, alignment, code-critic, and verification pass.
- Failing to classify review issues by severity.
- Editing the main workspace instead of the dedicated worktree.
- Updating only one side of the dual-DB implementation.
- Forgetting `.js` extensions in ESM imports.
- Removing the worktree before explicit human approval when the Human Review
  Gate was enabled.
- Skipping the final GitHub issue comment.
