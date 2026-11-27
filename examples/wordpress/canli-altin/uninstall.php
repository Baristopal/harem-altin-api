<?php
// Eklenti silindiğinde ayarları ve önbelleği temizler.
if (!defined('WP_UNINSTALL_PLUGIN')) {
    exit;
}

delete_option('canli_altin_settings');
delete_option('canli_altin_last_good');
delete_transient('canli_altin_prices');
