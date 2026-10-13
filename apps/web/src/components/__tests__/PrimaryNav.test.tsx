import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";

import HeaderNavigation from "../HeaderNavigation";

const pathname = vi.hoisted(() => ({ value: "/" }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathname.value,
}));
vi.mock("../AccountBadge", () => ({ default: () => <div>Account</div> }));

describe("PrimaryNav mobile drawer", () => {
  afterEach(() => {
    pathname.value = "/";
  });

  it("stays open, closes after navigation, and restores focus on Escape", () => {
    const view = render(<HeaderNavigation archiveDate="2026-10-12" />);
    const toggle = screen.getByRole("button", {
      name: "Toggle navigation menu",
    });
    toggle.focus();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("dialog", { name: "Menu" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveFocus();
    const mobileRegion = toggle.parentElement?.querySelector("div.md\\:hidden");
    expect(mobileRegion).toHaveAttribute("hidden");

    toggle.focus();
    fireEvent.click(toggle);
    pathname.value = "/games";
    view.rerender(<HeaderNavigation archiveDate="2026-10-12" />);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });
});
