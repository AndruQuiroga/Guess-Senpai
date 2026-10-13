import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DailyRolloverNotice } from "../DailyRolloverNotice";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("offers an explicit reload after UTC midnight without replacing the open game", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-12T23:59:55Z"));
  render(
    <>
      <DailyRolloverNotice date="2026-10-12" />
      <input aria-label="Current guess" defaultValue="unfinished" />
    </>,
  );
  expect(screen.queryByRole("button", { name: "Load new daily" })).toBeNull();
  act(() => {
    vi.advanceTimersByTime(15_000);
  });
  expect(
    screen.getByRole("button", { name: "Load new daily" }),
  ).toBeInTheDocument();
  expect(screen.getByLabelText("Current guess")).toHaveValue("unfinished");
});
