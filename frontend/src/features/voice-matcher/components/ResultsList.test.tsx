import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ResultsList } from "./ResultsList.tsx";
import type { ResultMap } from "../hooks/useBatchSynthesis.ts";

const results: ResultMap = {
  Kore: { status: "done", url: "blob:ref" },
  "en-US-Standard-A": { status: "done", url: "blob:a" },
  "en-US-Standard-C": { status: "done", url: "blob:c" },
};

describe("ResultsList", () => {
  it("renders the reference card and one card per candidate", () => {
    render(
      <ResultsList
        referenceLabel="Kore"
        candidateLabels={["en-US-Standard-A", "en-US-Standard-C"]}
        results={results}
        onPlay={() => {}}
        onPlayAll={() => {}}
        isRunning={false}
      />,
    );
    expect(screen.getByText("Kore")).toBeInTheDocument();
    expect(screen.getByText("en-US-Standard-A")).toBeInTheDocument();
    expect(screen.getByText("en-US-Standard-C")).toBeInTheDocument();
  });

  it("calls onPlayAll when the play-all button is clicked", async () => {
    const onPlayAll = vi.fn();
    const user = userEvent.setup();
    render(
      <ResultsList
        referenceLabel="Kore"
        candidateLabels={["en-US-Standard-A"]}
        results={results}
        onPlay={() => {}}
        onPlayAll={onPlayAll}
        isRunning={false}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: /play all in sequence/i }),
    );
    expect(onPlayAll).toHaveBeenCalled();
  });

  it("disables play-all while a batch is still running", () => {
    // While synthesizing, some cards have no URL yet; playAll captures the
    // ready URLs once, so late finishers would be skipped. Disabling until the
    // batch settles avoids a partial play-all.
    render(
      <ResultsList
        referenceLabel="Kore"
        candidateLabels={["en-US-Standard-A"]}
        results={{ Kore: { status: "done", url: "blob:ref" } }}
        onPlay={() => {}}
        onPlayAll={() => {}}
        isRunning
      />,
    );
    expect(
      screen.getByRole("button", { name: /play all in sequence/i }),
    ).toBeDisabled();
  });
});
