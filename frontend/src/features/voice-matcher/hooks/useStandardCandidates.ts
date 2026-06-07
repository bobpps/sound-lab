import type { Voice } from "../../../types/api.ts";
import { useStandardVoices } from "../api/queries.ts";

export type ReferenceGender = "male" | "female";

export function uniqueLocales(voices: Voice[]): string[] {
  return [...new Set(voices.map((v) => v.language))].sort();
}

export function filterStandardCandidates(
  voices: Voice[],
  locale: string | null,
  referenceGender: ReferenceGender | null,
): Voice[] {
  if (locale === null || referenceGender === null) {
    return [];
  }
  const opposite: ReferenceGender =
    referenceGender === "male" ? "female" : "male";
  return voices.filter(
    (v) => v.language === locale && v.gender !== opposite,
  );
}

interface UseStandardCandidatesResult {
  locales: string[];
  candidates: Voice[];
  isLoading: boolean;
  isError: boolean;
}

export function useStandardCandidates(
  locale: string | null,
  referenceGender: ReferenceGender | null,
): UseStandardCandidatesResult {
  const { data, isLoading, isError } = useStandardVoices();
  const voices = data ?? [];
  return {
    locales: uniqueLocales(voices),
    candidates: filterStandardCandidates(voices, locale, referenceGender),
    isLoading,
    isError,
  };
}
