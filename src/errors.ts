/**
 * Thrown for every non-2xx response and for network failures.
 *
 * Common codes: api_key_required, invalid_api_key (401); revoked_api_key, inactive_client, ip_not_allowed (403);
 * unknown_symbol (404); rate_limit_exceeded, monthly_quota_exceeded (429); price_feed_empty (503);
 * network_error and timeout when the request did not complete.
 */
export class HaremApiError extends Error {
  readonly status: number;
  readonly code: string;
  /** Seconds to wait before retrying, from the Retry-After header on 429 responses. */
  readonly retryAfter?: number;

  constructor(message: string, options: { status: number; code: string; retryAfter?: number; cause?: unknown }) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "HaremApiError";
    this.status = options.status;
    this.code = options.code;
    this.retryAfter = options.retryAfter;
  }
}

type ErrorBody = { error?: unknown; title?: unknown; code?: unknown; message?: unknown; detail?: unknown };

// The API answers with either { error, message } or an RFC 7807 problem ({ title, detail, status }).
export async function errorFromResponse(response: Response): Promise<HaremApiError> {
  let body: ErrorBody = {};
  try {
    body = (await response.json()) as ErrorBody;
  } catch {
    // Not JSON; fall back to the status line.
  }

  const pick = (...values: unknown[]) => values.find((value): value is string => typeof value === "string" && value.length > 0);
  const code = pick(body.error, body.code, body.title) ?? `http_${response.status}`;
  const message = pick(body.message, body.detail) ?? `Request failed with status ${response.status}.`;
  const retryAfterHeader = Number(response.headers.get("retry-after"));

  return new HaremApiError(message, {
    status: response.status,
    code,
    retryAfter: Number.isFinite(retryAfterHeader) && retryAfterHeader > 0 ? retryAfterHeader : undefined,
  });
}
