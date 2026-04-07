import { useEffect, useRef, useState } from "react";
import { api } from "../../../lib/api-client.ts";
import type { AnnotatedMessage, DialogMessage } from "../../../types/api.ts";
import {
  useAnnotation,
  useDialogDetail,
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
  const dialogQuery = useDialogDetail(dialogId);
  const updateMessage = useUpdateAnnotatedMessage();
  const createAnnotation = useCreateAnnotation();
  const createAnnotationMessage = useCreateAnnotationMessage();

  const [showAutoAnnotate, setShowAutoAnnotate] = useState(false);
  const [localTexts, setLocalTexts] = useState<Map<number, string>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [savingVariant, setSavingVariant] = useState(false);

  const debounceTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  // Refs to access current values from effect cleanup (avoids stale closures)
  const localTextsRef = useRef(localTexts);
  localTextsRef.current = localTexts;
  const annotationQueryRef = useRef(annotationQuery.data);
  annotationQueryRef.current = annotationQuery.data;
  const updateMessageRef = useRef(updateMessage.mutate);
  updateMessageRef.current = updateMessage.mutate;

  // Derive pairs from query data + local text overrides (no useEffect hydration)
  const annotatedMap = new Map(
    (annotationQuery.data?.messages ?? []).map((m) => [
      m.dialog_message_id,
      m,
    ]),
  );

  const pairs: MessagePair[] = (dialogQuery.data?.messages ?? []).map(
    (original) => {
      const annotated = annotatedMap.get(original.id) ?? null;
      const localText =
        localTexts.get(original.id) ?? annotated?.text ?? original.text;
      return { original, annotated, localText };
    },
  );

  // Flush all pending debounced saves immediately (fire mutations now, cancel timers)
  function flushPendingSaves() {
    const timers = debounceTimers.current;
    for (const [dialogMessageId, timer] of timers.entries()) {
      clearTimeout(timer);
      const text = localTexts.get(dialogMessageId);
      const annotatedMsg = annotationQuery.data?.messages.find(
        (m) => m.dialog_message_id === dialogMessageId,
      );
      if (text !== undefined && annotatedMsg) {
        updateMessage.mutate({
          annotationId,
          messageId: annotatedMsg.id,
          data: { text },
        });
      }
    }
    timers.clear();
  }

  // Flush pending saves, then reset local state when annotation changes or on unmount
  useEffect(() => {
    setLocalTexts(new Map());
    setError(null);
    const timers = debounceTimers.current;

    return () => {
      // Flush pending saves before discarding timers
      for (const [dialogMessageId, timer] of timers.entries()) {
        clearTimeout(timer);
        const text = localTextsRef.current.get(dialogMessageId);
        const annotatedMsg = annotationQueryRef.current?.messages.find(
          (m: AnnotatedMessage) => m.dialog_message_id === dialogMessageId,
        );
        if (text !== undefined && annotatedMsg) {
          updateMessageRef.current({
            annotationId,
            messageId: annotatedMsg.id,
            data: { text },
          });
        }
      }
      timers.clear();
    };
  }, [annotationId]);

  function handleTextChange(dialogMessageId: number, newText: string) {
    setError(null);

    setLocalTexts((current) => {
      const next = new Map(current);
      next.set(dialogMessageId, newText);
      return next;
    });

    // Look up annotated message from query data directly (avoids stale closure)
    const annotatedMsg = annotationQuery.data?.messages.find(
      (m) => m.dialog_message_id === dialogMessageId,
    );
    if (!annotatedMsg) {
      return;
    }

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
          messageId: annotatedMsg.id,
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
    flushPendingSaves();
    setError(null);
    setSavingVariant(true);

    let newAnnotationId: number | null = null;

    try {
      // Step 1: Create annotation shell
      const newAnnotation = await createAnnotation.mutateAsync({
        dialogId,
        data: {
          provider_id: ttsProviderId,
          title: `${annotationQuery.data?.title ?? "Annotation"} (copy)`,
        },
      });
      newAnnotationId = newAnnotation.id;

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
      // Rollback: delete the partially created annotation
      if (newAnnotationId !== null) {
        try {
          await api.delete(`/annotations/${newAnnotationId}`);
        } catch {
          // Rollback failed — leave it for manual cleanup
        }
      }
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
                <textarea
                  rows={2}
                  className={`w-full rounded-lg border px-3 py-2 text-sm ${
                    pair.annotated === null
                      ? "border-gray-200 bg-gray-50 text-gray-400"
                      : "border-gray-300 bg-white text-gray-900"
                  }`}
                  value={pair.localText}
                  onChange={(e) =>
                    handleTextChange(pair.original.id, e.target.value)
                  }
                  disabled={pair.annotated === null}
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
