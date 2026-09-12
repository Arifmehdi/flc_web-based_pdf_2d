<?php
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/books.php';
require_once __DIR__ . '/settings.php';
admin_require_login();

$books = array_reverse(books_load());
$flash = $_SESSION['flash'] ?? null;
unset($_SESSION['flash']);

$settings = settings_load();
$bannerFile = $settings['bannerFile'] ?? null;
$bannerUrl = $bannerFile
  ? '../uploads/banner/' . $bannerFile . '?v=' . ($settings['bannerUpdatedAt'] ?? 0)
  : '../assets/banner.png';
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
        <form action="upload.php" method="post" enctype="multipart/form-data" class="admin-upload-form" id="uploadStoryForm">
          <div class="admin-field">
            <label for="title">Title</label>
            <input type="text" id="title" name="title" required maxlength="120" placeholder="The Little Brave Bird" />
          </div>
          <div class="admin-field">
            <label for="subtitle">Subtitle (optional)</label>
            <input type="text" id="subtitle" name="subtitle" maxlength="160" placeholder="A story about courage and never giving up" />
          </div>
          <div class="admin-field">
            <label for="ageRange">Recommended age (optional)</label>
            <input type="text" id="ageRange" name="ageRange" maxlength="20" placeholder="e.g. 4-8" />
            <p class="admin-hint">Shown as an "Ages 4–8" badge on the story card. Leave empty to hide it.</p>
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
          <button type="submit" class="admin-btn-primary" id="uploadStoryBtn">Upload Story</button>

          <div class="admin-upload-progress admin-hidden" id="uploadProgress">
            <div class="admin-upload-spinner"></div>
            <div class="admin-upload-progress-info">
              <div class="admin-upload-progress-track">
                <div class="admin-upload-progress-fill" id="uploadProgressFill"></div>
              </div>
              <span class="admin-upload-progress-pct" id="uploadProgressPct">0%</span>
            </div>
          </div>
        </form>
      </section>

      <section class="admin-card">
        <h2>"More stories coming soon" banner</h2>
        <p class="admin-hint" style="margin-bottom: 12px;">
          Shown at the bottom of the library page. Recommended size: <strong>900 × 160px</strong> (roughly 5.6:1, wide and short) as a <strong>PNG with a transparent background</strong> — it's placed on a colored card, so a solid/white background will show as a box around your artwork.
        </p>
        <img class="admin-current-banner" src="<?= htmlspecialchars($bannerUrl) ?>" alt="Current promo banner" />
        <form action="banner.php" method="post" enctype="multipart/form-data" class="admin-upload-form" style="margin-top: 14px;">
          <div class="admin-field">
            <label for="banner">Banner image</label>
            <input type="file" id="banner" name="banner" accept="image/png,image/jpeg,image/webp" required />
          </div>
          <button type="submit" class="admin-btn-primary">Upload Banner</button>
        </form>
        <?php if ($bannerFile): ?>
          <form action="banner.php" method="post" style="margin-top: 10px;" onsubmit="return confirm('Reset to the default banner?');">
            <input type="hidden" name="resetBanner" value="1" />
            <button type="submit" class="admin-btn-secondary" style="border:none;">Reset to default</button>
          </form>
        <?php endif; ?>
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
  <script src="admin-upload.js"></script>
</body>
</html>
