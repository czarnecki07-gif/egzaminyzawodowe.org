/* app.js — egzaminyzawodowe.org
   Działa od razu z:
   - exams.json
   - courses.json
   oraz z index.html, który ma elementy:
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

  if (!gridEl || !qEl || !groupEl || !sortEl || !countEl) {
    console.warn('Brakuje wymaganych elementów w index.html (#q, #group, #sort, #count, #grid).');
    return;
  }

  const state = {
    exams: [],
    courses: [],
    courseByExam: new Map(),
    groups: new Set(),
    filtered: []
  };

  function safe(s) {
    return (s ?? '').toString().trim();
  }

  function norm(s) {
    return safe(s).toLowerCase();
  }

  function escapeHtml(str) {
    return safe(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function pln(n) {
    // n może być liczbą albo stringiem
    const v = typeof n === 'number' ? n : Number(String(n).replace(',', '.'));
    if (!Number.isFinite(v)) return '';
    return `${v.toFixed(0)} PLN`;
  }

  async function loadJson(path) {
    const res = await fetch(path, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Nie mogę pobrać ${path} (HTTP ${res.status})`);
    return await res.json();
  }

  function guessGroupFromCode(code) {
    // INF.03 -> INF
    const c = safe(code).toUpperCase();
    const m = c.match(/^([A-Z]{2,4})\./);
    return m ? m[1] : 'INNE';
  }

  function buildGroupSelect(groups) {
    // zachowaj "Wszystkie branże"
    const current = groupEl.value || 'all';
    groupEl.innerHTML = `<option value="all">Wszystkie branże</option>`;

    [...groups]
      .sort((a, b) => a.localeCompare(b, 'pl'))
      .forEach((g) => {
        const opt = document.createElement('option');
        opt.value = g;
        opt.textContent = g;
        groupEl.appendChild(opt);
      });

    // przywróć wybraną wartość jeśli nadal istnieje
    if ([...groupEl.options].some(o => o.value === current)) groupEl.value = current;
  }

  function compute() {
    const q = norm(qEl.value);
    const selectedGroup = safe(groupEl.value);

    let out = state.exams.slice();

    // filtr grupy (branży)
    if (selectedGroup !== 'all') {
      out = out.filter(e => guessGroupFromCode(e.code) === selectedGroup);
    }

    // wyszukiwarka po kodzie/nazwie
    if (q) {
      out = out.filter(e => {
        const code = norm(e.code);
        const name = norm(e.name);
        return code.includes(q) || name.includes(q);
      });
    }

    // sort
    const sortBy = safe(sortEl.value);
    out.sort((a, b) => {
      if (sortBy === 'name') {
        return safe(a.name).localeCompare(safe(b.name), 'pl', { sensitivity: 'base' });
      }
      return safe(a.code).localeCompare(safe(b.code), 'pl', { sensitivity: 'base' });
    });

    state.filtered = out;
  }

  function render() {
    const items = state.filtered;
    countEl.textContent = String(items.length);

    // render grid
    gridEl.innerHTML = '';

    const frag = document.createDocumentFragment();

    for (const ex of items) {
      const code = safe(ex.code).toUpperCase();
      const name = safe(ex.name);
      const group = guessGroupFromCode(code);

      const course = state.courseByExam.get(code);
      // Jeśli nie ma kursu — prowadź do strony egzaminu (pod SEO), a tam możesz pokazać "wkrótce"
      const href = course?.payment_url
        ? course.payment_url
        : `egzamin.html?code=${encodeURIComponent(code)}`;

      const priceText = course?.price_pln != null ? pln(course.price_pln) : '';
      const cta = course?.payment_url ? 'Kup kurs' : 'Zobacz';

      const a = document.createElement('a');
      a.className = 'btn-card';
      a.href = href;

      // jeśli to płatność — nofollow
      if (course?.payment_url) a.setAttribute('rel', 'nofollow');

      a.innerHTML = `
        <div class="btn-card-top">
          <span class="badge">${escapeHtml(group)}</span>
          ${priceText ? `<span class="price">${escapeHtml(priceText)}</span>` : `<span class="price muted">—</span>`}
        </div>
        <div class="btn-card-code">${escapeHtml(code)}</div>
        <div class="btn-card-name">${escapeHtml(name)}</div>
        <div class="btn-card-cta">${escapeHtml(cta)} →</div>
      `;

      frag.appendChild(a);
    }

    gridEl.appendChild(frag);
  }

  function showError(msg) {
    gridEl.innerHTML = `
      <div class="note">
        <strong>Błąd:</strong> ${escapeHtml(msg)}
        <div class="muted" style="margin-top:8px;">Sprawdź czy w repo są pliki <code>exams.json</code> i <code>courses.json</code> obok <code>index.html</code>.</div>
      </div>
    `;
  }

  async function init() {
    try {
      const [exams, courses] = await Promise.all([
        loadJson('./exams.json'),
        loadJson('./courses.json'),
      ]);

      state.exams = Array.isArray(exams) ? exams : [];
      state.courses = Array.isArray(courses) ? courses : [];

      // map kursów i grupy
      state.courseByExam.clear();
      state.groups.clear();

      for (const ex of state.exams) {
        state.groups.add(guessGroupFromCode(ex.code));
      }

      for (const c of state.courses) {
        const code = safe(c.exam_code).toUpperCase();
        if (code) state.courseByExam.set(code, c);
      }

      buildGroupSelect(state.groups);
      compute();
      render();

      // events
      qEl.addEventListener('input', () => { compute(); render(); });
      groupEl.addEventListener('change', () => { compute(); render(); });
      sortEl.addEventListener('change', () => { compute(); render(); });

    } catch (e) {
      showError(e?.message || 'Nieznany błąd.');
    }
  }

  init();
})();
