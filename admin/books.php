<?php
/** Simple JSON-file-backed book store. Not for high concurrency, fine for a small catalog. */
require_once __DIR__ . '/config.php';

function books_load(): array {
  if (!file_exists(BOOKS_JSON)) {
    return [];
  }
  $raw = file_get_contents(BOOKS_JSON);
  $data = json_decode($raw, true);
  return is_array($data) ? $data : [];
}

function books_save(array $books): void {
  if (!is_dir(DATA_DIR)) {
    mkdir(DATA_DIR, 0775, true);
  }
  file_put_contents(BOOKS_JSON, json_encode($books, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), LOCK_EX);
}

function books_find(string $id): ?array {
  foreach (books_load() as $book) {
    if ($book['id'] === $id) return $book;
  }
  return null;
}

function books_generate_id(): string {
  return bin2hex(random_bytes(8));
}
