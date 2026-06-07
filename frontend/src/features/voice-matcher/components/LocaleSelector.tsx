interface LocaleSelectorProps {
  locales: string[];
  value: string | null;
  onChange: (locale: string) => void;
}

export function LocaleSelector({
  locales,
  value,
  onChange,
}: LocaleSelectorProps) {
  return (
    <label className="flex flex-col gap-1 text-sm text-gray-700">
      <span>Standard locale</span>
      <select
        aria-label="Standard locale"
        className="rounded border border-gray-300 px-2 py-1"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="" disabled>
          {locales.length === 0 ? "Loading…" : "Select a locale"}
        </option>
        {locales.map((loc) => (
          <option key={loc} value={loc}>
            {loc}
          </option>
        ))}
      </select>
    </label>
  );
}
