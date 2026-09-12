/* ==========================================================================
   Story Time Admin — PDF-first-page cover thumbnails.
   For any book without an admin-uploaded cover, renders the PDF's first
   page into a small canvas client-side via pdf.js (mirrors js/booklist.js
   so the admin preview matches what visitors actually see). Results are
   cached in localStorage (keyed by id + updatedAt) so repeat dashboard
   visits show thumbnails instantly instead of re-rendering every time.
   ========================================================================== */
(function () {
  'use strict';

  if (typeof pdfjsLib === 'undefined') return;

  const COVER_CACHE_PREFIX = 'sv-cover-cache-';

  function cacheKey(id, updated) {
    return COVER_CACHE_PREFIX + id + '-' + (updated || 0);
  }

  function getCached(id, updated) {
    try {
      return localStorage.getItem(cacheKey(id, updated));
    } catch (err) {
      return null;
    }
  }

  function setCached(id, updated, dataUrl) {
    try {
      localStorage.setItem(cacheKey(id, updated), dataUrl);
    } catch (err) {
      // Storage full/unavailable — non-fatal.
    }
  }

  function showSpinner(coverEl) {
    coverEl.innerHTML = '<div class="admin-cover-spinner"></div>';
  }

  function setImage(coverEl, src) {
    coverEl.innerHTML = '';
    const img = document.createElement('img');
    img.src = src;
    img.alt = '';
    coverEl.appendChild(img);
  }

  document.querySelectorAll('.admin-book-cover[data-book-id]').forEach((coverEl) => {
    const id = coverEl.getAttribute('data-book-id');
    const updated = coverEl.getAttribute('data-updated');

    const cached = getCached(id, updated);
    if (cached) {
      setImage(coverEl, cached);
      return;
    }

    showSpinner(coverEl);
    const pdfUrl = '../api/pdf.php?id=' + encodeURIComponent(id);

    pdfjsLib.getDocument(pdfUrl).promise
      .then((doc) => doc.getPage(1))
      .then((page) => {
        const targetWidth = 240;
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = targetWidth / baseViewport.width;
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');

        return page.render({ canvasContext: ctx, viewport }).promise.then(() => canvas);
      })
      .then((canvas) => {
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setCached(id, updated, dataUrl);
        setImage(coverEl, dataUrl);
      })
      .catch((err) => {
        console.error('Could not render PDF cover thumbnail for book', id, err);
        coverEl.innerHTML = '<span>📖</span>';
      });
  });
})();
