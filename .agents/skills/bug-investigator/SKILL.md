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

## Reproduction Workflow

Use DevTools as the primary browser tool for both reproduction and inspection.
Use Playwright only as fallback when DevTools is insufficient or when the flow is easier to stabilize with scripted automation.

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
