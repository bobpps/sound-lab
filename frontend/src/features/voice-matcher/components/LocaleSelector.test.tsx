import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LocaleSelector } from "./LocaleSelector.tsx";

describe("LocaleSelector", () => {
  it("renders an error message when status is error", () => {
    render(
      <LocaleSelector
        locales={[]}
        value={null}
        onChange={() => {}}
        isLoading={false}
        isError
      />,
    );
    expect(screen.getByText("Failed to load locales.")).toBeInTheDocument();
  });

  it("renders a loading indicator while loading", () => {
    render(
      <LocaleSelector
        locales={[]}
        value={null}
        onChange={() => {}}
        isLoading
        isError={false}
      />,
    );
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(
      screen.queryByText("Failed to load locales."),
    ).not.toBeInTheDocument();
  });

  it("renders the locale options when loaded", () => {
    render(
      <LocaleSelector
        locales={["en-US", "de-DE"]}
        value={null}
        onChange={() => {}}
        isLoading={false}
        isError={false}
      />,
    );
    expect(screen.getByRole("option", { name: "en-US" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "de-DE" })).toBeInTheDocument();
    expect(
      screen.queryByText("Failed to load locales."),
    ).not.toBeInTheDocument();
  });
});
