import { DEFAULT_BASE_URL } from "./client.js";
import type { Price } from "./types.js";

/** The parts of a WebSocket this helper uses; the browser/Node 22 global and the `ws` package both fit. */
export interface WebSocketLike {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener(type: string, listener: (event: any) => void): void;
}

/** A WebSocket constructor such as the one from the `ws` package. */
export type WebSocketConstructor = new (url: string, options?: { headers?: Record<string, string> }) => WebSocketLike;

export interface SnapshotMessage {
  type: "snapshot";
  asOfUtc: string | null;
  market?: string | null;
  data: Price[];
}

export interface StreamErrorMessage {
  type: "error";
  code: string;
  message: string;
}

export interface StreamOptions {
  /** Your API key. WebSocket access needs a Pro or Business plan. */
  apiKey: string;
  /** Only receive these symbols; omit for all of them. */
  symbols?: string[];
  /** Defaults to https://api.pixcharp.com (the wss:// URL is derived from it). */
  baseUrl?: string;
  /**
   * WebSocket constructor, e.g. `import WebSocket from "ws"`. With it the key is sent in the X-API-Key header.
   * Without it the global WebSocket is used (browsers, Node 22+) and the key goes in the URL, because the
   * standard WebSocket cannot set headers: use a dedicated key with an IP whitelist in that case.
   */
  WebSocket?: WebSocketConstructor;
  /** Reconnect with backoff after the connection drops. Defaults to true. */
  reconnect?: boolean;
  onSnapshot?: (message: SnapshotMessage) => void;
  onPrice?: (price: Price) => void;
  /** Server errors (e.g. invalid_symbol, websocket_not_included) and local parse/connection errors. */
  onError?: (error: StreamErrorMessage) => void;
  onOpen?: () => void;
  onClose?: (event: { code: number; reason: string }) => void;
}

export interface PriceStream {
  /** Change the symbol filter; [] or ["*"] restores all symbols. */
  subscribe(symbols: string[]): void;
  /** Close the connection and stop reconnecting. */
  close(): void;
}

const OPEN = 1;
// 1008 means the key was revoked, the plan changed or the IP left the whitelist: reconnecting would fail again.
const POLICY_VIOLATION = 1008;

function toText(data: unknown): string {
  if (typeof data === "string") return data;
  if (data instanceof ArrayBuffer) return new TextDecoder().decode(data);
  if (ArrayBuffer.isView(data)) return new TextDecoder().decode(data);
  return String(data);
}

export function streamUrl(baseUrl: string) {
  return `${baseUrl.replace(/\/+$/, "").replace(/^http/, "ws")}/v1/stream`;
}

/** Opens wss://api.pixcharp.com/v1/stream: a full snapshot on connect, then one message per price change. */
export function stream(options: StreamOptions): PriceStream {
  const apiKey = options.apiKey?.trim();
  if (!apiKey) throw new Error("An API key is required.");

  const Ctor = options.WebSocket ?? (globalThis as { WebSocket?: WebSocketConstructor }).WebSocket;
  if (!Ctor) throw new Error("No WebSocket implementation found. Install `ws` and pass it as the WebSocket option.");

  const url = streamUrl(options.baseUrl ?? DEFAULT_BASE_URL);
  const reconnect = options.reconnect ?? true;
  let symbols = options.symbols;
  let socket: WebSocketLike | undefined;
  let closed = false;
  let attempt = 0;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;

  const sendSubscribe = () => {
    if (socket?.readyState === OPEN && symbols) {
      socket.send(JSON.stringify({ type: "subscribe", symbols }));
    }
  };

  const connect = () => {
    socket = options.WebSocket
      ? new Ctor(url, { headers: { "X-API-Key": apiKey } })
      : new Ctor(`${url}?apiKey=${encodeURIComponent(apiKey)}`);

    socket.addEventListener("open", () => {
      attempt = 0;
      sendSubscribe();
      options.onOpen?.();
    });

    socket.addEventListener("message", (event: { data: unknown }) => {
      let message: { type?: string; data?: unknown; code?: string; message?: string };
      try {
        message = JSON.parse(toText(event.data));
      } catch {
        options.onError?.({ type: "error", code: "invalid_message", message: "The server sent a message that is not JSON." });
        return;
      }
      if (message.type === "snapshot") options.onSnapshot?.(message as SnapshotMessage);
      else if (message.type === "price") options.onPrice?.(message.data as Price);
      else if (message.type === "error") {
        options.onError?.({ type: "error", code: message.code ?? "unknown_error", message: message.message ?? "" });
      }
      // "ping", "pong" and "subscribed" need no handling.
    });

    socket.addEventListener("error", () => {
      options.onError?.({ type: "error", code: "connection_error", message: "The WebSocket connection failed." });
    });

    socket.addEventListener("close", (event: { code?: number; reason?: string }) => {
      const code = event.code ?? 1006;
      options.onClose?.({ code, reason: event.reason ?? "" });
      if (closed || !reconnect || code === POLICY_VIOLATION) return;
      const delay = Math.min(30_000, 1_000 * 2 ** attempt) + Math.floor(Math.random() * 500);
      attempt += 1;
      retryTimer = setTimeout(connect, delay);
    });
  };

  connect();

  return {
    subscribe(next) {
      symbols = next;
      sendSubscribe();
    },
    close() {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      socket?.close(1000, "client closed");
    },
  };
}
