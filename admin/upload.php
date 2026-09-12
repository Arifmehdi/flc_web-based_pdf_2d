<?php
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/books.php';
admin_require_login();

function flash_and_redirect(string $type, string $message): void {
  $_SESSION['flash'] = ['type' => $type, 'message' => $message];
  header('Location: dashboard.php');
  exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  flash_and_redirect('error', 'Invalid request.');
}

$title = trim($_POST['title'] ?? '');
$subtitle = trim($_POST['subtitle'] ?? '');
$ageRange = trim($_POST['ageRange'] ?? '');

if ($title === '') {
  flash_and_redirect('error', 'Title is required.');
}

if (empty($_FILES['pdf']) || $_FILES['pdf']['error'] !== UPLOAD_ERR_OK) {
  flash_and_redirect('error', 'PDF upload failed. Please choose a valid PDF file.');
}

$pdfFile = $_FILES['pdf'];

if ($pdfFile['size'] > MAX_PDF_SIZE) {
  flash_and_redirect('error', 'PDF is too large (max 100 MB).');
}

// Validate actual file content, not just the extension/declared mime type.
$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mime = finfo_file($finfo, $pdfFile['tmp_name']);
finfo_close($finfo);
if ($mime !== 'application/pdf') {
  flash_and_redirect('error', 'That file is not a valid PDF.');
}

if (!is_dir(UPLOAD_DIR)) mkdir(UPLOAD_DIR, 0775, true);
if (!is_dir(COVER_DIR)) mkdir(COVER_DIR, 0775, true);

$id = books_generate_id();
$pdfFilename = $id . '.pdf';
if (!move_uploaded_file($pdfFile['tmp_name'], UPLOAD_DIR . $pdfFilename)) {
  flash_and_redirect('error', 'Could not save the PDF file.');
}

$coverFilename = null;
if (!empty($_FILES['cover']) && $_FILES['cover']['error'] === UPLOAD_ERR_OK) {
  $coverFile = $_FILES['cover'];
  if ($coverFile['size'] <= MAX_COVER_SIZE) {
    $imgInfo = @getimagesize($coverFile['tmp_name']);
    $allowed = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
    if ($imgInfo && isset($allowed[$imgInfo['mime']])) {
      $coverFilename = $id . '.' . $allowed[$imgInfo['mime']];
      move_uploaded_file($coverFile['tmp_name'], COVER_DIR . $coverFilename);
    }
  }
}

$books = books_load();
$books[] = [
  'id' => $id,
  'title' => $title,
  'subtitle' => $subtitle,
  'ageRange' => $ageRange,
  'pdfFile' => $pdfFilename,
  'cover' => $coverFilename,
  'uploadedAt' => date('Y-m-d H:i'),
  'updatedAt' => time(), // cache-busts client-side PDF-cover thumbnails on change
  'views' => 0, // incremented by api/pdf.php each time it's streamed — powers the "Popular" sort
];
books_save($books);

flash_and_redirect('success', 'Story uploaded successfully.');
