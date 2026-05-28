---
name: bug-investigator
description: "Investigate product or UI bugs in the sound-lab repository. Use when the user reports broken behavior and wants Codex to collect reproduction details, request screenshots when needed, create a new GitHub bug issue in English, reproduce the problem in the browser, inspect the root cause, and update the GitHub issue with findings or follow-up questions until the bug is reproducible and the likely cause is understood."
---

# Bug Investigator

## Overview

Drive a bug from vague report to actionable GitHub issue with root-cause notes.
Prefer a tight investigation loop: clarify, reproduce, inspect, document, repeat.

## Preconditions

- Read and follow:
  - `CLAUDE.md`
  - `backend/CLAUDE.md` when backend behavior may be involved
  - `frontend/CLAUDE.md` when frontend behavior may be involved
- Treat `CLAUDE.md` as authoritative even though the file name references Claude.
- Write every GitHub issue title and description in English.
- Fix causes, not symptoms. Do not stop at the first visible failure if it looks secondary.
- After the GitHub issue is created, do all investigation and implementation work inside a dedicated git worktree, not in the main checkout.

## Intake Workflow

Start by collecting the minimum information required to open and investigate the bug.
Ask concise questions and avoid asking everything at once unless the report is nearly empty.

Collect:

1. What is broken.
2. What the user expected instead.
3. Exact reproduction steps.
4. Environment details when relevant:
   - page or route
   - provider, dataset, browser, auth state, feature flag, device size
5. Evidence:
   - screenshot
   - screen recording
   - console error text
   - network failure details

If the report is too vague to create a useful issue, ask follow-up questions first.
If a screenshot or recording would materially reduce ambiguity, ask for it explicitly.

## GitHub Issue Workflow

Create a new GitHub issue as soon as there is enough information to describe:

- observed behavior
- expected behavior
- current reproduction steps
- environment details
- evidence available so far

Prefer `gh` CLI against `bobpps/sound-lab`.

Issue shape:

- Title: short, factual, in English
- Label: `bug` when available
- Body sections:
  - Summary
  - Actual behavior
  - Expected behavior
  - Steps to reproduce
  - Environment
  - Evidence
  - Investigation status

If the `bug` label does not exist, still create the issue and note that label assignment was skipped.

After creation, keep the issue number and append investigation updates as comments unless the main body has clearly become stale and needs editing.

## Branch And Worktree Workflow

Immediately after creating the GitHub issue:

1. Create a GitHub-linked branch with:
   - `gh issue develop <issue-number> --checkout=false`
2. Determine the created branch name.
3. Create a local worktree at:
   - `.agents/worktrees/<branch-name>`
4. Base that worktree on the created branch.
5. Switch local work to that worktree and treat it as the active checkout for the rest of the task.

If the worktree already exists:

- inspect its status before proceeding
- resume work there if it is clearly the same bug investigation
- do not discard existing changes unless the user explicitly asks for it

After this point:

- run all shell commands from the worktree path
- read, reproduce, debug, edit, test, commit, and verify only from that worktree
- leave the main checkout unchanged

If branch creation or worktree creation fails, stop and report the exact blocker instead of continuing in the main checkout.

## Operational Contract

Use this exact sequence unless there is a concrete repository-specific reason to deviate.

### 1. Create The GitHub-Linked Branch

Run:

```bash
gh issue develop <issue-number> --checkout=false
```

Requirements:

- do not create an ad hoc local branch first
- do not continue until the command succeeds
- treat the created issue number as the canonical bug identifier for branch naming and artifacts

### 2. Resolve The Branch Name

Determine the branch name created for the issue.
Prefer a direct git or `gh` query over assumptions.

Acceptable approaches include:

```bash
gh issue view <issue-number>
git branch -r
git ls-remote --heads origin
```

Requirements:

- identify the exact branch ref that was created for the issue
- do not guess the branch name from the issue title if it can be queried directly

### 3. Create The Local Worktree

Use this path convention:

```text
.agents/worktrees/<branch-name>
```

Create the worktree from the branch:

```bash
git worktree add .agents/worktrees/<branch-name> <branch-name>
```

If the branch exists only on `origin`, create the tracking local branch as part of the worktree creation flow.

Requirements:

- create the `.agents/worktrees` directory if needed
- do not create the worktree under any other path unless the user explicitly asks
- if the target worktree path already exists, inspect and resume instead of recreating blindly

### 4. Verify The Worktree Binding

Before doing any debugging or edits, verify all of the following from the worktree path:

```bash
git rev-parse --show-toplevel
git branch --show-current
git status --short
git worktree list
```

Confirm:

- the current top-level path is the worktree path, not the main checkout
- the current branch matches the issue branch
- the worktree is attached to the expected branch
- any existing dirty state is understood before proceeding

If these checks fail, stop and fix the checkout state first.

### 4.5. Generate Isolated Port Configuration

Run from the worktree root:

```powershell
pwsh ../../scripts/setup-worktree-env.ps1 -IssueNumber <issue-number>
```

This creates `backend/.env.local` and `frontend/.env.local` with unique
`BACKEND_PORT` and `FRONTEND_PORT` values so the worktree's dev servers do not
collide with the main checkout or other parallel worktrees.

Capture the printed `Backend:` and `Frontend:` URLs. Treat the printed
`Frontend:` URL as the canonical address for this investigation:

- use it as the target for `npm run dev` browser checks
- use it for every DevTools or Playwright MCP `navigate` call
- never assume `localhost:5173` or `localhost:3000` while inside a worktree

If the script reports that `.env.local` files already exist, inspect them to
confirm they belong to this same investigation. Pass `-Force` only if you
intentionally want to regenerate the ports.

### 5. Switch All Further Work To The Worktree

After verification:

- run all subsequent shell commands with the worktree as `workdir`
- open, edit, test, and commit only inside the worktree
- treat any command still pointing at the main checkout as a workflow violation

### 6. Preserve Main Checkout Safety

Never investigate or patch the bug from the main checkout after the worktree exists.

Forbidden behaviors:

- editing files in the main checkout
- running implementation commands from the main checkout by accident
- creating a second unrelated branch for the same issue
- deleting or overwriting an existing investigation worktree without inspection

## Reproduction Workflow

Use DevTools as the primary browser tool for both reproduction and inspection.
Use Playwright only as fallback when DevTools is insufficient or when the flow is easier to stabilize with scripted automation.

Before reproducing the bug, confirm that the current working checkout is the dedicated worktree created for this issue.

Determine the actual frontend URL from `frontend/.env.local` (or the saved
output of `setup-worktree-env.ps1`). Never default to `localhost:5173` while
inside a worktree — the dev server runs on a worktree-specific port.

During reproduction:

- Use the user-provided steps exactly before improvising.
- Record the exact route, inputs, test data, viewport, and account state used.
- Check whether the behavior is deterministic or intermittent.
- Capture:
  - screenshot of the failure state
  - console errors or warnings
  - failing network requests
  - DOM state that contradicts expected UI behavior

If the first reproduction attempt fails:

1. Compare the actual environment to the user's report.
2. Try the smallest reasonable variations.
3. Escalate to Playwright only if scripted repetition, auth flow stabilization, or deterministic replay would help.
4. Do not brute-force random flows.
5. Return to the user with targeted questions that explain what could not be matched.

## Root Cause Analysis

Use DevTools to inspect the most plausible layer:

- console and stack traces
- network requests and payloads
- rendered DOM and state transitions
- local/session storage when relevant
- backend responses and schema mismatches implied by the UI

Keep asking: "Is this the root cause or a consequence?"

Do not claim root cause unless there is a concrete causal chain from user action to failure.
If multiple hypotheses remain, rank them and state which one is best supported by evidence.

## Playwright Fallback

Use Playwright only when one of these conditions is true:

- the flow must be repeated many times with exact timing
- DevTools interaction is too manual to keep the scenario stable
- reproduction depends on a long scripted setup
- post-fix regression verification needs deterministic replay

When Playwright is used, keep DevTools as the main inspection surface for console, network, and DOM analysis.

## GitHub Update Rules

If the bug is reproduced and the likely root cause is identified, add an issue comment in English with:

- reproduction status
- exact reproduction path used
- observed technical cause
- affected area
- recommended fix direction
- open risks or unknowns

Recommended fix direction should be implementation-oriented, not vague. Example: mention the component, hook, API contract, validation gap, or state transition that likely needs to change.

If the bug is not yet reproduced, add a concise issue comment describing:

- what was tried
- what did not match
- which evidence is missing
- what additional user input is required

Then return to the user and continue the clarification loop.

## Investigation Loop

Repeat this cycle until one of these states is reached:

1. Reproduced and likely cause found.
2. Reproduced but cause still unclear.
   - keep inspecting and update the issue with current evidence
3. Not reproduced.
   - ask the user for narrower steps, data, screenshots, or account context

Do not silently stop after a failed reproduction attempt.

## Output Expectations

When using this skill in a live task:

- Keep user-facing updates short and concrete.
- Keep GitHub content in English even if the conversation is in another language.
- Preserve exact evidence, but summarize long logs instead of pasting noise.
- Include file or subsystem names when the likely cause points to specific code ownership.
- Mention the issue number, branch name, and worktree path once they are created.
