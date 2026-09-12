<?php
/** Simple JSON-file-backed site settings store (currently just the promo banner). */
require_once __DIR__ . '/config.php';

function settings_load(): array {
  if (!file_exists(SETTINGS_JSON)) {
    return [];
  }
  $raw = file_get_contents(SETTINGS_JSON);
  $data = json_decode($raw, true);
  return is_array($data) ? $data : [];
}

function settings_save(array $settings): void {
  if (!is_dir(DATA_DIR)) {
    mkdir(DATA_DIR, 0775, true);
  }
  file_put_contents(SETTINGS_JSON, json_encode($settings, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), LOCK_EX);
}
