"""Pixcharp Harem Altın API - WebSocket akışı (websockets>=14).

Kullanım:
    export PIXCHARP_API_KEY=pxa_live_...
    python stream.py HAS USDTRY

WebSocket Pro ve Business planlarındadır (ücretsiz denemede 1 bağlantı, Starter'da yok).
Her `snapshot` ve `prices` mesajı aylık kotadan 1 istek düşer; ping, pong, error ve subscribed ücretsizdir.
"""

import asyncio
import json
import os
import sys

import websockets

STREAM_URL = "wss://api.pixcharp.com/v1/stream"
MAX_RETRY_DELAY = 60


async def stream(api_key, symbols):
    latest = {}
    delay = 1

    while True:
        try:
            # Sunucudan bağlanırken anahtarı başlıkta gönderin.
            async with websockets.connect(STREAM_URL, additional_headers={"X-API-Key": api_key}) as ws:
                delay = 1
                print("Bağlandı.")
                # İsteğe bağlı: yalnızca ihtiyacınız olan semboller. [] veya ["*"] hepsini geri getirir.
                if symbols:
                    await ws.send(json.dumps({"type": "subscribe", "symbols": symbols}))

                async for raw in ws:
                    message = json.loads(raw)
                    kind = message.get("type")

                    if kind == "snapshot":  # Bağlanınca ve her "subscribe" sonrasında
                        for row in message["data"]:
                            latest[row["symbol"]] = row
                        print(f"snapshot: {len(message['data'])} sembol, piyasa: {message.get('market', '?')}")
                    elif kind == "prices":  # Fiyat değiştikçe, en fazla saniyede bir
                        for row in message["data"]:
                            latest[row["symbol"]] = row
                            print(f"{message['asOfUtc']}  {row['symbol']}  alış {row['alis']}  satış {row['satis']}")
                    elif kind == "error":  # Hatalı istemci mesajı veya kapanıştan önceki uyarı
                        print(f"Sunucu hatası: {message.get('code')} {message.get('message', '')}", file=sys.stderr)
                    # "ping" 30 saniyede bir gelir; yanıt gerekmez.

        except websockets.exceptions.InvalidStatus as error:
            # 403 websocket_not_included / ip_not_allowed, 429 websocket_connection_limit / monthly_quota_exceeded
            print(f"Bağlantı reddedildi: HTTP {error.response.status_code}", file=sys.stderr)
        except websockets.exceptions.ConnectionClosed as error:
            # 1008: anahtar iptal edildi, plan değişti, IP whitelist'ten çıktı ya da aylık kota doldu.
            print(f"Bağlantı kapandı: {error}", file=sys.stderr)
        except OSError as error:
            print(f"Ağ hatası: {error}", file=sys.stderr)

        print(f"{delay} sn sonra yeniden bağlanılacak.")
        await asyncio.sleep(delay)
        delay = min(delay * 2, MAX_RETRY_DELAY)


def main():
    api_key = os.environ.get("PIXCHARP_API_KEY")
    if not api_key:
        sys.exit("PIXCHARP_API_KEY ortam değişkenini tanımlayın.")
    symbols = [s.upper() for s in sys.argv[1:]]
    try:
        asyncio.run(stream(api_key, symbols))
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
