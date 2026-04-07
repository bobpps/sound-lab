# TTS Annotation Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an inline annotation editor on the TTS page that shows original dialog messages alongside editable annotated messages, with debounced auto-save, "Save as New Variant" creation, and LLM-powered auto-annotation via a modal.

**Architecture:** The editor is a new component (`AnnotationEditor.tsx`) rendered on the TTS page when an annotation is selected. It fetches both the annotation (with messages) and the original dialog (with messages), pairs them by `dialog_message_id`, and renders each pair as a row. Edits to annotated message text are debounced (~500ms) and auto-saved via `PUT /annotations/:id/messages/:messageId`. A sub-component modal (`AutoAnnotateModal.tsx`) lets users pick an LLM provider, model, and annotation prompt to auto-generate annotations. All API calls go through new query/mutation hooks added to the existing `ttsKeys` factory in `queries.ts`.

**Tech Stack:** React 19, TanStack Query, Tailwind CSS, Vitest + React Testing Library, ESM with `.js` extensions

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `frontend/src/features/tts/api/queries.ts` | Add 5 query hooks + 4 mutation hooks + ttsKeys entries |
| Modify | `frontend/src/features/tts/api/queries.test.tsx` | Tests for all new hooks |
| Create | `frontend/src/features/tts/components/AnnotationEditor.tsx` | Paired message list editor with debounced auto-save + Save as New Variant |
| Create | `frontend/src/features/tts/components/AnnotationEditor.test.tsx` | Component tests for the editor |
| Create | `frontend/src/features/tts/components/AutoAnnotateModal.tsx` | Modal for LLM provider/model/prompt selection and auto-annotate trigger |
| Create | `frontend/src/features/tts/components/AutoAnnotateModal.test.tsx` | Component tests for the modal |
| Modify | `frontend/src/features/tts/components/TtsPage.tsx` | Wire AnnotationEditor below selector row |
| Modify | `frontend/src/features/tts/components/TtsPage.test.tsx` | Test that editor appears when annotation selected |

---

## Task 1: Add Query Hooks to ttsKeys Factory and queries.ts

**Files:**
- Modify: `frontend/src/features/tts/api/queries.test.tsx`
- Modify: `frontend/src/features/tts/api/queries.ts`

### Step 1.1: Write failing tests for new query hooks

- [ ] **Step 1.1.1: Add test fixtures and fetch stubs for new endpoints**

Add the following test data and fetch routes to `frontend/src/features/tts/api/queries.test.tsx`. The new imports and data go alongside existing ones.

At the top, update the import to include the new hooks:

```tsx
import {
  ttsKeys,
  useTtsProviders,
  useTtsVoices,
  useDialogs,
  useAnnotationsByDialog,
  useAnnotation,
  useDialogWithMessages,
  useLlmProviders,
  useLlmModels,
  useAnnotationPrompts,
} from "./queries.ts";
```

Add these fixtures after the existing `annotations` array:

```tsx
const annotationWithMessages = {
  id: 10,
  dialog_id: 1,
  provider_id: "openai",
  title: "Formal annotation",
  created_by: null,
  created_at: "2026-04-02T10:00:00.000Z",
  messages: [
    {
      id: 100,
      annotated_dialog_id: 10,
      dialog_message_id: 1,
      text: "Good morning, how may I help you?",
    },
  ],
};

const dialogWithMessages = {
  id: 1,
  title: "Greeting",
  description: null,
  language: "en-US",
  created_by: null,
  created_at: "2026-04-01T10:00:00.000Z",
  messages: [
    {
      id: 1,
      dialog_id: 1,
      order: 1,
      character: 1,
      text: "Hello, how can I help you?",
    },
  ],
};

const llmProviders = [
  {
    id: "openai",
    name: "OpenAI",
    type: "llm",
    enabled: true,
    created_at: "2026-04-06T00:00:00.000Z",
  },
];

const llmModels = ["gpt-4o", "gpt-4o-mini"];

const annotationPrompts = [
  {
    id: 1,
    title: "Formal style",
    provider_id: "elevenlabs",
    language: "en-US",
    prompt: "Make it formal",
    created_by: null,
    created_at: "2026-04-03T00:00:00.000Z",
  },
];
```

Add these URL branches inside the existing `vi.stubGlobal("fetch", ...)` callback in `beforeEach`, before the 404 fallback:

```tsx
if (url.endsWith("/api/annotations/10")) {
  return jsonResponse(annotationWithMessages);
}

if (url.endsWith("/api/dialogs/1")) {
  return jsonResponse(dialogWithMessages);
}

if (url.endsWith("/api/providers?type=llm")) {
  return jsonResponse(llmProviders);
}

if (url.endsWith("/api/llm/openai/models")) {
  return jsonResponse(llmModels);
}

if (url.endsWith("/api/annotation-prompts")) {
  return jsonResponse(annotationPrompts);
}
```

- [ ] **Step 1.1.2: Write test for useAnnotation**

Add this test inside the `describe("tts queries", ...)` block:

```tsx
it("fetches annotation with messages by id", async () => {
  const queryClient = createTestQueryClient();
  const wrapper = createTestWrapper({ queryClient });

  const { result } = renderHook(() => useAnnotation(10), { wrapper });

  await waitFor(() => {
    expect(result.current.isSuccess).toBe(true);
  });

  expect(result.current.data).toEqual(annotationWithMessages);
  expect(fetch).toHaveBeenCalledWith(
    "/api/annotations/10",
    expect.objectContaining({ method: "GET" }),
  );
});

it("disables annotation query when annotationId is null", () => {
  const queryClient = createTestQueryClient();
  const wrapper = createTestWrapper({ queryClient });

  const { result } = renderHook(() => useAnnotation(null), { wrapper });

  expect(result.current.fetchStatus).toBe("idle");
});
```

- [ ] **Step 1.1.3: Write test for useDialogWithMessages**

```tsx
it("fetches dialog with messages by id", async () => {
  const queryClient = createTestQueryClient();
  const wrapper = createTestWrapper({ queryClient });

  const { result } = renderHook(() => useDialogWithMessages(1), { wrapper });

  await waitFor(() => {
    expect(result.current.isSuccess).toBe(true);
  });

  expect(result.current.data).toEqual(dialogWithMessages);
  expect(fetch).toHaveBeenCalledWith(
    "/api/dialogs/1",
    expect.objectContaining({ method: "GET" }),
  );
});

it("disables dialog-with-messages query when dialogId is null", () => {
  const queryClient = createTestQueryClient();
  const wrapper = createTestWrapper({ queryClient });

  const { result } = renderHook(() => useDialogWithMessages(null), {
    wrapper,
  });

  expect(result.current.fetchStatus).toBe("idle");
});
```

- [ ] **Step 1.1.4: Write test for useLlmProviders**

```tsx
it("fetches LLM providers", async () => {
  const queryClient = createTestQueryClient();
  const wrapper = createTestWrapper({ queryClient });

  const { result } = renderHook(() => useLlmProviders(), { wrapper });

  await waitFor(() => {
    expect(result.current.isSuccess).toBe(true);
  });

  expect(result.current.data).toEqual(llmProviders);
  expect(fetch).toHaveBeenCalledWith(
    "/api/providers?type=llm",
    expect.objectContaining({ method: "GET" }),
  );
});
```

- [ ] **Step 1.1.5: Write test for useLlmModels**

```tsx
it("fetches models for an LLM provider", async () => {
  const queryClient = createTestQueryClient();
  const wrapper = createTestWrapper({ queryClient });

  const { result } = renderHook(() => useLlmModels("openai"), { wrapper });

  await waitFor(() => {
    expect(result.current.isSuccess).toBe(true);
  });

  expect(result.current.data).toEqual(llmModels);
  expect(fetch).toHaveBeenCalledWith(
    "/api/llm/openai/models",
    expect.objectContaining({ method: "GET" }),
  );
});

it("disables models query when providerId is null", () => {
  const queryClient = createTestQueryClient();
  const wrapper = createTestWrapper({ queryClient });

  const { result } = renderHook(() => useLlmModels(null), { wrapper });

  expect(result.current.fetchStatus).toBe("idle");
});
```

- [ ] **Step 1.1.6: Write test for useAnnotationPrompts**

```tsx
it("fetches annotation prompts", async () => {
  const queryClient = createTestQueryClient();
  const wrapper = createTestWrapper({ queryClient });

  const { result } = renderHook(() => useAnnotationPrompts(), { wrapper });

  await waitFor(() => {
    expect(result.current.isSuccess).toBe(true);
  });

  expect(result.current.data).toEqual(annotationPrompts);
  expect(fetch).toHaveBeenCalledWith(
    "/api/annotation-prompts",
    expect.objectContaining({ method: "GET" }),
  );
});
```

- [ ] **Step 1.1.7: Write test for new ttsKeys entries**

Update the existing `"provides structured query keys via ttsKeys"` test to include new keys:

```tsx
it("provides structured query keys via ttsKeys", () => {
  expect(ttsKeys.providers()).toEqual(["tts", "providers"]);
  expect(ttsKeys.voices("elevenlabs")).toEqual([
    "tts",
    "voices",
    "elevenlabs",
  ]);
  expect(ttsKeys.dialogs()).toEqual(["tts", "dialogs"]);
  expect(ttsKeys.annotations(1)).toEqual(["tts", "annotations", 1]);
  expect(ttsKeys.annotation(10)).toEqual(["tts", "annotation", 10]);
  expect(ttsKeys.dialogWithMessages(1)).toEqual([
    "tts",
    "dialogWithMessages",
    1,
  ]);
  expect(ttsKeys.llmProviders()).toEqual(["tts", "llmProviders"]);
  expect(ttsKeys.llmModels("openai")).toEqual([
    "tts",
    "llmModels",
    "openai",
  ]);
  expect(ttsKeys.annotationPrompts()).toEqual(["tts", "annotationPrompts"]);
});
```

- [ ] **Step 1.1.8: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/features/tts/api/queries.test.tsx`

Expected: Multiple FAIL results (functions not exported, keys not defined)

### Step 1.2: Implement query hooks

- [ ] **Step 1.2.1: Add new key factory entries and imports**

In `frontend/src/features/tts/api/queries.ts`, update imports and the key factory:

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api-client.ts";
import type {
  AnnotatedDialog,
  AnnotatedDialogWithMessages,
  AnnotatedMessage,
  AnnotationPrompt,
  Dialog,
  DialogWithMessages,
  Provider,
  Voice,
} from "../../../types/api.ts";

export const ttsKeys = {
  providers: () => ["tts", "providers"] as const,
  voices: (providerId: string) => ["tts", "voices", providerId] as const,
  dialogs: () => ["tts", "dialogs"] as const,
  annotations: (dialogId: number) => ["tts", "annotations", dialogId] as const,
  annotation: (annotationId: number) =>
    ["tts", "annotation", annotationId] as const,
  dialogWithMessages: (dialogId: number) =>
    ["tts", "dialogWithMessages", dialogId] as const,
  llmProviders: () => ["tts", "llmProviders"] as const,
  llmModels: (providerId: string) =>
    ["tts", "llmModels", providerId] as const,
  annotationPrompts: () => ["tts", "annotationPrompts"] as const,
};
```

- [ ] **Step 1.2.2: Add the 5 new query hooks**

Append these hooks after the existing `useAnnotationsByDialog` function:

```ts
export function useAnnotation(annotationId: number | null) {
  return useQuery({
    queryKey: ttsKeys.annotation(annotationId ?? 0),
    queryFn: () =>
      api.get<AnnotatedDialogWithMessages>(`/annotations/${annotationId}`),
    enabled: annotationId !== null,
  });
}

export function useDialogWithMessages(dialogId: number | null) {
  return useQuery({
    queryKey: ttsKeys.dialogWithMessages(dialogId ?? 0),
    queryFn: () => api.get<DialogWithMessages>(`/dialogs/${dialogId}`),
    enabled: dialogId !== null,
  });
}

export function useLlmProviders() {
  return useQuery({
    queryKey: ttsKeys.llmProviders(),
    queryFn: () => api.get<Provider[]>("/providers?type=llm"),
  });
}

export function useLlmModels(providerId: string | null) {
  return useQuery({
    queryKey: ttsKeys.llmModels(providerId ?? ""),
    queryFn: () => api.get<string[]>(`/llm/${providerId}/models`),
    enabled: providerId !== null,
  });
}

export function useAnnotationPrompts() {
  return useQuery({
    queryKey: ttsKeys.annotationPrompts(),
    queryFn: () => api.get<AnnotationPrompt[]>("/annotation-prompts"),
  });
}
```

- [ ] **Step 1.2.3: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/features/tts/api/queries.test.tsx`

Expected: ALL PASS

- [ ] **Step 1.2.4: Commit**

```bash
git add frontend/src/features/tts/api/queries.ts frontend/src/features/tts/api/queries.test.tsx
git commit -m "feat(tts): add query hooks for annotation editor

Add useAnnotation, useDialogWithMessages, useLlmProviders, useLlmModels,
useAnnotationPrompts query hooks with corresponding ttsKeys entries."
```

---

## Task 2: Add Mutation Hooks

**Files:**
- Modify: `frontend/src/features/tts/api/queries.test.tsx`
- Modify: `frontend/src/features/tts/api/queries.ts`

### Step 2.1: Write failing tests for mutation hooks

- [ ] **Step 2.1.1: Update imports in test file**

Add to the imports from `./queries.ts`:

```tsx
import {
  ttsKeys,
  useTtsProviders,
  useTtsVoices,
  useDialogs,
  useAnnotationsByDialog,
  useAnnotation,
  useDialogWithMessages,
  useLlmProviders,
  useLlmModels,
  useAnnotationPrompts,
  useAutoAnnotate,
  useCreateAnnotation,
  useCreateAnnotationMessage,
  useUpdateAnnotatedMessage,
} from "./queries.ts";
```

- [ ] **Step 2.1.2: Write test for useAutoAnnotate**

Add inside the `describe` block. The mutation tests check that the correct URL and method are called and that the relevant query cache is invalidated.

```tsx
it("auto-annotates and invalidates annotation queries", async () => {
  const queryClient = createTestQueryClient();
  const wrapper = createTestWrapper({ queryClient });

  // Seed the annotations cache to verify invalidation
  queryClient.setQueryData(ttsKeys.annotations(1), annotations);

  const { result } = renderHook(() => useAutoAnnotate(), { wrapper });

  await result.current.mutateAsync({
    dialogId: 1,
    providerId: "openai",
    model: "gpt-4o",
    annotationPromptId: 1,
    ttsProviderId: "elevenlabs",
    title: "Auto-annotated",
  });

  expect(fetch).toHaveBeenCalledWith(
    "/api/services/annotate",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        dialogId: 1,
        providerId: "openai",
        model: "gpt-4o",
        annotationPromptId: 1,
        ttsProviderId: "elevenlabs",
        title: "Auto-annotated",
      }),
    }),
  );
});
```

- [ ] **Step 2.1.3: Write test for useCreateAnnotation**

```tsx
it("creates an annotation shell and invalidates annotations list", async () => {
  const queryClient = createTestQueryClient();
  const wrapper = createTestWrapper({ queryClient });

  queryClient.setQueryData(ttsKeys.annotations(1), annotations);

  const { result } = renderHook(() => useCreateAnnotation(), { wrapper });

  await result.current.mutateAsync({
    dialogId: 1,
    data: { provider_id: "elevenlabs", title: "New variant" },
  });

  expect(fetch).toHaveBeenCalledWith(
    "/api/dialogs/1/annotations",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        provider_id: "elevenlabs",
        title: "New variant",
      }),
    }),
  );
});
```

- [ ] **Step 2.1.4: Write test for useCreateAnnotationMessage**

```tsx
it("creates an annotated message", async () => {
  const queryClient = createTestQueryClient();
  const wrapper = createTestWrapper({ queryClient });

  const { result } = renderHook(() => useCreateAnnotationMessage(), {
    wrapper,
  });

  await result.current.mutateAsync({
    annotationId: 10,
    data: { dialog_message_id: 1, text: "Annotated text" },
  });

  expect(fetch).toHaveBeenCalledWith(
    "/api/annotations/10/messages",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        dialog_message_id: 1,
        text: "Annotated text",
      }),
    }),
  );
});
```

- [ ] **Step 2.1.5: Write test for useUpdateAnnotatedMessage**

```tsx
it("updates an annotated message", async () => {
  const queryClient = createTestQueryClient();
  const wrapper = createTestWrapper({ queryClient });

  const { result } = renderHook(() => useUpdateAnnotatedMessage(), {
    wrapper,
  });

  await result.current.mutateAsync({
    annotationId: 10,
    messageId: 100,
    data: { text: "Updated text" },
  });

  expect(fetch).toHaveBeenCalledWith(
    "/api/annotations/10/messages/100",
    expect.objectContaining({
      method: "PUT",
      body: JSON.stringify({ text: "Updated text" }),
    }),
  );
});
```

- [ ] **Step 2.1.6: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/features/tts/api/queries.test.tsx`

Expected: FAIL (functions not exported)

### Step 2.2: Implement mutation hooks

- [ ] **Step 2.2.1: Add mutation input types**

Add these types near the top of `frontend/src/features/tts/api/queries.ts`, after the imports:

```ts
export interface AutoAnnotateInput {
  dialogId: number;
  providerId: string;
  model: string;
  annotationPromptId: number;
  ttsProviderId: string;
  title: string;
}

export interface CreateAnnotationInput {
  provider_id: string;
  title: string;
}

export interface CreateAnnotationMessageInput {
  dialog_message_id: number;
  text: string;
}

export interface UpdateAnnotatedMessageInput {
  text: string;
}
```

- [ ] **Step 2.2.2: Add the 4 mutation hooks**

Append after the query hooks:

```ts
export function useAutoAnnotate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: AutoAnnotateInput) =>
      api.post<AnnotatedDialogWithMessages>("/services/annotate", input),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({
        queryKey: ttsKeys.annotations(data.dialog_id),
      });
    },
  });
}

export function useCreateAnnotation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      dialogId,
      data,
    }: {
      dialogId: number;
      data: CreateAnnotationInput;
    }) => api.post<AnnotatedDialog>(`/dialogs/${dialogId}/annotations`, data),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ttsKeys.annotations(variables.dialogId),
      });
    },
  });
}

export function useCreateAnnotationMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      annotationId,
      data,
    }: {
      annotationId: number;
      data: CreateAnnotationMessageInput;
    }) =>
      api.post<AnnotatedMessage>(
        `/annotations/${annotationId}/messages`,
        data,
      ),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ttsKeys.annotation(variables.annotationId),
      });
    },
  });
}

export function useUpdateAnnotatedMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      annotationId,
      messageId,
      data,
    }: {
      annotationId: number;
      messageId: number;
      data: UpdateAnnotatedMessageInput;
    }) =>
      api.put<AnnotatedMessage>(
        `/annotations/${annotationId}/messages/${messageId}`,
        data,
      ),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ttsKeys.annotation(variables.annotationId),
      });
    },
  });
}
```

- [ ] **Step 2.2.3: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/features/tts/api/queries.test.tsx`

Expected: ALL PASS

- [ ] **Step 2.2.4: Commit**

```bash
git add frontend/src/features/tts/api/queries.ts frontend/src/features/tts/api/queries.test.tsx
git commit -m "feat(tts): add mutation hooks for annotation editor

Add useAutoAnnotate, useCreateAnnotation, useCreateAnnotationMessage,
useUpdateAnnotatedMessage mutation hooks with cache invalidation."
```

---

## Task 3: Create AnnotationEditor Component

**Files:**
- Create: `frontend/src/features/tts/components/AnnotationEditor.test.tsx`
- Create: `frontend/src/features/tts/components/AnnotationEditor.tsx`

### Step 3.1: Write failing tests for AnnotationEditor

- [ ] **Step 3.1.1: Create the test file with setup and basic render test**

Create `frontend/src/features/tts/components/AnnotationEditor.test.tsx`:

```tsx
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test-utils.tsx";
import { AnnotationEditor } from "./AnnotationEditor.tsx";

const dialogMessages = [
  { id: 1, dialog_id: 1, order: 1, character: 1, text: "Hello there" },
  { id: 2, dialog_id: 1, order: 2, character: 2, text: "Hi, how are you?" },
];

const annotatedMessages = [
  {
    id: 100,
    annotated_dialog_id: 10,
    dialog_message_id: 1,
    text: "Good morning",
  },
  {
    id: 101,
    annotated_dialog_id: 10,
    dialog_message_id: 2,
    text: "Hello, how do you do?",
  },
];

const annotationWithMessages = {
  id: 10,
  dialog_id: 1,
  provider_id: "elevenlabs",
  title: "Formal",
  created_by: null,
  created_at: "2026-04-02T10:00:00.000Z",
  messages: annotatedMessages,
};

const dialogWithMessages = {
  id: 1,
  title: "Greeting",
  description: null,
  language: "en-US",
  created_by: null,
  created_at: "2026-04-01T10:00:00.000Z",
  messages: dialogMessages,
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function extractUrl(input: string | URL | Request): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.pathname;
  return input.url;
}

function extractMethod(input: string | URL | Request, init?: RequestInit): string {
  if (init?.method) return init.method;
  if (input instanceof Request) return input.method;
  return "GET";
}

describe("AnnotationEditor", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = extractUrl(input);
        const method = extractMethod(input, init);

        if (url.endsWith("/api/annotations/10") && method === "GET") {
          return jsonResponse(annotationWithMessages);
        }

        if (url.endsWith("/api/dialogs/1") && method === "GET") {
          return jsonResponse(dialogWithMessages);
        }

        if (url.match(/\/api\/annotations\/\d+\/messages\/\d+/) && method === "PUT") {
          const body = JSON.parse(init?.body as string);
          return jsonResponse({ ...annotatedMessages[0], ...body });
        }

        if (url.match(/\/api\/annotations\/\d+\/messages$/) && method === "POST") {
          const body = JSON.parse(init?.body as string);
          return jsonResponse(
            { id: 200, annotated_dialog_id: 10, ...body },
            201,
          );
        }

        if (url.match(/\/api\/dialogs\/\d+\/annotations$/) && method === "POST") {
          const body = JSON.parse(init?.body as string);
          return jsonResponse(
            {
              id: 20,
              dialog_id: 1,
              ...body,
              created_by: null,
              created_at: "2026-04-02T10:00:00.000Z",
            },
            201,
          );
        }

        return jsonResponse({ message: "Not Found" }, 404);
      }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("renders paired original and annotated messages", async () => {
    renderWithProviders(
      <AnnotationEditor
        annotationId={10}
        dialogId={1}
        ttsProviderId="elevenlabs"
      />,
    );

    // Original messages shown as read-only
    expect(await screen.findByText("Hello there")).toBeInTheDocument();
    expect(screen.getByText("Hi, how are you?")).toBeInTheDocument();

    // Annotated messages shown in editable inputs
    const inputs = screen.getAllByRole("textbox");
    expect(inputs).toHaveLength(2);
    expect(inputs[0]).toHaveValue("Good morning");
    expect(inputs[1]).toHaveValue("Hello, how do you do?");
  });

  it("debounces auto-save when annotated text is edited", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    renderWithProviders(
      <AnnotationEditor
        annotationId={10}
        dialogId={1}
        ttsProviderId="elevenlabs"
      />,
    );

    const inputs = await screen.findAllByRole("textbox");
    await user.clear(inputs[0]);
    await user.type(inputs[0], "Greetings");

    // Not yet called — debounce hasn't fired
    const putCalls = vi.mocked(fetch).mock.calls.filter(
      ([url, init]) =>
        extractUrl(url).includes("/messages/") &&
        (init as RequestInit | undefined)?.method === "PUT",
    );
    expect(putCalls).toHaveLength(0);

    // Advance past debounce
    await vi.advanceTimersByTimeAsync(600);

    await waitFor(() => {
      const putCallsAfter = vi.mocked(fetch).mock.calls.filter(
        ([url, init]) =>
          extractUrl(url).includes("/messages/") &&
          (init as RequestInit | undefined)?.method === "PUT",
      );
      expect(putCallsAfter.length).toBeGreaterThan(0);
    });
  });

  it("shows Save as New Variant button", async () => {
    renderWithProviders(
      <AnnotationEditor
        annotationId={10}
        dialogId={1}
        ttsProviderId="elevenlabs"
      />,
    );

    expect(
      await screen.findByRole("button", { name: /save as new variant/i }),
    ).toBeInTheDocument();
  });

  it("shows Auto-Annotate button", async () => {
    renderWithProviders(
      <AnnotationEditor
        annotationId={10}
        dialogId={1}
        ttsProviderId="elevenlabs"
      />,
    );

    expect(
      await screen.findByRole("button", { name: /auto-annotate/i }),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 3.1.2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/features/tts/components/AnnotationEditor.test.tsx`

Expected: FAIL (module not found)

### Step 3.2: Implement AnnotationEditor

- [ ] **Step 3.2.1: Create the AnnotationEditor component**

Create `frontend/src/features/tts/components/AnnotationEditor.tsx`:

```tsx
import { useEffect, useRef, useState } from "react";
import type { AnnotatedMessage, DialogMessage } from "../../../types/api.ts";
import {
  useAnnotation,
  useDialogWithMessages,
  useUpdateAnnotatedMessage,
  useCreateAnnotation,
  useCreateAnnotationMessage,
} from "../api/queries.ts";
import { AutoAnnotateModal } from "./AutoAnnotateModal.tsx";

interface AnnotationEditorProps {
  annotationId: number;
  dialogId: number;
  ttsProviderId: string;
  currentMessageIndex?: number;
  onAnnotationCreated?: (annotationId: number) => void;
}

interface MessagePair {
  original: DialogMessage;
  annotated: AnnotatedMessage | null;
  localText: string;
}

const DEBOUNCE_MS = 500;

export function AnnotationEditor({
  annotationId,
  dialogId,
  ttsProviderId,
  currentMessageIndex,
  onAnnotationCreated,
}: AnnotationEditorProps) {
  const annotationQuery = useAnnotation(annotationId);
  const dialogQuery = useDialogWithMessages(dialogId);
  const updateMessage = useUpdateAnnotatedMessage();
  const createAnnotation = useCreateAnnotation();
  const createAnnotationMessage = useCreateAnnotationMessage();

  const [showAutoAnnotate, setShowAutoAnnotate] = useState(false);
  const [pairs, setPairs] = useState<MessagePair[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savingVariant, setSavingVariant] = useState(false);

  const debounceTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const hydratedAnnotationId = useRef<number | null>(null);

  // Build pairs when data arrives or annotation changes
  useEffect(() => {
    if (!annotationQuery.data || !dialogQuery.data) {
      return;
    }

    if (hydratedAnnotationId.current === annotationId) {
      return;
    }

    const annotatedByDialogMsgId = new Map(
      annotationQuery.data.messages.map((m) => [m.dialog_message_id, m]),
    );

    const newPairs = dialogQuery.data.messages.map((original) => {
      const annotated = annotatedByDialogMsgId.get(original.id) ?? null;
      return {
        original,
        annotated,
        localText: annotated?.text ?? original.text,
      };
    });

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPairs(newPairs);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(null);
    hydratedAnnotationId.current = annotationId;
  }, [annotationId, annotationQuery.data, dialogQuery.data]);

  // Reset hydration ref when annotationId changes
  useEffect(() => {
    hydratedAnnotationId.current = null;
  }, [annotationId]);

  // Cleanup timers on unmount
  useEffect(() => {
    const timers = debounceTimers.current;
    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
    };
  }, []);

  function handleTextChange(dialogMessageId: number, newText: string) {
    setError(null);

    setPairs((current) =>
      current.map((pair) =>
        pair.original.id === dialogMessageId
          ? { ...pair, localText: newText }
          : pair,
      ),
    );

    // Find the annotated message to update
    const pair = pairs.find((p) => p.original.id === dialogMessageId);
    if (!pair?.annotated) {
      return;
    }

    const annotatedMessageId = pair.annotated.id;

    // Clear existing timer for this message
    const existing = debounceTimers.current.get(dialogMessageId);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      debounceTimers.current.delete(dialogMessageId);
      updateMessage.mutate(
        {
          annotationId,
          messageId: annotatedMessageId,
          data: { text: newText },
        },
        {
          onError: (err) => {
            setError(
              err instanceof Error ? err.message : "Failed to save change.",
            );
          },
        },
      );
    }, DEBOUNCE_MS);

    debounceTimers.current.set(dialogMessageId, timer);
  }

  async function handleSaveAsNewVariant() {
    setError(null);
    setSavingVariant(true);

    try {
      // Step 1: Create annotation shell
      const newAnnotation = await createAnnotation.mutateAsync({
        dialogId,
        data: {
          provider_id: ttsProviderId,
          title: `${annotationQuery.data?.title ?? "Annotation"} (copy)`,
        },
      });

      // Step 2: Create messages for each pair
      for (const pair of pairs) {
        await createAnnotationMessage.mutateAsync({
          annotationId: newAnnotation.id,
          data: {
            dialog_message_id: pair.original.id,
            text: pair.localText,
          },
        });
      }

      onAnnotationCreated?.(newAnnotation.id);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save new variant.",
      );
    } finally {
      setSavingVariant(false);
    }
  }

  if (annotationQuery.isPending || dialogQuery.isPending) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-500 shadow-sm">
        Loading annotation editor...
      </div>
    );
  }

  if (annotationQuery.isError || dialogQuery.isError) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">
        {annotationQuery.error?.message ??
          dialogQuery.error?.message ??
          "Failed to load data."}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          Annotation Editor
        </h2>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => setShowAutoAnnotate(true)}
          >
            Auto-Annotate
          </button>
          <button
            type="button"
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleSaveAsNewVariant}
            disabled={savingVariant}
          >
            {savingVariant ? "Saving..." : "Save as New Variant"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="space-y-3">
        {pairs.map((pair, index) => (
          <div
            key={pair.original.id}
            className={`rounded-xl border p-4 shadow-sm ${
              currentMessageIndex === index
                ? "border-blue-300 bg-blue-50"
                : "border-gray-200 bg-white"
            }`}
          >
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white">
                {index + 1}
              </div>
              <span className="text-xs font-medium text-gray-500">
                Character {pair.original.character}
              </span>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <span className="mb-1 block text-xs font-medium text-gray-400">
                  Original
                </span>
                <div className="rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-700">
                  {pair.original.text}
                </div>
              </div>

              <div>
                <span className="mb-1 block text-xs font-medium text-gray-400">
                  Annotated
                </span>
                <input
                  type="text"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                  value={pair.localText}
                  onChange={(e) =>
                    handleTextChange(pair.original.id, e.target.value)
                  }
                  aria-label={`Annotated text for message ${index + 1}`}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {showAutoAnnotate ? (
        <AutoAnnotateModal
          dialogId={dialogId}
          ttsProviderId={ttsProviderId}
          onClose={() => setShowAutoAnnotate(false)}
          onAnnotationCreated={onAnnotationCreated}
        />
      ) : null}
    </div>
  );
}
```

- [ ] **Step 3.2.2: Create a stub AutoAnnotateModal for the tests to pass**

Create `frontend/src/features/tts/components/AutoAnnotateModal.tsx` with a minimal stub (to be fully implemented in Task 4):

```tsx
interface AutoAnnotateModalProps {
  dialogId: number;
  ttsProviderId: string;
  onClose: () => void;
  onAnnotationCreated?: (annotationId: number) => void;
}

export function AutoAnnotateModal({
  onClose,
}: AutoAnnotateModalProps) {
  return (
    <div role="dialog" aria-label="Auto-Annotate">
      <p>Auto-annotate modal placeholder</p>
      <button type="button" onClick={onClose}>
        Cancel
      </button>
    </div>
  );
}
```

- [ ] **Step 3.2.3: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/features/tts/components/AnnotationEditor.test.tsx`

Expected: ALL PASS

- [ ] **Step 3.2.4: Commit**

```bash
git add frontend/src/features/tts/components/AnnotationEditor.tsx frontend/src/features/tts/components/AnnotationEditor.test.tsx frontend/src/features/tts/components/AutoAnnotateModal.tsx
git commit -m "feat(tts): add AnnotationEditor component

Paired message list with original (readonly) and annotated (editable) text.
Debounced auto-save (~500ms). Save as New Variant button.
Stub AutoAnnotateModal for next task."
```

---

## Task 4: Implement AutoAnnotateModal

**Files:**
- Create: `frontend/src/features/tts/components/AutoAnnotateModal.test.tsx`
- Modify: `frontend/src/features/tts/components/AutoAnnotateModal.tsx`

### Step 4.1: Write failing tests for AutoAnnotateModal

- [ ] **Step 4.1.1: Create the test file**

Create `frontend/src/features/tts/components/AutoAnnotateModal.test.tsx`:

```tsx
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test-utils.tsx";
import { AutoAnnotateModal } from "./AutoAnnotateModal.tsx";

const llmProviders = [
  {
    id: "openai",
    name: "OpenAI",
    type: "llm",
    enabled: true,
    created_at: "2026-04-06T00:00:00.000Z",
  },
];

const llmModels = ["gpt-4o", "gpt-4o-mini"];

const annotationPrompts = [
  {
    id: 1,
    title: "Formal style",
    provider_id: "elevenlabs",
    language: "en-US",
    prompt: "Make it formal",
    created_by: null,
    created_at: "2026-04-03T00:00:00.000Z",
  },
  {
    id: 2,
    title: "Wrong provider prompt",
    provider_id: "google",
    language: "en-US",
    prompt: "Different provider",
    created_by: null,
    created_at: "2026-04-03T00:00:00.000Z",
  },
];

const autoAnnotateResult = {
  id: 30,
  dialog_id: 1,
  provider_id: "elevenlabs",
  title: "Auto-annotated",
  created_by: null,
  created_at: "2026-04-05T10:00:00.000Z",
  messages: [
    {
      id: 300,
      annotated_dialog_id: 30,
      dialog_message_id: 1,
      text: "Auto text",
    },
  ],
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function extractUrl(input: string | URL | Request): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.pathname;
  return input.url;
}

describe("AutoAnnotateModal", () => {
  const onClose = vi.fn();
  const onAnnotationCreated = vi.fn();

  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = extractUrl(input);

        if (url.endsWith("/api/providers?type=llm")) {
          return jsonResponse(llmProviders);
        }

        if (url.endsWith("/api/llm/openai/models")) {
          return jsonResponse(llmModels);
        }

        if (url.endsWith("/api/annotation-prompts")) {
          return jsonResponse(annotationPrompts);
        }

        if (url.endsWith("/api/services/annotate")) {
          return jsonResponse(autoAnnotateResult);
        }

        return jsonResponse({ message: "Not Found" }, 404);
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders the modal with LLM provider selector", async () => {
    renderWithProviders(
      <AutoAnnotateModal
        dialogId={1}
        ttsProviderId="elevenlabs"
        onClose={onClose}
        onAnnotationCreated={onAnnotationCreated}
      />,
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Auto-Annotate",
    });
    expect(dialog).toBeInTheDocument();

    expect(
      await within(dialog).findByRole("combobox", { name: /llm provider/i }),
    ).toBeInTheDocument();
  });

  it("shows model selector after LLM provider is selected", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <AutoAnnotateModal
        dialogId={1}
        ttsProviderId="elevenlabs"
        onClose={onClose}
        onAnnotationCreated={onAnnotationCreated}
      />,
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Auto-Annotate",
    });
    const providerSelect = await within(dialog).findByRole("combobox", {
      name: /llm provider/i,
    });
    await user.selectOptions(providerSelect, "openai");

    expect(
      await within(dialog).findByRole("combobox", { name: /model/i }),
    ).toBeInTheDocument();
  });

  it("filters annotation prompts by ttsProviderId", async () => {
    renderWithProviders(
      <AutoAnnotateModal
        dialogId={1}
        ttsProviderId="elevenlabs"
        onClose={onClose}
        onAnnotationCreated={onAnnotationCreated}
      />,
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Auto-Annotate",
    });

    const promptSelect = await within(dialog).findByRole("combobox", {
      name: /annotation prompt/i,
    });

    // "Formal style" (elevenlabs) should be present
    const options = within(promptSelect).getAllByRole("option");
    const optionTexts = options.map((o) => o.textContent);
    expect(optionTexts).toContain("Formal style");
    // "Wrong provider prompt" (google) should NOT be present
    expect(optionTexts).not.toContain("Wrong provider prompt");
  });

  it("calls onClose when Cancel is clicked", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <AutoAnnotateModal
        dialogId={1}
        ttsProviderId="elevenlabs"
        onClose={onClose}
        onAnnotationCreated={onAnnotationCreated}
      />,
    );

    await screen.findByRole("dialog", { name: "Auto-Annotate" });
    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("submits auto-annotate request with selected values", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <AutoAnnotateModal
        dialogId={1}
        ttsProviderId="elevenlabs"
        onClose={onClose}
        onAnnotationCreated={onAnnotationCreated}
      />,
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Auto-Annotate",
    });

    // Select LLM provider
    const providerSelect = await within(dialog).findByRole("combobox", {
      name: /llm provider/i,
    });
    await user.selectOptions(providerSelect, "openai");

    // Select model
    const modelSelect = await within(dialog).findByRole("combobox", {
      name: /model/i,
    });
    await user.selectOptions(modelSelect, "gpt-4o");

    // Select annotation prompt
    const promptSelect = within(dialog).getByRole("combobox", {
      name: /annotation prompt/i,
    });
    await user.selectOptions(promptSelect, "1");

    // Fill in title
    const titleInput = within(dialog).getByRole("textbox", {
      name: /title/i,
    });
    await user.clear(titleInput);
    await user.type(titleInput, "My auto annotation");

    // Submit
    await user.click(
      within(dialog).getByRole("button", { name: /run auto-annotate/i }),
    );

    await waitFor(() => {
      expect(onAnnotationCreated).toHaveBeenCalledWith(30);
    });
  });
});
```

- [ ] **Step 4.1.2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/features/tts/components/AutoAnnotateModal.test.tsx`

Expected: FAIL (stub modal doesn't have the right structure)

### Step 4.2: Implement AutoAnnotateModal

- [ ] **Step 4.2.1: Replace the stub with full implementation**

Replace the contents of `frontend/src/features/tts/components/AutoAnnotateModal.tsx`:

```tsx
import { useState } from "react";
import {
  useAnnotationPrompts,
  useAutoAnnotate,
  useLlmModels,
  useLlmProviders,
} from "../api/queries.ts";

interface AutoAnnotateModalProps {
  dialogId: number;
  ttsProviderId: string;
  onClose: () => void;
  onAnnotationCreated?: (annotationId: number) => void;
}

export function AutoAnnotateModal({
  dialogId,
  ttsProviderId,
  onClose,
  onAnnotationCreated,
}: AutoAnnotateModalProps) {
  const [selectedLlmProviderId, setSelectedLlmProviderId] = useState<
    string | null
  >(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [selectedPromptId, setSelectedPromptId] = useState<number | null>(null);
  const [title, setTitle] = useState("Auto-annotated");
  const [error, setError] = useState<string | null>(null);

  const llmProvidersQuery = useLlmProviders();
  const llmModelsQuery = useLlmModels(selectedLlmProviderId);
  const annotationPromptsQuery = useAnnotationPrompts();
  const autoAnnotate = useAutoAnnotate();

  const filteredPrompts =
    annotationPromptsQuery.data?.filter(
      (p) => p.provider_id === ttsProviderId,
    ) ?? [];

  const canSubmit =
    selectedLlmProviderId !== null &&
    selectedModel !== null &&
    selectedPromptId !== null &&
    title.trim().length > 0 &&
    !autoAnnotate.isPending;

  async function handleSubmit() {
    if (
      !selectedLlmProviderId ||
      !selectedModel ||
      !selectedPromptId ||
      !title.trim()
    ) {
      return;
    }

    setError(null);

    try {
      const result = await autoAnnotate.mutateAsync({
        dialogId,
        providerId: selectedLlmProviderId,
        model: selectedModel,
        annotationPromptId: selectedPromptId,
        ttsProviderId,
        title: title.trim(),
      });

      onAnnotationCreated?.(result.id);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Auto-annotation failed.",
      );
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-label="Auto-Annotate"
        className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl"
      >
        <h3 className="text-lg font-semibold text-gray-900">Auto-Annotate</h3>
        <p className="mt-1 text-sm text-gray-600">
          Use an LLM to automatically generate annotation text.
        </p>

        {error ? (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="mt-4 space-y-4">
          {/* LLM Provider */}
          <div className="space-y-1">
            <label
              htmlFor="auto-annotate-llm-provider"
              className="block text-sm font-medium text-gray-700"
            >
              LLM Provider
            </label>
            <select
              id="auto-annotate-llm-provider"
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
              value={selectedLlmProviderId ?? ""}
              onChange={(e) => {
                setSelectedLlmProviderId(e.target.value || null);
                setSelectedModel(null);
              }}
            >
              <option value="" disabled>
                Select an LLM provider...
              </option>
              {llmProvidersQuery.data
                ?.filter((p) => p.enabled)
                .map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Model */}
          {selectedLlmProviderId !== null ? (
            <div className="space-y-1">
              <label
                htmlFor="auto-annotate-model"
                className="block text-sm font-medium text-gray-700"
              >
                Model
              </label>
              <select
                id="auto-annotate-model"
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
                value={selectedModel ?? ""}
                onChange={(e) => setSelectedModel(e.target.value || null)}
              >
                <option value="" disabled>
                  {llmModelsQuery.isPending
                    ? "Loading models..."
                    : "Select a model..."}
                </option>
                {llmModelsQuery.data?.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {/* Annotation Prompt */}
          <div className="space-y-1">
            <label
              htmlFor="auto-annotate-prompt"
              className="block text-sm font-medium text-gray-700"
            >
              Annotation Prompt
            </label>
            <select
              id="auto-annotate-prompt"
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
              value={selectedPromptId !== null ? String(selectedPromptId) : ""}
              onChange={(e) =>
                setSelectedPromptId(
                  e.target.value ? Number(e.target.value) : null,
                )
              }
            >
              <option value="" disabled>
                {annotationPromptsQuery.isPending
                  ? "Loading prompts..."
                  : "Select a prompt..."}
              </option>
              {filteredPrompts.map((prompt) => (
                <option key={prompt.id} value={String(prompt.id)}>
                  {prompt.title}
                </option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div className="space-y-1">
            <label
              htmlFor="auto-annotate-title"
              className="block text-sm font-medium text-gray-700"
            >
              Title
            </label>
            <input
              id="auto-annotate-title"
              type="text"
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {autoAnnotate.isPending ? "Running..." : "Run Auto-Annotate"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4.2.2: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/features/tts/components/AutoAnnotateModal.test.tsx`

Expected: ALL PASS

- [ ] **Step 4.2.3: Re-run AnnotationEditor tests to ensure nothing broke**

Run: `cd frontend && npx vitest run src/features/tts/components/AnnotationEditor.test.tsx`

Expected: ALL PASS

- [ ] **Step 4.2.4: Commit**

```bash
git add frontend/src/features/tts/components/AutoAnnotateModal.tsx frontend/src/features/tts/components/AutoAnnotateModal.test.tsx
git commit -m "feat(tts): implement AutoAnnotateModal

Modal for selecting LLM provider, model, and annotation prompt.
Filters prompts by ttsProviderId. Calls POST /services/annotate."
```

---

## Task 5: Wire AnnotationEditor into TtsPage

**Files:**
- Modify: `frontend/src/features/tts/components/TtsPage.tsx`
- Modify: `frontend/src/features/tts/components/TtsPage.test.tsx`

### Step 5.1: Write failing test for editor integration

- [ ] **Step 5.1.1: Add test for AnnotationEditor appearing when annotation is selected**

In `frontend/src/features/tts/components/TtsPage.test.tsx`, add additional fetch stubs in the existing `beforeEach` for the new endpoints the editor will need. Update the existing fetch mock to include:

```tsx
if (url.endsWith("/api/annotations/10")) {
  return jsonResponse({
    ...annotations[0],
    messages: [
      {
        id: 100,
        annotated_dialog_id: 10,
        dialog_message_id: 1,
        text: "Formal greeting",
      },
    ],
  });
}

if (url.endsWith("/api/dialogs/1") && !url.includes("annotations")) {
  return jsonResponse({
    ...dialogs[0],
    messages: [
      {
        id: 1,
        dialog_id: 1,
        order: 1,
        character: 1,
        text: "Hello there",
      },
    ],
  });
}
```

Then add a new test:

```tsx
it("shows annotation editor when an annotation variant is selected", async () => {
  const user = userEvent.setup();

  renderWithProviders(<TtsPage />);

  // Select provider
  const providerSelect = await screen.findByRole("combobox", {
    name: "TTS Provider",
  });
  await user.selectOptions(providerSelect, "elevenlabs");

  // Select dialog
  const dialogSelect = await screen.findByRole("combobox", {
    name: "Dialog",
  });
  await user.selectOptions(dialogSelect, "1");

  // Select annotation
  const annotationSelect = await screen.findByRole("combobox", {
    name: "Annotation Variant",
  });
  await user.selectOptions(annotationSelect, "10");

  // Editor should appear
  expect(
    await screen.findByRole("heading", { name: "Annotation Editor" }),
  ).toBeInTheDocument();
});

it("hides annotation editor when Clean variant is selected", async () => {
  const user = userEvent.setup();

  renderWithProviders(<TtsPage />);

  // Select provider
  const providerSelect = await screen.findByRole("combobox", {
    name: "TTS Provider",
  });
  await user.selectOptions(providerSelect, "elevenlabs");

  // Select dialog
  const dialogSelect = await screen.findByRole("combobox", {
    name: "Dialog",
  });
  await user.selectOptions(dialogSelect, "1");

  // Select annotation
  const annotationSelect = await screen.findByRole("combobox", {
    name: "Annotation Variant",
  });
  await user.selectOptions(annotationSelect, "10");

  // Editor should appear
  await screen.findByRole("heading", { name: "Annotation Editor" });

  // Switch back to "Clean"
  await user.selectOptions(annotationSelect, "clean");

  // Editor should disappear
  expect(
    screen.queryByRole("heading", { name: "Annotation Editor" }),
  ).not.toBeInTheDocument();
});
```

- [ ] **Step 5.1.2: Run tests to verify new tests fail**

Run: `cd frontend && npx vitest run src/features/tts/components/TtsPage.test.tsx`

Expected: The new tests FAIL (AnnotationEditor not rendered yet in TtsPage)

### Step 5.2: Wire AnnotationEditor into TtsPage

- [ ] **Step 5.2.1: Update TtsPage to import and render AnnotationEditor**

Update `frontend/src/features/tts/components/TtsPage.tsx`:

```tsx
import { useState } from "react";
import { AnnotationEditor } from "./AnnotationEditor.tsx";
import { AnnotationSelector } from "./AnnotationSelector.tsx";
import { DialogSelector } from "./DialogSelector.tsx";
import { ProviderSelector } from "./ProviderSelector.tsx";

export function TtsPage() {
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(
    null,
  );
  const [selectedDialogId, setSelectedDialogId] = useState<number | null>(null);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<
    number | null
  >(null);

  function handleProviderSelect(providerId: string) {
    setSelectedProviderId(providerId);
    setSelectedDialogId(null);
    setSelectedAnnotationId(null);
  }

  function handleDialogSelect(dialogId: number) {
    setSelectedDialogId(dialogId);
    setSelectedAnnotationId(null);
  }

  function handleAnnotationSelect(annotationId: number | null) {
    setSelectedAnnotationId(annotationId);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-900">TTS Testing</h1>
        <p className="max-w-2xl text-sm text-gray-600">
          Test text-to-speech providers and compare outputs.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="grid gap-6 md:grid-cols-3">
          <ProviderSelector
            selectedId={selectedProviderId}
            onSelect={handleProviderSelect}
          />

          {selectedProviderId !== null && (
            <DialogSelector
              selectedId={selectedDialogId}
              onSelect={handleDialogSelect}
            />
          )}

          {selectedDialogId !== null && (
            <AnnotationSelector
              dialogId={selectedDialogId}
              selectedAnnotationId={selectedAnnotationId}
              onSelect={handleAnnotationSelect}
            />
          )}
        </div>
      </div>

      {selectedAnnotationId !== null &&
        selectedDialogId !== null &&
        selectedProviderId !== null && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <AnnotationEditor
              annotationId={selectedAnnotationId}
              dialogId={selectedDialogId}
              ttsProviderId={selectedProviderId}
              onAnnotationCreated={handleAnnotationSelect}
            />
          </div>
        )}
    </div>
  );
}
```

- [ ] **Step 5.2.2: Run TtsPage tests to verify they pass**

Run: `cd frontend && npx vitest run src/features/tts/components/TtsPage.test.tsx`

Expected: ALL PASS

- [ ] **Step 5.2.3: Run all TTS feature tests**

Run: `cd frontend && npx vitest run src/features/tts/`

Expected: ALL PASS

- [ ] **Step 5.2.4: Commit**

```bash
git add frontend/src/features/tts/components/TtsPage.tsx frontend/src/features/tts/components/TtsPage.test.tsx
git commit -m "feat(tts): wire AnnotationEditor into TtsPage

Show editor panel below selectors when an annotation variant is chosen.
Pass onAnnotationCreated to allow auto-annotate to switch selection."
```

---

## Task 6: Verify with Playwright

**Files:** None modified (visual verification only)

- [ ] **Step 6.1: Run the full test suite**

Run: `cd frontend && npx vitest run`

Expected: ALL PASS

- [ ] **Step 6.2: Start the dev server and open the TTS page in Playwright**

Run: `npm run dev` (in root)

Open the TTS page at `http://localhost:5173/tts` in Playwright browser. Take a screenshot.

Verify:
1. Provider selector is visible
2. Selecting a provider reveals dialog selector
3. Selecting a dialog reveals annotation selector
4. Selecting an annotation variant shows the AnnotationEditor below with paired messages
5. Original text is read-only (gray bg), annotated text is editable (input field)
6. "Save as New Variant" and "Auto-Annotate" buttons are visible
7. Clicking "Auto-Annotate" opens the modal with LLM provider, model, prompt selectors
8. No console errors or warnings

- [ ] **Step 6.3: Check browser console for errors**

Use Playwright console messages tool to verify no errors or warnings.

- [ ] **Step 6.4: Final commit if any visual fixes were needed**

Only commit if fixes were needed:

```bash
git add -u
git commit -m "fix(tts): visual fixes from Playwright verification"
```
