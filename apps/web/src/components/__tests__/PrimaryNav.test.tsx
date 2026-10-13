import { render, screen, within } from "@testing-library/react";
import { vi } from "vitest";

import PrimaryNav from "../PrimaryNav";
import type { NavGame } from "../nav/useNavGames";

const pathname = vi.hoisted(() => ({ value: "/" }));
const games = vi.hoisted(() => ({ value: [] as NavGame[] }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathname.value,
}));
vi.mock("../nav/NavAccount", () => ({
  NavAccount: () => <div>Account</div>,
}));
vi.mock("../nav/useNavGames", () => ({
  useNavGames: () => games.value,
}));

const baseGames: NavGame[] = [
  { slug: "anidle", title: "Anidle", href: "/games/anidle", status: "new" },
  {
    slug: "poster-zoomed",
    title: "Poster Zoomed",
    href: "/games/poster-zoomed",
    status: "in-progress",
  },
  {
    slug: "character-silhouette",
    title: "Character Silhouette",
    href: "/games/character-silhouette",
    status: "solved",
  },
  {
    slug: "redacted-synopsis",
    title: "Redacted Synopsis",
    href: "/games/redacted-synopsis",
    status: "out-of-guesses",
  },
];

describe("PrimaryNav", () => {
  beforeEach(() => {
    games.value = baseGames;
  });
  afterEach(() => {
    pathname.value = "/";
  });

  it("lists every playable mode with today's status in the sidebar", () => {
    render(<PrimaryNav archiveDate="2026-10-12" />);
    const sidebar = screen.getByRole("navigation", { name: "Primary" });
    const anidle = within(sidebar).getByRole("link", { name: /Anidle/ });
    expect(anidle).toHaveTextContent("New");
    expect(
      within(sidebar).getByRole("link", { name: /Poster Zoomed/ }),
    ).toHaveTextContent("In progress");
    expect(
      within(sidebar).getByRole("link", { name: /Character Silhouette/ }),
    ).toHaveTextContent("Solved");
    expect(
      within(sidebar).getByRole("link", { name: /Redacted Synopsis/ }),
    ).toHaveTextContent("Out of guesses");
    expect(
      within(sidebar).getByRole("link", { name: /Archive/ }),
    ).toHaveAttribute("href", "/archive?selected=2026-10-12");
    expect(
      within(sidebar).getByRole("link", { name: /How to play/ }),
    ).toHaveAttribute("href", "/how-to-play");
  });

  it("never lists modes that were not passed in (hidden modes)", () => {
    render(<PrimaryNav archiveDate="2026-10-12" />);
    expect(screen.queryByText(/Mystery Voice/)).toBeNull();
    expect(screen.queryByText(/Guess the Opening/)).toBeNull();
  });

  it("omits the status text until progress is known", () => {
    games.value = baseGames.map((game) => ({ ...game, status: null }));
    render(<PrimaryNav archiveDate="2026-10-12" />);
    const sidebar = screen.getByRole("navigation", { name: "Primary" });
    expect(
      within(sidebar).getByRole("link", { name: "Anidle" }),
    ).toBeInTheDocument();
    expect(within(sidebar).queryByText("New")).toBeNull();
  });

  it("marks only the current game with aria-current", () => {
    pathname.value = "/games/poster-zoomed";
    render(<PrimaryNav archiveDate="2026-10-12" />);
    for (const label of ["Primary", "Primary (compact)"]) {
      const nav = screen.getByRole("navigation", { name: label });
      const current = within(nav)
        .getAllByRole("link")
        .filter((link) => link.getAttribute("aria-current") === "page");
      expect(current).toHaveLength(1);
      expect(current[0]).toHaveTextContent("Poster Zoomed");
    }
  });

  it("marks Today exactly on the home route and Archive on archive routes", () => {
    const { rerender } = render(<PrimaryNav archiveDate="2026-10-12" />);
    const sidebar = () => screen.getByRole("navigation", { name: "Primary" });
    expect(
      within(sidebar()).getByRole("link", { name: "Today" }),
    ).toHaveAttribute("aria-current", "page");

    pathname.value = "/archive/2026-10-01";
    rerender(<PrimaryNav archiveDate="2026-10-12" />);
    expect(
      within(sidebar()).getByRole("link", { name: "Today" }),
    ).not.toHaveAttribute("aria-current");
    expect(
      within(sidebar()).getByRole("link", { name: /Archive/ }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("gives mobile chips accessible status text and no hamburger or dialog", () => {
    render(<PrimaryNav archiveDate="2026-10-12" />);
    const compact = screen.getByRole("navigation", {
      name: "Primary (compact)",
    });
    expect(
      within(compact).getByRole("link", {
        name: /Poster Zoomed ?, In progress/,
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      screen.queryByRole("button", { name: /navigation menu/i }),
    ).toBeNull();
  });
});
