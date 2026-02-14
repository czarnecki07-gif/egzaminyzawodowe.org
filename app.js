/* app.js — egzaminyzawodowe.org
   Działa z:
   - exams.json: [{ symbol, name, ... }, ...]
   - courses.json: { "AUD.01.": { payUrl, group, ... }, ... }  (albo array — też obsłuży)
   Wymaga w index.html elementów:
   #q, #group, #sort, #count, #grid
*/

(() => {
  const $ = (sel) => document.querySelector(sel);

  const qEl = $('#q');
  const groupEl = $('#group');
  const sortEl = $('#sort');
  const countEl = $('#count');
  const gridEl = $('#grid');
  const yearEl = $('#year');

  if (yearEl) yearEl.textContent = new Date().getFullYear();

  if (!qEl || !groupEl || !sortEl || !countEl || !gridEl) {
    console.error('Brakuje elementów w HTML: #q, #group, #sort, #count, #grid');
    return;
  }

  const state = {
    exams: [],
    coursesBySymbol: new Map(),
    groups: new Set(),
    filtered: [],
  };

  const safe = (v) => (v ?? '').toString().trim();
  const norm = (v) => safe(v).toLowerCase();

  function escapeHtml(str) {
    return safe(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function guessGroupFromSymbol(symbol) {
    const s = safe(symbol).toUpperCase();
    const m = s.match(/^([A-Z]{2,4})\./);
    return m ? m[1] : 'INNE';
  }

  async function loadJson(path) {
    const res = await fetch(path, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Nie mogę pobrać ${path} (HTTP ${res.status})`);
    return await res.json();
  }

  function normalizeSymbol(sym) {
    // Zostawiamy kropki jak w plikach (np. AUD.01.)
    // Żeby działało 1:1 z kluczami courses.json
    return safe(sym).toUpperCase();
  }

  function buildGroupSelect(groups) {
    const current = groupEl.value || 'all';
    groupEl.innerHTML = `<option value="all">Wszystkie branże</option>`;

    [...groups]
      .sort((a, b) => a.localeCompare(b, 'pl', { sensitivity: 'base' }))
      .forEach((g) => {
        const opt = document.createElement('option');
        opt.value = g;
        opt.textContent = g;
        groupEl.appendChild(opt);
      });

    if ([...groupEl.options].some(o => o.value === current)) groupEl.value = current;
  }

  function compute() {
    const q = norm(qEl.value);
    const selectedGroup = safe(groupEl.value);

    let out = state.exams.slice();

    if (selectedGroup !== 'all') {
      out = out.filter((e) => {
        const symbol = normalizeSymbol(e.symbol || e.code);
        const g = e.group ? safe(e.group) : guessGroupFromSymbol(symbol);
        return g === selectedGroup;
      });
    }

    if (q) {
      out = out.filter((e) => {
        const symbol = norm(e.symbol || e.code);
        const name = norm(e.name);
        return symbol.includes(q) || name.includes(q);
      });
    }

    const sortBy = safe(sortEl.value);
    out.sort((a, b) => {
      if (sortBy === 'name') {
        return safe(a.name).localeCompare(safe(b.name), 'pl', { sensitivity: 'base' });
      }
      return normalizeSymbol(a.symbol || a.code).localeCompare(
        normalizeSymbol(b.symbol || b.code),
        'pl',
        { sensitivity: 'base' }
      );
    });

    state.filtered = out;
  }

  function render() {
    const items = state.filtered;
    countEl.textContent = String(items.length);
    gridEl.innerHTML = '';

    const frag = document.createDocumentFragment();

    for (const ex of items) {
      const symbol = normalizeSymbol(ex.symbol || ex.code);
      const name = safe(ex.name);

      const course = state.coursesBySymbol.get(symbol);

      // priorytet linków:
      // 1) courseUrl (jeśli kiedyś dodasz)
      // 2) payUrl / payment_url
      // 3) fallback: egzamin.html?symbol=...
      const href =
        course?.courseUrl ||
        course?.course_url ||
        course?.payUrl ||
        course?.payment_url ||
        `egzamin.html?symbol=${encodeURIComponent(symbol)}`;

      const group =
        safe(ex.group) ||
        safe(course?.group) ||
        guessGroupFromSymbol(symbol);

      const a = document.createElement('a');
      a.className = 'btn-card';
      a.href = href;

      // jeśli to płatność, daj nofollow (na razie OK)
      if (course?.payUrl || course?.payment_url) a.setAttribute('rel', 'nofollow');

      a.innerHTML = `
        <div class="btn-card-top">
          <span class="badge">${escapeHtml(group)}</span>
        </div>
        <div class="btn-card-code">${escapeHtml(symbol)}</div>
        <div class="btn-card-name">${escapeHtml(name)}</div>
        <div class="btn-card-cta">Otwórz →</div>
      `;

      frag.appendChild(a);
    }

    gridEl.appendChild(frag);

    if (!items.length) {
      gridEl.innerHTML = `
        <div class="note">
          <strong>Brak wyników.</strong>
          <div class="muted" style="margin-top:6px;">Zmień frazę wyszukiwania lub wybierz inną branżę.</div>
        </div>
      `;
    }
  }

  function showError(msg) {
    gridEl.innerHTML = `
      <div class="note">
        <strong>Błąd:</strong> ${escapeHtml(msg)}
        <div class="muted" style="margin-top:8px;">
          Sprawdź czy w tym samym katalogu co <code>index.html</code> są pliki
          <code>exams.json</code> i <code>courses.json</code>.
        </div>
      </div>
    `;
  }

  async function init() {
    try {
      const [examsRaw, coursesRaw] = await Promise.all([
        loadJson('./exams.json'),
        loadJson('./courses.json'),
      ]);

      // exams.json: może być array albo {exams:[...]}
      const exams = Array.isArray(examsRaw) ? examsRaw : (examsRaw?.exams || []);
      state.exams = exams.map((e) => ({
        symbol: normalizeSymbol(e.symbol || e.code || e.exam_code),
        name: safe(e.name || e.title || e.exam_name),
        group: safe(e.group),
      })).filter(e => e.symbol && e.name);

      // courses.json: może być object (mapa) lub array
      state.coursesBySymbol.clear();
      if (Array.isArray(coursesRaw)) {
        for (const c of coursesRaw) {
          const sym = normalizeSymbol(c.exam_code || c.symbol || c.code);
          if (!sym) continue;
          state.coursesBySymbol.set(sym, c);
        }
      } else if (coursesRaw && typeof coursesRaw === 'object') {
        for (const [symRaw, c] of Object.entries(coursesRaw)) {
          const sym = normalizeSymbol(symRaw);
          state.coursesBySymbol.set(sym, c);
        }
      }

      // grupy
      state.groups.clear();
      for (const ex of state.exams) {
        const g = ex.group || guessGroupFromSymbol(ex.symbol);
        state.groups.add(g);
      }

      buildGroupSelect(state.groups);
      compute();
      render();

      qEl.addEventListener('input', () => { compute(); render(); });
      groupEl.addEventListener('change', () => { compute(); render(); });
      sortEl.addEventListener('change', () => { compute(); render(); });

    } catch (e) {
      showError(e?.message || 'Nieznany błąd.');
      console.error(e);
    }
  }

  init();
})();
