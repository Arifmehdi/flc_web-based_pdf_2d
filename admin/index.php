<?php
require_once __DIR__ . '/auth.php';

$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $password = $_POST['password'] ?? '';
  if (password_verify($password, ADMIN_PASSWORD_HASH)) {
    session_regenerate_id(true);
    $_SESSION['is_admin'] = true;
    header('Location: dashboard.php');
    exit;
  }
  $error = 'Incorrect password.';
}

if (admin_is_logged_in()) {
  header('Location: dashboard.php');
  exit;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Admin Login — Story Time</title>
<link rel="stylesheet" href="admin.css" />
</head>
<body>
  <div class="admin-login-wrap">
    <form class="admin-login-card" method="post">
      <div class="admin-login-icon">📖</div>
      <h1>Story Time Admin</h1>
      <p class="admin-login-sub">Sign in to manage story books</p>
      <?php if ($error): ?>
        <p class="admin-error"><?= htmlspecialchars($error) ?></p>
      <?php endif; ?>
      <label for="password">Password</label>
      <div class="admin-password-wrap">
        <input type="password" id="password" name="password" required autofocus />
        <button type="button" class="admin-password-toggle" id="togglePassword" aria-label="Show password" aria-pressed="false">
          <svg class="admin-eye-open" width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1.5 10S4.5 4 10 4s8.5 6 8.5 6-3 6-8.5 6-8.5-6-8.5-6Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
            <circle cx="10" cy="10" r="2.5" stroke="currentColor" stroke-width="1.5"/>
          </svg>
          <svg class="admin-eye-closed" width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1.5 10S4.5 4 10 4s8.5 6 8.5 6-3 6-8.5 6-8.5-6-8.5-6Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
            <circle cx="10" cy="10" r="2.5" stroke="currentColor" stroke-width="1.5"/>
            <path d="M3 17 17 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
      <button type="submit">Sign In</button>
    </form>
  </div>

  <script>
    (function () {
      const input = document.getElementById('password');
      const toggle = document.getElementById('togglePassword');
      toggle.addEventListener('click', () => {
        const showing = input.type === 'text';
        input.type = showing ? 'password' : 'text';
        toggle.classList.toggle('admin-password-visible', !showing);
        toggle.setAttribute('aria-pressed', String(!showing));
        toggle.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
      });
    })();
  </script>
</body>
</html>
