/** One price row. `alis` is the buy price and `satis` the sell price, as on the Harem screen. */
export interface Price {
  symbol: string;
  alis: number;
  satis: number;
  kapanis: number | null;
  acilis: number | null;
  asOfUtc: string;
  source: string;
  stale: boolean;
}

/** GET /v1/prices */
export interface PricesResponse {
  version: string;
  asOfUtc: string;
  source: string;
  /** True when the feed has not updated for a while; show prices with care. */
  stale: boolean;
  /** "open" or "closed" when the feed reports it. */
  market?: string | null;
  data: Price[];
}

/** GET /v1/symbols */
export interface SymbolsResponse {
  version: string;
  symbols: string[];
}

/** GET /v1/status */
export interface StatusResponse {
  status: string;
  version: string;
  symbolCount: number;
  lastPriceUpdateUtc: string | null;
  stale: boolean;
  source: string;
  market?: string | null;
}

/** Limits the API reports in response headers on every authorized call. */
export interface RateLimitInfo {
  /** Requests allowed per minute. */
  limit?: number;
  remaining?: number;
  /** Monthly request quota. */
  quotaLimit?: number;
  quotaUsed?: number;
  quotaRemaining?: number;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface ClientOptions {
  /** Your key from the Pixcharp API dashboard, e.g. pxa_live_... Keep it on the server. */
  apiKey: string;
  /** Defaults to https://api.pixcharp.com */
  baseUrl?: string;
  /** Custom fetch implementation; defaults to the global fetch (Node 18+). */
  fetch?: FetchLike;
  /** Per-request timeout in milliseconds. Defaults to 10000. */
  timeoutMs?: number;
}
