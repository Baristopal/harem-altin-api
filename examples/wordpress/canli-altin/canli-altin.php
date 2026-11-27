<?php
/**
 * Plugin Name:       Canlı Altın Fiyatları (Pixcharp Harem Altın API)
 * Plugin URI:        https://pixcharp.com/tr/harem-altin-api
 * Description:       [canli_altin] kısa koduyla Pixcharp Harem Altın API'den canlı altın ve döviz fiyat tablosu gösterir. Fiyatlar sunucu tarafında çekilir ve önbelleğe alınır.
 * Version:           1.0.0
 * Requires at least: 5.8
 * Requires PHP:      7.4
 * Author:            Pixcharp
 * Author URI:        https://pixcharp.com
 * License:           MIT
 * License URI:       https://opensource.org/licenses/MIT
 * Text Domain:       canli-altin
 */

if (!defined('ABSPATH')) {
    exit;
}

define('CANLI_ALTIN_API_BASE', 'https://api.pixcharp.com');
define('CANLI_ALTIN_OPTION', 'canli_altin_settings');
define('CANLI_ALTIN_TRANSIENT', 'canli_altin_prices');
define('CANLI_ALTIN_LAST_GOOD', 'canli_altin_last_good');

/** Sembol kodları için Türkçe görünen adlar. Listede olmayan semboller kodlarıyla gösterilir. */
function canli_altin_labels()
{
    return [
        'HAS'          => 'Has altın',
        'GRAM_ALTIN'   => 'Gram altın',
        'CEYREK_YENI'  => 'Çeyrek altın',
        'CEYREK_ESKI'  => 'Eski çeyrek',
        'YARIM_YENI'   => 'Yarım altın',
        'YARIM_ESKI'   => 'Eski yarım',
        'TAM_YENI'     => 'Tam altın',
        'TAM_ESKI'     => 'Eski tam',
        'ATA_YENI'     => 'Ata altın',
        'ATA_ESKI'     => 'Eski ata',
        'ATA5_YENI'    => 'Ata beşli',
        'ATA5_ESKI'    => 'Eski ata beşli',
        'GREMSE_YENI'  => 'Gremse altın',
        'GREMSE_ESKI'  => 'Eski gremse',
        'AYAR22'       => '22 ayar bilezik',
        'AYAR14'       => '14 ayar altın',
        'ONS'          => 'Ons altın',
        'USDKG'        => 'Kilo altın (USD)',
        'EURKG'        => 'Kilo altın (EUR)',
        'ALTIN_GUMUS'  => 'Altın/gümüş oranı',
        'GUMUS_TL'     => 'Gram gümüş',
        'GUMUS_ONS'    => 'Ons gümüş',
        'GUMUS_USD'    => 'Kilo gümüş (USD)',
        'PLATIN_ONS'   => 'Ons platin',
        'PALADYUM_ONS' => 'Ons paladyum',
        'USDTRY'       => 'Dolar',
        'EURTRY'       => 'Euro',
        'GBPTRY'       => 'Sterlin',
        'CHFTRY'       => 'İsviçre frangı',
        'JPYTRY'       => 'Japon yeni',
        'SARTRY'       => 'Suudi riyali',
        'EURUSD'       => 'Euro/Dolar',
    ];
}

function canli_altin_defaults()
{
    return [
        'api_key'     => '',
        'cache_ttl'   => 60,
        'symbols'     => 'HAS,GRAM_ALTIN,CEYREK_YENI,YARIM_YENI,TAM_YENI,AYAR22,ONS,USDTRY,EURTRY',
        'show_source' => 0,
    ];
}

function canli_altin_settings()
{
    return wp_parse_args((array) get_option(CANLI_ALTIN_OPTION, []), canli_altin_defaults());
}

/**
 * API anahtarı önceliği: wp-config.php'deki PIXCHARP_API_KEY sabiti, ortam değişkeni, ayarlar sayfası.
 * Sabit kullanmak anahtarı veritabanının dışında tutar ve önerilen yoldur.
 */
function canli_altin_api_key()
{
    if (defined('PIXCHARP_API_KEY') && PIXCHARP_API_KEY) {
        return (string) PIXCHARP_API_KEY;
    }
    $env = getenv('PIXCHARP_API_KEY');
    if ($env) {
        return (string) $env;
    }
    return (string) canli_altin_settings()['api_key'];
}

/**
 * GET /v1/prices yanıtını döndürür. Sonuç transient'ta tutulur; böylece ziyaretçi sayısı
 * ne olursa olsun önbellek süresi başına en fazla bir API isteği yapılır.
 *
 * @return array|WP_Error
 */
function canli_altin_fetch_prices()
{
    $cached = get_transient(CANLI_ALTIN_TRANSIENT);
    if (is_array($cached)) {
        return $cached;
    }

    $key = canli_altin_api_key();
    if ($key === '') {
        return new WP_Error('canli_altin_no_key', __('API anahtarı tanımlı değil.', 'canli-altin'));
    }

    $settings = canli_altin_settings();
    $ttl = max(30, (int) $settings['cache_ttl']);

    $response = wp_remote_get(CANLI_ALTIN_API_BASE . '/v1/prices', [
        'timeout' => 10,
        'headers' => ['X-API-Key' => $key, 'Accept' => 'application/json'],
    ]);

    $error = null;
    if (is_wp_error($response)) {
        $error = $response;
    } else {
        $status = (int) wp_remote_retrieve_response_code($response);
        $body = json_decode(wp_remote_retrieve_body($response), true);
        if ($status === 200 && is_array($body) && isset($body['data']) && is_array($body['data'])) {
            set_transient(CANLI_ALTIN_TRANSIENT, $body, $ttl);
            update_option(CANLI_ALTIN_LAST_GOOD, $body, false);
            return $body;
        }
        // Hata gövdesi: {"title": "<hata kodu>", "status": 403, "detail": "..."}
        $code = is_array($body) && isset($body['title']) ? (string) $body['title'] : 'http_' . $status;
        $error = new WP_Error('canli_altin_' . $code, $code);
    }

    // Hata durumunda son başarılı yanıtı kısa süreliğine sun; API'yi her ziyarette yeniden denemeyin.
    $last = get_option(CANLI_ALTIN_LAST_GOOD);
    if (is_array($last)) {
        $last['stale'] = true;
        set_transient(CANLI_ALTIN_TRANSIENT, $last, $ttl);
        return $last;
    }

    return $error;
}

/** 100'den küçük değerler (ör. döviz) 4, diğerleri 2 ondalıkla. */
function canli_altin_format($value)
{
    if ($value === null || $value === '') {
        return '-';
    }
    $value = (float) $value;
    return number_format_i18n($value, $value < 100 ? 4 : 2);
}

function canli_altin_parse_symbols($list)
{
    $symbols = array_map('trim', explode(',', strtoupper((string) $list)));
    return array_values(array_filter($symbols, static function ($symbol) {
        return (bool) preg_match('/^[A-Z0-9_]+$/', $symbol);
    }));
}

/**
 * [canli_altin] kısa kodu.
 * Öznitelikler:
 *   semboller="HAS,GRAM_ALTIN,USDTRY"  Gösterilecek semboller ve sırası (varsayılan: ayarlardaki liste)
 *   baslik="Canlı Altın Fiyatları"     Tablo başlığı (boş bırakılırsa başlık gösterilmez)
 */
function canli_altin_shortcode($atts)
{
    $settings = canli_altin_settings();
    $atts = shortcode_atts([
        'semboller' => $settings['symbols'],
        'baslik'    => __('Canlı Altın Fiyatları', 'canli-altin'),
    ], $atts, 'canli_altin');

    $result = canli_altin_fetch_prices();
    if (is_wp_error($result)) {
        $message = current_user_can('manage_options')
            ? sprintf(__('Fiyatlar alınamadı: %s', 'canli-altin'), $result->get_error_message())
            : __('Fiyatlar şu anda gösterilemiyor.', 'canli-altin');
        return '<p class="canli-altin-error">' . esc_html($message) . '</p>';
    }

    $rows = [];
    foreach ($result['data'] as $row) {
        if (isset($row['symbol'])) {
            $rows[$row['symbol']] = $row;
        }
    }

    $labels = canli_altin_labels();
    $symbols = canli_altin_parse_symbols($atts['semboller']);
    if (!$symbols) {
        $symbols = array_keys($rows);
    }

    wp_enqueue_style('canli-altin');

    ob_start();
    ?>
    <div class="canli-altin">
        <?php if ($atts['baslik'] !== '') : ?>
            <h3 class="canli-altin-title"><?php echo esc_html($atts['baslik']); ?></h3>
        <?php endif; ?>
        <table class="canli-altin-table">
            <thead>
                <tr>
                    <th scope="col"><?php esc_html_e('Ürün', 'canli-altin'); ?></th>
                    <th scope="col"><?php esc_html_e('Alış', 'canli-altin'); ?></th>
                    <th scope="col"><?php esc_html_e('Satış', 'canli-altin'); ?></th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($symbols as $symbol) : ?>
                    <?php if (!isset($rows[$symbol])) { continue; } $row = $rows[$symbol]; ?>
                    <tr>
                        <th scope="row"><?php echo esc_html($labels[$symbol] ?? $symbol); ?></th>
                        <td><?php echo esc_html(canli_altin_format($row['alis'] ?? null)); ?></td>
                        <td><?php echo esc_html(canli_altin_format($row['satis'] ?? null)); ?></td>
                    </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
        <p class="canli-altin-meta">
            <?php
            $time = isset($result['asOfUtc']) ? strtotime((string) $result['asOfUtc']) : false;
            if ($time) {
                printf(
                    /* translators: %s: saat */
                    esc_html__('Son güncelleme: %s', 'canli-altin'),
                    esc_html(wp_date('d.m.Y H:i', $time, new DateTimeZone('Europe/Istanbul')))
                );
            }
            if (!empty($result['stale'])) {
                echo ' &middot; ' . esc_html__('Veriler gecikmeli olabilir.', 'canli-altin');
            }
            if (!empty($settings['show_source'])) {
                echo ' &middot; <a href="https://pixcharp.com/tr/harem-altin-api">' . esc_html__('Pixcharp Harem Altın API', 'canli-altin') . '</a>';
            }
            ?>
        </p>
    </div>
    <?php
    return (string) ob_get_clean();
}
add_shortcode('canli_altin', 'canli_altin_shortcode');

function canli_altin_register_style()
{
    wp_register_style('canli-altin', false, [], '1.0.0');
    wp_add_inline_style('canli-altin', '
        .canli-altin-table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
        .canli-altin-table th,.canli-altin-table td{padding:.5em .75em;border-bottom:1px solid rgba(0,0,0,.1);text-align:right}
        .canli-altin-table th:first-child{text-align:left}
        .canli-altin-meta{font-size:.85em;opacity:.7;margin-top:.5em}
    ');
}
add_action('wp_enqueue_scripts', 'canli_altin_register_style');

/* ---------- Ayarlar sayfası (Ayarlar > Canlı Altın) ---------- */

function canli_altin_admin_menu()
{
    add_options_page(
        __('Canlı Altın Fiyatları', 'canli-altin'),
        __('Canlı Altın', 'canli-altin'),
        'manage_options',
        'canli-altin',
        'canli_altin_settings_page'
    );
}
add_action('admin_menu', 'canli_altin_admin_menu');

function canli_altin_register_settings()
{
    register_setting('canli_altin', CANLI_ALTIN_OPTION, [
        'type'              => 'array',
        'sanitize_callback' => 'canli_altin_sanitize',
        'default'           => canli_altin_defaults(),
    ]);
}
add_action('admin_init', 'canli_altin_register_settings');

function canli_altin_sanitize($input)
{
    $current = canli_altin_settings();
    $input = (array) $input;

    $key = isset($input['api_key']) ? trim(sanitize_text_field($input['api_key'])) : '';
    $clean = [
        // Alan boş bırakılırsa kayıtlı anahtar korunur.
        'api_key'     => $key !== '' ? $key : $current['api_key'],
        'cache_ttl'   => max(30, absint($input['cache_ttl'] ?? 60)),
        'symbols'     => implode(',', canli_altin_parse_symbols($input['symbols'] ?? '')),
        'show_source' => empty($input['show_source']) ? 0 : 1,
    ];

    delete_transient(CANLI_ALTIN_TRANSIENT);
    return $clean;
}

function canli_altin_settings_page()
{
    if (!current_user_can('manage_options')) {
        return;
    }
    $settings = canli_altin_settings();
    $from_config = defined('PIXCHARP_API_KEY') || getenv('PIXCHARP_API_KEY');
    $name = CANLI_ALTIN_OPTION;
    ?>
    <div class="wrap">
        <h1><?php esc_html_e('Canlı Altın Fiyatları', 'canli-altin'); ?></h1>
        <p>
            <?php esc_html_e('Sayfalarınıza [canli_altin] kısa kodunu ekleyin. Örnek:', 'canli-altin'); ?>
            <code>[canli_altin semboller="HAS,GRAM_ALTIN,USDTRY" baslik="Altın Fiyatları"]</code>
        </p>
        <form method="post" action="options.php">
            <?php settings_fields('canli_altin'); ?>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row"><label for="canli-altin-key"><?php esc_html_e('API anahtarı', 'canli-altin'); ?></label></th>
                    <td>
                        <?php if ($from_config) : ?>
                            <p><?php esc_html_e('Anahtar wp-config.php (PIXCHARP_API_KEY) veya ortam değişkeninden okunuyor.', 'canli-altin'); ?></p>
                        <?php else : ?>
                            <input type="password" id="canli-altin-key" class="regular-text" autocomplete="off"
                                   name="<?php echo esc_attr($name); ?>[api_key]" value=""
                                   placeholder="<?php echo esc_attr($settings['api_key'] !== '' ? __('Kayıtlı (değiştirmek için yeni anahtar girin)', 'canli-altin') : 'pxa_live_...'); ?>">
                            <p class="description">
                                <?php esc_html_e('Önerilen: anahtarı veritabanı yerine wp-config.php içinde tanımlayın:', 'canli-altin'); ?>
                                <code>define('PIXCHARP_API_KEY', 'pxa_live_...');</code>
                            </p>
                        <?php endif; ?>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="canli-altin-ttl"><?php esc_html_e('Önbellek süresi (sn)', 'canli-altin'); ?></label></th>
                    <td>
                        <input type="number" min="30" step="1" id="canli-altin-ttl" class="small-text"
                               name="<?php echo esc_attr($name); ?>[cache_ttl]" value="<?php echo esc_attr((string) $settings['cache_ttl']); ?>">
                        <p class="description"><?php esc_html_e('Bu süre boyunca tüm ziyaretçiler aynı yanıtı görür. 60 sn, ayda en fazla yaklaşık 43.200 istek demektir.', 'canli-altin'); ?></p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="canli-altin-symbols"><?php esc_html_e('Varsayılan semboller', 'canli-altin'); ?></label></th>
                    <td>
                        <input type="text" id="canli-altin-symbols" class="large-text"
                               name="<?php echo esc_attr($name); ?>[symbols]" value="<?php echo esc_attr($settings['symbols']); ?>">
                        <p class="description"><?php esc_html_e('Virgülle ayrılmış sembol kodları, ör. HAS,GRAM_ALTIN,CEYREK_YENI,USDTRY.', 'canli-altin'); ?></p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><?php esc_html_e('Kaynak bağlantısı', 'canli-altin'); ?></th>
                    <td>
                        <label>
                            <input type="checkbox" name="<?php echo esc_attr($name); ?>[show_source]" value="1" <?php checked(!empty($settings['show_source'])); ?>>
                            <?php esc_html_e('Tablonun altında veri kaynağı bağlantısını göster', 'canli-altin'); ?>
                        </label>
                    </td>
                </tr>
            </table>
            <?php submit_button(); ?>
        </form>
    </div>
    <?php
}
