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
