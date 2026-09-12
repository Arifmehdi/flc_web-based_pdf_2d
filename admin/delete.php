<?php
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/books.php';
admin_require_login();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  header('Location: dashboard.php');
  exit;
}

$id = $_POST['id'] ?? '';
$books = books_load();
$remaining = [];
$deleted = null;

foreach ($books as $book) {
  if ($book['id'] === $id) {
    $deleted = $book;
  } else {
    $remaining[] = $book;
  }
}

if ($deleted) {
  $pdfPath = UPLOAD_DIR . $deleted['pdfFile'];
  if (file_exists($pdfPath)) unlink($pdfPath);
  if (!empty($deleted['cover'])) {
    $coverPath = COVER_DIR . $deleted['cover'];
    if (file_exists($coverPath)) unlink($coverPath);
  }
  books_save($remaining);
  $_SESSION['flash'] = ['type' => 'success', 'message' => 'Book deleted.'];
} else {
  $_SESSION['flash'] = ['type' => 'error', 'message' => 'Book not found.'];
}

header('Location: dashboard.php');
