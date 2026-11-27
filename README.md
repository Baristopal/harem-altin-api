# harem-altin-api

[![npm](https://img.shields.io/npm/v/harem-altin-api.svg)](https://www.npmjs.com/package/harem-altin-api)
[![MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Harem Altın API** için resmi Pixcharp JavaScript/TypeScript istemcisi. Has altın, gram altın, çeyrek, 22 ayar,
ons ve döviz kurlarının **canlı alış-satış fiyatlarını** REST API ve WebSocket ile JSON olarak alın.

> Bu paket ve API, Pixcharp tarafından sunulan bağımsız bir hizmettir; Harem Altın ile resmi bir bağı yoktur.

- Ürün sayfası ve planlar: https://pixcharp.com/tr/harem-altin-api
- API dokümantasyonu: https://docs.pixcharp.com
- 7 gün ücretsiz deneme, kart gerekmez
- English: [see below](#english)

## Türkçe

### Kurulum

```bash
npm install harem-altin-api
```

Node.js 18+ gerekir. REST istemcisinin çalışma zamanı bağımlılığı yoktur.

### API anahtarı

[Ürün sayfasından](https://pixcharp.com/tr/harem-altin-api) kartsız 7 günlük ücretsiz denemeyi başlatın ya da bir plan
seçin. [Müşteri panelinden](https://panel.pixcharp.com/tr/api-dashboard) `pxa_live_...` ile başlayan bir API anahtarı oluşturun. Anahtarı yalnızca sunucuda tutun.

### REST ile canlı altın fiyatı

```js
import { createClient } from "harem-altin-api";

const client = createClient({ apiKey: process.env.PIXCHARP_API_KEY });

const has = await client.getPrice("HAS");
console.log(has.alis, has.satis, has.asOfUtc);

const { data } = await client.getPrices(["GRAM_ALTIN", "CEYREK_YENI", "USDTRY"]);
const symbols = await client.getSymbols(); // hesabınızdaki tüm semboller
const status = await client.getStatus(); // veri akışının güncelliği
```

| Metot | Uç nokta | Açıklama |
|---|---|---|
| `getPrices(symbols?)` | `GET /v1/prices` | Tüm fiyatlar. `symbols` verilirse yalnızca onlar döner (süzme yerelde yapılır, tek istek sayılır). |
| `getPrice(symbol)` | `GET /v1/prices/{symbol}` | Tek sembol, örn. `HAS`, `GRAM_ALTIN`, `CEYREK_YENI`, `AYAR22`, `ONS`, `USDTRY`. |
| `getSymbols()` | `GET /v1/symbols` | Kullanabileceğiniz semboller. |
| `getStatus()` | `GET /v1/status` | Son fiyat zamanı, sembol sayısı, `stale` bilgisi. |

Her çağrıdan sonra `client.rateLimit` dakikalık limiti ve aylık kotayı gösterir
(`limit`, `remaining`, `quotaLimit`, `quotaUsed`, `quotaRemaining`).

### WebSocket ile anlık fiyat akışı (Pro ve İşletme planları)

```js
import WebSocket from "ws"; // npm install ws
import { stream } from "harem-altin-api";

const prices = stream({
  apiKey: process.env.PIXCHARP_API_KEY,
  WebSocket, // anahtar X-API-Key başlığıyla gider
  symbols: ["HAS", "GRAM_ALTIN"],
  onSnapshot: (snapshot) => console.log(snapshot.data.length, "sembol"),
  onPrice: (price) => console.log(price.symbol, price.alis, price.satis),
  onError: (error) => console.error(error.code, error.message),
});

prices.subscribe(["USDTRY"]); // filtreyi değiştir; [] tümünü geri getirir
prices.close();
```

Bağlanınca tam bir anlık görüntü (snapshot), ardından fiyat değiştikçe en fazla saniyede bir `prices` mesajı gelir. Her
`snapshot` ve `prices` mesajı aylık kotadan 1 istek düşer; `ping`, `pong`, `error` ve `subscribed` ücretsizdir ve kota REST
çağrılarıyla ortaktır. Bağlantı koparsa istemci artan beklemeyle yeniden bağlanır; anahtar iptal edilirse (kapanış kodu 1008)
yeniden denemez. `WebSocket` seçeneği verilmezse tarayıcının veya Node 22+'nin yerleşik WebSocket'i kullanılır ve anahtar
URL'de gönderilir: bu durumda ayrı bir anahtar ve IP whitelist kullanın.

### Hatalar

Başarısız her istek `HaremApiError` fırlatır: `status` (HTTP kodu) ve `code` alanları vardır.

```js
import { HaremApiError } from "harem-altin-api";

try {
  await client.getPrice("XYZ");
} catch (error) {
  if (error instanceof HaremApiError && error.code === "unknown_symbol") {
    // ...
  }
}
```

| HTTP | `code` |
|---|---|
| 401 | `api_key_required`, `invalid_api_key` |
| 403 | `revoked_api_key`, `inactive_client`, `ip_not_allowed` |
| 404 | `unknown_symbol` |
| 429 | `rate_limit_exceeded`, `monthly_quota_exceeded` (`error.retryAfter` saniye) |
| 503 | `price_feed_empty` |
| 0 | `network_error`, `timeout` |

### Planlar

Güncel fiyatlar ve koşullar için: https://pixcharp.com/tr/harem-altin-api

| Plan | Aylık | İstek / ay | Dakikalık limit | WebSocket |
|---|---|---|---|---|
| Başlangıç | $12.99 | 200.000 | 60 | - |
| Pro | $24.99 | 1.000.000 | 180 | 2 bağlantı |
| İşletme | $59.99 | 5.000.000 | 600 | 10 bağlantı |

Yıllık ödemede 2 ay hediye. Ürün sayfasında 7 gün ücretsiz deneme sunulur, kart gerekmez.

### Diğer diller

```bash
curl https://api.pixcharp.com/v1/prices/HAS \
  -H "X-API-Key: pxa_live_..."
```

```php
<?php
$ch = curl_init("https://api.pixcharp.com/v1/prices");
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPHEADER => ["X-API-Key: " . getenv("PIXCHARP_API_KEY")],
]);
$prices = json_decode(curl_exec($ch), true);
```

```python
import os
import requests

response = requests.get(
    "https://api.pixcharp.com/v1/prices/HAS",
    headers={"X-API-Key": os.environ["PIXCHARP_API_KEY"]},
    timeout=10,
)
response.raise_for_status()
print(response.json()["satis"])
```

Hazır örnekler ([`examples/`](examples)):

- [Node.js](examples/node-rest.mjs) (bu paketle REST ve [WebSocket](examples/node-websocket.mjs))
- [PHP](examples/php): curl ile REST, dosya önbelleği ve hata durumunda son fiyat
- [Python](examples/python): `requests` ile REST, `websockets` ile canlı akış
- [cURL](examples/curl): komut satırından tüm uç noktalar
- [WordPress / WooCommerce](examples/wordpress): `[canli_altin]` kısa kodlu eklenti; fiyatlar sunucuda çekilir ve önbelleğe alınır, API anahtarı tarayıcıya gitmez

## English

Official Pixcharp JavaScript/TypeScript client for the **Harem gold price API**: live buy (`alis`) and sell (`satis`)
prices for Turkish gold (has altın, gram, çeyrek, 22 ayar), ounce gold and TRY exchange rates over REST and WebSocket.

> This package and API are an independent service provided by Pixcharp, with no official affiliation with Harem Altın.

```bash
npm install harem-altin-api
```

```js
import { createClient, stream } from "harem-altin-api";

const client = createClient({ apiKey: process.env.PIXCHARP_API_KEY });
const has = await client.getPrice("HAS");
const { data } = await client.getPrices(["GRAM_ALTIN", "USDTRY"]);

// Pro and Business plans: live stream (pass `ws` on Node < 22 so the key goes in a header)
import WebSocket from "ws";
const prices = stream({
  apiKey: process.env.PIXCHARP_API_KEY,
  WebSocket,
  onPrice: (price) => console.log(price.symbol, price.satis),
});
```

- `createClient({ apiKey, baseUrl?, fetch?, timeoutMs? })` returns `getPrices(symbols?)`, `getPrice(symbol)`,
  `getSymbols()`, `getStatus()` and `rateLimit`.
- `stream({ apiKey, symbols?, WebSocket?, reconnect?, onSnapshot?, onPrice?, onError?, onOpen?, onClose? })` returns
  `subscribe(symbols)` and `close()`.
- Errors are `HaremApiError` instances with `status` and `code` (see the table above).

Each WebSocket `snapshot` and `prices` message counts as 1 request against the monthly quota, shared with REST calls;
`ping`, `pong`, `error` and `subscribed` are free.

More examples in [`examples/`](examples): [PHP](examples/php), [Python](examples/python), [cURL](examples/curl) and a
[WordPress / WooCommerce plugin](examples/wordpress) with a `[canli_altin]` shortcode.

Plans start at $12.99/month for 200,000 requests (Pro: $24.99, 1,000,000 requests and 2 WebSocket connections;
Business: $59.99, 5,000,000 requests and 10 connections), with a 7-day free trial and no card required, as listed on the
product page: https://pixcharp.com/en/harem-gold-api. Documentation: https://docs.pixcharp.com/en.

## License

MIT © Pixcharp
