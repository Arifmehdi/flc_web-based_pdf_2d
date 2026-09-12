<?php
/** Public: returns site-wide display settings (currently just the promo banner). */
require_once __DIR__ . '/../admin/settings.php';

header('Content-Type: application/json');
header('Cache-Control: no-store');

$settings = settings_load();
$bannerFile = $settings['bannerFile'] ?? null;

echo json_encode([
  'bannerUrl' => $bannerFile
    ? 'uploads/banner/' . $bannerFile . '?v=' . ($settings['bannerUpdatedAt'] ?? 0)
    : 'assets/banner.png',
]);
