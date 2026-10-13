import { render, screen, within } from "@testing-library/react";
import { vi } from "vitest";

import PrimaryNav from "../PrimaryNav";
import type { NavGame } from "../nav/useNavGames";

const pathname = vi.hoisted(() => ({ value: "/" }));
const games = vi.hoisted(() => ({ value: [] as NavGame[] }));
const score = vi.hoisted(() => ({
  value: null as null | { total: number; max: number; perGame: object },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => pathname.value,
}));
vi.mock("../nav/NavAccount", () => ({
  NavAccount: () => <div>Account</div>,
}));
vi.mock("../nav/useNavGames", () => ({
  useNavGames: () => games.value,
}));
vi.mock("../nav/useDailyScore", () => ({
  useDailyScore: () => score.value,
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
    title: "Guess the Character",
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
    score.value = null;
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
      within(sidebar).getByRole("link", { name: /Guess the Character/ }),
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

  it("lists Unlimited under the daily modes with no daily status", () => {
    render(<PrimaryNav archiveDate="2026-10-12" />);
    const sidebar = screen.getByRole("navigation", { name: "Primary" });
    const compact = screen.getByRole("navigation", {
      name: "Primary (compact)",
    });
    for (const nav of [sidebar, compact]) {
      const unlimited = within(nav).getByRole("link", { name: "Unlimited" });
      expect(unlimited).toHaveAttribute("href", "/games/anidle/unlimited");
      for (const status of [/New/, /In progress/, /Solved/, /Out of guesses/]) {
        expect(unlimited).not.toHaveTextContent(status);
      }
      const links = within(nav).getAllByRole("link");
      expect(links.indexOf(unlimited)).toBeGreaterThan(
        links.indexOf(within(nav).getByRole("link", { name: /Redacted/ })),
      );
    }
  });

  it("marks Unlimited, not daily Anidle, as current on the unlimited route", () => {
    pathname.value = "/games/anidle/unlimited";
    render(<PrimaryNav archiveDate="2026-10-12" />);
    for (const label of ["Primary", "Primary (compact)"]) {
      const nav = screen.getByRole("navigation", { name: label });
      const current = within(nav)
        .getAllByRole("link")
        .filter((link) => link.getAttribute("aria-current") === "page");
      expect(current).toHaveLength(1);
      expect(current[0]).toHaveTextContent("Unlimited");
    }
  });

  it("still marks daily Anidle as current on its own route", () => {
    pathname.value = "/games/anidle";
    render(<PrimaryNav archiveDate="2026-10-12" />);
    const nav = screen.getByRole("navigation", { name: "Primary" });
    const current = within(nav)
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent("Anidle");
    expect(current[0]).not.toHaveTextContent("Unlimited");
  });

  it("shows today's score in the sidebar and compact bar, and hides it while unknown", () => {
    const { rerender } = render(<PrimaryNav archiveDate="2026-10-12" />);
    expect(screen.queryByText("2,450 / 4,000")).toBeNull();

    score.value = { total: 2450, max: 4000, perGame: {} };
    rerender(<PrimaryNav archiveDate="2026-10-12" />);
    const links = screen.getAllByRole("link", {
      name: /Today.s score 2,450 \/ 4,000/,
    });
    expect(links).toHaveLength(2);
    for (const link of links) {
      expect(link).toHaveAttribute("href", "/how-to-play#daily-score");
    }
  });
});
