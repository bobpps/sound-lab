# Task Context — Issue #18

## Issue
- **Number:** 18
- **Title:** Task 17: Auto-annotation service + route
- **URL:** https://github.com/bobpps/sound-lab/issues/18
- **State:** OPEN
- **Labels:** backend
- **Comments:** 0
- **Depends on:** #8 (CLOSED/merged), #16 (OPEN)

## Branch & Worktree
- **Branch:** `feat/18-auto-annotation`
- **Worktree:** `.claude/worktrees/feat/18-auto-annotation`
- **Base:** `origin/main` (at `19fab66`)

## Description

Implement an auto-annotation service that processes dialog messages one-by-one through an LLM, building conversation history, and creates AnnotatedDialog + AnnotatedMessage entries with SSML output.

**Endpoint:** `POST /services/annotate`

**Request body:**
```json
{
  "dialogId": 1,
  "providerId": "openai",
  "model": "gpt-4o",
  "annotationPromptId": 5,
  "ttsProviderId": "elevenlabs",
  "title": "SSML v1 auto"
}
```

**Response:** `AnnotatedDialogWithMessages`

## Steps from Issue
1. Write service tests (dialog with 3 messages + annotation prompt, LLM called 3x with growing history, AnnotatedDialog created, annotated messages stored with SSML)
2. Run tests — fail (RED)
3. Implement `autoAnnotate()` service
4. Write route test + implement route
5. Run all tests — pass (GREEN)
6. Commit

## Files to Create/Modify
- **Create:** `backend/src/services/auto-annotation.ts`
- **Create:** `backend/tests/services/auto-annotation.test.ts`
- **Modify:** `backend/src/routes/services/index.ts`

## Key Repo Areas to Investigate
- `backend/src/db/interfaces.ts` — repository contracts
- `backend/src/db/types.ts` — DB types (AnnotatedDialog, AnnotatedMessage, Dialog, Message, AnnotationPrompt)
- `backend/src/services/` — existing service patterns
- `backend/src/routes/services/` — existing service routes
- `backend/src/llm/` — LLM provider interfaces and registry
- `backend/tests/services/` — existing service test patterns
- `backend/src/db/local/` and `backend/src/db/supabase/` — dual-DB implementations
