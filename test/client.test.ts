import { describe, expect, it, vi } from "vitest";

import { createClient, HaremApiError } from "../src/index.js";

const snapshot = {
  version: "v1",
  asOfUtc: "2026-11-14T10:24:13Z",
  source: "harem",
  stale: false,
  market: "open",
  data: [
    { symbol: "HAS", alis: 6127.46, satis: 6155.99, kapanis: null, acilis: null, asOfUtc: "2026-11-14T10:24:13Z", source: "harem", stale: false },
    { symbol: "USDTRY", alis: 41.1, satis: 41.2, kapanis: null, acilis: null, asOfUtc: "2026-11-14T10:24:13Z", source: "harem", stale: false },
  ],
};

function jsonResponse(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json", ...init.headers },
  });
}

describe("createClient", () => {
  it("requires an API key", () => {
    expect(() => createClient({ apiKey: " " })).toThrow(HaremApiError);
  });

  it("sends the key in X-API-Key and returns the snapshot", async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse(snapshot));
    const client = createClient({ apiKey: "pxa_live_test", fetch });

    const prices = await client.getPrices();

    expect(prices.data).toHaveLength(2);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://api.pixcharp.com/v1/prices");
    expect(init.headers["X-API-Key"]).toBe("pxa_live_test");
  });

  it("filters symbols locally, case-insensitively", async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse(snapshot));
    const client = createClient({ apiKey: "pxa_live_test", fetch });

    const prices = await client.getPrices(["has"]);

    expect(prices.data.map((price) => price.symbol)).toEqual(["HAS"]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("gets one symbol, the symbol list and the status", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(snapshot.data[0]))
      .mockResolvedValueOnce(jsonResponse({ version: "v1", symbols: ["HAS", "USDTRY"] }))
      .mockResolvedValueOnce(
        jsonResponse({ status: "ok", version: "v1", symbolCount: 2, lastPriceUpdateUtc: "2026-11-14T10:24:13Z", stale: false, source: "harem" }),
      );
    const client = createClient({ apiKey: "pxa_live_test", baseUrl: "https://example.test/", fetch });

    await expect(client.getPrice("HAS")).resolves.toMatchObject({ symbol: "HAS", satis: 6155.99 });
    await expect(client.getSymbols()).resolves.toEqual(["HAS", "USDTRY"]);
    await expect(client.getStatus()).resolves.toMatchObject({ symbolCount: 2 });
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      "https://example.test/v1/prices/HAS",
      "https://example.test/v1/symbols",
      "https://example.test/v1/status",
    ]);
  });

  it("reads rate limit and quota headers", async () => {
    const fetch = vi.fn().mockResolvedValue(
      jsonResponse(snapshot, {
        headers: {
          "X-RateLimit-Limit": "60",
          "X-RateLimit-Remaining": "59",
          "X-Quota-Limit": "200000",
          "X-Quota-Used": "10",
          "X-Quota-Remaining": "199990",
        },
      }),
    );
    const client = createClient({ apiKey: "pxa_live_test", fetch });

    expect(client.rateLimit).toBeUndefined();
    await client.getPrices();
    expect(client.rateLimit).toEqual({ limit: 60, remaining: 59, quotaLimit: 200000, quotaUsed: 10, quotaRemaining: 199990 });
  });

  it("turns { error, message } bodies into HaremApiError", async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ error: "unknown_symbol", message: "No price is available for XYZ." }, { status: 404 }));
    const client = createClient({ apiKey: "pxa_live_test", fetch });

    const error = await client.getPrice("XYZ").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(HaremApiError);
    expect(error).toMatchObject({ status: 404, code: "unknown_symbol", message: "No price is available for XYZ." });
  });

  it("turns problem details into HaremApiError with Retry-After", async () => {
    const fetch = vi.fn().mockResolvedValue(
      jsonResponse({ title: "rate_limit_exceeded", detail: "Too many requests.", status: 429 }, { status: 429, headers: { "Retry-After": "12" } }),
    );
    const client = createClient({ apiKey: "pxa_live_test", fetch });

    await expect(client.getPrices()).rejects.toMatchObject({ status: 429, code: "rate_limit_exceeded", retryAfter: 12 });
  });

  it("reports network failures", async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    const client = createClient({ apiKey: "pxa_live_test", fetch });

    await expect(client.getStatus()).rejects.toMatchObject({ status: 0, code: "network_error" });
  });
});
