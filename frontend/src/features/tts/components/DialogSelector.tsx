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
