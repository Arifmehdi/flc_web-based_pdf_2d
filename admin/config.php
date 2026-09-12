<?php
/**
 * Admin & storage configuration.
 *
 * IMPORTANT: change ADMIN_PASSWORD_HASH before going live. Generate a new
 * hash with:
 *   php -r "echo password_hash('your-new-password', PASSWORD_DEFAULT);"
 */

// Default password: ChangeMe123!  (change this!)
define('ADMIN_PASSWORD_HASH', '$2y$10$E3U7km.PdLhNzLXr9iw0wexoWMX/ShOGMUBe9Tuvur0HSnQ8OcC3O');

define('DATA_DIR', __DIR__ . '/../data');
define('BOOKS_JSON', DATA_DIR . '/books.json');
define('SETTINGS_JSON', DATA_DIR . '/settings.json');
define('UPLOAD_DIR', __DIR__ . '/../uploads/pdfs/');
define('COVER_DIR', __DIR__ . '/../uploads/covers/');
define('BANNER_DIR', __DIR__ . '/../uploads/banner/');

define('MAX_PDF_SIZE', 100 * 1024 * 1024); // 100 MB
define('MAX_COVER_SIZE', 5 * 1024 * 1024); // 5 MB
define('MAX_BANNER_SIZE', 3 * 1024 * 1024); // 3 MB
