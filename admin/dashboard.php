<?php
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/books.php';
admin_require_login();

$books = array_reverse(books_load());
$flash = $_SESSION['flash'] ?? null;
unset($_SESSION['flash']);
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Admin Dashboard — Story Time</title>
<link rel="stylesheet" href="admin.css" />
</head>
<body>
  <div class="admin-shell">
    <header class="admin-topbar">
      <div class="admin-brand">📖 <span>Story Time Admin</span></div>
      <a class="admin-logout" href="logout.php">Log out</a>
    </header>

    <main class="admin-main">
      <?php if ($flash): ?>
        <div class="admin-flash admin-flash-<?= htmlspecialchars($flash['type']) ?>">
          <?= htmlspecialchars($flash['message']) ?>
        </div>
      <?php endif; ?>

      <section class="admin-card">
        <h2>Upload a new story</h2>
        <form action="upload.php" method="post" enctype="multipart/form-data" class="admin-upload-form">
          <div class="admin-field">
            <label for="title">Title</label>
            <input type="text" id="title" name="title" required maxlength="120" placeholder="The Little Brave Bird" />
          </div>
          <div class="admin-field">
            <label for="subtitle">Subtitle (optional)</label>
            <input type="text" id="subtitle" name="subtitle" maxlength="160" placeholder="A story about courage and never giving up" />
          </div>
          <div class="admin-field-row">
            <div class="admin-field">
              <label for="pdf">PDF file</label>
              <input type="file" id="pdf" name="pdf" accept="application/pdf" required />
            </div>
            <div class="admin-field">
              <label for="cover">Cover image (optional)</label>
              <input type="file" id="cover" name="cover" accept="image/*" />
              <p class="admin-hint">Recommended size: 600 × 750px (4:5 ratio), JPG/PNG/WEBP, max 5 MB. If left empty, the book's first PDF page is shown as the cover instead.</p>
            </div>
          </div>
          <button type="submit" class="admin-btn-primary">Upload Story</button>
        </form>
      </section>

      <section class="admin-card">
        <h2>Books (<?= count($books) ?>)</h2>
        <?php if (empty($books)): ?>
          <p class="admin-empty">No books uploaded yet.</p>
        <?php else: ?>
          <div class="admin-books-grid">
            <?php foreach ($books as $book): ?>
              <div class="admin-book-card">
                <div class="admin-book-cover"<?= empty($book['cover']) ? ' data-book-id="' . htmlspecialchars($book['id']) . '" data-updated="' . htmlspecialchars((string) ($book['updatedAt'] ?? 0)) . '"' : '' ?>>
                  <?php if (!empty($book['cover'])): ?>
                    <img src="../uploads/covers/<?= htmlspecialchars($book['cover']) ?>" alt="" />
                  <?php else: ?>
                    <span>📖</span>
                  <?php endif; ?>
                </div>
                <div class="admin-book-info">
                  <strong title="<?= htmlspecialchars($book['title']) ?>"><?= htmlspecialchars($book['title']) ?></strong>
                  <?php if (!empty($book['subtitle'])): ?>
                    <p title="<?= htmlspecialchars($book['subtitle']) ?>"><?= htmlspecialchars($book['subtitle']) ?></p>
                  <?php endif; ?>
                  <span class="admin-book-date"><?= htmlspecialchars($book['uploadedAt']) ?></span>
                </div>
                <div class="admin-book-actions">
                  <a href="../viewer.html?id=<?= urlencode($book['id']) ?>" target="_blank" class="admin-btn-secondary">Preview</a>
                  <a href="edit.php?id=<?= urlencode($book['id']) ?>" class="admin-btn-secondary">Edit</a>
                  <form action="delete.php" method="post" onsubmit="return confirm('Delete this book permanently?');">
                    <input type="hidden" name="id" value="<?= htmlspecialchars($book['id']) ?>" />
                    <button type="submit" class="admin-btn-danger">Delete</button>
                  </form>
                </div>
              </div>
            <?php endforeach; ?>
          </div>
        <?php endif; ?>
      </section>
    </main>
  </div>

  <script src="../js/vendor/pdf.min.js"></script>
  <script>pdfjsLib.GlobalWorkerOptions.workerSrc = '../js/vendor/pdf.worker.min.js';</script>
  <script src="admin-covers.js"></script>
</body>
</html>
