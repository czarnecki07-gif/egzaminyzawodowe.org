/* app.js — egzaminyzawodowe.org
   Wymaga plików obok: exams.json, courses.json
*/

(async () => {
  const $ = (sel) => document.querySelector(sel);

  // Dostosuj te ID jeśli w index.html masz inne
  const listEl = $('#examsList');
  const searchEl = $('#examsSearch');   // input type="search"
  const filterEl = $('#examsFilter');   // select (opcjonalnie)
  const countEl = $('#examsCount');     // (opcjonalnie) span

  if (!listEl) {
    console.warn('Brak #examsList w index.html — nie mam gdzie wyrenderować listy.');
    return;
  }

  async function loadJson(path) {
    const res = await fetch(path, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Nie mogę pobrać ${path} (HTTP ${res.status})`);
    return await res.json();
  }

  function safe(s) {
    return (s ?? '').toString().trim();
  }

  function normalize(s) {
    return safe(s).toLowerCase();
  }

  let exams = [];
  let courses = [];

  try {
    [exams, courses] = await Promise.all([
      loadJson('./exams.json'),
      loadJson('./courses.json'),
    ]);
  } catch (e) {
    listEl.innerHTML = `<div class="note"><strong>Błąd:</strong> ${safe(e.message)}</div>`;
    return;
  }

  // Map kursów po kodzie egzaminu
  const courseByCode = new Map();
  for (const c of courses) {
    const code = safe(c.exam_code).toUpperCase();
    if (code) courseByCode.set(code, c);
  }

  function render(items) {
    listEl.innerHTML = '';

    for (const ex of items) {
      const code = safe(ex.code).toUpperCase();
      const name = safe(ex.name);
      const desc = safe(ex.description);

      const course = courseByCode.get(code);
      const price = course?.price_pln != null ? `${course.price_pln} PLN` : '';
      const badge = course ? 'kurs dostępny' : 'wkrótce';

      const a = document.createElement('a');
      a.className = 'card card-link';
      a.href = `egzamin.html?code=${encodeURIComponent(code)}`;

      a.innerHTML = `
        <div class="card-icon">📘</div>
        <h3>${code} — ${name}</h3>
        <p>${desc || 'Przygotowanie do egzaminu zawodowego.'}</p>
        <div class="meta-row" style="margin-top:10px;">
          <span class="pill">${badge}</span>
          ${price ? `<span class="pill">${price}</span>` : ``}
        </div>
        <span class="card-cta">Otwórz →</span>
      `;

      listEl.appendChild(a);
    }

    if (countEl) countEl.textContent = `${items.length}`;
  }

  function applyFilters() {
    const q = normalize(searchEl?.value);
    const f = normalize(filterEl?.value);

    let out = exams.slice();

    if (q) {
      out = out.filter(e => {
        const code = normalize(e.code);
        const name = normalize(e.name);
        return code.includes(q) || name.includes(q);
      });
    }

    // opcjonalny filtr (np. "tylko z kursem")
    if (f === 'withCourse') {
      out = out.filter(e => courseByCode.has(safe(e.code).toUpperCase()));
    } else if (f === 'withoutCourse') {
      out = out.filter(e => !courseByCode.has(safe(e.code).toUpperCase()));
    }

    render(out);
  }

  // start
  render(exams);

  // events
  searchEl?.addEventListener('input', applyFilters);
  filterEl?.addEventListener('change', applyFilters);
})();
