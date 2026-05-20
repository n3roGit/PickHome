import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchExternal, resetExternalFetchState } from "@/lib/external-fetch";

describe("fetchExternal", () => {
  beforeEach(() => {
    resetExternalFetchState();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    resetExternalFetchState();
  });

  it("retries on 503 and succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      );
    vi.stubGlobal("fetch", fetchMock);

    const promise = fetchExternal("osrm", "https://example.test/route");
    await vi.runAllTimersAsync();
    const res = await promise;

    expect(res?.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry on 400", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);

    const promise = fetchExternal("osrm", "https://example.test/route");
    await vi.runAllTimersAsync();
    const res = await promise;

    expect(res?.status).toBe(400);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("enforces minimum interval between nominatim calls", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const first = fetchExternal("nominatim", "https://example.test/1");
    const second = fetchExternal("nominatim", "https://example.test/2");

    await vi.advanceTimersByTimeAsync(0);
    await first;
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1099);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    await second;
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns null after network errors are exhausted", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network"));
    vi.stubGlobal("fetch", fetchMock);

    const promise = fetchExternal("osrm", "https://example.test/route");
    await vi.runAllTimersAsync();
    const res = await promise;

    expect(res).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
