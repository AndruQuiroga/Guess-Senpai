import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.resetModules();
});

it("reports unavailable streaks and keeps the account after failed logout", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ authenticated: true, user: { id: 12 } }),
    })
    .mockResolvedValueOnce({ ok: false, status: 503 })
    .mockResolvedValueOnce({ ok: false, status: 503 });
  vi.stubGlobal("fetch", fetchMock);
  const { useAccount } = await import("../useAccount");
  const { result } = renderHook(() => useAccount());
  await waitFor(() => expect(result.current.resolved).toBe(true));
  expect(result.current.streakError).toBe("Streak unavailable");
  expect(result.current.streakCount).toBeNull();
  await act(async () => {
    await result.current.logout();
  });
  expect(result.current.account.user?.id).toBe(12);
  expect(result.current.error).toMatch(/Couldn't sign out/);
});
