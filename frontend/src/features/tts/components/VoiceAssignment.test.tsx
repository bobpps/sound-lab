import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test-utils.tsx";
import type { Voice } from "../../../types/api.ts";
import type { VoiceMap } from "../hooks/useAudioPlayback.ts";
import { VoiceAssignment } from "./VoiceAssignment.tsx";

const voices: Voice[] = [
  { id: "voice-1", name: "Alice", language: "en-US", gender: "female" },
  { id: "voice-2", name: "Bob", language: "en-US", gender: "male" },
  { id: "voice-3", name: "Charlie", language: "en-US" },
];

describe("VoiceAssignment", () => {
  it("renders two dropdowns for character 1 and character 2", () => {
    const onChange = vi.fn();

    renderWithProviders(
      <VoiceAssignment
        voices={voices}
        voiceMap={{}}
        onChange={onChange}
      />,
    );

    expect(screen.getByLabelText("Character 1 voice")).toBeInTheDocument();
    expect(screen.getByLabelText("Character 2 voice")).toBeInTheDocument();
  });

  it("shows voice options in each dropdown", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    renderWithProviders(
      <VoiceAssignment
        voices={voices}
        voiceMap={{}}
        onChange={onChange}
      />,
    );

    const select1 = screen.getByLabelText("Character 1 voice");
    await user.selectOptions(select1, "voice-1");

    expect(screen.getAllByRole("option", { name: "Alice (female)" })).toHaveLength(2);
    expect(screen.getAllByRole("option", { name: "Bob (male)" })).toHaveLength(2);
    expect(screen.getAllByRole("option", { name: "Charlie" })).toHaveLength(2);
    expect(onChange).toHaveBeenCalledWith({ 1: "voice-1" });
  });

  it("calls onChange for character 2 selection", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    renderWithProviders(
      <VoiceAssignment
        voices={voices}
        voiceMap={{ 1: "voice-1" }}
        onChange={onChange}
      />,
    );

    const select2 = screen.getByLabelText("Character 2 voice");
    await user.selectOptions(select2, "voice-2");

    expect(onChange).toHaveBeenCalledWith({ 1: "voice-1", 2: "voice-2" });
  });

  it("reflects the current voiceMap in select values", () => {
    const voiceMap: VoiceMap = { 1: "voice-1", 2: "voice-2" };

    renderWithProviders(
      <VoiceAssignment
        voices={voices}
        voiceMap={voiceMap}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Character 1 voice")).toHaveValue("voice-1");
    expect(screen.getByLabelText("Character 2 voice")).toHaveValue("voice-2");
  });

  it("shows empty state when no voices are provided", () => {
    renderWithProviders(
      <VoiceAssignment
        voices={[]}
        voiceMap={{}}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText(/no voices available/i)).toBeInTheDocument();
  });

  it("disables dropdowns when disabled prop is true", () => {
    renderWithProviders(
      <VoiceAssignment
        voices={voices}
        voiceMap={{}}
        onChange={vi.fn()}
        disabled
      />,
    );

    expect(screen.getByLabelText("Character 1 voice")).toBeDisabled();
    expect(screen.getByLabelText("Character 2 voice")).toBeDisabled();
  });
});
