# CLAUDE.md

Best practices for the backend (Fastify 5, TypeScript, better-sqlite3, Supabase, Vitest).

## Codebase Conventions

- Repository + factory pattern. `createDatabase()` in `db/factory.ts` auto-selects backend from env vars, returns `IDatabase` (`db/interfaces.ts`). Implementations: `db/local/` and `db/supabase/` share identical interfaces.
- When adding a repository method: update the interface, both implementations, and tests.
- All repo methods return `Promise<T>` regardless of backend.
- "Not found" → `null` (Supabase: `PGRST116` → `null`). Invalid mutations throw.
- Provider IDs are natural string keys (`"elevenlabs"`, `"google"`), not auto-increment.
- Dialogs are hierarchical: dialog → messages → annotated_dialogs → annotated_messages. CASCADE DELETE.
- API key encryption: AES-256-GCM with scrypt in `db/local/crypto.ts`, used by both backends.

## Environment

No env vars needed for local dev. See `.env.example`. Auto-detection: if `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` set → Supabase, else → SQLite (`./data/sound-lab.db`).

## Architecture Decisions

**App factory pattern** — separate app construction from `.listen()`. Export `buildApp()` returning a configured Fastify instance. This enables `app.inject()` in tests without a port.

**TypeBox as single source of truth** — `@sinclair/typebox` for schemas that are simultaneously JSON Schema (validation/serialization) and TypeScript types. Use `.withTypeProvider<TypeBoxTypeProvider>()` for automatic type inference in handlers.

**`additionalProperties: false` on all body schemas** — every `Type.Object()` used as a request body (Create\*, Update\*, etc.) must include `{ additionalProperties: false }`. Without it, Ajv passes extra fields through to handlers, and Supabase `.update(data)` will persist them — allowing clients to overwrite protected columns like `id`, `dialog_id`, or `annotated_dialog_id`. Also put URL-scoped IDs **after** the spread (`{ ...request.body, dialog_id: request.params.dialogId }`) so the URL param always wins.

**Always define response schemas** — enables `fast-json-stringify` (~20-30% throughput boost) and prevents accidental data leaks (only listed fields serialized).

**`@fastify/autoload`** for routes — directory names become route prefixes. `autohooks.ts` in route directories for scoped hooks (auth, etc.).

## Fastify Patterns

- **Plugins are encapsulated by default.** Use `fastify-plugin` (fp) only for global infrastructure (DB, auth, config).
- **Registration order:** schemas → infrastructure plugins (DB, auth) → routes.
- **DB as decorator:** wrap `createDatabase()` in an fp plugin, `fastify.decorate('db', db)`, add `onClose` hook. Access: `fastify.db.dialogs.list()`.
- **Declaration merging** for decorator types: `declare module 'fastify' { interface FastifyInstance { db: IDatabase } }`.
- **Errors:** `@fastify/sensible` (`fastify.httpErrors.notFound()`). Custom codes: `@fastify/error`.
- **Security:** `@fastify/helmet`, `@fastify/rate-limit`, `@fastify/cors` (origins from env), `@fastify/jwt`.
- **Logging:** Pino built-in. `pino-pretty` in dev only.

## Testing

- Vitest, `globals: true`. Each test gets fresh in-memory SQLite via `createTestDb()` from `tests/db/test-helpers.ts` (migrations run automatically).
- **Route tests:** `app.inject()` — simulates HTTP without network. `app.ready()` before, `app.close()` after.
- **Integration tests:** in-memory SQLite (real SQL). **Unit tests:** mocked repos (isolates handler logic).
- `vi.restoreAllMocks()` in `afterEach`. `vi.mock()` is hoisted — use `importOriginal` for partial mocks.
