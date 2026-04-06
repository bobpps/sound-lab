import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Tabs } from "./Tabs.tsx";

describe("Tabs", () => {
  it("renders the default tab content and switches tabs on click", async () => {
    const user = userEvent.setup();

    render(
      <Tabs
        defaultTab="tts"
        tabs={[
          { id: "tts", label: "TTS" },
          { id: "llm", label: "LLM" },
        ]}
      >
        {(activeTab) => <p>{activeTab}</p>}
      </Tabs>,
    );

    expect(screen.getByRole("tab", { name: "TTS" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("tts")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "LLM" }));

    expect(screen.getByRole("tab", { name: "LLM" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("llm")).toBeInTheDocument();
  });
});
