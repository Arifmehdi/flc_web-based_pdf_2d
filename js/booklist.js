/* ==========================================================================
   Story Time — Book list (client-facing landing page)
   Fetches the public book catalog and renders selectable story cards.
   Visual theming lives in css/booklist.css.
   ========================================================================== */
(function () {
  'use strict';

  const grid = document.getElementById('blGrid');
  const loading = document.getElementById('blLoading');
  const empty = document.getElementById('blEmpty');
  const backBtn = document.getElementById('blBackBtn');

  // Apply whichever theme was picked in the viewer's Settings popup, so the
  // library matches instead of always showing the default blue palette.
  const savedTheme = localStorage.getItem('sv-theme');
  if (savedTheme && savedTheme !== 'blue') {
    document.body.classList.add('sv-theme-' + savedTheme);
  }

  // "Back" always returns to index.html, which resumes the last book that
  // was open (or falls back sensibly) — more predictable than browser
  // history.back(), which could leave the site if the library was opened
  // directly (e.g. bookmarked).
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      window.location.href = 'index.html';
    });
  }

  fetch('api/books.php', { cache: 'no-store' })
    .then((res) => {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then((books) => {
      loading.classList.add('bl-hidden');
      if (!books.length) {
        empty.classList.remove('bl-hidden');
        return;
      }
      renderBooks(books);
    })
    .catch((err) => {
      console.error('Failed to load book list', err);
      loading.textContent = 'Could not load stories. Please try again later.';
    });

  function renderBooks(books) {
    books.forEach((book) => {
      const card = document.createElement('a');
      card.className = 'bl-card';
      card.href = 'viewer.html?id=' + encodeURIComponent(book.id);

      const cover = document.createElement('div');
      cover.className = 'bl-card-cover';
      if (book.cover) {
        const img = document.createElement('img');
        img.src = book.cover;
        img.alt = book.title;
        cover.appendChild(img);
      } else {
        // No cover uploaded — try an instant cached thumbnail first; only
        // show a spinner + render from the PDF's first page if nothing
        // cached (or the PDF changed since it was cached) is available.
        const cached = getCachedCover(book);
        if (cached) {
          setCoverImage(cover, cached, book.title);
        } else {
          showCoverSpinner(cover);
          renderPdfCoverThumbnail(book, cover);
        }
      }

      const info = document.createElement('div');
      info.className = 'bl-card-info';
      const title = document.createElement('h3');
      title.textContent = book.title;
      title.title = book.title; // full text on hover if truncated
      info.appendChild(title);
      if (book.subtitle) {
        const sub = document.createElement('p');
        sub.textContent = book.subtitle;
        sub.title = book.subtitle; // full text on hover if truncated
        info.appendChild(sub);
      }

      const cta = document.createElement('span');
      cta.className = 'bl-card-cta';
      cta.textContent = 'Read now ›';
      info.appendChild(cta);

      card.appendChild(cover);
      card.appendChild(info);
      grid.appendChild(card);
    });
  }

  // ---- Cover thumbnail cache --------------------------------------------------
  // Rendering a PDF's first page (fetch + parse + rasterize) is the slowest
  // part of loading the library. Caching the resulting image means every
  // visit after the first is instant — no re-render, no perceived delay.
  // Keyed by book id + updatedAt, so replacing a PDF/cover in admin
  // automatically invalidates the old cached thumbnail.
  const COVER_CACHE_PREFIX = 'sv-cover-cache-';

  function coverCacheKey(book) {
    return COVER_CACHE_PREFIX + book.id + '-' + (book.updatedAt || 0);
  }

  function getCachedCover(book) {
    try {
      return localStorage.getItem(coverCacheKey(book));
    } catch (err) {
      return null; // localStorage unavailable (private mode / quota) — just re-render
    }
  }

  function setCachedCover(book, dataUrl) {
    try {
      localStorage.setItem(coverCacheKey(book), dataUrl);
    } catch (err) {
      // Storage full or unavailable — non-fatal, thumbnail still renders each visit.
    }
  }

  function showCoverSpinner(coverEl) {
    coverEl.innerHTML = '<div class="bl-cover-spinner"></div>';
  }

  function setCoverImage(coverEl, src, alt) {
    coverEl.innerHTML = '';
    const img = document.createElement('img');
    img.src = src;
    img.alt = alt;
    coverEl.appendChild(img);
  }

  // Renders the PDF's first page into a small canvas and swaps it in as the
  // cover. Runs client-side via pdf.js so no server-side PDF rendering
  // dependency (Imagick/Ghostscript) is required.
  function renderPdfCoverThumbnail(book, coverEl) {
    if (typeof pdfjsLib === 'undefined') return;
    const pdfUrl = 'api/pdf.php?id=' + encodeURIComponent(book.id);

    pdfjsLib.getDocument(pdfUrl).promise
      .then((doc) => doc.getPage(1))
      .then((page) => {
        const targetWidth = 400; // thumbnail resolution, independent of on-screen size
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
        setCachedCover(book, dataUrl);
        setCoverImage(coverEl, dataUrl, book.title);
      })
      .catch((err) => {
        console.error('Could not render PDF cover thumbnail for book', book.id, err);
        coverEl.textContent = '📖'; // fall back to the plain placeholder
      });
  }
})();
