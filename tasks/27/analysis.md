# Issue #27: TTS Annotation Editor -- Analysis

## What the Task Requires

Add an inline annotation editor to the TTS testing page:

1. View and edit annotation messages -- original text (readonly, gray) + annotated text (editable)
2. Auto-save individual edits -- debounced PUT /annotations/:id/messages/:messageId
3. Save as New Variant -- create new annotated dialog + messages
4. Auto-Annotate -- modal to select LLM provider + model + annotation prompt, calls POST /services/annotate
5. Wire into TtsPage -- show AnnotationEditor below selectors when annotation is selected

## Constraints

- ESM everywhere (.ts extensions in imports)
- Feature-based structure (all new files under features/tts/)
- No cross-feature imports
- No barrel files
- React Compiler active (no manual useMemo/useCallback/React.memo)
- forwardRef deprecated (ref is a regular prop)
- TanStack Query for server state
- Tailwind CSS for styling
- TDD by default
- Verify UI with Playwright
- Typed fetch wrapper in lib/api-client.ts

## Key Files

### Frontend -- Existing (to modify)
- frontend/src/features/tts/api/queries.ts -- query hooks + key factory
- frontend/src/features/tts/components/TtsPage.tsx -- orchestrator page

### Frontend -- New (to create)
- frontend/src/features/tts/components/AnnotationEditor.tsx
- frontend/src/features/tts/components/AnnotationEditor.test.tsx
- frontend/src/features/tts/api/queries.test.tsx (extend with mutation tests)

### Backend -- Reference only
- backend/src/routes/annotations/index.ts -- CRUD for annotations
- backend/src/routes/dialogs/index.ts -- Dialog CRUD + annotation sub-routes
- backend/src/routes/services/index.ts -- POST /services/annotate
- backend/src/services/auto-annotation.ts -- auto-annotation service
- backend/src/routes/llm/index.ts -- GET /llm/:providerId/models
- backend/src/routes/annotation-prompts/index.ts -- GET /annotation-prompts

### Shared Types
- frontend/src/types/api.ts -- AnnotatedDialog, AnnotatedMessage, AnnotatedDialogWithMessages, AnnotationPrompt, DialogMessage
- frontend/src/lib/api-client.ts -- api.get(), api.post(), api.put(), api.delete()
- backend/src/db/types.ts -- canonical type definitions
- backend/src/db/interfaces.ts -- repository contracts

### Pattern Reference
- frontend/src/features/datasets/api/queries.ts -- mutation hooks with cache invalidation
- frontend/src/features/datasets/components/DialogEditor.tsx -- complex editor with local state hydration
- frontend/src/features/datasets/components/MessageEditor.tsx -- individual message editing
- frontend/src/features/providers/api/queries.ts -- simpler mutation pattern
## API Endpoint Details

### 1. GET /annotations/:id
- Response: AnnotatedDialogWithMessages { id, dialog_id, provider_id, title, created_by, created_at, messages[] }
- Purpose: Fetch full annotation with messages when user selects a variant

### 2. GET /dialogs/:dialogId
- Response: DialogWithMessages { id, title, description, language, created_by, created_at, messages[] }
- Purpose: Fetch original dialog messages to display alongside annotated messages

### 3. PUT /annotations/:id/messages/:messageId
- Request: { text: string }
- Response: AnnotatedMessage { id, annotated_dialog_id, dialog_message_id, text }
- Purpose: Auto-save individual message edits (debounced)

### 4. POST /dialogs/:dialogId/annotations
- Request: { provider_id: string, title: string }
- Response: AnnotatedDialog { id, dialog_id, provider_id, title, created_by, created_at }
- Purpose: Save as New Variant step 1 -- create the annotation shell

### 5. POST /annotations/:id/messages
- Request: { dialog_message_id: number, text: string }
- Response: AnnotatedMessage
- Purpose: Save as New Variant step 2 -- create each message

### 6. POST /services/annotate
- Request: { dialogId, providerId, model, annotationPromptId, ttsProviderId, title }
- Response: AnnotatedDialogWithMessages
- Purpose: Auto-annotate a dialog using LLM

### 7. GET /llm/:providerId/models
- Response: string[]
- Purpose: Populate model dropdown in auto-annotate modal

### 8. GET /annotation-prompts
- Response: AnnotationPrompt[] { id, title, provider_id, language, prompt, created_by, created_at }
- Purpose: Populate annotation prompt dropdown. Prompts scoped to provider_id (TTS provider).

### 9. GET /providers?type=llm
- Response: Provider[]
- Purpose: Populate LLM provider dropdown in auto-annotate modal
## Data Model

    Dialog (1) --> DialogMessage (N)     [order, character, text]
      |
      +---> AnnotatedDialog (N)           [provider_id, title]
             |
             +---> AnnotatedMessage (N)   [dialog_message_id -> DialogMessage, text]

- Each AnnotatedMessage links to a DialogMessage via dialog_message_id (1:1 mapping)
- AnnotatedDialog.provider_id = TTS provider (not the LLM used to generate it)
- CASCADE DELETE from dialog down

### Key Relationship for the Editor

1. DialogWithMessages -- original text per message
2. AnnotatedDialogWithMessages -- annotated text per message
3. Match: for each DialogMessage, find AnnotatedMessage where dialog_message_id === dialogMessage.id
4. If no match, show original text as fallback in the editable field

## New Query Hooks Needed

ttsKeys additions:
- annotationDetail: (id) => ["tts", "annotation-detail", id]
- dialogDetail: (id) => ["tts", "dialog-detail", id]
- llmProviders: () => ["tts", "llm-providers"]
- llmModels: (providerId) => ["tts", "llm-models", providerId]
- annotationPrompts: () => ["tts", "annotation-prompts"]

Query hooks:
- useAnnotation(annotationId) -- GET /annotations/:id
- useDialogWithMessages(dialogId) -- GET /dialogs/:dialogId (cannot import from datasets)
- useLlmProviders() -- GET /providers?type=llm
- useLlmModels(providerId) -- GET /llm/:providerId/models
- useAnnotationPrompts() -- GET /annotation-prompts

Mutation hooks:
- useAutoAnnotate() -- POST /services/annotate; onSuccess: invalidate annotations list + set detail cache
- useCreateAnnotation() -- POST /dialogs/:dialogId/annotations; onSuccess: invalidate annotations list
- useCreateAnnotationMessage() -- POST /annotations/:id/messages
- useUpdateAnnotatedMessage() -- PUT /annotations/:id/messages/:messageId; onSuccess: invalidate detail
## Risks

1. **Message ordering mismatch** -- Must build a map by dialog_message_id, not use array index.
2. **Debounced auto-save race conditions** -- Need per-message debounce strategy.
3. **Save as New Variant is multi-step** -- Create annotation then N messages. Partial failure leaves incomplete annotation.
4. **Auto-annotate can be slow** -- LLM calls are sequential. Need loading state.
5. **Cache invalidation complexity** -- Multiple caches to invalidate on create/auto-annotate.
6. **No useDialogWithMessages in TTS yet** -- Must create (no cross-feature imports).
7. **Annotation prompt filtering** -- Filter prompts client-side by TTS provider_id.

## Assumptions

1. Annotation messages map 1:1 to dialog messages.
2. Editor only appears when an annotation is selected (not Clean).
3. Auto-annotate and Save as New Variant both create NEW annotations.
4. Debounce interval: 500-1000ms.
5. No backend changes needed -- all endpoints exist.

## Unknowns Resolved

| Question | Resolution |
|---|---|
| Backend supports updating annotated messages? | Yes -- PUT /annotations/:id/messages/:messageId |
| Backend supports creating messages individually? | Yes -- POST /annotations/:id/messages |
| Auto-annotate return shape? | AnnotatedDialogWithMessages (complete) |
| Auto-annotate request fields? | dialogId, providerId (LLM), model, annotationPromptId, ttsProviderId, title |
| Annotation prompts scoped to TTS provider? | Yes -- provider_id field, backend validates match |
| Can reuse useDialog from datasets? | No -- no cross-feature imports |
| Test utilities? | createTestQueryClient, createTestWrapper, renderWithProviders |
| Mutation testing pattern? | Stub fetch, renderHook + act + mutateAsync |
