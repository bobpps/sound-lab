import { useAnnotationsByDialog } from "../api/queries.ts";

interface AnnotationSelectorProps {
  dialogId: number;
  providerId: string;
  selectedAnnotationId: number | null;
  onSelect: (annotationId: number | null) => void;
}

export function AnnotationSelector({
  dialogId,
  providerId,
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

  const providerAnnotations = annotationsQuery.data.filter(
    (a) => a.provider_id === providerId,
  );

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
        {providerAnnotations.map((annotation) => (
          <option key={annotation.id} value={String(annotation.id)}>
            {annotation.title}
          </option>
        ))}
      </select>
    </div>
  );
}
