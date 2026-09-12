<?php
/** Shared session/auth guard. Include at the top of every protected admin page. */
require_once __DIR__ . '/config.php';

if (session_status() === PHP_SESSION_NONE) {
  session_start();
}

function admin_is_logged_in(): bool {
  return !empty($_SESSION['is_admin']);
}

function admin_require_login(): void {
  if (!admin_is_logged_in()) {
    header('Location: index.php');
    exit;
  }
}
