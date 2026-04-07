# Execution Log -- Issue #27

## Research Phase

### 1. Read project guidance files
- Root CLAUDE.md: Fastify 5 backend + React 19 frontend, ESM, TDD, Playwright verification
- Backend CLAUDE.md: Repository pattern, TypeBox schemas, app factory pattern, in-memory SQLite tests
- Frontend CLAUDE.md: Feature-based structure, no cross-feature imports, TanStack Query, React Compiler active

### 2. Analyzed existing TTS feature (from issue #26 branch)
- queries.ts: Has useTtsProviders, useTtsVoices, useDialogs, useAnnotationsByDialog with ttsKeys factory
- TtsPage.tsx: Orchestrator with 3 state vars (selectedProviderId, selectedDialogId, selectedAnnotationId)
- ProviderSelector.tsx: Dropdown for TTS providers, filters by enabled
- DialogSelector.tsx: Dropdown for dialogs
- AnnotationSelector.tsx: Dropdown for annotation variants with "Clean (no annotation)" default
- queries.test.tsx: Tests use vi.stubGlobal("fetch"), jsonResponse helper, renderHook pattern
- TtsPage.test.tsx: Integration tests with fetch stub, tests cascading selection behavior

### 3. Mapped backend API endpoints
- POST /services/annotate: AutoAnnotateBody = { dialogId, providerId, model, annotationPromptId, ttsProviderId, title }
- GET /annotations/:id: Returns AnnotatedDialogWithMessages
- PUT /annotations/:id/messages/:messageId: UpdateAnnotatedMessage = { text: string }
- POST /annotations/:id/messages: CreateAnnotatedMessage = { dialog_message_id, text }
- POST /dialogs/:dialogId/annotations: CreateAnnotatedDialogBody = { provider_id, title }
- GET /dialogs/:dialogId/annotations: Returns AnnotatedDialog[]
- GET /llm/:providerId/models: Returns string[]
- GET /annotation-prompts: Returns AnnotationPrompt[]
- GET /providers?type=llm: Returns Provider[]

### 4. Analyzed database interfaces
- IAnnotationRepository: listByDialog, getWithMessages, create, delete, createMessage, updateMessage, deleteMessage
- Data hierarchy: Dialog -> DialogMessage -> AnnotatedDialog -> AnnotatedMessage
- AnnotatedMessage.dialog_message_id links to DialogMessage.id (1:1 mapping)
- AnnotatedDialog.provider_id refers to TTS provider, not LLM provider

### 5. Studied auto-annotation service
- auto-annotation.ts: Takes dialog, sends each message through LLM with annotation prompt as system message
- Builds conversation history (previous messages + LLM responses)
- Creates AnnotatedDialog + AnnotatedMessages in DB
- Validates: dialog exists, TTS provider exists, prompt exists, prompt matches TTS provider, dialog not empty
- Cleans up on failure (deletes partially created annotation)

### 6. Analyzed frontend patterns from datasets feature
- datasets/queries.ts: Mutation hooks use useMutation + useQueryClient, invalidate on success
- DialogEditor.tsx: Complex editor pattern with local state hydration via useEffect
- Uses hydratedDialogIdRef to track which dialog was hydrated (prevents re-hydration on same dialog)
- Save flow: persistDialogChanges() handles create/update/delete of messages
- MessageEditor.tsx: Simple controlled component with clientId tracking

### 7. Checked GitHub issue #27
- Title: Task 26: TTS Testing -- Annotation editor + auto-annotation
- Depends on: #26 (TTS selection page, PR #59 OPEN), #18 (backend auto-annotation, CLOSED)
- Branch base: feat/26-tts-selection

### 8. Reviewed full project plan
- Task 26 in the plan specifies: AnnotationEditor with message list, Save as New Variant, Auto-Annotate
- Task 27 (next) will add VoiceAssignment + PlaybackControls, passing currentMessageIndex to AnnotationEditor
- This means AnnotationEditor should accept an optional currentMessageIndex prop for future highlighting

## Key Findings

1. All backend endpoints needed already exist -- no backend changes required
2. Frontend needs 5 new query hooks + 4 new mutation hooks in queries.ts
3. Cannot reuse useDialog from datasets (no cross-feature imports) -- need useDialogWithMessages in tts
4. Annotation prompts are scoped to TTS provider_id -- auto-annotate modal should filter by selectedProviderId
5. The auto-annotate request needs both providerId (LLM) and ttsProviderId (TTS) -- these are different providers
6. Task 27 (voice assignment) will need to pass currentMessageIndex to AnnotationEditor for highlighting
7. Save as New Variant is a 2-step process (create annotation, then create each message)
8. AnnotatedMessage links to DialogMessage via dialog_message_id, not by array index

## Implementation Phase

### Task 1: Add 5 Query Hooks (commit 046ad5e)
- Added ttsKeys entries: annotation, dialogWithMessages, llmProviders, llmModels, annotationPrompts
- Added query hooks: useAnnotation, useDialogWithMessages, useLlmProviders, useLlmModels, useAnnotationPrompts
- TDD: 9 new tests (red -> green), 15 total passing
- No deviations from plan

### Task 2: Add 4 Mutation Hooks (commit c86dcd9)
- Added mutation input types: AutoAnnotateInput, CreateAnnotationInput, CreateAnnotationMessageInput, UpdateAnnotatedMessageInput
- Added mutation hooks: useAutoAnnotate, useCreateAnnotation, useCreateAnnotationMessage, useUpdateAnnotatedMessage
- Updated fetch stub to handle init parameter (method/body) for mutation tests
- TDD: 4 new tests (red -> green), 19 total passing
- No deviations from plan

### Task 3: Create AnnotationEditor Component (commit 2cbe51a)
- Created AnnotationEditor.tsx with paired message list, debounced auto-save, Save as New Variant
- Created stub AutoAnnotateModal.tsx for tests to pass
- Created AnnotationEditor.test.tsx with 4 tests
- TDD: all tests pass
- No deviations from plan

### Task 4: Implement AutoAnnotateModal (commit 39a76ff)
- Replaced stub with full AutoAnnotateModal implementation
- LLM provider/model/annotation prompt selection, filters prompts by ttsProviderId
- Created AutoAnnotateModal.test.tsx with 5 tests
- Verified AnnotationEditor tests still pass after stub replacement
- No deviations from plan

### Task 5: Wire AnnotationEditor into TtsPage (commit 4c28d9f)
- Added AnnotationEditor import and rendering to TtsPage
- Shows editor when annotation is selected, hides on Clean
- Added fetch stubs for annotation detail and dialog detail to TtsPage tests
- Added 2 new tests, 8 total TtsPage tests passing, 52 total TTS feature tests passing
- No deviations from plan

### Task 6: Verify with Playwright and Build/Lint
- Full test suite: 336 backend + 75 frontend = 411 tests passing
- Build: clean (TypeScript + Vite production build)
- Lint: clean (no errors/warnings)
- Playwright: TTS page renders correctly, cascading selectors work, no console errors/warnings
- Note: Local DB has no seeded data so full annotation editor flow can only be verified via tests
- No visual fixes needed
