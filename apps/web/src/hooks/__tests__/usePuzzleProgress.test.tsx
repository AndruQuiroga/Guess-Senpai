import { act, renderHook, waitFor } from "@testing-library/react";
import { type ReactNode } from "react";
import { vi } from "vitest";
import {
  PuzzleProgressProvider,
  usePuzzleProgress,
} from "../usePuzzleProgress";

const auth = vi.hoisted(() => ({
  account: {
    authenticated: false,
    user: undefined as { id: number } | undefined,
  },
  loading: false,
}));
vi.mock("../useAccount", () => ({ useAccount: () => auth }));
const day = "2026-10-12";
const puzzleId = `daily:${day}`;
const key = `guesssenpai-progress:${day}:${puzzleId}:v1`;
const saved = {
  anidle: { completed: false, round: 1, guesses: ["First guess"] },
};
function wrapper({ children }: { children: ReactNode }) {
  return (
    <PuzzleProgressProvider date={day} puzzleId={puzzleId} rulesVersion="1">
      {children}
    </PuzzleProgressProvider>
  );
}
beforeEach(() => {
  localStorage.clear();
  document.cookie = "guesssenpai-progress=; path=/; max-age=0";
  auth.account = { authenticated: false, user: undefined };
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("preserves guest progress across reload without reading or writing account progress", async () => {
  localStorage.setItem(key, JSON.stringify({ progress: saved }));
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const first = renderHook(() => usePuzzleProgress(day), { wrapper });
  await waitFor(() =>
    expect(first.result.current.progress.anidle?.guesses).toEqual([
      "First guess",
    ]),
  );
  first.unmount();
  const second = renderHook(() => usePuzzleProgress(day), { wrapper });
  await act(async () => {
    await second.result.current.refresh();
  });
  expect(second.result.current.progress.anidle?.guesses).toEqual([
    "First guess",
  ]);
  expect(fetch).not.toHaveBeenCalled();
});

it("does not replace a local completed game with an empty server response", async () => {
  auth.account = { authenticated: true, user: { id: 7 } };
  localStorage.setItem(
    `${key}:user:7`,
    JSON.stringify({
      progress: { anidle: { ...saved.anidle, completed: true } },
    }),
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        date: day,
        puzzle_id: puzzleId,
        rules_version: "1",
        account_user_id: 7,
        progress: {},
      }),
    })),
  );
  const hook = renderHook(() => usePuzzleProgress(day), { wrapper });
  await waitFor(() =>
    expect(hook.result.current.progress.anidle?.completed).toBe(true),
  );
  await act(async () => {
    await hook.result.current.refresh();
  });
  expect(hook.result.current.progress.anidle?.completed).toBe(true);
});

it("ignores a delayed server response from the previous account", async () => {
  auth.account = { authenticated: true, user: { id: 7 } };
  localStorage.setItem(`${key}:user:7`, JSON.stringify({ progress: saved }));
  let resolve!: (value: unknown) => void;
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    ),
  );
  const hook = renderHook(() => usePuzzleProgress(day), { wrapper });
  await waitFor(() =>
    expect(hook.result.current.progress.anidle).toBeDefined(),
  );
  auth.account = { authenticated: false, user: undefined };
  hook.rerender();
  await act(async () => {
    resolve({
      ok: true,
      json: async () => ({
        date: day,
        puzzle_id: puzzleId,
        rules_version: "1",
        account_user_id: 7,
        progress: saved,
      }),
    });
  });
  expect(hook.result.current.progress).toEqual({});
  expect(localStorage.getItem(key)).toBeNull();
});

it("preserves guesses made while account hydration is in flight", async () => {
  auth.account = { authenticated: true, user: { id: 7 } };
  let resolve!: (value: unknown) => void;
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    ),
  );
  const hook = renderHook(() => usePuzzleProgress(day), { wrapper });
  act(() => hook.result.current.recordGame("anidle", saved.anidle));
  await act(async () => {
    resolve({
      ok: true,
      json: async () => ({
        date: day,
        puzzle_id: puzzleId,
        rules_version: "1",
        account_user_id: 7,
        progress: {},
      }),
    });
  });
  expect(hook.result.current.progress.anidle?.guesses).toEqual(["First guess"]);
});

it("keeps date-only legacy progress separate from a shared puzzle", async () => {
  const legacyKey = `guesssenpai-progress:${day}`;
  localStorage.setItem(legacyKey, JSON.stringify({ progress: saved }));
  vi.stubGlobal("fetch", vi.fn());
  const hook = renderHook(() => usePuzzleProgress(day), { wrapper });
  expect(hook.result.current.progress).toEqual({});
  expect(localStorage.getItem(legacyKey)).not.toBeNull();
});
