/* ==========================================================================
   Story Time — Book list (client-facing landing page)
   Fetches the public book catalog and renders selectable, filterable story
   cards (search, favorites, popularity, age range). Visual theming lives in
   css/booklist.css (shared variables with css/style.css).
   ========================================================================== */
(function () {
  'use strict';

  const grid = document.getElementById('blGrid');
  const loading = document.getElementById('blLoading');
  const empty = document.getElementById('blEmpty');
  const noResults = document.getElementById('blNoResults');
  const backBtn = document.getElementById('blBackBtn');
  const searchBtn = document.getElementById('blSearchBtn');
  const searchBar = document.getElementById('blSearchBar');
  const searchInput = document.getElementById('blSearchInput');
  const filterPills = document.querySelectorAll('.bl-filter-pill');
  const ageFilterBtn = document.getElementById('blAgeFilterBtn');
  const ageSelect = document.getElementById('blAgeSelect');
  const bottomTabs = document.querySelectorAll('.bl-bottom-tab[data-tab]');
  const settingsTab = document.getElementById('blSettingsTab');
  const settingsPanel = document.getElementById('settingsPanel');
  const settingsClose = document.getElementById('blSettingsClose');
  const themeSwatches = document.getElementById('themeSwatches');
  const promoBanner = document.getElementById('blPromoBanner');

  let allBooks = [];
  let activeFilter = 'all';
  let searchTerm = '';
  let activeAge = '';

  const FAVORITES_KEY = 'sv-favorites';
  const NEW_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // "New" badge for uploads in the last 7 days

  // ---- Reading progress (written by viewer.js as the reader turns pages) ---
  const PROGRESS_KEY = 'sv-progress';
  function getProgressMap() {
    try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}'); } catch (err) { return {}; }
  }
  function setProgressPage(bookId, page) {
    try {
      const all = getProgressMap();
      if (!all[bookId]) return;
      all[bookId].page = page;
      all[bookId].updatedAt = Date.now();
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(all));
    } catch (err) { /* ignore — storage full/unavailable */ }
  }
  // Most recently read book that isn't finished yet, still present in the
  // catalog. Returns null when there's nothing to resume.
  function getContinueEntry() {
    const progressMap = getProgressMap();
    let best = null;
    Object.keys(progressMap).forEach((id) => {
      const p = progressMap[id];
      if (!p || !p.totalPages || p.page >= p.totalPages) return; // finished or malformed
      if (best && p.updatedAt <= best.progress.updatedAt) return;
      const book = allBooks.find((b) => b.id === id);
      if (!book) return; // deleted since
      best = { book: book, progress: p };
    });
    return best;
  }

  // ---- Apply whichever theme was picked in Settings, so the library ---------
  // matches instead of always showing the default palette.
  const THEME_KEY = 'sv-theme';
  const DEFAULT_THEME = 'blue';

  function applyTheme(theme) {
    document.body.classList.forEach((cls) => {
      if (cls.startsWith('sv-theme-')) document.body.classList.remove(cls);
    });
    if (theme !== 'blue') document.body.classList.add('sv-theme-' + theme);
    themeSwatches.querySelectorAll('.sv-theme-swatch').forEach((btn) => {
      btn.classList.toggle('sv-swatch-active', btn.dataset.theme === theme);
    });
  }
  applyTheme(localStorage.getItem(THEME_KEY) || DEFAULT_THEME);
  themeSwatches.addEventListener('click', (e) => {
    const btn = e.target.closest('.sv-theme-swatch');
    if (!btn) return;
    localStorage.setItem(THEME_KEY, btn.dataset.theme);
    applyTheme(btn.dataset.theme);
  });

  function openSettings() { settingsPanel.classList.remove('sv-panel-hidden'); }
  function closeSettings() { settingsPanel.classList.add('sv-panel-hidden'); }
  settingsTab.addEventListener('click', openSettings);
  settingsClose.addEventListener('click', closeSettings);
  settingsPanel.addEventListener('click', (e) => { if (e.target === settingsPanel) closeSettings(); });

  // ---- Favorites (per-device, localStorage) ----------------------------------
  function getFavorites() {
    try {
      return new Set(JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]'));
    } catch (err) {
      return new Set();
    }
  }
  function saveFavorites(set) {
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(set)));
    } catch (err) { /* storage unavailable — favorites just won't persist */ }
  }
  function toggleFavorite(id) {
    const favs = getFavorites();
    if (favs.has(id)) favs.delete(id); else favs.add(id);
    saveFavorites(favs);
    return favs.has(id);
  }

  // ---- "Back" — same resume-last-book logic as the viewer's back link -------
  backBtn.addEventListener('click', () => { window.location.href = 'index.html'; });

  // ---- Search toggle -----------------------------------------------------
  searchBtn.addEventListener('click', () => {
    searchBar.classList.toggle('bl-hidden');
    if (!searchBar.classList.contains('bl-hidden')) searchInput.focus();
  });
  searchInput.addEventListener('input', () => {
    searchTerm = searchInput.value.trim().toLowerCase();
    render();
  });

  // ---- Filter pills + bottom nav shortcuts -----------------------------------
  function setFilter(filter) {
    activeFilter = filter;
    filterPills.forEach((p) => p.classList.toggle('bl-filter-active', p.dataset.filter === filter));
    bottomTabs.forEach((t) => t.classList.toggle('bl-bottom-active', t.dataset.tab === filter));
    ageSelect.classList.toggle('bl-hidden', filter !== 'age');
    render();
  }
  filterPills.forEach((pill) => pill.addEventListener('click', () => setFilter(pill.dataset.filter)));
  bottomTabs.forEach((tab) => tab.addEventListener('click', () => setFilter(tab.dataset.tab)));
  ageSelect.addEventListener('change', () => { activeAge = ageSelect.value; render(); });

  // ---- Load site settings (admin-uploaded promo banner) --------------------
  if (promoBanner) {
    fetch('api/settings.php', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((settings) => {
        if (settings && settings.bannerUrl) {
          promoBanner.style.backgroundImage = "url('" + settings.bannerUrl + "')";
        }
      })
      .catch((err) => console.error('Failed to load promo banner', err));
  }

  // ---- Load catalog --------------------------------------------------------
  fetch('api/books.php', { cache: 'no-store' })
    .then((res) => {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then((books) => {
      loading.classList.add('bl-hidden');
      allBooks = books;
      if (!books.length) {
        empty.classList.remove('bl-hidden');
        return;
      }
      setupAgeFilter(books);
      render();
    })
    .catch((err) => {
      console.error('Failed to load book list', err);
      loading.textContent = 'Could not load stories. Please try again later.';
    });

  function setupAgeFilter(books) {
    const ranges = Array.from(new Set(books.map((b) => b.ageRange).filter(Boolean))).sort();
    if (!ranges.length) return; // no book has an age range set — keep the pill hidden
    ageFilterBtn.classList.remove('bl-hidden');
    ageSelect.innerHTML = ranges.map((r) => `<option value="${r}">Ages ${r}</option>`).join('');
    activeAge = ranges[0];
  }

  function matchesFilter(book, favorites) {
    if (activeFilter === 'favorites') return favorites.has(book.id);
    if (activeFilter === 'age') return book.ageRange === activeAge;
    return true; // 'all' and 'popular' both start from the full set (popular just re-sorts it)
  }

  function render() {
    const favorites = getFavorites();
    let list = allBooks.filter((b) => matchesFilter(b, favorites));

    if (searchTerm) {
      list = list.filter((b) =>
        b.title.toLowerCase().includes(searchTerm) ||
        (b.subtitle || '').toLowerCase().includes(searchTerm)
      );
    }

    if (activeFilter === 'popular') {
      list = list.slice().sort((a, b) => (b.views || 0) - (a.views || 0));
    }

    grid.innerHTML = '';
    noResults.classList.toggle('bl-hidden', list.length > 0 || !allBooks.length);

    // "Continue reading" takes the place of its book's normal card, only in
    // the unfiltered/no-search view — searching or switching filters should
    // show plain results, not an unrelated promoted card.
    const continueEntry = (activeFilter === 'all' && !searchTerm) ? getContinueEntry() : null;
    if (continueEntry) grid.appendChild(renderContinueCard(continueEntry.book, continueEntry.progress));

    list.forEach((book) => {
      if (continueEntry && book.id === continueEntry.book.id) return;
      grid.appendChild(renderCard(book, favorites));
    });
  }

  function renderCard(book, favorites) {
    const card = document.createElement('div');
    card.className = 'bl-card';

    const cover = document.createElement('a');
    cover.className = 'bl-card-cover';
    cover.href = 'viewer.html?id=' + encodeURIComponent(book.id);

    const isNew = book.uploadedAt && (Date.now() - Date.parse(book.uploadedAt.replace(' ', 'T'))) < NEW_WINDOW_MS;
    if (isNew) {
      const badge = document.createElement('span');
      badge.className = 'bl-new-badge';
      badge.textContent = 'New';
      cover.appendChild(badge);
    }

    if (book.cover) {
      const img = document.createElement('img');
      img.src = book.cover;
      img.alt = book.title;
      cover.appendChild(img);
    } else {
      const placeholder = document.createElement('span');
      placeholder.textContent = '📖';
      cover.appendChild(placeholder);
      const cached = getCachedCover(book);
      if (cached) {
        setCoverImage(cover, cached, book.title, isNew);
      } else {
        showCoverSpinner(cover, isNew);
        renderPdfCoverThumbnail(book, cover, isNew);
      }
    }

    const info = document.createElement('div');
    info.className = 'bl-card-info';

    const title = document.createElement('h3');
    title.textContent = book.title;
    title.title = book.title;
    info.appendChild(title);

    if (book.subtitle) {
      const sub = document.createElement('p');
      sub.textContent = book.subtitle;
      sub.title = book.subtitle;
      info.appendChild(sub);
    }

    const meta = document.createElement('div');
    meta.className = 'bl-card-meta';
    const pagesPill = document.createElement('span');
    pagesPill.className = 'bl-meta-pill bl-pages-pill';
    pagesPill.innerHTML = '📖 <span>…</span><span class="bl-meta-word"></span>';
    meta.appendChild(pagesPill);
    getPageCount(book).then((count) => {
      if (count) {
        pagesPill.querySelector('span').textContent = count;
        pagesPill.querySelector('.bl-meta-word').textContent = count === 1 ? ' page' : ' pages';
      } else {
        pagesPill.remove();
      }
    });
    if (book.ageRange) {
      const agePill = document.createElement('span');
      agePill.className = 'bl-meta-pill bl-age-pill';
      agePill.innerHTML = '👤 <span class="bl-meta-word">Ages </span>' + escapeHtml(book.ageRange);
      meta.appendChild(agePill);
    }
    info.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'bl-card-actions';
    const cta = document.createElement('a');
    cta.className = 'bl-card-cta';
    cta.href = 'viewer.html?id=' + encodeURIComponent(book.id);
    cta.innerHTML = 'Read now <span>›</span>';
    actions.appendChild(cta);

    const favBtn = document.createElement('button');
    favBtn.className = 'bl-fav-btn';
    favBtn.type = 'button';
    favBtn.setAttribute('aria-label', 'Toggle favorite');
    const isFav = favorites.has(book.id);
    favBtn.classList.toggle('bl-fav-active', isFav);
    favBtn.innerHTML = '<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">'
      + '<path d="M10 17.2s-6.7-4.2-9-8.3C-0.4 5.7 1.6 2.6 4.9 2.6c1.9 0 3.5 1 5.1 3 1.6-2 3.2-3 5.1-3 3.3 0 5.3 3.1 3.9 6.3-2.3 4.1-9 8.3-9 8.3Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>'
      + '</svg>';
    favBtn.addEventListener('click', () => {
      const nowFav = toggleFavorite(book.id);
      favBtn.classList.toggle('bl-fav-active', nowFav);
      if (activeFilter === 'favorites' && !nowFav) render(); // drop out of the Favorites view immediately
    });
    actions.appendChild(favBtn);

    info.appendChild(actions);
    card.appendChild(cover);
    card.appendChild(info);
    return card;
  }

  // "Continue reading" card — same overall size/shape as a normal story
  // card, but the cover is replaced with a live thumbnail of the exact page
  // the reader stopped on, plus Previous/Next controls to flip through
  // right from the library (each tap updates the saved progress too).
  function renderContinueCard(book, progress) {
    const card = document.createElement('div');
    card.className = 'bl-card bl-continue-card';

    // header + stage together take up exactly the same 4:5 box a plain
    // cover image would, so both cards' pictures end at the same height
    // and everything below (title, meta, buttons) lines up between cards.
    const coverWrap = document.createElement('div');
    coverWrap.className = 'bl-continue-cover';

    const header = document.createElement('div');
    header.className = 'bl-continue-header';
    header.innerHTML =
      '<span class="bl-continue-titlewrap">' +
        '<strong>' + escapeHtml(book.title) + '</strong>' +
        '<span>' + escapeHtml(book.subtitle || 'Continue reading') + '</span>' +
      '</span>';
    coverWrap.appendChild(header);

    const stage = document.createElement('a');
    stage.className = 'bl-continue-stage';
    const canvas = document.createElement('canvas');
    stage.appendChild(canvas);
    coverWrap.appendChild(stage);

    card.appendChild(coverWrap);

    const nav = document.createElement('div');
    nav.className = 'bl-continue-nav';
    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'bl-continue-navbtn';
    prevBtn.setAttribute('aria-label', 'Previous page');
    prevBtn.textContent = '‹';
    const pageLabel = document.createElement('span');
    pageLabel.className = 'bl-continue-pagelabel';
    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'bl-continue-navbtn';
    nextBtn.setAttribute('aria-label', 'Next page');
    nextBtn.textContent = '›';
    nav.appendChild(prevBtn);
    nav.appendChild(pageLabel);
    nav.appendChild(nextBtn);
    card.appendChild(nav);

    const info = document.createElement('div');
    info.className = 'bl-card-info';

    const title = document.createElement('h3');
    title.textContent = book.title;
    title.title = book.title;
    info.appendChild(title);

    if (book.subtitle) {
      const sub = document.createElement('p');
      sub.textContent = book.subtitle;
      sub.title = book.subtitle;
      info.appendChild(sub);
    }

    const actions = document.createElement('div');
    actions.className = 'bl-card-actions';
    const cta = document.createElement('a');
    cta.className = 'bl-card-cta';
    cta.innerHTML = 'Continue <span>›</span>';
    actions.appendChild(cta);
    info.appendChild(actions);
    card.appendChild(info);

    let page = progress.page;
    const totalPages = progress.totalPages;
    let pdfDocPromise = null;
    function getPdfDoc() {
      if (!pdfDocPromise) {
        pdfDocPromise = pdfjsLib.getDocument('api/pdf.php?id=' + encodeURIComponent(book.id)).promise;
      }
      return pdfDocPromise;
    }
    function renderThumbnail() {
      getPdfDoc()
        .then((doc) => doc.getPage(page))
        .then((pdfPage) => {
          const targetWidth = 300;
          const baseViewport = pdfPage.getViewport({ scale: 1 });
          const viewport = pdfPage.getViewport({ scale: targetWidth / baseViewport.width });
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          return pdfPage.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        })
        .catch((err) => console.error('Continue-card thumbnail render failed', err));
    }
    function updatePageUI() {
      pageLabel.textContent = page + ' / ' + totalPages;
      prevBtn.disabled = page <= 1;
      nextBtn.disabled = page >= totalPages;
      const resumeUrl = 'viewer.html?id=' + encodeURIComponent(book.id) + '&page=' + page;
      cta.href = resumeUrl;
      stage.href = resumeUrl;
      renderThumbnail();
    }
    prevBtn.addEventListener('click', () => {
      if (page <= 1) return;
      page -= 1;
      setProgressPage(book.id, page);
      updatePageUI();
    });
    nextBtn.addEventListener('click', () => {
      if (page >= totalPages) return;
      page += 1;
      setProgressPage(book.id, page);
      updatePageUI();
    });
    updatePageUI();

    return card;
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  // ---- Cover thumbnail + page-count cache -------------------------------------
  // Rendering a PDF's first page (fetch + parse + rasterize) is the slowest
  // part of loading the library. Caching the resulting image/page-count means
  // every visit after the first is instant. Keyed by book id + updatedAt, so
  // replacing a PDF/cover in admin automatically invalidates stale entries.
  const COVER_CACHE_PREFIX = 'sv-cover-cache-';
  const PAGES_CACHE_PREFIX = 'sv-pages-cache-';

  function cacheKey(prefix, book) {
    return prefix + book.id + '-' + (book.updatedAt || 0);
  }
  function getCachedCover(book) {
    try { return localStorage.getItem(cacheKey(COVER_CACHE_PREFIX, book)); } catch (err) { return null; }
  }
  function setCachedCover(book, dataUrl) {
    try { localStorage.setItem(cacheKey(COVER_CACHE_PREFIX, book), dataUrl); } catch (err) { /* ignore */ }
  }
  function getCachedPageCount(book) {
    try {
      const v = localStorage.getItem(cacheKey(PAGES_CACHE_PREFIX, book));
      return v ? parseInt(v, 10) : null;
    } catch (err) { return null; }
  }
  function setCachedPageCount(book, count) {
    try { localStorage.setItem(cacheKey(PAGES_CACHE_PREFIX, book), String(count)); } catch (err) { /* ignore */ }
  }

  // Returns a promise for the page count. Uses the cache when available;
  // otherwise only fetches the PDF if we don't already have one in flight for
  // the cover thumbnail (books with a manual cover skip the PDF fetch
  // entirely here, to avoid an extra download just for a page count pill).
  function getPageCount(book) {
    const cached = getCachedPageCount(book);
    if (cached) return Promise.resolve(cached);
    if (book.cover || typeof pdfjsLib === 'undefined') return Promise.resolve(null);
    const pdfUrl = 'api/pdf.php?id=' + encodeURIComponent(book.id);
    return pdfjsLib.getDocument(pdfUrl).promise
      .then((doc) => {
        setCachedPageCount(book, doc.numPages);
        return doc.numPages;
      })
      .catch(() => null);
  }

  function showCoverSpinner(coverEl, isNew) {
    coverEl.innerHTML = (isNew ? '<span class="bl-new-badge">New</span>' : '') + '<div class="bl-cover-spinner"></div>';
  }

  function setCoverImage(coverEl, src, alt, isNew) {
    coverEl.innerHTML = isNew ? '<span class="bl-new-badge">New</span>' : '';
    const img = document.createElement('img');
    img.src = src;
    img.alt = alt;
    coverEl.appendChild(img);
  }

  // Renders the PDF's first page into a small canvas and swaps it in as the
  // cover. Runs client-side via pdf.js so no server-side PDF rendering
  // dependency (Imagick/Ghostscript) is required.
  function renderPdfCoverThumbnail(book, coverEl, isNew) {
    if (typeof pdfjsLib === 'undefined') return;
    const pdfUrl = 'api/pdf.php?id=' + encodeURIComponent(book.id);

    pdfjsLib.getDocument(pdfUrl).promise
      .then((doc) => {
        setCachedPageCount(book, doc.numPages);
        return doc.getPage(1);
      })
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
        setCoverImage(coverEl, dataUrl, book.title, isNew);
      })
      .catch((err) => {
        console.error('Could not render PDF cover thumbnail for book', book.id, err);
        coverEl.innerHTML = (isNew ? '<span class="bl-new-badge">New</span>' : '') + '📖';
      });
  }
})();
