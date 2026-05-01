---
name: bug-investigator
description: >
  This skill should be used when the user reports a bug or broken behavior in sound-lab and
  wants Claude to investigate it end-to-end: collect a reproduction, create a GitHub issue in
  English, reproduce the problem in the browser using DevTools or Playwright, inspect the root
  cause, and update the issue with findings. Triggers on phrases like "investigate this bug",
  "something is broken", "not working", "look into this issue", "reproduce the bug",
  "find the root cause", or when a user pastes an error and wants it traced.
---

# Bug Investigator

Drive a bug from a vague report to an actionable GitHub issue with root-cause notes.
Prefer a tight investigation loop: clarify → reproduce → inspect → document → repeat.

## Preconditions

Before starting, read and follow:

- `CLAUDE.md` — project-wide rules (authoritative even though the file name references Claude)
- `backend/CLAUDE.md` when backend behavior may be involved
- `frontend/CLAUDE.md` when frontend behavior may be involved

Write every GitHub issue title and description in English.
Fix causes, not symptoms — do not stop at the first visible failure if it looks secondary.

## Intake Workflow

Collect the minimum information required to open and investigate the bug.
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

Use the `gh` CLI against `bobpps/sound-lab`:

```bash
gh issue create \
  --repo bobpps/sound-lab \
  --title "Short factual title in English" \
  --label bug \
  --body "$(cat <<'EOF'
## Summary
…

## Actual behavior
…

## Expected behavior
…

## Steps to reproduce
1. …
2. …

## Environment
- Route/page: …
- Browser: …
- Auth state: …

## Evidence
…

## Investigation status
🔍 In progress
EOF
)"
```

If the `bug` label does not exist, still create the issue without `--label bug` and note that label assignment was skipped.

After creation, record the issue number and append investigation updates as comments:

```bash
gh issue comment <NUMBER> --repo bobpps/sound-lab --body "..."
```

Edit the main body only when it has become clearly stale.

## Reproduction Workflow

Use DevTools MCP as the primary browser tool for both reproduction and inspection.
Use Playwright MCP only as fallback when DevTools is insufficient or the flow benefits from scripted automation.

During reproduction:

- Follow the user-provided steps exactly before improvising.
- Record the exact route, inputs, test data, viewport, and account state used.
- Check whether the behavior is deterministic or intermittent.
- Capture:
  - screenshot of the failure state
  - console errors or warnings
  - failing network requests and payloads
  - DOM state that contradicts expected UI behavior

If the first reproduction attempt fails:

1. Compare the actual environment to the user's report.
2. Try the smallest reasonable variations.
3. Escalate to Playwright only if scripted repetition, auth flow stabilization, or deterministic replay would help.
4. Do not brute-force random flows.
5. Return to the user with targeted questions that explain what could not be matched.

## Root Cause Analysis

Use DevTools MCP to inspect the most plausible layer:

- console messages and stack traces (`list_console_messages`, `get_console_message`)
- network requests and payloads (`list_network_requests`, `get_network_request`)
- rendered DOM and state transitions (`take_snapshot`)
- localStorage / sessionStorage when relevant (`evaluate_script`)
- backend responses and schema mismatches implied by the UI

Keep asking: "Is this the root cause or a consequence?"

Do not claim root cause unless there is a concrete causal chain from user action to failure.
If multiple hypotheses remain, rank them and state which one is best supported by evidence.

Use the `superpowers:systematic-debugging` skill for complex bugs where the causal chain is unclear.

## Playwright Fallback

Use Playwright MCP only when one of these conditions is true:

- the flow must be repeated many times with exact timing
- DevTools interaction is too manual to keep the scenario stable
- reproduction depends on a long scripted setup
- post-fix regression verification needs deterministic replay

When Playwright is used, keep DevTools as the main inspection surface for console, network, and DOM analysis.

## GitHub Update Rules

If the bug is reproduced and the likely root cause is identified, add an issue comment in English with:

- reproduction status (✅ Reproduced / ❌ Not reproduced)
- exact reproduction path used
- observed technical cause
- affected area (component / hook / API endpoint / service)
- recommended fix direction — implementation-oriented, not vague (mention the component, hook, API contract, validation gap, or state transition that likely needs to change)
- open risks or unknowns

If the bug is not yet reproduced, add a concise issue comment describing:

- what was tried
- what did not match
- which evidence is missing
- what additional user input is required

Then return to the user and continue the clarification loop.

## Investigation Loop

Repeat this cycle until one of these states is reached:

1. **Reproduced and likely cause found** — update issue and report to user.
2. **Reproduced but cause still unclear** — keep inspecting, update issue with current evidence, continue.
3. **Not reproduced** — ask the user for narrower steps, data, screenshots, or account context.

Do not silently stop after a failed reproduction attempt.

## Output Expectations

- Keep user-facing updates short and concrete.
- Keep all GitHub content in English even when the conversation is in another language.
- Preserve exact evidence, but summarize long logs instead of pasting noise.
- Include file or subsystem names when the likely cause points to specific code ownership.
