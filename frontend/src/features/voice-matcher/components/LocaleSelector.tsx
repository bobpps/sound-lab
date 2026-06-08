interface LocaleSelectorProps {
  locales: string[];
  value: string | null;
  onChange: (locale: string) => void;
  isLoading: boolean;
  isError: boolean;
}

export function LocaleSelector({
  locales,
  value,
  onChange,
  isLoading,
  isError,
}: LocaleSelectorProps) {
  return (
    <label className="flex flex-col gap-1 text-sm text-gray-700">
      <span>Standard locale</span>
      <select
        aria-label="Standard locale"
        className="rounded border border-gray-300 px-2 py-1"
        value={value ?? ""}
        disabled={isLoading || isError}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="" disabled>
          {isLoading ? "Loading…" : "Select a locale"}
        </option>
        {locales.map((loc) => (
          <option key={loc} value={loc}>
            {loc}
          </option>
        ))}
      </select>

      {isError ? (
        <p className="text-sm text-red-600">Failed to load locales.</p>
      ) : null}
    </label>
  );
}
