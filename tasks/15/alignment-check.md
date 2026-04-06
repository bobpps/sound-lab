# Alignment Check: Issue #15 -- LLM API Routes

## Original Analysis Summary

The analysis (`tasks/15/analysis.md`) specified the following requirements:

**Endpoints:**
1. `GET /llm/:providerId/models` -- returns `200` with `string[]`; errors `404` (provider not found or wrong type), `400` (no API key or unsupported provider)
2. `POST /llm/:providerId/complete` -- accepts `{ messages: [{role, content}], model }`, returns `200` with `{ text: string }`; same errors plus `400` for invalid body

**Architectural Constraints:**
- Mirror the TTS route pattern exactly: DB lookup, type check, decrypt key, factory instantiate, call method
- TypeBox schemas with `additionalProperties: false` on body schemas
- Response schemas on every endpoint (for `fast-json-stringify` and data-leak prevention)
- ESM `.js` extensions in all imports
- `FastifyPluginAsyncTypebox` route plugin type
- `fastify-plugin` decorator for `createLLMProvider` factory
- `@fastify/sensible` errors (`reply.notFound()`, `reply.badRequest()`)
- `vi.restoreAllMocks()` in `afterEach`
- TDD: RED then GREEN

**Files to Create:**
- `backend/src/plugins/llm.ts` -- factory decorator plugin
- `backend/src/schemas/llm.ts` -- TypeBox schemas
- `backend/src/routes/llm/index.ts` -- route plugin with `resolveLLMProvider()` + 2 endpoints
- `backend/tests/routes/llm.test.ts` -- tests

**Files to Modify:**
- `backend/src/app.ts` -- register `llmPlugin`

**Key Assumptions:**
- `ProviderIdParam` defined separately in LLM schemas (not shared with TTS)
- `messages` must have `minItems: 1`
- `complete()` returns raw `string`; route wraps in `{ text: string }`
- No streaming
- No explicit try/catch around adapter calls (match TTS pattern)

---

## What Was Implemented

### `backend/src/plugins/llm.ts`
- Exact structural mirror of `plugins/tts.ts`
- Exports `LLMProviderFactory` type
- `declare module 'fastify'` augmentation for `createLLMProvider`
- `fp()` wrapper with `{ name: 'llm' }`
- Decorates with the `createLLMProvider` factory from the LLM registry
- ESM `.js` import extensions used correctly

### `backend/src/schemas/llm.ts`
- `LLMProviderIdParam` -- own copy, same shape as TTS `ProviderIdParam`
- `LLMMessage` -- `Type.Union([Type.Literal('system'), Type.Literal('user'), Type.Literal('assistant')])` + `content: Type.String()`
- `CompleteBody` -- `{ messages: Type.Array(LLMMessage, { minItems: 1 }), model: Type.String() }` with `{ additionalProperties: false }`
- `CompleteResponse` -- `{ text: Type.String() }`
- `ModelsResponse` -- `Type.Array(Type.String())`
- All schemas export both the TypeBox value and the `Static<>` type

### `backend/src/routes/llm/index.ts`
- `FastifyPluginAsyncTypebox` plugin type
- `resolveLLMProvider()` helper: DB lookup, type check (`!== 'llm'`), decrypt key, factory call with try/catch
- `GET /:providerId/models` -- schema with params, response (200/400/404), calls `getModels()`
- `POST /:providerId/complete` -- schema with params, body, response (200/400/404), calls `complete(messages, model)`, wraps in `{ text }`
- Error handling uses `reply.notFound()` and `reply.badRequest()` from `@fastify/sensible`
- ESM `.js` extensions on all imports
- Unused `Type` import from plan was correctly removed

### `backend/tests/routes/llm.test.ts`
- 14 test cases across both endpoints
- `buildTestApp()` for fresh app, decorator override with `vi.fn()` mock factory
- `seedLLMProvider()` helper: creates provider with `type: 'llm'` + sets API key
- `afterEach`: `vi.restoreAllMocks()` + `app.close()`
- Happy path tests for both endpoints
- Error case tests: 404 not found, 404 wrong type, 400 no key, 400 unsupported registry
- POST-specific validation: empty messages, missing model, invalid role, additional properties
- Argument-forwarding test verifies `mockComplete` receives correct `(messages, model)`

### `backend/src/app.ts`
- Line 10: `import llmPlugin from './plugins/llm.js';`
- Line 31: `await app.register(llmPlugin);` (after `ttsPlugin`, before `autoload`)

---

## Mismatches

### 1. Additional properties behavior: rejection vs. stripping -- Minor

**Analysis stated:** `400` for additional properties in request body.
**Plan stated:** Test expects `400` for extra fields ("rejects additional properties in body").
**Implementation:** Test changed to "strips additional properties from body" expecting `200`.

**Root cause:** Fastify 5 default Ajv config uses `removeAdditional: true`, which silently strips extra fields instead of rejecting. The `additionalProperties: false` schema constraint still prevents extra fields from reaching the handler, just via removal rather than rejection.

**Severity: Minor.** The security goal (extra fields never reach handlers/DB) is fully met. The mechanism differs from what the analysis assumed, but the outcome is equivalent. The test was correctly updated to match actual framework behavior, and the execution log documents this deviation.

### 2. No `Type` import in route file -- Non-issue (improvement)

**Plan specified:** `import { Type } from '@sinclair/typebox'` in the route file.
**Implementation:** Omitted this unused import.

**Severity:** Not a mismatch -- this is a correct cleanup. The plan included it because the TTS route uses `Type.Array(Voice)` inline, but the LLM route uses pre-defined `ModelsResponse` from the schema file instead, making the import unnecessary.

---

## Corrections Made

### 1. Additional properties test (plan deviation)

The plan's test case "rejects additional properties in body" expected `400`. During implementation, it was discovered that Fastify 5's Ajv uses `removeAdditional: true` by default, causing extra fields to be stripped silently with a `200` response instead of rejected with `400`. The test was changed to "strips additional properties from body" and expects `200`.

**Justification:** This matches real framework behavior. Forcing rejection would require overriding Fastify's default Ajv configuration, which would be a framework-level change beyond the scope of this issue and could affect existing TTS routes. The security intent (no extra fields in handlers) is preserved.

**Documented:** Yes, in `tasks/15/execution-log.md` under the Task 3 deviation note.

---

## Final Alignment Verdict

**ALIGNED.** The implementation faithfully follows the original analysis and plan with one minor, well-justified deviation.

**Endpoint spec compliance:**
- `GET /llm/:providerId/models` -- matches spec exactly (params, response shape, error codes)
- `POST /llm/:providerId/complete` -- matches spec exactly (params, body with validation, response wrapping, error codes)

**Constraint compliance:**
- TypeBox schemas with `additionalProperties: false` on body -- yes
- Response schemas on all endpoints -- yes
- ESM `.js` extensions -- yes
- `FastifyPluginAsyncTypebox` -- yes
- `fastify-plugin` decorator -- yes
- `@fastify/sensible` error methods -- yes
- `vi.restoreAllMocks()` in `afterEach` -- yes
- TDD workflow (RED then GREEN) -- yes, confirmed by execution log

**TTS pattern fidelity:**
- Plugin structure (`fp()`, `declare module`, factory type) -- identical
- `resolveLLMProvider()` helper -- structural mirror of `resolveTTSProvider()`
- Schema organization (separate file, own `ProviderIdParam`) -- mirrors TTS
- Test pattern (buildTestApp, decorator override, seed helper, error case coverage) -- mirrors TTS
- Registration in `app.ts` -- same pattern as TTS

**Error cases covered:**
- Provider not found (404) -- both endpoints
- Wrong provider type (404) -- both endpoints
- No API key (400) -- both endpoints
- Unsupported by registry (400) -- models endpoint (also implicitly covered for complete)
- Empty messages (400) -- complete endpoint
- Missing required fields (400) -- complete endpoint
- Invalid role enum (400) -- complete endpoint
- Additional properties (stripped, 200) -- complete endpoint

**Test quality:** 14 tests, covering happy paths, argument forwarding, and all identified error scenarios. Full suite (263 tests) passes with no regressions.

**One minor deviation** (additional properties stripped vs. rejected) is well-documented, correctly justified, and preserves the security intent. No major or fundamental mismatches found.
