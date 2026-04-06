# Task Context — Issue #13

## Issue
- **Number:** 13
- **Title:** Task 12: LLM provider interface + registry + OpenAI adapter
- **URL:** https://github.com/bobpps/sound-lab/issues/13
- **Labels:** backend, providers
- **State:** OPEN
- **Comments:** 0

## Branch & Worktree
- **Branch:** `feat/13-llm-providers`
- **Worktree:** `.claude/worktrees/feat/13-llm-providers`
- **Base:** `origin/main` (ad69ecf)

## Issue Description

Phase 4: Backend LLM Providers (1/3). Define LLM provider abstraction and implement OpenAI adapter.

**Files to create:**
- `backend/src/providers/llm/types.ts`
- `backend/src/providers/llm/registry.ts`
- `backend/src/providers/llm/openai.ts`
- `backend/tests/providers/openai-llm.test.ts`

**Interfaces required:**
- `ILLMMessage` — role: 'system'|'user'|'assistant', content: string
- `ILLMProvider` — id, name, getModels() → string[], complete(messages, model) → string

**Steps from issue:**
1. Create `src/providers/llm/types.ts`
2. Install: `npm install openai`
3. Write tests — mock OpenAI SDK, test getModels() and complete()
4. Run tests — fail
5. Implement `OpenAILLMProvider`: getModels() filters gpt-* models, complete() uses chat.completions.create
6. Create registry with `createLLMProvider(id, apiKey)`
7. Run tests — pass
8. Commit

**Depends on:** #2 (providers CRUD — already merged)

## Relevant Repo Files & Directories
- `backend/src/providers/tts/` — existing TTS provider pattern (types, registry, adapters)
- `backend/src/providers/tts/types.ts` — ITTSProvider interface pattern
- `backend/src/providers/tts/registry.ts` — registry factory pattern
- `backend/src/providers/tts/elevenlabs.ts` — adapter implementation pattern
- `backend/tests/providers/elevenlabs.test.ts` — test pattern (vi.stubGlobal('fetch'))
- `backend/tests/providers/registry.test.ts` — registry test pattern
- `backend/CLAUDE.md` — backend conventions
- `docs/plans/2026-04-04-full-project-plan.md` — full project plan

## Key Conventions
- ESM: all imports must include `.js` extension
- Provider IDs are natural string keys ("openai")
- TDD: write tests first, then implement
- Tests use `vi.stubGlobal('fetch')` for mocking external APIs
- Provider pattern: interface → adapter classes → registry factory
- `validateCredentials()` method on all providers
