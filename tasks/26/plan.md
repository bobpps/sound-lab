# TTS Selection UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the TTS testing page with sequential selection flow: provider -> dialog -> annotation variant, enabling users to pick a TTS provider, then a dialog, then choose between clean text or an annotation variant.

**Architecture:** Three selector components orchestrated by a TtsPage component via local `useState`. Each selector only renders when the previous selection is made (cascade pattern). Query hooks fetch data from existing backend endpoints via the shared `api-client.ts`. The TtsPage feature component is re-exported from `pages/TtsPage.tsx` for router consumption.

**Tech Stack:** React 19, TypeScript, TanStack Query, Tailwind CSS, Vitest + React Testing Library

---

## File Map

| File | Responsibility |
|---|---|
| Create: `frontend/src/features/tts/api/queries.ts` | TanStack Query hooks: `useTtsProviders`, `useTtsVoices`, `useDialogs`, `useAnnotationsByDialog` |
| Create: `frontend/src/features/tts/api/queries.test.tsx` | Unit tests for query hooks |
| Create: `frontend/src/features/tts/components/ProviderSelector.tsx` | Dropdown for selecting an enabled TTS provider |
| Create: `frontend/src/features/tts/components/ProviderSelector.test.tsx` | Tests for ProviderSelector |
| Create: `frontend/src/features/tts/components/DialogSelector.tsx` | Dropdown for selecting a dialog |
| Create: `frontend/src/features/tts/components/DialogSelector.test.tsx` | Tests for DialogSelector |
| Create: `frontend/src/features/tts/components/AnnotationSelector.tsx` | Dropdown for selecting annotation variant with "Clean" option |
| Create: `frontend/src/features/tts/components/AnnotationSelector.test.tsx` | Tests for AnnotationSelector |
| Create: `frontend/src/features/tts/components/TtsPage.tsx` | Orchestrating page with cascading selection state |
| Create: `frontend/src/features/tts/components/TtsPage.test.tsx` | Integration tests for TtsPage |
| Modify: `frontend/src/pages/TtsPage.tsx` | Re-export from feature module |

---

### Task 1: Query Hooks

**Files:**
- Create: `frontend/src/features/tts/api/queries.ts`
- Create: `frontend/src/features/tts/api/queries.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// frontend/src/features/tts/api/queries.test.tsx
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTestQueryClient,
  createTestWrapper,
} from "../../../test-utils.tsx";
import {
  ttsKeys,
  useTtsProviders,
  useTtsVoices,
  useDialogs,
  useAnnotationsByDialog,
} from "./queries.ts";

const providers = [
  {
    id: "elevenlabs",
    name: "ElevenLabs",
    type: "tts",
    enabled: true,
    created_at: "2026-04-06T00:00:00.000Z",
  },
  {
    id: "google",
    name: "Google",
    type: "tts",
    enabled: false,
    created_at: "2026-04-06T00:00:00.000Z",
  },
];

const voices = [
  {
    id: "voice-1",
    name: "Rachel",
    language: "en-US",
    gender: "female",
  },
];

const dialogs = [
  {
    id: 1,
    title: "Greeting",
    description: null,
    language: "en-US",
    created_by: null,
    created_at: "2026-04-01T10:00:00.000Z",
  },
];

const annotations = [
  {
    id: 10,
    dialog_id: 1,
    provider_id: "openai",
    title: "Formal annotation",
    created_by: null,
    created_at: "2026-04-02T10:00:00.000Z",
  },
];

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

describe("tts queries", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = extractUrl(input);

        if (url.endsWith("/api/providers?type=tts")) {
          return jsonResponse(providers);
        }

        if (url.endsWith("/api/tts/elevenlabs/voices")) {
          return jsonResponse(voices);
        }

        if (url.endsWith("/api/dialogs")) {
          return jsonResponse(dialogs);
        }

        if (url.endsWith("/api/dialogs/1/annotations")) {
          return jsonResponse(annotations);
        }

        return jsonResponse({ message: "Not Found" }, 404);
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches TTS providers", async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createTestWrapper({ queryClient });

    const { result } = renderHook(() => useTtsProviders(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(providers);
    expect(fetch).toHaveBeenCalledWith(
      "/api/providers?type=tts",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("fetches voices for a provider", async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createTestWrapper({ queryClient });

    const { result } = renderHook(() => useTtsVoices("elevenlabs"), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(voices);
    expect(fetch).toHaveBeenCalledWith(
      "/api/tts/elevenlabs/voices",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("disables voices query when providerId is null", () => {
    const queryClient = createTestQueryClient();
    const wrapper = createTestWrapper({ queryClient });

    const { result } = renderHook(() => useTtsVoices(null), { wrapper });

    expect(result.current.fetchStatus).toBe("idle");
  });

  it("fetches dialogs", async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createTestWrapper({ queryClient });

    const { result } = renderHook(() => useDialogs(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(dialogs);
    expect(fetch).toHaveBeenCalledWith(
      "/api/dialogs",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("fetches annotations for a dialog", async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createTestWrapper({ queryClient });

    const { result } = renderHook(() => useAnnotationsByDialog(1), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(annotations);
    expect(fetch).toHaveBeenCalledWith(
      "/api/dialogs/1/annotations",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("disables annotations query when dialogId is null", () => {
    const queryClient = createTestQueryClient();
    const wrapper = createTestWrapper({ queryClient });

    const { result } = renderHook(() => useAnnotationsByDialog(null), {
      wrapper,
    });

    expect(result.current.fetchStatus).toBe("idle");
  });

  it("provides structured query keys via ttsKeys", () => {
    expect(ttsKeys.providers()).toEqual(["tts", "providers"]);
    expect(ttsKeys.voices("elevenlabs")).toEqual([
      "tts",
      "voices",
      "elevenlabs",
    ]);
    expect(ttsKeys.dialogs()).toEqual(["tts", "dialogs"]);
    expect(ttsKeys.annotations(1)).toEqual(["tts", "annotations", 1]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/features/tts/api/queries.test.tsx`
Expected: FAIL — `queries.ts` does not exist

- [ ] **Step 3: Implement the query hooks**

```ts
// frontend/src/features/tts/api/queries.ts
import { useQuery } from "@tanstack/react-query";
import { api } from "../../../lib/api-client.ts";
import type {
  AnnotatedDialog,
  Dialog,
  Provider,
  Voice,
} from "../../../types/api.ts";

export const ttsKeys = {
  providers: () => ["tts", "providers"] as const,
  voices: (providerId: string) => ["tts", "voices", providerId] as const,
  dialogs: () => ["tts", "dialogs"] as const,
  annotations: (dialogId: number) => ["tts", "annotations", dialogId] as const,
};

export function useTtsProviders() {
  return useQuery({
    queryKey: ttsKeys.providers(),
    queryFn: () => api.get<Provider[]>("/providers?type=tts"),
  });
}

export function useTtsVoices(providerId: string | null) {
  return useQuery({
    queryKey: ttsKeys.voices(providerId ?? ""),
    queryFn: () => api.get<Voice[]>(`/tts/${providerId}/voices`),
    enabled: providerId !== null,
  });
}

export function useDialogs() {
  return useQuery({
    queryKey: ttsKeys.dialogs(),
    queryFn: () => api.get<Dialog[]>("/dialogs"),
  });
}

export function useAnnotationsByDialog(dialogId: number | null) {
  return useQuery({
    queryKey: ttsKeys.annotations(dialogId ?? 0),
    queryFn: () =>
      api.get<AnnotatedDialog[]>(`/dialogs/${dialogId}/annotations`),
    enabled: dialogId !== null,
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/features/tts/api/queries.test.tsx`
Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/tts/api/queries.ts frontend/src/features/tts/api/queries.test.tsx
git commit -m "feat(tts): add TanStack Query hooks for TTS selection flow"
```

---

### Task 2: ProviderSelector Component

**Files:**
- Create: `frontend/src/features/tts/components/ProviderSelector.tsx`
- Create: `frontend/src/features/tts/components/ProviderSelector.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// frontend/src/features/tts/components/ProviderSelector.test.tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test-utils.tsx";
import { ProviderSelector } from "./ProviderSelector.tsx";

const providers = [
  {
    id: "elevenlabs",
    name: "ElevenLabs",
    type: "tts",
    enabled: true,
    created_at: "2026-04-06T00:00:00.000Z",
  },
  {
    id: "google",
    name: "Google",
    type: "tts",
    enabled: true,
    created_at: "2026-04-06T00:00:00.000Z",
  },
  {
    id: "disabled-provider",
    name: "Disabled TTS",
    type: "tts",
    enabled: false,
    created_at: "2026-04-06T00:00:00.000Z",
  },
];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("ProviderSelector", () => {
  const onSelect = vi.fn();

  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(providers)),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    onSelect.mockReset();
  });

  it("renders enabled providers as options and calls onSelect", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <ProviderSelector selectedId={null} onSelect={onSelect} />,
    );

    const select = await screen.findByRole("combobox", {
      name: "TTS Provider",
    });

    expect(select).toBeInTheDocument();

    await user.selectOptions(select, "elevenlabs");

    expect(onSelect).toHaveBeenCalledWith("elevenlabs");
  });

  it("only shows enabled providers", async () => {
    renderWithProviders(
      <ProviderSelector selectedId={null} onSelect={onSelect} />,
    );

    await screen.findByRole("combobox", { name: "TTS Provider" });

    const options = screen.getAllByRole("option");
    const optionTexts = options.map((o) => o.textContent);

    expect(optionTexts).toContain("ElevenLabs");
    expect(optionTexts).toContain("Google");
    expect(optionTexts).not.toContain("Disabled TTS");
  });

  it("shows loading state", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );

    renderWithProviders(
      <ProviderSelector selectedId={null} onSelect={onSelect} />,
    );

    expect(screen.getByText("Loading providers...")).toBeInTheDocument();
  });

  it("shows error state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ message: "Server error" }, 500)),
    );

    renderWithProviders(
      <ProviderSelector selectedId={null} onSelect={onSelect} />,
    );

    expect(
      await screen.findByText("Failed to load providers."),
    ).toBeInTheDocument();
  });

  it("reflects the selected provider", async () => {
    renderWithProviders(
      <ProviderSelector selectedId="google" onSelect={onSelect} />,
    );

    const select = await screen.findByRole("combobox", {
      name: "TTS Provider",
    });

    expect(select).toHaveValue("google");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/features/tts/components/ProviderSelector.test.tsx`
Expected: FAIL — `ProviderSelector.tsx` does not exist

- [ ] **Step 3: Implement ProviderSelector**

```tsx
// frontend/src/features/tts/components/ProviderSelector.tsx
import { useTtsProviders } from "../api/queries.ts";

interface ProviderSelectorProps {
  selectedId: string | null;
  onSelect: (providerId: string) => void;
}

export function ProviderSelector({
  selectedId,
  onSelect,
}: ProviderSelectorProps) {
  const providersQuery = useTtsProviders();

  if (providersQuery.isPending) {
    return (
      <div className="text-sm text-gray-500">Loading providers...</div>
    );
  }

  if (providersQuery.isError) {
    return (
      <div className="text-sm text-red-600">Failed to load providers.</div>
    );
  }

  const enabledProviders = providersQuery.data.filter((p) => p.enabled);

  return (
    <div className="space-y-1">
      <label
        htmlFor="tts-provider-select"
        className="block text-sm font-medium text-gray-700"
      >
        TTS Provider
      </label>
      <select
        id="tts-provider-select"
        className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
        value={selectedId ?? ""}
        onChange={(e) => onSelect(e.target.value)}
      >
        <option value="" disabled>
          Select a provider...
        </option>
        {enabledProviders.map((provider) => (
          <option key={provider.id} value={provider.id}>
            {provider.name}
          </option>
        ))}
      </select>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/features/tts/components/ProviderSelector.test.tsx`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/tts/components/ProviderSelector.tsx frontend/src/features/tts/components/ProviderSelector.test.tsx
git commit -m "feat(tts): add ProviderSelector component"
```

---

### Task 3: DialogSelector Component

**Files:**
- Create: `frontend/src/features/tts/components/DialogSelector.tsx`
- Create: `frontend/src/features/tts/components/DialogSelector.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// frontend/src/features/tts/components/DialogSelector.test.tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test-utils.tsx";
import { DialogSelector } from "./DialogSelector.tsx";

const dialogs = [
  {
    id: 1,
    title: "Greeting practice",
    description: null,
    language: "en-US",
    created_by: null,
    created_at: "2026-04-01T10:00:00.000Z",
  },
  {
    id: 2,
    title: "Support escalation",
    description: null,
    language: "en-GB",
    created_by: null,
    created_at: "2026-04-02T10:00:00.000Z",
  },
];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("DialogSelector", () => {
  const onSelect = vi.fn();

  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(dialogs)),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    onSelect.mockReset();
  });

  it("renders dialogs as options and calls onSelect", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <DialogSelector selectedId={null} onSelect={onSelect} />,
    );

    const select = await screen.findByRole("combobox", { name: "Dialog" });

    await user.selectOptions(select, "1");

    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it("shows loading state", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );

    renderWithProviders(
      <DialogSelector selectedId={null} onSelect={onSelect} />,
    );

    expect(screen.getByText("Loading dialogs...")).toBeInTheDocument();
  });

  it("shows error state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ message: "Server error" }, 500)),
    );

    renderWithProviders(
      <DialogSelector selectedId={null} onSelect={onSelect} />,
    );

    expect(
      await screen.findByText("Failed to load dialogs."),
    ).toBeInTheDocument();
  });

  it("reflects the selected dialog", async () => {
    renderWithProviders(
      <DialogSelector selectedId={2} onSelect={onSelect} />,
    );

    const select = await screen.findByRole("combobox", { name: "Dialog" });

    expect(select).toHaveValue("2");
  });

  it("shows empty state when no dialogs exist", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse([])),
    );

    renderWithProviders(
      <DialogSelector selectedId={null} onSelect={onSelect} />,
    );

    expect(
      await screen.findByText("No dialogs available."),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/features/tts/components/DialogSelector.test.tsx`
Expected: FAIL — `DialogSelector.tsx` does not exist

- [ ] **Step 3: Implement DialogSelector**

```tsx
// frontend/src/features/tts/components/DialogSelector.tsx
import { useDialogs } from "../api/queries.ts";

interface DialogSelectorProps {
  selectedId: number | null;
  onSelect: (dialogId: number) => void;
}

export function DialogSelector({ selectedId, onSelect }: DialogSelectorProps) {
  const dialogsQuery = useDialogs();

  if (dialogsQuery.isPending) {
    return <div className="text-sm text-gray-500">Loading dialogs...</div>;
  }

  if (dialogsQuery.isError) {
    return (
      <div className="text-sm text-red-600">Failed to load dialogs.</div>
    );
  }

  if (dialogsQuery.data.length === 0) {
    return (
      <div className="text-sm text-gray-500">No dialogs available.</div>
    );
  }

  return (
    <div className="space-y-1">
      <label
        htmlFor="dialog-select"
        className="block text-sm font-medium text-gray-700"
      >
        Dialog
      </label>
      <select
        id="dialog-select"
        className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
        value={selectedId !== null ? String(selectedId) : ""}
        onChange={(e) => onSelect(Number(e.target.value))}
      >
        <option value="" disabled>
          Select a dialog...
        </option>
        {dialogsQuery.data.map((dialog) => (
          <option key={dialog.id} value={String(dialog.id)}>
            {dialog.title} ({dialog.language})
          </option>
        ))}
      </select>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/features/tts/components/DialogSelector.test.tsx`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/tts/components/DialogSelector.tsx frontend/src/features/tts/components/DialogSelector.test.tsx
git commit -m "feat(tts): add DialogSelector component"
```

---

### Task 4: AnnotationSelector Component

**Files:**
- Create: `frontend/src/features/tts/components/AnnotationSelector.tsx`
- Create: `frontend/src/features/tts/components/AnnotationSelector.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// frontend/src/features/tts/components/AnnotationSelector.test.tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test-utils.tsx";
import { AnnotationSelector } from "./AnnotationSelector.tsx";

const annotations = [
  {
    id: 10,
    dialog_id: 1,
    provider_id: "openai",
    title: "Formal annotation",
    created_by: null,
    created_at: "2026-04-02T10:00:00.000Z",
  },
  {
    id: 11,
    dialog_id: 1,
    provider_id: "openai",
    title: "Casual annotation",
    created_by: null,
    created_at: "2026-04-03T10:00:00.000Z",
  },
];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("AnnotationSelector", () => {
  const onSelect = vi.fn();

  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(annotations)),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    onSelect.mockReset();
  });

  it("renders annotations with a 'Clean' option and calls onSelect", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <AnnotationSelector
        dialogId={1}
        selectedAnnotationId={null}
        onSelect={onSelect}
      />,
    );

    const select = await screen.findByRole("combobox", {
      name: "Annotation Variant",
    });

    // "Clean" option should be present
    const options = screen.getAllByRole("option");
    expect(options.map((o) => o.textContent)).toContain(
      "Clean (no annotation)",
    );

    await user.selectOptions(select, "10");

    expect(onSelect).toHaveBeenCalledWith(10);
  });

  it("allows selecting the Clean option", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <AnnotationSelector
        dialogId={1}
        selectedAnnotationId={10}
        onSelect={onSelect}
      />,
    );

    const select = await screen.findByRole("combobox", {
      name: "Annotation Variant",
    });

    await user.selectOptions(select, "clean");

    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("shows loading state", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );

    renderWithProviders(
      <AnnotationSelector
        dialogId={1}
        selectedAnnotationId={null}
        onSelect={onSelect}
      />,
    );

    expect(screen.getByText("Loading annotations...")).toBeInTheDocument();
  });

  it("shows error state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ message: "Server error" }, 500)),
    );

    renderWithProviders(
      <AnnotationSelector
        dialogId={1}
        selectedAnnotationId={null}
        onSelect={onSelect}
      />,
    );

    expect(
      await screen.findByText("Failed to load annotations."),
    ).toBeInTheDocument();
  });

  it("reflects the selected annotation", async () => {
    renderWithProviders(
      <AnnotationSelector
        dialogId={1}
        selectedAnnotationId={10}
        onSelect={onSelect}
      />,
    );

    const select = await screen.findByRole("combobox", {
      name: "Annotation Variant",
    });

    expect(select).toHaveValue("10");
  });

  it("shows 'Clean' as selected when selectedAnnotationId is null", async () => {
    renderWithProviders(
      <AnnotationSelector
        dialogId={1}
        selectedAnnotationId={null}
        onSelect={onSelect}
      />,
    );

    const select = await screen.findByRole("combobox", {
      name: "Annotation Variant",
    });

    expect(select).toHaveValue("clean");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/features/tts/components/AnnotationSelector.test.tsx`
Expected: FAIL — `AnnotationSelector.tsx` does not exist

- [ ] **Step 3: Implement AnnotationSelector**

```tsx
// frontend/src/features/tts/components/AnnotationSelector.tsx
import { useAnnotationsByDialog } from "../api/queries.ts";

interface AnnotationSelectorProps {
  dialogId: number;
  selectedAnnotationId: number | null;
  onSelect: (annotationId: number | null) => void;
}

export function AnnotationSelector({
  dialogId,
  selectedAnnotationId,
  onSelect,
}: AnnotationSelectorProps) {
  const annotationsQuery = useAnnotationsByDialog(dialogId);

  if (annotationsQuery.isPending) {
    return (
      <div className="text-sm text-gray-500">Loading annotations...</div>
    );
  }

  if (annotationsQuery.isError) {
    return (
      <div className="text-sm text-red-600">
        Failed to load annotations.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <label
        htmlFor="annotation-select"
        className="block text-sm font-medium text-gray-700"
      >
        Annotation Variant
      </label>
      <select
        id="annotation-select"
        className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
        value={selectedAnnotationId !== null ? String(selectedAnnotationId) : "clean"}
        onChange={(e) => {
          const value = e.target.value;
          onSelect(value === "clean" ? null : Number(value));
        }}
      >
        <option value="clean">Clean (no annotation)</option>
        {annotationsQuery.data.map((annotation) => (
          <option key={annotation.id} value={String(annotation.id)}>
            {annotation.title}
          </option>
        ))}
      </select>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/features/tts/components/AnnotationSelector.test.tsx`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/tts/components/AnnotationSelector.tsx frontend/src/features/tts/components/AnnotationSelector.test.tsx
git commit -m "feat(tts): add AnnotationSelector component with Clean option"
```

---

### Task 5: TtsPage Orchestrating Component

**Files:**
- Create: `frontend/src/features/tts/components/TtsPage.tsx`
- Create: `frontend/src/features/tts/components/TtsPage.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// frontend/src/features/tts/components/TtsPage.test.tsx
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test-utils.tsx";
import { TtsPage } from "./TtsPage.tsx";

const providers = [
  {
    id: "elevenlabs",
    name: "ElevenLabs",
    type: "tts",
    enabled: true,
    created_at: "2026-04-06T00:00:00.000Z",
  },
];

const dialogs = [
  {
    id: 1,
    title: "Greeting practice",
    description: null,
    language: "en-US",
    created_by: null,
    created_at: "2026-04-01T10:00:00.000Z",
  },
];

const annotations = [
  {
    id: 10,
    dialog_id: 1,
    provider_id: "openai",
    title: "Formal annotation",
    created_by: null,
    created_at: "2026-04-02T10:00:00.000Z",
  },
];

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

describe("TtsPage", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = extractUrl(input);

        if (url.endsWith("/api/providers?type=tts")) {
          return jsonResponse(providers);
        }

        if (url.endsWith("/api/dialogs")) {
          return jsonResponse(dialogs);
        }

        if (url.endsWith("/api/dialogs/1/annotations")) {
          return jsonResponse(annotations);
        }

        return jsonResponse({ message: "Not Found" }, 404);
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the page title", async () => {
    renderWithProviders(<TtsPage />);

    expect(
      screen.getByRole("heading", { name: "TTS Testing" }),
    ).toBeInTheDocument();
  });

  it("shows only provider selector initially, dialog and annotation are hidden", async () => {
    renderWithProviders(<TtsPage />);

    expect(
      await screen.findByRole("combobox", { name: "TTS Provider" }),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("combobox", { name: "Dialog" }),
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole("combobox", { name: "Annotation Variant" }),
    ).not.toBeInTheDocument();
  });

  it("shows dialog selector after selecting a provider", async () => {
    const user = userEvent.setup();

    renderWithProviders(<TtsPage />);

    const providerSelect = await screen.findByRole("combobox", {
      name: "TTS Provider",
    });
    await user.selectOptions(providerSelect, "elevenlabs");

    expect(
      await screen.findByRole("combobox", { name: "Dialog" }),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("combobox", { name: "Annotation Variant" }),
    ).not.toBeInTheDocument();
  });

  it("shows annotation selector after selecting a dialog", async () => {
    const user = userEvent.setup();

    renderWithProviders(<TtsPage />);

    const providerSelect = await screen.findByRole("combobox", {
      name: "TTS Provider",
    });
    await user.selectOptions(providerSelect, "elevenlabs");

    const dialogSelect = await screen.findByRole("combobox", {
      name: "Dialog",
    });
    await user.selectOptions(dialogSelect, "1");

    expect(
      await screen.findByRole("combobox", { name: "Annotation Variant" }),
    ).toBeInTheDocument();
  });

  it("resets dialog and annotation when provider changes", async () => {
    const user = userEvent.setup();

    // Add a second provider to enable switching
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = extractUrl(input);

        if (url.endsWith("/api/providers?type=tts")) {
          return jsonResponse([
            ...providers,
            {
              id: "google",
              name: "Google",
              type: "tts",
              enabled: true,
              created_at: "2026-04-06T00:00:00.000Z",
            },
          ]);
        }

        if (url.endsWith("/api/dialogs")) {
          return jsonResponse(dialogs);
        }

        if (url.endsWith("/api/dialogs/1/annotations")) {
          return jsonResponse(annotations);
        }

        return jsonResponse({ message: "Not Found" }, 404);
      }),
    );

    renderWithProviders(<TtsPage />);

    // Select provider and dialog
    const providerSelect = await screen.findByRole("combobox", {
      name: "TTS Provider",
    });
    await user.selectOptions(providerSelect, "elevenlabs");

    const dialogSelect = await screen.findByRole("combobox", {
      name: "Dialog",
    });
    await user.selectOptions(dialogSelect, "1");

    // Verify annotation selector appeared
    expect(
      await screen.findByRole("combobox", { name: "Annotation Variant" }),
    ).toBeInTheDocument();

    // Change provider — should reset dialog and annotation
    await user.selectOptions(providerSelect, "google");

    // Dialog selector should still be visible (new provider selected)
    // but annotation selector should be gone (dialog was reset)
    expect(
      screen.getByRole("combobox", { name: "Dialog" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Annotation Variant" }),
    ).not.toBeInTheDocument();
  });

  it("resets annotation when dialog changes", async () => {
    const user = userEvent.setup();

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = extractUrl(input);

        if (url.endsWith("/api/providers?type=tts")) {
          return jsonResponse(providers);
        }

        if (url.endsWith("/api/dialogs")) {
          return jsonResponse([
            ...dialogs,
            {
              id: 2,
              title: "Second dialog",
              description: null,
              language: "en-GB",
              created_by: null,
              created_at: "2026-04-03T10:00:00.000Z",
            },
          ]);
        }

        if (url.includes("/annotations")) {
          return jsonResponse(annotations);
        }

        return jsonResponse({ message: "Not Found" }, 404);
      }),
    );

    renderWithProviders(<TtsPage />);

    const providerSelect = await screen.findByRole("combobox", {
      name: "TTS Provider",
    });
    await user.selectOptions(providerSelect, "elevenlabs");

    const dialogSelect = await screen.findByRole("combobox", {
      name: "Dialog",
    });
    await user.selectOptions(dialogSelect, "1");

    // Wait for annotation selector to appear
    await screen.findByRole("combobox", { name: "Annotation Variant" });

    // Select an annotation
    const annotationSelect = screen.getByRole("combobox", {
      name: "Annotation Variant",
    });
    await user.selectOptions(annotationSelect, "10");

    // Change dialog — annotation selector should reset
    await user.selectOptions(dialogSelect, "2");

    // Annotation selector should still be visible but reset to "Clean"
    const newAnnotationSelect = await screen.findByRole("combobox", {
      name: "Annotation Variant",
    });
    expect(newAnnotationSelect).toHaveValue("clean");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/features/tts/components/TtsPage.test.tsx`
Expected: FAIL — `TtsPage.tsx` in features directory does not exist

- [ ] **Step 3: Implement TtsPage**

```tsx
// frontend/src/features/tts/components/TtsPage.tsx
import { useState } from "react";
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
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/features/tts/components/TtsPage.test.tsx`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/tts/components/TtsPage.tsx frontend/src/features/tts/components/TtsPage.test.tsx
git commit -m "feat(tts): add TtsPage with cascading selection flow"
```

---

### Task 6: Wire Up Router Re-export

**Files:**
- Modify: `frontend/src/pages/TtsPage.tsx`

- [ ] **Step 1: Update the pages re-export**

Replace the contents of `frontend/src/pages/TtsPage.tsx` with:

```tsx
// frontend/src/pages/TtsPage.tsx
import { TtsPage as TtsFeaturePage } from "../features/tts/components/TtsPage.tsx";

export function TtsPage() {
  return <TtsFeaturePage />;
}
```

This follows the same pattern as `frontend/src/pages/ProvidersPage.tsx`.

- [ ] **Step 2: Run all TTS tests**

Run: `cd frontend && npx vitest run src/features/tts/`
Expected: All tests across queries.test.tsx, ProviderSelector.test.tsx, DialogSelector.test.tsx, AnnotationSelector.test.tsx, and TtsPage.test.tsx pass.

- [ ] **Step 3: Run the full frontend test suite**

Run: `cd frontend && npx vitest run`
Expected: All tests pass, no regressions.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/TtsPage.tsx
git commit -m "feat(tts): wire TtsPage feature to router via pages re-export"
```

---

### Task 7: Playwright Verification

**Files:** None (verification only)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` (from root)
Expected: Backend on port 3000, frontend on port 5173.

- [ ] **Step 2: Open the TTS page in Playwright**

Navigate to `http://localhost:5173/tts` in Playwright browser.

- [ ] **Step 3: Take a screenshot of the initial state**

Verify:
- Page title "TTS Testing" is visible
- Provider dropdown is visible
- No dialog or annotation dropdowns visible yet

- [ ] **Step 4: Select a provider and take a screenshot**

Select a TTS provider from the dropdown.
Verify:
- Dialog dropdown appears
- Annotation dropdown is still hidden

- [ ] **Step 5: Select a dialog and take a screenshot**

Select a dialog from the dropdown.
Verify:
- Annotation dropdown appears with "Clean (no annotation)" as default
- All three selectors are visible

- [ ] **Step 6: Check browser console for errors**

Verify: No errors or warnings in the console.

- [ ] **Step 7: Final commit (if any Playwright-driven fixes were needed)**

If any fixes were required during verification:

```bash
git add -A
git commit -m "fix(tts): address issues found during Playwright verification"
```
