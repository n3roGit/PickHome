import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  consumeExternalServiceUnavailable,
  fetchExternal,
  isExternalServiceInCooldown,
  resetExternalFetchState,
} from "@/lib/external-fetch";

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

  it("honors Retry-After header on 429", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, { status: 429, headers: { "Retry-After": "2" } })
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const promise = fetchExternal("osrm", "https://example.test/route");
    await vi.advanceTimersByTimeAsync(2000);
    await promise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("background 503 activates cooldown and skips further transit calls", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    const first = fetchExternal("transit", "https://example.test/1", undefined, {
      background: true,
    });
    await vi.runAllTimersAsync();
    expect(await first).toBeNull();
    expect(consumeExternalServiceUnavailable("transit")).toBe(true);

    fetchMock.mockClear();
    const second = fetchExternal("transit", "https://example.test/2", undefined, {
      background: true,
    });
    await vi.runAllTimersAsync();
    expect(await second).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(isExternalServiceInCooldown("transit")).toBe(true);
  });

  it("rate-limits nominatim and osrm independently", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const osrm = fetchExternal("osrm", "https://example.test/osrm");
    const nominatim = fetchExternal("nominatim", "https://example.test/nom");

    await vi.advanceTimersByTimeAsync(0);
    await Promise.all([osrm, nominatim]);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    fetchMock.mockClear();
    const nominatim2 = fetchExternal("nominatim", "https://example.test/nom2");
    await vi.advanceTimersByTimeAsync(1099);
    expect(fetchMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await nominatim2;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
