import { describe, expect, it } from "vitest";
import type { Voice } from "../../../types/api.ts";
import {
  filterStandardCandidates,
  uniqueLocales,
} from "./useStandardCandidates.ts";

const voices: Voice[] = [
  { id: "en-US-Standard-A", name: "en-US-Standard-A", language: "en-US", gender: "male" },
  { id: "en-US-Standard-C", name: "en-US-Standard-C", language: "en-US", gender: "female" },
  { id: "en-US-Standard-X", name: "en-US-Standard-X", language: "en-US", gender: "neutral" },
  { id: "en-US-Standard-Z", name: "en-US-Standard-Z", language: "en-US" },
  { id: "de-DE-Standard-A", name: "de-DE-Standard-A", language: "de-DE", gender: "female" },
];

describe("uniqueLocales", () => {
  it("returns sorted unique locales", () => {
    expect(uniqueLocales(voices)).toEqual(["de-DE", "en-US"]);
  });

  it("returns an empty array for no voices", () => {
    expect(uniqueLocales([])).toEqual([]);
  });
});

describe("filterStandardCandidates", () => {
  it("keeps same-gender, neutral and undefined; excludes only the opposite gender", () => {
    const result = filterStandardCandidates(voices, "en-US", "male");
    expect(result.map((v) => v.id)).toEqual([
      "en-US-Standard-A", // male
      "en-US-Standard-X", // neutral
      "en-US-Standard-Z", // undefined
    ]);
  });

  it("excludes male when reference is female", () => {
    const result = filterStandardCandidates(voices, "en-US", "female");
    expect(result.map((v) => v.id)).toEqual([
      "en-US-Standard-C", // female
      "en-US-Standard-X", // neutral
      "en-US-Standard-Z", // undefined
    ]);
  });

  it("filters by locale", () => {
    const result = filterStandardCandidates(voices, "de-DE", "female");
    expect(result.map((v) => v.id)).toEqual(["de-DE-Standard-A"]);
  });

  it("returns empty when locale or gender is null", () => {
    expect(filterStandardCandidates(voices, null, "male")).toEqual([]);
    expect(filterStandardCandidates(voices, "en-US", null)).toEqual([]);
  });
});
