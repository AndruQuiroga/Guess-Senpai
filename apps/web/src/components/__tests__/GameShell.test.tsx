import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";

import { GameShell } from "../GameShell";
import { GameUnavailable } from "../GameUnavailable";

vi.mock("next/navigation", () => ({
  usePathname: () => "/games/anidle",
}));

describe("GameShell", () => {
  it("renders the title with no round badge or progress bar by default", () => {
    const { container } = render(
      <GameShell title="Anidle" round={2} totalRounds={3} roundLabel="Round">
        <div>board</div>
      </GameShell>,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Anidle" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Round/)).toBeNull();
    expect(container.querySelector("[aria-hidden='true'].h-1")).toBeNull();
    expect(screen.getByText("board")).toBeInTheDocument();
  });

  it("renders the optional status slot", () => {
    render(
      <GameShell title="Anidle" status={<span>Guess 3 / 8</span>}>
        <div />
      </GameShell>,
    );
    expect(screen.getByText("Guess 3 / 8")).toBeInTheDocument();
  });

  it("opens the rules from the ? disclosure and closes on Escape", () => {
    render(
      <GameShell title="Anidle">
        <div />
      </GameShell>,
    );
    const button = screen.getByRole("button", { name: "How to play Anidle" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/Submit an anime title/)).toBeVisible();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveFocus();
  });
});

describe("GameUnavailable", () => {
  it("explains the mode is not available and links back to Today", () => {
    render(<GameUnavailable title="Mystery Voice" />);
    expect(
      screen.getByRole("heading", {
        name: /Mystery Voice isn.t available yet/,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Today" })).toHaveAttribute(
      "href",
      "/",
    );
  });
});
