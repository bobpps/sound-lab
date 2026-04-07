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

    setPairs(newPairs);
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
