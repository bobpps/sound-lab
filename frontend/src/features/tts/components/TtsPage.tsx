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
