<?php
/**
 * Streams a book's PDF by opaque id. The real filename/path is never exposed
 * to the client (uploads/pdfs/ is also blocked from direct access via
 * .htaccess as a second layer).
 */
require_once __DIR__ . '/../admin/books.php';

$id = $_GET['id'] ?? '';
if (!preg_match('/^[a-f0-9]{16}$/', $id)) {
  http_response_code(400);
  exit('Invalid id');
}

$book = books_find($id);
if (!$book) {
  http_response_code(404);
  exit('Not found');
}

$path = UPLOAD_DIR . $book['pdfFile'];
if (!file_exists($path)) {
  http_response_code(404);
  exit('File missing');
}

// Only count real reads (viewer.js passes &track=1), not the background
// fetches booklist.js/admin-covers.js make just to render a cover
// thumbnail — otherwise "Popular" would just reflect thumbnail cache misses.
if (($_GET['track'] ?? '') === '1') {
  $allBooks = books_load();
  foreach ($allBooks as &$b) {
    if ($b['id'] === $id) {
      $b['views'] = ($b['views'] ?? 0) + 1;
      break;
    }
  }
  unset($b);
  books_save($allBooks);
}

header('Content-Type: application/pdf');
header('Content-Length: ' . filesize($path));
header('Content-Disposition: inline; filename="story.pdf"');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('X-Frame-Options: SAMEORIGIN');
// Accept-Ranges/If-Range intentionally omitted so pdf.js falls back to a
// single full-file fetch instead of exposing byte-range access.
readfile($path);
