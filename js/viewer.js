/* ==========================================================================
   Story Time — PDF Story Viewer core logic
   Renders each PDF page to a <canvas> via pdf.js (no native browser PDF UI,
   no download/print/save controls, no direct file URL exposed to the user).
   Visual theming lives entirely in css/style.css.
   ========================================================================== */
(function () {
  'use strict';

  // ---- Configuration -----------------------------------------------------
  // Book id comes from the query string (set by the book-list page). The PDF
  // is streamed through api/pdf.php, which resolves the id to a file server
  // side — the actual filename/path is never exposed to the client.
  const params = new URLSearchParams(window.location.search);
  const bookId = params.get('id');
  const PDF_URL = bookId ? 'api/pdf.php?id=' + encodeURIComponent(bookId) + '&track=1' : 'story.pdf';

  // Remember the last book opened so index.html can send returning visitors
  // straight back into it instead of the library.
  if (bookId) {
    localStorage.setItem('sv-last-book-id', bookId);
  }

  // ?page=N opens directly at that page — used by the library page's
  // "Continue reading" card to jump back to where the reader left off.
  const requestedPage = parseInt(params.get('page'), 10) || 1;

  // Per-book reading progress, read by the library page to build the
  // "Continue reading" card (title, current page, total pages, recency).
  const PROGRESS_KEY = 'sv-progress';
  function saveProgress(page, total) {
    if (!bookId) return;
    try {
      const all = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
      all[bookId] = { page: page, totalPages: total, updatedAt: Date.now() };
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(all));
    } catch (err) { /* ignore — storage full/unavailable */ }
  }

  pdfjsLib.GlobalWorkerOptions.workerSrc = 'js/vendor/pdf.worker.min.js';

  // ---- State ---------------------------------------------------------------
  let pdfDoc = null;
  let currentPage = 1;
  let totalPages = 1;
  let currentRenderTask = null;
  let currentRenderTask2 = null;
  let pageMode = localStorage.getItem('sv-page-mode') === 'double' ? 'double' : 'single';

  // ---- DOM refs ------------------------------------------------------------
  const canvas = document.getElementById('pdfCanvas');
  const ctx = canvas.getContext('2d');
  const canvas2 = document.getElementById('pdfCanvas2');
  const ctx2 = canvas2.getContext('2d');
  const loadingOverlay = document.getElementById('loadingOverlay');
  const currentPageEl = document.getElementById('currentPage');
  const totalPagesEl = document.getElementById('totalPages');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const pageSlider = document.getElementById('pageSlider');
  const swipeLeft = document.getElementById('swipeLeftZone');
  const swipeRight = document.getElementById('swipeRightZone');
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  const pageModeBtn = document.getElementById('pageModeBtn');
  const pageSpine = document.getElementById('pageSpine');
  const rotateHint = document.getElementById('rotateHint');
  const pagesTab = document.getElementById('pagesTab');
  const contentsTab = document.getElementById('contentsTab');
  const pagesPanel = document.getElementById('pagesPanel');
  const contentsPanel = document.getElementById('contentsPanel');
  const pagesGrid = document.getElementById('pagesGrid');
  const contentsList = document.getElementById('contentsList');
  const pageCard = document.getElementById('pageCard');
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsPanel = document.getElementById('settingsPanel');
  const themeSwatches = document.getElementById('themeSwatches');
  const storyViewerEl = document.getElementById('story-viewer');
  const bookmarkTab = document.getElementById('bookmarkTab');
  const bookmarksStrip = document.getElementById('bookmarksStrip');
  const bookmarksChips = document.getElementById('bookmarksChips');
  const svToast = document.getElementById('svToast');

  // Keeps the footer controls (Previous/Next, slider, tab bar) the same
  // width as the book itself — whichever it currently is, single page or a
  // full double-page spread — instead of a fixed width that would look too
  // narrow next to a wide open-book spread.
  if (window.ResizeObserver) {
    new ResizeObserver((entries) => {
      const width = entries[0].contentRect.width;
      if (width > 0) storyViewerEl.style.setProperty('--sv-book-width', width + 'px');
    }).observe(pageCard);
  }

  // ---- Protection helpers ---------------------------------------------------
  // Block common save/copy interactions. Not a guarantee against a determined
  // user, but stops normal right-click-save / drag / print / devtools-print.
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('dragstart', (e) => e.preventDefault());
  document.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (e.ctrlKey && ['s', 'p', 'u'].includes(k)) e.preventDefault();
    if (e.key === 'F12') e.preventDefault();
  });
  window.addEventListener('beforeprint', (e) => {
    document.body.style.visibility = 'hidden';
  });

  // ---- Double-page (open book) mode helpers ----------------------------------
  function isDoubleMode() {
    return pageMode === 'double';
  }

  // In double mode, page numbers snap to an odd-numbered spread anchor
  // (1-2, 3-4, 5-6, ...) so the book always opens on a consistent pair.
  function normalizeToSpread(num) {
    if (!isDoubleMode()) return num;
    return num % 2 === 0 ? num - 1 : num;
  }

  function getSpreadPages(num) {
    if (!isDoubleMode()) return [num];
    const left = normalizeToSpread(num);
    const right = left + 1;
    return right <= totalPages ? [left, right] : [left];
  }

  function pageStep() {
    return isDoubleMode() ? 2 : 1;
  }

  function isMobileViewport() {
    return window.matchMedia('(max-width: 900px)').matches;
  }

  function updateRotateHint() {
    const needsLandscape = isDoubleMode() && isMobileViewport() &&
      window.matchMedia('(orientation: portrait)').matches;
    rotateHint.classList.toggle('sv-hidden', !needsLandscape);
  }

  function applyPageModeUI() {
    pageCard.classList.toggle('sv-double-page', isDoubleMode());
    pageSpine.classList.toggle('sv-hidden', !isDoubleMode());
    pageModeBtn.classList.toggle('sv-mode-active', isDoubleMode());
    pageModeBtn.title = isDoubleMode() ? 'Switch to single-page view' : 'Switch to double-page book view';
    pageModeBtn.setAttribute('aria-label', pageModeBtn.title);
    updateRotateHint();
  }

  async function setPageMode(mode) {
    pageMode = mode;
    localStorage.setItem('sv-page-mode', mode);
    applyPageModeUI();

    if (mode === 'double' && isMobileViewport()) {
      // Best-effort: fullscreen + lock landscape (Android Chrome and similar).
      // iOS Safari does not support orientation.lock at all — the on-screen
      // rotate hint (CSS-driven via the orientation media query) covers that.
      try {
        const el = document.getElementById('story-viewer');
        if (!document.fullscreenElement && el.requestFullscreen) {
          await el.requestFullscreen();
        }
        if (screen.orientation && screen.orientation.lock) {
          await screen.orientation.lock('landscape');
        }
      } catch (err) {
        // Not supported/allowed — rely on the rotate hint instead.
      }
    } else if (mode === 'single') {
      try {
        if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
      } catch (err) { /* not supported — harmless */ }
    }

    if (pdfDoc) renderPage(currentPage);
  }

  // ---- Folding page-turn transition ------------------------------------------
  // Snapshots the outgoing page (or full spread, in double mode) and turns it
  // as a genuinely folding sheet: split into two hinged halves in 3D so the
  // outer half creases against the inner half as it turns, instead of one
  // flat rigid card rotating — much closer to a real page turn.
  function flipToPage(direction) {
    if (canvas.width === 0) return; // nothing rendered yet (first load)

    const showingSpread = isDoubleMode() && !canvas2.classList.contains('sv-hidden') && canvas2.width > 0;

    let dataUrl, widthPx, heightPx;
    if (showingSpread) {
      const combined = document.createElement('canvas');
      combined.width = canvas.width + canvas2.width;
      combined.height = Math.max(canvas.height, canvas2.height);
      const combinedCtx = combined.getContext('2d');
      combinedCtx.fillStyle = '#fff';
      combinedCtx.fillRect(0, 0, combined.width, combined.height);
      combinedCtx.drawImage(canvas, 0, 0);
      combinedCtx.drawImage(canvas2, canvas.width, 0);
      dataUrl = combined.toDataURL();
      widthPx = parseFloat(canvas.style.width) + parseFloat(canvas2.style.width);
      heightPx = parseFloat(canvas.style.height);
    } else {
      dataUrl = canvas.toDataURL();
      widthPx = parseFloat(canvas.style.width);
      heightPx = parseFloat(canvas.style.height);
    }

    const leaf = document.createElement('div');
    leaf.className = 'sv-flip-leaf sv-flip-' + direction;
    leaf.style.width = widthPx + 'px';
    leaf.style.height = heightPx + 'px';

    // Two halves of the SAME image: half A stays hinged at the spine edge,
    // half B is nested inside half A and hinged at the fold line (the
    // midpoint), so its rotation compounds with half A's — the classic
    // "folding in half toward the spine" illusion.
    const nearSide = direction === 'next' ? 'left' : 'right';
    const farSide = direction === 'next' ? 'right' : 'left';

    const halfA = document.createElement('div');
    halfA.className = 'sv-fold-half sv-fold-a';
    const innerA = document.createElement('div');
    innerA.className = 'sv-fold-inner';
    const imgA = document.createElement('img');
    imgA.src = dataUrl;
    imgA.className = 'sv-fold-img sv-fold-img-' + nearSide;
    innerA.appendChild(imgA);

    const halfB = document.createElement('div');
    halfB.className = 'sv-fold-half sv-fold-b';
    const innerB = document.createElement('div');
    innerB.className = 'sv-fold-inner';
    const imgB = document.createElement('img');
    imgB.src = dataUrl;
    imgB.className = 'sv-fold-img sv-fold-img-' + farSide;
    innerB.appendChild(imgB);

    halfB.appendChild(innerB);
    halfA.appendChild(innerA);
    halfA.appendChild(halfB);
    leaf.appendChild(halfA);
    pageCard.appendChild(leaf);

    // Force layout so the animation class transition triggers.
    // eslint-disable-next-line no-unused-expressions
    leaf.offsetWidth;
    requestAnimationFrame(() => leaf.classList.add('sv-flip-animate'));

    leaf.addEventListener('transitionend', (e) => {
      if (e.target === halfB) leaf.remove();
    });
    setTimeout(() => leaf.remove(), 900); // safety fallback
  }

  // ---- Rendering -------------------------------------------------------------
  // If a render is already in flight (e.g. a resize fires mid-render, or the
  // user taps Next twice quickly) we cancel it rather than queue behind it —
  // pdf.js does not allow two concurrent render() calls on the same canvas.
  function renderIntoCanvas(canvasEl, ctxEl, num, isSecondary, onDone) {
    pdfDoc.getPage(num).then((page) => {
      const stage = document.querySelector('.sv-stage');
      const availH = stage.clientHeight - 32;
      const availW = (stage.clientWidth - 32) / (isDoubleMode() ? 2 : 1);

      const baseViewport = page.getViewport({ scale: 1 });
      const scale = Math.min(availW / baseViewport.width, availH / baseViewport.height);
      const outputScale = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale: scale * outputScale });

      canvasEl.width = viewport.width;
      canvasEl.height = viewport.height;
      canvasEl.style.width = (viewport.width / outputScale) + 'px';
      canvasEl.style.height = (viewport.height / outputScale) + 'px';

      const task = page.render({ canvasContext: ctxEl, viewport });
      if (isSecondary) currentRenderTask2 = task; else currentRenderTask = task;
      return task.promise;
    }).then(() => {
      if (isSecondary) currentRenderTask2 = null; else currentRenderTask = null;
      if (onDone) onDone();
    }).catch((err) => {
      if (isSecondary) currentRenderTask2 = null; else currentRenderTask = null;
      if (err && err.name === 'RenderingCancelledException') return; // expected on rapid nav
      console.error('Page render failed', err);
    });
  }

  // Fills canvas2 with a blank page matching canvas1's exact size — used when
  // the book ends on an odd page, so the layout still reads as a symmetric
  // open book (blank right-hand page) instead of squeezing the last page
  // into a lopsided half-width box.
  function showBlankRightPage() {
    canvas2.classList.remove('sv-hidden');
    canvas2.width = canvas.width;
    canvas2.height = canvas.height;
    canvas2.style.width = canvas.style.width;
    canvas2.style.height = canvas.style.height;
    ctx2.fillStyle = '#fdfdfd';
    ctx2.fillRect(0, 0, canvas2.width, canvas2.height);
  }

  function renderPage(num) {
    const pages = getSpreadPages(num);
    currentPage = pages[0];

    currentPageEl.textContent = pages.length === 2 ? pages[0] + '–' + pages[1] : String(pages[0]);
    pageSlider.value = pages[0];
    prevBtn.disabled = pages[0] <= 1;
    nextBtn.disabled = pages[pages.length - 1] >= totalPages;
    saveProgress(pages[0], totalPages);
    updateBookmarkTabUI();

    if (currentRenderTask) currentRenderTask.cancel();
    if (currentRenderTask2) currentRenderTask2.cancel();

    const needsBlankRight = isDoubleMode() && !pages[1];
    renderIntoCanvas(canvas, ctx, pages[0], false, needsBlankRight ? showBlankRightPage : null);

    if (isDoubleMode() && pages[1]) {
      canvas2.classList.remove('sv-hidden');
      renderIntoCanvas(canvas2, ctx2, pages[1], true);
    } else if (!isDoubleMode()) {
      canvas2.classList.add('sv-hidden');
    }
    // else: double mode, last odd page — canvas2 is filled blank above once
    // canvas1's render (and thus its final size) resolves.
  }

  function goToPage(num) {
    const target = normalizeToSpread(num);
    if (target < 1 || target > totalPages || target === currentPage) return;
    const direction = target > currentPage ? 'next' : 'prev';
    flipToPage(direction);
    renderPage(target);
  }

  // ---- Load book title/subtitle (best-effort; viewer still works without it) ---
  if (bookId) {
    fetch('api/books.php', { cache: 'no-store' })
      .then((res) => res.json())
      .then((books) => {
        const book = books.find((b) => b.id === bookId);
        if (book) {
          document.getElementById('storyTitle').textContent = book.title;
          document.getElementById('storySubtitle').textContent = book.subtitle || 'Read • Learn • Imagine';
          document.title = book.title + ' — Story Time';
        }
      })
      .catch(() => {});
  }

  applyPageModeUI();

  // ---- Load PDF ----------------------------------------------------------
  pdfjsLib.getDocument(PDF_URL).promise.then((doc) => {
    pdfDoc = doc;
    totalPages = doc.numPages;
    totalPagesEl.textContent = totalPages;
    pageSlider.max = totalPages;

    buildContentsList();

    loadingOverlay.classList.add('sv-hidden');
    const startPage = Math.min(Math.max(requestedPage, 1), totalPages);
    renderPage(startPage);
  }).catch((err) => {
    console.error('PDF load failed', err);
    const isFileProtocol = window.location.protocol === 'file:';
    loadingOverlay.innerHTML = isFileProtocol
      ? '<p><strong>This page must be opened through a web server, not double-clicked as a file.</strong><br><br>' +
        'Since this project lives in your Laragon <code>www</code> folder, open it at:<br>' +
        '<code>http://localhost/freelancer/web_based_pdf_viwer/</code><br>(or your Laragon virtual host) instead of a <code>file://</code> path.</p>'
      : `<p>Could not load the story.<br><small>${(err && err.message) || err}</small></p>`;
  });

  // ---- Panels: Pages grid & Contents list --------------------------------
  // Real page thumbnails (not just "Page N" placeholders), rendered lazily —
  // only once the Pages panel is actually opened — and cached in
  // localStorage so re-opening it (or revisiting the book) is instant.
  const THUMB_CACHE_PREFIX = 'sv-page-thumb-';
  let pagesGridBuilt = false;

  function thumbCacheKey(pageNum) {
    return THUMB_CACHE_PREFIX + bookId + '-' + pageNum;
  }

  function renderPageThumb(pageNum, canvas) {
    const cached = bookId && (() => {
      try { return localStorage.getItem(thumbCacheKey(pageNum)); } catch (err) { return null; }
    })();
    if (cached) {
      const img = new Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        canvas.getContext('2d').drawImage(img, 0, 0);
      };
      img.src = cached;
      return;
    }
    pdfDoc.getPage(pageNum).then((page) => {
      const targetWidth = 160;
      const baseViewport = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: targetWidth / baseViewport.width });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      return page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise.then(() => {
        if (!bookId) return;
        try { localStorage.setItem(thumbCacheKey(pageNum), canvas.toDataURL('image/jpeg', 0.75)); } catch (err) { /* storage full — non-fatal */ }
      });
    }).catch((err) => console.error('Page thumbnail render failed for page', pageNum, err));
  }

  function buildPagesGrid() {
    if (pagesGridBuilt) return;
    pagesGridBuilt = true;
    pagesGrid.innerHTML = '';
    for (let i = 1; i <= totalPages; i++) {
      const thumb = document.createElement('button');
      thumb.className = 'sv-page-thumb';
      thumb.setAttribute('aria-label', 'Page ' + i);

      const canvas = document.createElement('canvas');
      thumb.appendChild(canvas);
      const label = document.createElement('span');
      label.className = 'sv-page-thumb-num';
      label.textContent = i;
      thumb.appendChild(label);

      if (isBookmarked(i)) {
        thumb.appendChild(makeBookmarkRibbon());
      }

      thumb.addEventListener('click', () => {
        goToPage(i);
        closePanels();
      });
      pagesGrid.appendChild(thumb);
      renderPageThumb(i, canvas);
    }
  }

  function buildContentsList() {
    contentsList.innerHTML = '';
    for (let i = 1; i <= totalPages; i++) {
      const li = document.createElement('li');
      li.innerHTML = `<span>Page ${i}</span><span>›</span>`;
      li.addEventListener('click', () => {
        goToPage(i);
        closePanels();
      });
      contentsList.appendChild(li);
    }
  }

  function closePanels() {
    pagesPanel.classList.add('sv-panel-hidden');
    contentsPanel.classList.add('sv-panel-hidden');
    settingsPanel.classList.add('sv-panel-hidden');
  }

  pagesTab.addEventListener('click', () => {
    if (pdfDoc) buildPagesGrid();
    renderBookmarksStrip();
    contentsPanel.classList.add('sv-panel-hidden');
    settingsPanel.classList.add('sv-panel-hidden');
    pagesPanel.classList.toggle('sv-panel-hidden');
  });
  contentsTab.addEventListener('click', () => {
    pagesPanel.classList.add('sv-panel-hidden');
    settingsPanel.classList.add('sv-panel-hidden');
    contentsPanel.classList.toggle('sv-panel-hidden');
  });
  settingsBtn.addEventListener('click', () => {
    pagesPanel.classList.add('sv-panel-hidden');
    contentsPanel.classList.add('sv-panel-hidden');
    settingsPanel.classList.toggle('sv-panel-hidden');
  });

  // Settings is a centered popup — clicking the dimmed backdrop (not the
  // box itself) closes it, like a normal modal dialog.
  settingsPanel.addEventListener('click', (e) => {
    if (e.target === settingsPanel) closePanels();
  });
  document.querySelectorAll('[data-close-panel]').forEach((btn) =>
    btn.addEventListener('click', closePanels)
  );

  // ---- Theme picker ----------------------------------------------------------
  const THEME_KEY = 'sv-theme';
  const DEFAULT_THEME = 'blue';

  function applyTheme(theme) {
    storyViewerEl.classList.forEach((cls) => {
      if (cls.startsWith('sv-theme-')) storyViewerEl.classList.remove(cls);
    });
    if (theme !== 'blue') {
      storyViewerEl.classList.add('sv-theme-' + theme);
    }
    themeSwatches.querySelectorAll('.sv-theme-swatch').forEach((btn) => {
      btn.classList.toggle('sv-swatch-active', btn.dataset.theme === theme);
    });
  }

  applyTheme(localStorage.getItem(THEME_KEY) || DEFAULT_THEME);

  themeSwatches.addEventListener('click', (e) => {
    const btn = e.target.closest('.sv-theme-swatch');
    if (!btn) return;
    const theme = btn.dataset.theme;
    localStorage.setItem(THEME_KEY, theme);
    applyTheme(theme);
  });

  // ---- Bookmarks -----------------------------------------------------------
  // Per-book list of bookmarked page numbers, kept in localStorage so it
  // survives closing the browser. One tap on the Bookmark tab toggles the
  // *current* page; the Pages panel shows a ribbon on every bookmarked
  // thumbnail, plus a strip of quick-jump chips at the top.
  const BOOKMARKS_KEY = 'sv-bookmarks';

  function getAllBookmarks() {
    try { return JSON.parse(localStorage.getItem(BOOKMARKS_KEY) || '{}'); } catch (err) { return {}; }
  }
  function getBookmarks() {
    if (!bookId) return [];
    const all = getAllBookmarks();
    return Array.isArray(all[bookId]) ? all[bookId] : [];
  }
  function saveBookmarks(pages) {
    if (!bookId) return;
    const all = getAllBookmarks();
    all[bookId] = pages;
    try { localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(all)); } catch (err) { /* storage full — non-fatal */ }
  }
  function isBookmarked(page) {
    return getBookmarks().indexOf(page) !== -1;
  }

  function makeBookmarkRibbon() {
    const span = document.createElement('span');
    span.className = 'sv-page-thumb-bookmark';
    span.innerHTML = '<svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M5 2h10a1 1 0 0 1 1 1v15l-6-3.6L4 18V3a1 1 0 0 1 1-1Z" fill="currentColor"/></svg>';
    return span;
  }

  function showToast(message) {
    svToast.textContent = message;
    svToast.classList.remove('sv-hidden');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => svToast.classList.add('sv-hidden'), 1800);
  }

  function updateBookmarkTabUI() {
    bookmarkTab.classList.toggle('sv-bookmark-active', isBookmarked(currentPage));
  }

  function renderBookmarksStrip() {
    const pages = getBookmarks();
    bookmarksStrip.classList.toggle('sv-hidden', pages.length === 0);
    bookmarksChips.innerHTML = '';
    pages.forEach((page) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'sv-bookmark-chip';
      chip.innerHTML = '<span>Page ' + page + '</span><span class="sv-bookmark-chip-remove">✕</span>';
      chip.addEventListener('click', (e) => {
        if (e.target.closest('.sv-bookmark-chip-remove')) {
          e.stopPropagation();
          toggleBookmark(page);
          return;
        }
        goToPage(page);
        closePanels();
      });
      bookmarksChips.appendChild(chip);
    });
  }

  // Keeps the currently-open Pages grid's ribbons in sync without a full
  // rebuild (buildPagesGrid only runs once per book — see pagesGridBuilt).
  function refreshPageThumbBookmark(page) {
    const thumb = pagesGrid.children[page - 1];
    if (!thumb) return;
    const existing = thumb.querySelector('.sv-page-thumb-bookmark');
    if (isBookmarked(page)) {
      if (!existing) thumb.appendChild(makeBookmarkRibbon());
    } else if (existing) {
      existing.remove();
    }
  }

  function toggleBookmark(page) {
    const pages = getBookmarks();
    const idx = pages.indexOf(page);
    if (idx === -1) {
      pages.push(page);
      pages.sort((a, b) => a - b);
      saveBookmarks(pages);
      showToast('🔖 Bookmarked page ' + page);
    } else {
      pages.splice(idx, 1);
      saveBookmarks(pages);
      showToast('Bookmark removed');
    }
    updateBookmarkTabUI();
    renderBookmarksStrip();
    refreshPageThumbBookmark(page);
  }

  bookmarkTab.addEventListener('click', () => {
    if (pdfDoc) buildPagesGrid();
    toggleBookmark(currentPage);
    // Jump straight to the Pages panel (bookmarks strip at the top) so it's
    // obvious where to actually see/manage what you just bookmarked.
    contentsPanel.classList.add('sv-panel-hidden');
    settingsPanel.classList.add('sv-panel-hidden');
    pagesPanel.classList.remove('sv-panel-hidden');
  });

  // ---- Nav controls --------------------------------------------------------
  prevBtn.addEventListener('click', () => goToPage(currentPage - pageStep()));
  nextBtn.addEventListener('click', () => goToPage(currentPage + pageStep()));
  pageSlider.addEventListener('change', () => goToPage(Number(pageSlider.value)));
  swipeLeft.addEventListener('click', () => goToPage(currentPage - pageStep()));
  swipeRight.addEventListener('click', () => goToPage(currentPage + pageStep()));

  // Swipe gesture support
  let touchStartX = null;
  const stageEl = document.querySelector('.sv-stage');
  stageEl.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].clientX;
  }, { passive: true });
  stageEl.addEventListener('touchend', (e) => {
    if (touchStartX === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 50) {
      if (dx > 0) goToPage(currentPage - pageStep());
      else goToPage(currentPage + pageStep());
    }
    touchStartX = null;
  }, { passive: true });

  // Keyboard nav (desktop testing convenience)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') goToPage(currentPage + pageStep());
    if (e.key === 'ArrowLeft') goToPage(currentPage - pageStep());
  });

  // Double/single-page toggle
  pageModeBtn.addEventListener('click', () => {
    setPageMode(isDoubleMode() ? 'single' : 'double');
  });

  // Re-render current spread crisply on resize/orientation change, and
  // re-check whether the rotate-device hint should show.
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    updateRotateHint();
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (pdfDoc) renderPage(currentPage); }, 150);
  });
  window.addEventListener('orientationchange', () => {
    updateRotateHint();
  });

  // Fullscreen toggle
  fullscreenBtn.addEventListener('click', () => {
    const el = document.getElementById('story-viewer');
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.();
    }
  });
})();
