import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { AppRouteTree } from "./router.tsx";

function renderWithRouter(initialEntries: string[] = ["/"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AppRouteTree />
    </MemoryRouter>,
  );
}

describe("Router", () => {
  describe("index redirect", () => {
    it("redirects / to /datasets", () => {
      renderWithRouter(["/"]);
      expect(
        screen.getByRole("heading", { name: "Datasets" }),
      ).toBeInTheDocument();
    });
  });

  describe("route rendering", () => {
    it("renders Datasets page at /datasets", () => {
      renderWithRouter(["/datasets"]);
      expect(
        screen.getByRole("heading", { name: "Datasets" }),
      ).toBeInTheDocument();
    });

    it("renders TTS Testing page at /tts", () => {
      renderWithRouter(["/tts"]);
      expect(
        screen.getByRole("heading", { name: "TTS Testing" }),
      ).toBeInTheDocument();
    });

    it("renders Realtime page at /realtime", () => {
      renderWithRouter(["/realtime"]);
      expect(
        screen.getByRole("heading", { name: "Realtime" }),
      ).toBeInTheDocument();
    });

    it("renders Providers page at /providers", () => {
      renderWithRouter(["/providers"]);
      expect(
        screen.getByRole("heading", { name: "Providers" }),
      ).toBeInTheDocument();
    });
  });

  describe("Sidebar", () => {
    it("renders all 4 navigation links", () => {
      renderWithRouter(["/datasets"]);
      const nav = screen.getByRole("navigation");
      const links = screen.getAllByRole("link");

      expect(links).toHaveLength(4);
      expect(nav).toContainElement(links[0]);
    });

    it("renders links with correct labels", () => {
      renderWithRouter(["/datasets"]);
      expect(screen.getByRole("link", { name: "Datasets" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "TTS Testing" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Realtime" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Providers" })).toBeInTheDocument();
    });

    it("highlights the active nav link", () => {
      renderWithRouter(["/tts"]);
      const ttsLink = screen.getByRole("link", { name: "TTS Testing" });
      const datasetsLink = screen.getByRole("link", { name: "Datasets" });

      expect(ttsLink).toHaveClass("bg-gray-800", "text-white");
      expect(datasetsLink).toHaveClass("text-gray-400");
      expect(datasetsLink).not.toHaveClass("bg-gray-800");
    });
  });

  describe("Header", () => {
    it('shows "Local Mode" text', () => {
      renderWithRouter(["/datasets"]);
      expect(screen.getByText("Local Mode")).toBeInTheDocument();
    });
  });

  describe("navigation", () => {
    it("navigates between pages when clicking sidebar links", async () => {
      const user = userEvent.setup();
      renderWithRouter(["/datasets"]);

      expect(
        screen.getByRole("heading", { name: "Datasets" }),
      ).toBeInTheDocument();

      await user.click(screen.getByRole("link", { name: "TTS Testing" }));

      expect(
        screen.getByRole("heading", { name: "TTS Testing" }),
      ).toBeInTheDocument();
    });
  });
});
