# PHP örneği

PHP 7.4 veya üstü, `curl` eklentisi.

```bash
export PIXCHARP_API_KEY=pxa_live_...
php rest.php          # tüm fiyatlar
php rest.php CEYREK_YENI
```

`rest.php` kütüphane olarak da kullanılabilir:

```php
require __DIR__ . '/rest.php';

$prices = pixcharp_prices();          // GET /v1/prices (30 sn önbellek)
$has    = pixcharp_price('HAS');      // GET /v1/prices/HAS
echo pixcharp_format($has['satis']);  // ör. 6.155,99
```

- Yanıtlar `sys_get_temp_dir()` altında JSON dosyası olarak önbelleğe alınır. Her sayfa
  görüntülenmesinde API çağırmak yerine bu önbelleği kullanın; aylık kotanız korunur.
- API geçici olarak hata verirse (ör. `503 price_feed_empty`) son başarılı yanıt döndürülür.
- Paylaşımlı hostingde IP whitelist kullanıyorsanız, sunucunun çıkış IP'sini eklemeniz gerekir.
  `403 ip_not_allowed` hatasının `detail` alanında API'nin gördüğü adres yazar.

WebSocket akışı uzun süre açık kalan bir süreç gerektirdiği için tipik PHP (istek/yanıt)
kurulumuna uygun değildir. Canlı akış gerekiyorsa [Node.js istemcisi](../../README.md) veya
[Python](../python) örneğini ayrı bir işçi süreci olarak çalıştırın.

WordPress için hazır eklenti: [../wordpress](../wordpress).
