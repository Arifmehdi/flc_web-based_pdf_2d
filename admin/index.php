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
      <input type="password" id="password" name="password" required autofocus />
      <button type="submit">Sign In</button>
    </form>
  </div>
</body>
</html>
