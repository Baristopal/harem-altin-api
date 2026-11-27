# WordPress eklentisi: Canlı Altın Fiyatları

`[canli_altin]` kısa koduyla sayfanıza canlı altın ve döviz fiyat tablosu ekleyen küçük bir eklenti.
Fiyatlar sunucu tarafında `GET /v1/prices` ile çekilir ve WordPress transient'ında önbelleğe
alınır; API anahtarı tarayıcıya hiç gönderilmez.

## Kurulum

1. `canli-altin` klasörünü `wp-content/plugins/` altına kopyalayın (veya klasörü zip'leyip
   **Eklentiler > Yeni Ekle > Eklenti Yükle** ile yükleyin).
2. Eklentiyi etkinleştirin.
3. API anahtarınızı tanımlayın. Önerilen yol `wp-config.php`:

   ```php
   define('PIXCHARP_API_KEY', 'pxa_live_...');
   ```

   Alternatif olarak **Ayarlar > Canlı Altın** sayfasından girebilirsiniz.
4. IP whitelist kullanıyorsanız hosting sunucunuzun çıkış IP'sini müşteri paneline ekleyin.

## Kullanım

```
[canli_altin]
[canli_altin semboller="HAS,GRAM_ALTIN,CEYREK_YENI,USDTRY"]
[canli_altin semboller="USDTRY,EURTRY,GBPTRY" baslik="Döviz Kurları"]
[canli_altin baslik=""]
```

| Öznitelik | Açıklama |
| --- | --- |
| `semboller` | Gösterilecek semboller ve sırası. Varsayılan: ayarlardaki liste. |
| `baslik` | Tablo başlığı. Boş bırakılırsa başlık gösterilmez. |

## Önbellek ve kota

- Varsayılan önbellek süresi 60 saniyedir (en az 30). Ziyaretçi sayısından bağımsız olarak bu
  sürede en fazla bir istek yapılır: 60 sn ile ayda en fazla yaklaşık 43.200 istek.
- API geçici olarak yanıt vermezse son başarılı fiyatlar "gecikmeli olabilir" notuyla gösterilir.
- Hata mesajının ayrıntısı yalnızca yöneticilere gösterilir.

Eklenti silindiğinde (`uninstall.php`) ayarları ve önbelleği temizler.
