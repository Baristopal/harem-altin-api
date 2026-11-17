import { errorFromResponse, HaremApiError } from "./errors.js";
import type { ClientOptions, FetchLike, Price, PricesResponse, RateLimitInfo, StatusResponse, SymbolsResponse } from "./types.js";

export const DEFAULT_BASE_URL = "https://api.pixcharp.com";

export interface HaremApiClient {
  /**
   * Current price snapshot. Pass canonical symbols (as listed by getSymbols) to keep only those rows; the filtering happens locally,
   * the call still counts as one request.
   */
  getPrices(symbols?: string[]): Promise<PricesResponse>;
  /** One symbol, e.g. "HAS", "GRAM_ALTIN", "CEYREK_YENI", "USDTRY". Throws unknown_symbol (404) if it does not exist. */
  getPrice(symbol: string): Promise<Price>;
  /** Symbols available to your account. */
  getSymbols(): Promise<string[]>;
  /** Feed freshness and symbol count. */
  getStatus(): Promise<StatusResponse>;
  /** Limits from the most recent response headers, or undefined before the first call. */
  readonly rateLimit: RateLimitInfo | undefined;
}

function numberHeader(headers: Headers, name: string) {
  const value = headers.get(name);
  if (value === null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function createClient(options: ClientOptions): HaremApiClient {
  const apiKey = options.apiKey?.trim();
  if (!apiKey) {
    throw new HaremApiError("An API key is required. Create one in your Pixcharp API dashboard.", {
      status: 0,
      code: "api_key_required",
    });
  }

  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const timeoutMs = options.timeoutMs ?? 10_000;
  const fetchImpl: FetchLike | undefined = options.fetch ?? (globalThis.fetch?.bind(globalThis) as FetchLike | undefined);
  if (!fetchImpl) {
    throw new HaremApiError("No fetch implementation found. Use Node.js 18+ or pass the fetch option.", {
      status: 0,
      code: "fetch_unavailable",
    });
  }

  let rateLimit: RateLimitInfo | undefined;

  async function request<T>(path: string): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetchImpl!(`${baseUrl}${path}`, {
        headers: { "X-API-Key": apiKey!, Accept: "application/json" },
        signal: controller.signal,
      });
    } catch (error) {
      const timedOut = controller.signal.aborted;
      throw new HaremApiError(timedOut ? `Request timed out after ${timeoutMs} ms.` : "Network request failed.", {
        status: 0,
        code: timedOut ? "timeout" : "network_error",
        cause: error,
      });
    } finally {
      clearTimeout(timer);
    }

    rateLimit = {
      limit: numberHeader(response.headers, "x-ratelimit-limit"),
      remaining: numberHeader(response.headers, "x-ratelimit-remaining"),
      quotaLimit: numberHeader(response.headers, "x-quota-limit"),
      quotaUsed: numberHeader(response.headers, "x-quota-used"),
      quotaRemaining: numberHeader(response.headers, "x-quota-remaining"),
    };

    if (!response.ok) {
      throw await errorFromResponse(response);
    }
    return (await response.json()) as T;
  }

  return {
    async getPrices(symbols) {
      const snapshot = await request<PricesResponse>("/v1/prices");
      if (!symbols || symbols.length === 0) return snapshot;
      const wanted = new Set(symbols.map((symbol) => symbol.trim().toUpperCase()));
      return { ...snapshot, data: snapshot.data.filter((price) => wanted.has(price.symbol.toUpperCase())) };
    },
    getPrice(symbol) {
      const clean = symbol.trim();
      if (!clean) {
        return Promise.reject(new HaremApiError("A symbol is required.", { status: 0, code: "invalid_symbol" }));
      }
      return request<Price>(`/v1/prices/${encodeURIComponent(clean)}`);
    },
    async getSymbols() {
      const response = await request<SymbolsResponse>("/v1/symbols");
      return response.symbols;
    },
    getStatus() {
      return request<StatusResponse>("/v1/status");
    },
    get rateLimit() {
      return rateLimit;
    },
  };
}
