# Task Context: Issue #14 — Anthropic LLM Adapter

- **Issue:** #14
- **Title:** Task 13: Anthropic Claude LLM adapter
- **URL:** https://github.com/bobpps/sound-lab/issues/14
- **Labels:** backend, providers
- **Branch:** `feat/14-anthropic-llm`
- **Worktree:** `.claude/worktrees/feat/14-anthropic-llm`

## Description

Implement the Anthropic Claude LLM adapter for the Sound Lab backend. This adds Anthropic/Claude as an LLM provider alongside the planned OpenAI adapter.

## Dependency: Issue #13

Issue #13 (LLM provider interface + registry + OpenAI adapter) is **not yet implemented**. The LLM provider infrastructure (`types.ts`, `registry.ts`) does not exist yet. This task must create the LLM types and registry as prerequisite infrastructure, then implement the Anthropic adapter on top.

**Scope decision:** Implement the LLM types (`ILLMMessage`, `ILLMProvider`) and registry (`createLLMProvider`) as part of this PR, since they are required for the Anthropic adapter. The OpenAI adapter from #13 is out of scope — only the Anthropic adapter will be registered.

## Files to Create

- `backend/src/providers/llm/types.ts` — `ILLMMessage`, `ILLMProvider` interfaces
- `backend/src/providers/llm/registry.ts` — `createLLMProvider(id, apiKey)` factory
- `backend/src/providers/llm/anthropic.ts` — `AnthropicLLMProvider` class
- `backend/tests/providers/anthropic-llm.test.ts` — tests for the Anthropic adapter

## Files to Modify

- `backend/package.json` — add `@anthropic-ai/sdk` dependency

## Key Interfaces (from #13 spec)

```typescript
interface ILLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ILLMProvider {
  readonly id: string;
  readonly name: string;
  getModels(): Promise<string[]>;
  complete(messages: ILLMMessage[], model: string): Promise<string>;
}
```

## Relevant Patterns

- **TTS provider pattern:** `backend/src/providers/tts/` — types.ts defines interfaces, registry.ts maps provider IDs to constructors, each adapter implements the interface
- **Test pattern:** `backend/tests/providers/elevenlabs.test.ts` — mock `fetch` via `vi.stubGlobal`, test each method with various scenarios
- **For Anthropic SDK:** mock the SDK constructor and methods rather than fetch, since the SDK handles HTTP internally
- **ESM:** all imports must use `.js` extensions
- **Provider IDs:** natural string keys (e.g. `"anthropic"`)

## Anthropic-Specific Notes

- `getModels()` returns a curated list of Claude models (not an API call)
- `complete()` must extract system messages separately (Anthropic API has a dedicated `system` parameter, not a system role in messages array)
- Uses `@anthropic-ai/sdk` `messages.create` method
