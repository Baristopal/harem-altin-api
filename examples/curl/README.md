# cURL örnekleri

```bash
export PIXCHARP_API_KEY=pxa_live_...
bash examples.sh
```

| İstek | Açıklama |
| --- | --- |
| `GET /v1/prices` | Güncel fiyatların tamamı |
| `GET /v1/prices/{symbol}` | Tek sembol, ör. `HAS`, `GRAM_ALTIN`, `USDTRY` |
| `GET /v1/symbols` | Hesabınızda kullanılabilen semboller |
| `GET /v1/status` | Veri akışının güncelliği ve durumu |

Kimlik doğrulama için `X-API-Key: pxa_live_...` başlığını ya da
`Authorization: Bearer pxa_live_...` kullanın.

Yanıt başlıkları: `X-API-Version`, `X-RateLimit-Remaining` (dakika başı kalan),
`X-Quota-Remaining` (aylık kalan).

Hatalar JSON gövdede `title` (hata kodu), `status` ve `detail` alanlarıyla gelir:

```json
{
  "title": "ip_not_allowed",
  "status": 403,
  "detail": "Requests from 198.51.100.9 are not allowed for this API client. Add the address to the allowed IP list."
}
```

## WebSocket (komut satırından)

WebSocket akışı Pro ve Business planlarındadır (ücretsiz denemede 1 bağlantı).
Komut satırından denemek için [websocat](https://github.com/vi/websocat) kullanabilirsiniz:

```bash
websocat -H "X-API-Key: $PIXCHARP_API_KEY" wss://api.pixcharp.com/v1/stream
```

Bağlanınca tek bir `snapshot` mesajı, ardından fiyat değiştikçe en fazla saniyede bir
`prices` mesajı gelir. Her `snapshot` ve `prices` mesajı kotadan 1 istek düşer.
