<?php
/**
 * Pixcharp Harem Altın API - REST örneği (PHP 7.4+, curl eklentisi)
 *
 * Kullanım:
 *   export PIXCHARP_API_KEY=pxa_live_...
 *   php rest.php          # tüm fiyatlar
 *   php rest.php HAS      # tek sembol
 *
 * Yanıtlar geçici dizinde dosya önbelleğinde tutulur; böylece her sayfa görüntülenmesi
 * aylık kotanızdan istek harcamaz. Önbellek süresi: PIXCHARP_CACHE_TTL saniye.
 */

declare(strict_types=1);

const PIXCHARP_API_BASE = 'https://api.pixcharp.com';
const PIXCHARP_CACHE_TTL = 30;

final class PixcharpException extends RuntimeException
{
    /** @var string API hata kodu, ör. invalid_api_key, ip_not_allowed, unknown_symbol */
    public $errorCode;

    public function __construct(int $status, string $errorCode, string $detail = '')
    {
        parent::__construct(trim("$status $errorCode $detail"), $status);
        $this->errorCode = $errorCode;
    }
}

/**
 * Bir uç noktayı çağırır ve JSON yanıtını dizi olarak döndürür.
 */
function pixcharp_request(string $path): array
{
    $apiKey = getenv('PIXCHARP_API_KEY');
    if (!$apiKey) {
        throw new RuntimeException('PIXCHARP_API_KEY ortam değişkenini tanımlayın.');
    }

    $curl = curl_init(PIXCHARP_API_BASE . $path);
    curl_setopt_array($curl, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ['X-API-Key: ' . $apiKey, 'Accept: application/json'],
        CURLOPT_TIMEOUT => 10,
        CURLOPT_CONNECTTIMEOUT => 5,
    ]);
    $raw = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    $curlError = curl_error($curl);
    curl_close($curl);

    if ($raw === false) {
        throw new RuntimeException('Bağlantı hatası: ' . $curlError);
    }

    $body = json_decode((string) $raw, true);
    if ($status >= 400) {
        // Hata gövdesi: {"title": "<hata kodu>", "status": 403, "detail": "..."}
        throw new PixcharpException($status, $body['title'] ?? 'http_error', $body['detail'] ?? '');
    }
    if (!is_array($body)) {
        throw new RuntimeException('Geçersiz JSON yanıtı.');
    }

    return $body;
}

/**
 * pixcharp_request() etrafında basit dosya önbelleği.
 * API hata verirse ve elde eski bir yanıt varsa onu döndürür (sayfanız boş kalmaz).
 */
function pixcharp_cached(string $path, int $ttl = PIXCHARP_CACHE_TTL): array
{
    $file = sys_get_temp_dir() . '/pixcharp_' . md5($path) . '.json';

    if (is_file($file) && time() - filemtime($file) < $ttl) {
        $cached = json_decode((string) file_get_contents($file), true);
        if (is_array($cached)) {
            return $cached;
        }
    }

    try {
        $data = pixcharp_request($path);
        file_put_contents($file, json_encode($data), LOCK_EX);
        return $data;
    } catch (Throwable $error) {
        if (is_file($file)) {
            $stale = json_decode((string) file_get_contents($file), true);
            if (is_array($stale)) {
                return $stale;
            }
        }
        throw $error;
    }
}

function pixcharp_prices(): array
{
    return pixcharp_cached('/v1/prices');
}

function pixcharp_price(string $symbol): array
{
    return pixcharp_cached('/v1/prices/' . rawurlencode(strtoupper($symbol)));
}

function pixcharp_symbols(): array
{
    return pixcharp_cached('/v1/symbols', 3600);
}

function pixcharp_status(): array
{
    return pixcharp_request('/v1/status');
}

/** 100'den küçük değerler (ör. döviz) 4, diğerleri 2 ondalıkla; Türkçe biçim. */
function pixcharp_format($value): string
{
    if ($value === null) {
        return '-';
    }
    $value = (float) $value;
    return number_format($value, $value < 100 ? 4 : 2, ',', '.');
}

// Komut satırından çalıştırıldığında örnek çıktı üret.
if (PHP_SAPI === 'cli' && realpath($argv[0]) === __FILE__) {
    try {
        if (isset($argv[1])) {
            $row = pixcharp_price($argv[1]);
            printf("%s  alış %s  satış %s\n", $row['symbol'], pixcharp_format($row['alis']), pixcharp_format($row['satis']));
            printf("zaman %s%s\n", $row['asOfUtc'], !empty($row['stale']) ? '  (veri beklenenden eski)' : '');
            exit(0);
        }

        $body = pixcharp_prices();
        printf("%-14s%16s%16s\n", 'SEMBOL', 'ALIS', 'SATIS');
        foreach ($body['data'] as $row) {
            printf(
                "%-14s%16s%16s%s\n",
                $row['symbol'],
                pixcharp_format($row['alis']),
                pixcharp_format($row['satis']),
                !empty($row['stale']) ? '  eski' : ''
            );
        }
        printf("\nZaman: %s\n", $body['asOfUtc']);
    } catch (PixcharpException $error) {
        if ($error->errorCode === 'ip_not_allowed') {
            fwrite(STDERR, "Sunucunuzun IP adresini müşteri panelindeki whitelist'e ekleyin.\n");
        }
        fwrite(STDERR, $error->getMessage() . PHP_EOL);
        exit(1);
    } catch (Throwable $error) {
        fwrite(STDERR, $error->getMessage() . PHP_EOL);
        exit(1);
    }
}
