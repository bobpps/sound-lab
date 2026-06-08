interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function TextInput({ value, onChange }: TextInputProps) {
  return (
    <label className="flex flex-col gap-1 text-sm text-gray-700">
      <span>Phrase</span>
      <textarea
        aria-label="Phrase"
        className="min-h-24 rounded border border-gray-300 px-2 py-1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter a phrase to synthesize…"
      />
    </label>
  );
}
