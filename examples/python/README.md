# Python örnekleri

Python 3.9 veya üstü.

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export PIXCHARP_API_KEY=pxa_live_...

python rest.py              # tüm fiyatlar
python rest.py GRAM_ALTIN   # tek sembol
python stream.py HAS USDTRY # WebSocket akışı (Pro / Business / deneme)
```

- `rest.py`: `requests` ile küçük bir istemci (`PixcharpClient`): oturum yeniden kullanımı,
  30 sn önbellek, hata kodları (`title` alanı) ve `X-Quota-Remaining` başlığı.
- `stream.py`: `websockets` (14+) ile akış, `subscribe` mesajı ve artan bekleme süresiyle
  yeniden bağlanma. `websockets` 14 öncesinde başlık parametresinin adı `extra_headers` idi.
