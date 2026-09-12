<?php
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/settings.php';
admin_require_login();

function flash_and_redirect(string $type, string $message): void {
  $_SESSION['flash'] = ['type' => $type, 'message' => $message];
  header('Location: dashboard.php');
  exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  flash_and_redirect('error', 'Invalid request.');
}

// "Reset to default" — clears the custom banner so the library page falls
// back to its bundled assets/banner.png.
if (isset($_POST['resetBanner'])) {
  $settings = settings_load();
  if (!empty($settings['bannerFile'])) {
    @unlink(BANNER_DIR . $settings['bannerFile']);
  }
  unset($settings['bannerFile'], $settings['bannerUpdatedAt']);
  settings_save($settings);
  flash_and_redirect('success', 'Promo banner reset to default.');
}

if (empty($_FILES['banner']) || $_FILES['banner']['error'] !== UPLOAD_ERR_OK) {
  flash_and_redirect('error', 'Please choose an image to upload.');
}

$bannerFile = $_FILES['banner'];

if ($bannerFile['size'] > MAX_BANNER_SIZE) {
  flash_and_redirect('error', 'Banner image is too large (max 3 MB).');
}

// Validate actual file content, not just the extension/declared mime type.
$imgInfo = @getimagesize($bannerFile['tmp_name']);
$allowed = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
if (!$imgInfo || !isset($allowed[$imgInfo['mime']])) {
  flash_and_redirect('error', 'That file is not a valid JPG, PNG, or WEBP image.');
}

if (!is_dir(BANNER_DIR)) mkdir(BANNER_DIR, 0775, true);

$settings = settings_load();
// Old file gets a fresh name each upload so the browser never serves a stale cache.
if (!empty($settings['bannerFile'])) {
  @unlink(BANNER_DIR . $settings['bannerFile']);
}

$filename = 'banner-' . bin2hex(random_bytes(6)) . '.' . $allowed[$imgInfo['mime']];
if (!move_uploaded_file($bannerFile['tmp_name'], BANNER_DIR . $filename)) {
  flash_and_redirect('error', 'Could not save the banner image.');
}

$settings['bannerFile'] = $filename;
$settings['bannerUpdatedAt'] = time();
settings_save($settings);

flash_and_redirect('success', 'Promo banner updated.');
