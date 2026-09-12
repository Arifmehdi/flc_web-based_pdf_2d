<?php
/** Public: returns the list of available books (no file paths, only opaque ids). */
require_once __DIR__ . '/../admin/books.php';

header('Content-Type: application/json');
header('Cache-Control: no-store');

$books = books_load();
$public = array_map(function ($book) {
  return [
    'id' => $book['id'],
    'title' => $book['title'],
    'subtitle' => $book['subtitle'] ?? '',
    'cover' => !empty($book['cover']) ? 'uploads/covers/' . $book['cover'] : null,
    'ageRange' => $book['ageRange'] ?? '',
    'uploadedAt' => $book['uploadedAt'] ?? '',
    'updatedAt' => $book['updatedAt'] ?? 0,
    'views' => $book['views'] ?? 0,
  ];
}, $books);

// Newest first
echo json_encode(array_reverse($public));
