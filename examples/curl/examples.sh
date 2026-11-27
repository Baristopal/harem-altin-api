#!/usr/bin/env bash
# Pixcharp Harem Altın API - cURL örnekleri
# Kullanım: export PIXCHARP_API_KEY=pxa_live_...  &&  bash curl/examples.sh
# Her çağrı aylık kotanızdan 1 istek düşer.
set -euo pipefail

: "${PIXCHARP_API_KEY:?PIXCHARP_API_KEY ortam değişkenini tanımlayın}"
API="https://api.pixcharp.com"

# 1) Tüm güncel fiyatlar
curl -sS "$API/v1/prices" \
  -H "X-API-Key: $PIXCHARP_API_KEY"
echo

# 2) Tek sembol: has altın
curl -sS "$API/v1/prices/HAS" \
  -H "X-API-Key: $PIXCHARP_API_KEY"
echo

# 3) Aynı istek, Bearer token ile
curl -sS "$API/v1/prices/GRAM_ALTIN" \
  -H "Authorization: Bearer $PIXCHARP_API_KEY"
echo

# 4) Hesabınızda kullanılabilen semboller
curl -sS "$API/v1/symbols" \
  -H "X-API-Key: $PIXCHARP_API_KEY"
echo

# 5) Veri akışının güncelliği ve durumu
curl -sS "$API/v1/status" \
  -H "X-API-Key: $PIXCHARP_API_KEY"
echo

# 6) Limit başlıklarını görmek için (-i yanıt başlıklarını da yazdırır)
curl -sS -i "$API/v1/prices/USDTRY" \
  -H "X-API-Key: $PIXCHARP_API_KEY" \
  | grep -iE '^(HTTP|x-api-version|x-ratelimit-remaining|x-quota-remaining)'
