<?php
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/books.php';
admin_require_login();

function flash_and_redirect(string $type, string $message, string $to = 'dashboard.php'): void {
  $_SESSION['flash'] = ['type' => $type, 'message' => $message];
  header('Location: ' . $to);
  exit;
}

$id = $_GET['id'] ?? $_POST['id'] ?? '';
$book = books_find($id);
if (!$book) {
  flash_and_redirect('error', 'Book not found.');
}

$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $title = trim($_POST['title'] ?? '');
  $subtitle = trim($_POST['subtitle'] ?? '');
  $ageRange = trim($_POST['ageRange'] ?? '');

  if ($title === '') {
    $error = 'Title is required.';
  }

  // Optional: replace the PDF file.
  $newPdfFilename = null;
  if (!$error && !empty($_FILES['pdf']) && $_FILES['pdf']['error'] === UPLOAD_ERR_OK) {
    $pdfFile = $_FILES['pdf'];
    if ($pdfFile['size'] > MAX_PDF_SIZE) {
      $error = 'PDF is too large (max 100 MB).';
    } else {
      $finfo = finfo_open(FILEINFO_MIME_TYPE);
      $mime = finfo_file($finfo, $pdfFile['tmp_name']);
      finfo_close($finfo);
      if ($mime !== 'application/pdf') {
        $error = 'That file is not a valid PDF.';
      } else {
        $newPdfFilename = $book['id'] . '.pdf';
        if (!move_uploaded_file($pdfFile['tmp_name'], UPLOAD_DIR . $newPdfFilename)) {
          $error = 'Could not save the new PDF file.';
        }
      }
    }
  }

  // Optional: replace the cover image.
  $newCoverFilename = null;
  if (!$error && !empty($_FILES['cover']) && $_FILES['cover']['error'] === UPLOAD_ERR_OK) {
    $coverFile = $_FILES['cover'];
    if ($coverFile['size'] <= MAX_COVER_SIZE) {
      $imgInfo = @getimagesize($coverFile['tmp_name']);
      $allowed = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
      if ($imgInfo && isset($allowed[$imgInfo['mime']])) {
        // Remove old cover if its extension differs from the new one.
        if (!empty($book['cover'])) {
          $oldPath = COVER_DIR . $book['cover'];
          if (file_exists($oldPath)) unlink($oldPath);
        }
        $newCoverFilename = $book['id'] . '.' . $allowed[$imgInfo['mime']];
        move_uploaded_file($coverFile['tmp_name'], COVER_DIR . $newCoverFilename);
      } else {
        $error = 'Cover must be a JPG, PNG, or WEBP image.';
      }
    } else {
      $error = 'Cover image is too large (max 5 MB).';
    }
  }

  if (!$error) {
    $books = books_load();
    foreach ($books as &$b) {
      if ($b['id'] === $book['id']) {
        $b['title'] = $title;
        $b['subtitle'] = $subtitle;
        $b['ageRange'] = $ageRange;
        if ($newPdfFilename) $b['pdfFile'] = $newPdfFilename;
        if ($newCoverFilename) $b['cover'] = $newCoverFilename;
        if ($newPdfFilename || $newCoverFilename) {
          // Bust client-side cached cover thumbnails only when the actual
          // file changed — a plain title/subtitle edit doesn't need it.
          $b['updatedAt'] = time();
        }
      }
    }
    unset($b);
    books_save($books);
    flash_and_redirect('success', 'Book updated.');
  }

  // Re-fetch to reflect any partial changes (e.g. pdf replaced but validation failed elsewhere)
  $book = books_find($id) ?? $book;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Edit Book — Story Time Admin</title>
<link rel="stylesheet" href="admin.css" />
</head>
<body>
  <div class="admin-shell">
    <header class="admin-topbar">
      <div class="admin-brand">📖 <span>Story Time Admin</span></div>
      <a class="admin-logout" href="logout.php">Log out</a>
    </header>

    <main class="admin-main">
      <a href="dashboard.php" class="admin-btn-secondary admin-back-link">‹ Back to dashboard</a>

      <section class="admin-card">
        <h2>Edit story</h2>
        <?php if ($error): ?>
          <div class="admin-flash admin-flash-error"><?= htmlspecialchars($error) ?></div>
        <?php endif; ?>
        <form action="edit.php" method="post" enctype="multipart/form-data" class="admin-upload-form">
          <input type="hidden" name="id" value="<?= htmlspecialchars($book['id']) ?>" />

          <div class="admin-field">
            <label for="title">Title</label>
            <input type="text" id="title" name="title" required maxlength="120" value="<?= htmlspecialchars($book['title']) ?>" />
          </div>
          <div class="admin-field">
            <label for="subtitle">Subtitle (optional)</label>
            <input type="text" id="subtitle" name="subtitle" maxlength="160" value="<?= htmlspecialchars($book['subtitle'] ?? '') ?>" />
          </div>
          <div class="admin-field">
            <label for="ageRange">Recommended age (optional)</label>
            <input type="text" id="ageRange" name="ageRange" maxlength="20" placeholder="e.g. 4-8" value="<?= htmlspecialchars($book['ageRange'] ?? '') ?>" />
            <p class="admin-hint">Shown as an "Ages 4–8" badge on the story card. Leave empty to hide it.</p>
          </div>

          <div class="admin-field-row">
            <div class="admin-field">
              <label for="pdf">Replace PDF (optional)</label>
              <input type="file" id="pdf" name="pdf" accept="application/pdf" />
              <p class="admin-hint">Leave empty to keep the current PDF.</p>
            </div>
            <div class="admin-field">
              <label for="cover">Replace cover image (optional)</label>
              <input type="file" id="cover" name="cover" accept="image/*" />
              <p class="admin-hint">Recommended size: 600 × 750px (4:5 ratio), JPG/PNG/WEBP, max 5 MB.</p>
              <?php if (!empty($book['cover'])): ?>
                <p class="admin-hint">Current cover:</p>
                <img class="admin-current-cover" src="../uploads/covers/<?= htmlspecialchars($book['cover']) ?>" alt="" />
              <?php else: ?>
                <p class="admin-hint">No cover set — the book's first PDF page is shown instead:</p>
                <div class="admin-current-cover admin-book-cover" data-book-id="<?= htmlspecialchars($book['id']) ?>" data-updated="<?= htmlspecialchars((string) ($book['updatedAt'] ?? 0)) ?>">
                  <span>📖</span>
                </div>
              <?php endif; ?>
            </div>
          </div>

          <button type="submit" class="admin-btn-primary">Save Changes</button>
        </form>
      </section>
    </main>
  </div>

  <script src="../js/vendor/pdf.min.js"></script>
  <script>pdfjsLib.GlobalWorkerOptions.workerSrc = '../js/vendor/pdf.worker.min.js';</script>
  <script src="admin-covers.js"></script>
</body>
</html>
