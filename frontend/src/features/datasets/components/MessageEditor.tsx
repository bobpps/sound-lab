export interface EditableMessage {
  clientId: string;
  id: number | null;
  order: number;
  character: 1 | 2;
  text: string;
}

interface MessageEditorProps {
  index: number;
  disabled?: boolean;
  message: EditableMessage;
  onChange: (
    clientId: string,
    patch: Partial<Pick<EditableMessage, "character" | "text">>,
  ) => void;
  onDelete: (clientId: string) => void;
}

export function MessageEditor({
  index,
  disabled = false,
  message,
  onChange,
  onDelete,
}: MessageEditorProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-900 text-sm font-semibold text-white">
            {index + 1}
          </div>

          <label className="flex shrink-0 flex-col gap-1 text-sm text-gray-600">
            Character
            <select
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              value={message.character}
              onChange={(event) =>
                onChange(message.clientId, {
                  character: Number(event.target.value) as 1 | 2,
                })
              }
              disabled={disabled}
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
            </select>
          </label>
        </div>

        <button
          type="button"
          className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => onDelete(message.clientId)}
          disabled={disabled}
        >
          Delete
        </button>
      </div>

      <label className="mt-3 flex flex-col gap-1 text-sm text-gray-600">
        Text
        <input
          type="text"
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          value={message.text}
          onChange={(event) =>
            onChange(message.clientId, {
              text: event.target.value,
            })
          }
          disabled={disabled}
        />
      </label>
    </div>
  );
}
