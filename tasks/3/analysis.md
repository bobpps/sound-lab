# Analysis: Issue #3 -- TypeBox Request/Response Schemas

## What the Task Requires

Create TypeBox schemas in `backend/src/schemas/` that serve as both:
1. **JSON Schema** for Fastify request validation and response serialization
2. **TypeScript types** via `Static<typeof Schema>` for type-safe route handlers

Five schema files to create:
- `common.ts` -- shared param/error schemas
- `provider.ts` -- provider entity schemas
- `dialog.ts` -- dialog + message schemas
- `annotation.ts` -- annotated dialog + message schemas
- `prompt.ts` -- annotation prompt + agent prompt schemas

## Constraints from Project Guidance

### From `CLAUDE.md` (root)
- ESM everywhere -- `.js` extensions in imports
- TDD by default -- write tests first

### From `backend/CLAUDE.md`
- **TypeBox is the single source of truth** -- schemas are simultaneously JSON Schema (validation/serialization) and TypeScript types
- **Always define response schemas** -- enables `fast-json-stringify` and prevents data leaks
- Use `.withTypeProvider<TypeBoxTypeProvider>()` for automatic type inference
- Registration order: schemas -> infrastructure plugins (DB, auth) -> routes

### From `tsconfig.json`
- `strict: true` -- all optional fields must be explicitly typed
- `module: ESNext`, `moduleResolution: bundler`
- `target: ES2022`

## Key Files and Systems Involved

### Source of Truth (input)
- `backend/src/db/types.ts` -- 22 domain types/interfaces to mirror
- `backend/src/db/interfaces.ts` -- repository method signatures (shows what params routes need)

### Dependencies (already installed)
- `@sinclair/typebox` ^0.34.49 -- schema definition library
- `@fastify/type-provider-typebox` ^6.1.0 -- Fastify integration

### Existing Patterns (reference)
- `backend/src/routes/health/index.ts` -- working example of TypeBox with Fastify
  - Uses `import { Type } from '@sinclair/typebox'`
  - Uses `FastifyPluginAsyncTypebox` from `@fastify/type-provider-typebox`
  - Defines schemas inline, uses in `{ schema: { response: { 200: ... } } }`
- `backend/src/app.ts` -- `.withTypeProvider<TypeBoxTypeProvider>()`

### Files to Create
- `backend/src/schemas/common.ts`
- `backend/src/schemas/provider.ts`
- `backend/src/schemas/dialog.ts`
- `backend/src/schemas/annotation.ts`
- `backend/src/schemas/prompt.ts`

## Complete Type Inventory from `types.ts`

### Provider Domain (4 types)
| Domain Type | Schema Name | Fields |
|---|---|---|
| `ProviderType` | `ProviderType` | Union: `'tts' \| 'llm' \| 'realtime'` |
| `Provider` | `Provider` | `id: string, name: string, type: ProviderType, enabled: boolean, created_at: string` |
| `CreateProvider` | `CreateProvider` | `id: string, name: string, type: ProviderType` |
| `UpdateProvider` | `UpdateProvider` | `name?: string, type?: ProviderType, enabled?: boolean` |

Additional API schemas (not in types.ts):
- `SetKeyBody` -- `{ key: string }` for PUT /providers/:id/key
- `ProviderTypeQuery` -- `{ type?: ProviderType }` for GET /providers?type=tts

### Dialog Domain (7 types)
| Domain Type | Schema Name | Fields |
|---|---|---|
| `Dialog` | `Dialog` | `id: number, title: string, description: string\|null, language: string, created_by: string\|null, created_at: string` |
| `DialogMessage` | `DialogMessage` | `id: number, dialog_id: number, order: number, character: 1\|2, text: string` |
| `DialogWithMessages` | `DialogWithMessages` | `Dialog & { messages: DialogMessage[] }` |
| `CreateDialog` | `CreateDialog` | `title: string, description?: string, language: string` |
| `UpdateDialog` | `UpdateDialog` | `title?: string, description?: string, language?: string` |
| `CreateDialogMessage` | `CreateDialogMessage` | `order: number, character: 1\|2, text: string` |
| `UpdateDialogMessage` | `UpdateDialogMessage` | `character?: 1\|2, text?: string` |

Additional API schemas:
- `DialogIdParam` -- `{ dialogId: number }` for route params
- `MessageIdParam` -- `{ dialogId: number, messageId: number }`

### Annotation Domain (6 types)
| Domain Type | Schema Name | Fields |
|---|---|---|
| `AnnotatedDialog` | `AnnotatedDialog` | `id: number, dialog_id: number, provider_id: string, title: string, created_by: string\|null, created_at: string` |
| `AnnotatedMessage` | `AnnotatedMessage` | `id: number, annotated_dialog_id: number, dialog_message_id: number, text: string` |
| `AnnotatedDialogWithMessages` | `AnnotatedDialogWithMessages` | `AnnotatedDialog & { messages: AnnotatedMessage[] }` |
| `CreateAnnotatedDialog` | `CreateAnnotatedDialog` | `dialog_id: number, provider_id: string, title: string` |
| `CreateAnnotatedMessage` | `CreateAnnotatedMessage` | `dialog_message_id: number, text: string` |
| `UpdateAnnotatedMessage` | `UpdateAnnotatedMessage` | `text: string` |

Additional API schemas:
- `AnnotationIdParam` -- `{ id: number }`
- `AnnotationMessageIdParam` -- `{ id: number, messageId: number }`
- `DialogAnnotationsParam` -- `{ dialogId: number }`

### Prompt Domain (6 types)
| Domain Type | Schema Name | Fields |
|---|---|---|
| `AnnotationPrompt` | `AnnotationPrompt` | `id: number, title: string, provider_id: string, language: string, prompt: string, created_by: string\|null, created_at: string` |
| `CreateAnnotationPrompt` | `CreateAnnotationPrompt` | `title: string, provider_id: string, language: string, prompt: string` |
| `UpdateAnnotationPrompt` | `UpdateAnnotationPrompt` | `title?: string, provider_id?: string, language?: string, prompt?: string` |
| `AgentPrompt` | `AgentPrompt` | `id: number, title: string, provider_id: string, language: string, prompt: string, created_by: string\|null, created_at: string` |
| `CreateAgentPrompt` | `CreateAgentPrompt` | `title: string, provider_id: string, language: string, prompt: string` |
| `UpdateAgentPrompt` | `UpdateAgentPrompt` | `title?: string, provider_id?: string, language?: string, prompt?: string` |

### Common Schemas (not in types.ts)
- `IdParam` -- `{ id: number }` for numeric ID params
- `StringIdParam` -- `{ id: string }` for string ID params (providers)
- `ErrorResponse` -- `{ statusCode: number, error: string, message: string }` (matches @fastify/sensible error format)

**Total: 22 domain type equivalents + 8 API-specific schemas = 30 schemas across 5 files**

## TypeBox Patterns to Use

### Core Pattern: Schema + Type Export
```typescript
export const Provider = Type.Object({ ... });
export type Provider = Static<typeof Provider>;
```
TypeScript allows same-name value + type exports (declaration merging).

### Specific Type Mappings
| TypeScript | TypeBox |
|---|---|
| `string` | `Type.String()` |
| `number` | `Type.Number()` |
| `boolean` | `Type.Boolean()` |
| `string \| null` | `Type.Union([Type.String(), Type.Null()])` |
| `1 \| 2` | `Type.Union([Type.Literal(1), Type.Literal(2)])` |
| `'tts' \| 'llm' \| 'realtime'` | `Type.Union([Type.Literal('tts'), Type.Literal('llm'), Type.Literal('realtime')])` |
| `field?: T` | `Type.Optional(Type.T())` |
| `extends A` + extra fields | `Type.Intersect([SchemaA, Type.Object({ ... })])` |
| `T[]` | `Type.Array(T)` |

### Import Style
```typescript
import { Type, type Static } from '@sinclair/typebox';
```

## Design Decisions (Plan vs. Domain Types)

### Intentional Omissions in Create Schemas
The plan deliberately omits certain fields from Create body schemas compared to `types.ts`:

1. **`created_by`** omitted from `CreateDialog`, `CreateAnnotatedDialog`, `CreateAnnotationPrompt`, `CreateAgentPrompt`
   - Reason: will be set server-side from auth context (see Supabase implementations using `this.userId`)
   
2. **`dialog_id`** omitted from `CreateDialogMessage` schema
   - Reason: provided via URL param (`POST /dialogs/:dialogId/messages`)

3. **`annotated_dialog_id`** omitted from `CreateAnnotatedMessage` schema
   - Reason: provided via URL param

These are correct API design choices -- request body schemas should only contain fields the client explicitly provides.

### Route Param Schemas
The plan introduces param schemas (`DialogIdParam`, `MessageIdParam`, etc.) that don't exist in `types.ts`. These are needed because Fastify routes use URL params that need validation.

## Risks and Assumptions

### Low Risk
- **Schema-type drift**: TypeBox `Static<>` types may not be 100% assignable to `types.ts` interfaces. This is acceptable since schemas define the API contract, not the DB contract. Route handlers will bridge the two.
- **TypeBox 0.34.x API**: The `Type.Optional()` wrapping style is correct for this version. Older versions used `Type.Object({ field: Type.Optional(...) })` syntax.

### Assumptions
1. No barrel file (`schemas/index.ts`) needed yet -- routes will import from specific schema files
2. The plan's schema code is complete and accurate -- implementation follows it closely
3. `Type.Intersect` for `WithMessages` types is the correct approach (vs. manually duplicating fields)
4. No `format` annotations needed on strings at this stage (e.g., `Type.String({ format: 'date-time' })` for `created_at`)
5. `created_by` will be added to Create schemas later when auth is implemented (if needed as optional API field)

### Unknowns Resolved
- **TypeBox is already installed**: `@sinclair/typebox` ^0.34.49 in `backend/package.json`
- **Type provider is installed**: `@fastify/type-provider-typebox` ^6.1.0
- **Existing pattern works**: `health/index.ts` demonstrates the exact pattern to follow
- **No existing schemas directory**: `backend/src/schemas/` does not exist yet, must be created
- **`strict: true`** in tsconfig: optional fields must use `Type.Optional()` explicitly
