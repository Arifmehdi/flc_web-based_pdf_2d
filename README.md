# Story Time — Custom Mobile PDF Story Viewer + Admin

A lightweight, custom-built PDF story viewer for mobile web browsers (and Android WebView),
styled like an interactive children's story reader — with an admin panel to upload books and
a client-facing library page to browse/select them.

## How it works

- **Admin** (`/admin`) uploads a PDF + title + optional cover image. Files are validated
  (real PDF mime-type check, not just the extension) and stored with a random id-based
  filename — never the original filename.
- **Entry point** (`/index.html`) sends visitors straight into a book instead of a library
  screen: returning readers land back on the last book they opened (remembered in
  `localStorage`), first-time visitors land on the first book in the catalog. If there are no
  books yet, it falls back to the library page.
- **Library** (`/library.html`) fetches `api/books.php` and shows a grid of story cards to
  choose from. Reached via the "▦" icon in the viewer header. Tapping a card opens
  `viewer.html?id=<bookId>`.
- **Viewer** (`/viewer.html`) uses **pdf.js** (Mozilla, Apache-2.0 — free for commercial use)
  to render each PDF page onto an HTML5 `<canvas>` streamed through `api/pdf.php?id=...`.
  Because pages render as images on canvas, there is no native browser PDF toolbar (no
  built-in download/print/save/open-in-new-tab controls).
- Right-click / context menu, drag-save, Ctrl+S / Ctrl+P / Ctrl+U, and F12 are blocked via JS.
  An invisible "shield" div sits over the canvas to stop long-press "Save Image" on mobile.
- The real PDF file path is never exposed to the browser — only an opaque id. The
  `uploads/pdfs/` and `data/` folders are additionally blocked from direct web access via
  `.htaccess` (**requires Apache with `AllowOverride All`**, which is Laragon's default).
- **Important honesty note**: once pixels reach the browser, 100% prevention of
  screenshotting/recording is impossible on any platform. This setup blocks all *normal*
  download/save/print paths, which is the practical, achievable goal.

## First-time setup

1. **Change the admin password.** The default is `ChangeMe123!`. Generate a new hash:
   ```bash
   php -r "echo password_hash('your-new-password', PASSWORD_DEFAULT);"
   ```
   Paste the result into `ADMIN_PASSWORD_HASH` in `admin/config.php`.
2. Open `http://<your-site>/admin/` and log in.
3. Upload your first story (title, optional subtitle, PDF, optional cover image).
4. Visit `http://<your-site>/` — it opens straight into that book. Use the "▦" icon in the
   viewer header to reach the library and browse/switch books.

## File structure

```
web_based_pdf_viwer/
├── index.html              # Entry point — redirects into a book (last-read or first)
├── library.html              # Client-facing book list, reached via the viewer's "▦" icon
├── viewer.html                # The PDF story viewer (opened as viewer.html?id=...)
├── css/style.css             # Viewer visual styling (colors, fonts, buttons, spacing)
├── css/booklist.css          # Book-list page styling (reuses style.css variables)
├── js/booklist.js             # Fetches api/books.php, renders story cards
├── js/viewer.js                # Viewer logic (page render, nav, swipe, panels, flip animation)
├── js/vendor/pdf.min.js             # pdf.js library (Apache-2.0)
├── js/vendor/pdf.worker.min.js      # pdf.js worker
├── admin/
│   ├── index.php            # Admin login
│   ├── dashboard.php         # Upload form + book grid + delete
│   ├── upload.php             # Handles PDF/cover upload + validation
│   ├── delete.php             # Deletes a book + its files
│   ├── logout.php
│   ├── config.php             # Admin password hash + storage paths (EDIT THIS)
│   ├── auth.php               # Session guard
│   ├── books.php              # JSON book-store helpers
│   └── admin.css
├── api/
│   ├── books.php              # Public: JSON list of books (id, title, subtitle, cover)
│   └── pdf.php                 # Public: streams a book's PDF by id (path never exposed)
├── data/books.json             # Book metadata store (blocked from direct web access)
├── uploads/pdfs/                # Uploaded PDFs, random-id filenames (blocked from direct access)
├── uploads/covers/              # Uploaded cover images (publicly served — used in book cards)
└── story.pdf                   # Original standalone sample (kept for reference/testing)
```

## Customization

Everything visual for the viewer lives in `css/style.css` (CSS variables like `--sv-primary`,
`--sv-accent`, `--sv-font-family`, `--sv-radius-lg`). The book-list page (`css/booklist.css`)
reuses those same variables automatically, so changing the viewer's palette also restyles
the library page. The admin panel has its own `admin/admin.css` (internal tool, not
client-facing, so kept separate).

## Requirements

- **PHP 7.4+** (tested with PHP 8.2) with the `fileinfo` and `gd`/`exif` extensions
  (both are enabled by default in Laragon).
- **Apache** with `.htaccess` support enabled (Laragon default) — this is what blocks direct
  access to `uploads/pdfs/` and `data/`. If you deploy to Nginx instead, you'll need to add
  equivalent `location` blocks denying those two paths, since `.htaccess` is Apache-only.
- No database server needed — books are stored in a JSON file (`data/books.json`).

## Testing checklist (to be filled in per-device during QA)

See the project brief for the full device/OS/browser/orientation matrix required
(Android Chrome, iOS Safari, Android WebView, portrait/landscape, etc.). A test report
should be filled out per device with: rendering, nav, responsiveness, touch, download
protection, and WebView-specific results. Additionally verify:
- Admin upload/delete works on desktop and mobile browsers.
- Book list grid displays and links correctly at various screen widths.
- A book with no cover image falls back to the book-icon placeholder correctly.

## Third-party libraries

- **pdf.js** v3.11.174 — Mozilla — Apache License 2.0 (commercial-use compatible)

## Next steps to finish the client deliverable

1. Change the admin password (see "First-time setup" above).
2. Upload the real story PDFs via `/admin`.
3. Remove/replace the demo "The Little Brave Bird" sample book once real content is uploaded.
4. Run the full device/WebView test matrix and fill in the test report.
5. Sign the IP assignment / commercial rights transfer doc once delivered.
