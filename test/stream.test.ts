import { afterEach, describe, expect, it, vi } from "vitest";

import { stream, streamUrl, type WebSocketLike } from "../src/index.js";

class FakeSocket implements WebSocketLike {
  static instances: FakeSocket[] = [];
  readyState = 0;
  sent: string[] = [];
  listeners = new Map<string, ((event: any) => void)[]>();

  constructor(
    readonly url: string,
    readonly options?: { headers?: Record<string, string> },
  ) {
    FakeSocket.instances.push(this);
  }

  addEventListener(type: string, listener: (event: any) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close(code = 1000, reason = "") {
    this.readyState = 3;
    this.emit("close", { code, reason });
  }

  emit(type: string, event: unknown = {}) {
    if (type === "open") this.readyState = 1;
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

afterEach(() => {
  FakeSocket.instances = [];
  vi.useRealTimers();
});

describe("stream", () => {
  it("derives the wss URL", () => {
    expect(streamUrl("https://api.pixcharp.com/")).toBe("wss://api.pixcharp.com/v1/stream");
  });

  it("sends the key as a header with a custom constructor and subscribes on open", () => {
    const priceStream = stream({ apiKey: "pxa_live_test", symbols: ["HAS"], WebSocket: FakeSocket, reconnect: false });
    const socket = FakeSocket.instances[0];

    expect(socket.url).toBe("wss://api.pixcharp.com/v1/stream");
    expect(socket.options?.headers?.["X-API-Key"]).toBe("pxa_live_test");

    socket.emit("open");
    expect(JSON.parse(socket.sent[0])).toEqual({ type: "subscribe", symbols: ["HAS"] });

    priceStream.subscribe(["USDTRY"]);
    expect(JSON.parse(socket.sent[1])).toEqual({ type: "subscribe", symbols: ["USDTRY"] });
    priceStream.close();
  });

  it("puts the key in the URL with the global WebSocket", () => {
    vi.stubGlobal("WebSocket", FakeSocket);
    try {
      stream({ apiKey: "pxa live/test", reconnect: false }).close();
      expect(FakeSocket.instances[0].url).toBe("wss://api.pixcharp.com/v1/stream?apiKey=pxa%20live%2Ftest");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("dispatches snapshot, price and error messages", () => {
    const onSnapshot = vi.fn();
    const onPrice = vi.fn();
    const onError = vi.fn();
    stream({ apiKey: "pxa_live_test", WebSocket: FakeSocket, reconnect: false, onSnapshot, onPrice, onError });
    const socket = FakeSocket.instances[0];
    socket.emit("open");

    socket.emit("message", { data: JSON.stringify({ type: "snapshot", asOfUtc: null, data: [{ symbol: "HAS", alis: 1, satis: 2 }] }) });
    socket.emit("message", { data: new TextEncoder().encode(JSON.stringify({ type: "price", data: { symbol: "HAS", alis: 3, satis: 4 } })) });
    socket.emit("message", { data: JSON.stringify({ type: "ping", ts: "2026-11-14T10:24:43Z" }) });
    socket.emit("message", { data: JSON.stringify({ type: "error", code: "invalid_symbol", message: "bad" }) });
    socket.emit("message", { data: "not json" });

    expect(onSnapshot).toHaveBeenCalledWith(expect.objectContaining({ type: "snapshot" }));
    expect(onPrice).toHaveBeenCalledWith({ symbol: "HAS", alis: 3, satis: 4 });
    expect(onError.mock.calls.map(([error]) => error.code)).toEqual(["invalid_symbol", "invalid_message"]);
  });

  it("reconnects after a drop but not after close() or a policy close", () => {
    vi.useFakeTimers();
    const priceStream = stream({ apiKey: "pxa_live_test", WebSocket: FakeSocket });

    FakeSocket.instances[0].emit("close", { code: 1006, reason: "" });
    vi.advanceTimersByTime(2_000);
    expect(FakeSocket.instances).toHaveLength(2);

    FakeSocket.instances[1].emit("close", { code: 1008, reason: "revoked" });
    vi.advanceTimersByTime(60_000);
    expect(FakeSocket.instances).toHaveLength(2);

    priceStream.close();
    vi.advanceTimersByTime(60_000);
    expect(FakeSocket.instances).toHaveLength(2);
  });
});
