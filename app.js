/* app.js — egzaminyzawodowe.org
   Działa z:
   - exams.json: lista obiektów, gdzie symbol/nazwa mogą mieć różne klucze (symbol/Symbol/code/Kod itd.)
   - courses.json: object mapa (klucz=symbol) lub lista
   Wymaga w HTML: #q, #group, #sort, #count, #grid
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

  function normalizeSymbol(sym) {
    return safe(sym).toUpperCase();
  }

  function getAny(obj, candidates) {
    if (!obj || typeof obj !== 'object') return '';
    // 1) dokładne trafienie
    for (const k of candidates) {
      if (k in obj && safe(obj[k])) return safe(obj[k]);
    }
    // 2) case-insensitive
    const lowerMap = new Map(Object.keys(obj).map(k => [k.toLowerCase(), k]));
    for (const k of candidates) {
      const real = lowerMap.get(k.toLowerCase());
      if (real && safe(obj[real])) return safe(obj[real]);
    }
    return '';
  }

  function guessGroupFromSymbol(symbol) {
    const s = normalizeSymbol(symbol);
    // INF.02 -> INF
    let m = s.match(/^([A-Z]{2,6})\./);
    if (m) return m[1];
    // gdy nie ma kropki: INF02 -> INF
    m = s.match(/^([A-Z]{2,6})/);
    if (m) return m[1];
    return 'INNE';
  }

  async function loadJson(path) {
    const res = await fetch(path, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Nie mogę pobrać ${path} (HTTP ${res.status})`);
    return await res.json();
  }

  const state = {
    exams: [],
    coursesBySymbol: new Map(),
    groups: new Set(),
    filtered: [],
  };

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
      out = out.filter((e) => (e.group || guessGroupFromSymbol(e.symbol)) === selectedGroup);
    }

    if (q) {
      out = out.filter((e) => norm(e.symbol).includes(q) || norm(e.name).includes(q));
    }

    const sortBy = safe(sortEl.value);
    out.sort((a, b) => {
      if (sortBy === 'name') {
        return safe(a.name).localeCompare(safe(b.name), 'pl', { sensitivity: 'base' });
      }
      return safe(a.symbol).localeCompare(safe(b.symbol), 'pl', { sensitivity: 'base' });
    });

    state.filtered = out;
  }

  function render() {
    const items = state.filtered;

    countEl.textContent = String(items.length);
    gridEl.innerHTML = '';

    const frag = document.createDocumentFragment();

    for (const ex of items) {
      const symbol = normalizeSymbol(ex.symbol);
      const name = safe(ex.name);
      const group = ex.group || guessGroupFromSymbol(symbol);

      const course = state.coursesBySymbol.get(symbol);

      // 1) kurs (gdy już będzie), 2) płatność, 3) fallback pod SEO
      const href =
        course?.courseUrl ||
        course?.course_url ||
        course?.payUrl ||
        course?.payment_url ||
        `egzamin.html?symbol=${encodeURIComponent(symbol)}`;

      const a = document.createElement('a');
      a.className = 'btn-card';
      a.href = href;
      if (course?.payUrl || course?.payment_url) a.setAttribute('rel', 'nofollow');

      a.innerHTML = `
        <div class="btn-card-top">
          <span class="badge">${escapeHtml(group)}</span>
        </div>
        <div class="btn-card-code">${escapeHtml(symbol || '—')}</div>
        <div class="btn-card-name">${escapeHtml(name || '—')}</div>
        <div class="btn-card-cta">Zobacz →</div>
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

      // exams.json może być array albo {exams:[...]}
      const examsArr = Array.isArray(examsRaw) ? examsRaw : (examsRaw?.exams || []);
      state.exams = examsArr.map((e) => {
        const symbol = normalizeSymbol(getAny(e, [
          'symbol', 'Symbol', 'code', 'Code', 'kod', 'Kod', 'kwalifikacja', 'Kwalifikacja'
        ]));
        const name = safe(getAny(e, [
          'name', 'Name', 'nazwa', 'Nazwa', 'title', 'Title', 'opis', 'Opis'
        ]));
        const group = safe(getAny(e, ['group', 'Group', 'branża', 'Branża', 'branza', 'Branza'])) || guessGroupFromSymbol(symbol);
        return { symbol, name, group };
      }).filter(x => x.symbol && x.name);

      // courses.json: object mapa (klucz=symbol) lub lista
      state.coursesBySymbol.clear();
      if (Array.isArray(coursesRaw)) {
        for (const c of coursesRaw) {
          const sym = normalizeSymbol(getAny(c, ['exam_code','symbol','code','kod','kwalifikacja']));
          if (sym) state.coursesBySymbol.set(sym, c);
        }
      } else if (coursesRaw && typeof coursesRaw === 'object') {
        for (const [k, v] of Object.entries(coursesRaw)) {
          const sym = normalizeSymbol(k);
          state.coursesBySymbol.set(sym, v);
        }
      }

      // grupy do selecta
      state.groups.clear();
      for (const ex of state.exams) state.groups.add(ex.group || guessGroupFromSymbol(ex.symbol));

      buildGroupSelect(state.groups);
      compute();
      render();

      qEl.addEventListener('input', () => { compute(); render(); });
      groupEl.addEventListener('change', () => { compute(); render(); });
      sortEl.addEventListener('change', () => { compute(); render(); });

    } catch (e) {
      console.error(e);
      showError(e?.message || 'Nieznany błąd.');
    }
  }

  init();
})();
