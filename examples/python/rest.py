"""Pixcharp Harem Altın API - REST örneği (requests).

Kullanım:
    export PIXCHARP_API_KEY=pxa_live_...
    python rest.py          # tüm fiyatlar
    python rest.py HAS      # tek sembol

Anahtarı istemci tarafı koda koymayın; bu kodu kendi sunucunuzda çalıştırın.
"""

import os
import sys
import time

import requests

API_BASE = "https://api.pixcharp.com"


class PixcharpError(Exception):
    def __init__(self, status, code, detail=None):
        super().__init__(f"{status} {code}" + (f": {detail}" if detail else ""))
        self.status = status
        self.code = code


class PixcharpClient:
    """Küçük bir istemci: oturumu yeniden kullanır ve yanıtları kısa süre önbellekte tutar."""

    def __init__(self, api_key, cache_ttl=30):
        self.session = requests.Session()
        self.session.headers["X-API-Key"] = api_key
        self.cache_ttl = cache_ttl
        self._cache = {}
        self.quota_remaining = None

    def _get(self, path, ttl=None):
        ttl = self.cache_ttl if ttl is None else ttl
        hit = self._cache.get(path)
        if hit and time.monotonic() - hit[0] < ttl:
            return hit[1]

        response = self.session.get(API_BASE + path, timeout=10)
        if not response.ok:
            # Hata gövdesi: {"title": "<hata kodu>", "status": 403, "detail": "..."}
            try:
                body = response.json()
            except ValueError:
                body = {}
            raise PixcharpError(response.status_code, body.get("title", "http_error"), body.get("detail"))

        self.quota_remaining = response.headers.get("X-Quota-Remaining")
        data = response.json()
        self._cache[path] = (time.monotonic(), data)
        return data

    def prices(self):
        return self._get("/v1/prices")

    def price(self, symbol):
        return self._get(f"/v1/prices/{symbol}")

    def symbols(self):
        return self._get("/v1/symbols", ttl=3600)

    def status(self):
        return self._get("/v1/status", ttl=0)


def fmt(value):
    """100'den küçük değerler (ör. döviz) 4, diğerleri 2 ondalıkla; Türkçe biçim."""
    if value is None:
        return "-"
    digits = 4 if value < 100 else 2
    text = f"{value:,.{digits}f}"
    return text.replace(",", "X").replace(".", ",").replace("X", ".")


def main():
    api_key = os.environ.get("PIXCHARP_API_KEY")
    if not api_key:
        sys.exit("PIXCHARP_API_KEY ortam değişkenini tanımlayın.")

    client = PixcharpClient(api_key)
    try:
        if len(sys.argv) > 1:
            row = client.price(sys.argv[1].upper())
            print(f"{row['symbol']}  alış {fmt(row['alis'])}  satış {fmt(row['satis'])}")
            print(f"zaman {row['asOfUtc']}" + ("  (veri beklenenden eski)" if row.get("stale") else ""))
            return

        body = client.prices()
        print(f"{'SEMBOL':<14}{'ALIŞ':>16}{'SATIŞ':>16}")
        for row in body["data"]:
            flag = "  eski" if row.get("stale") else ""
            print(f"{row['symbol']:<14}{fmt(row['alis']):>16}{fmt(row['satis']):>16}{flag}")
        print(f"\nZaman: {body['asOfUtc']}  Kalan aylık kota: {client.quota_remaining or '?'}")
    except PixcharpError as error:
        if error.code == "ip_not_allowed":
            print("Sunucunuzun IP adresini müşteri panelindeki whitelist'e ekleyin.", file=sys.stderr)
        sys.exit(str(error))


if __name__ == "__main__":
    main()
