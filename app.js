// app.js — działa od razu z plikami: exams.json + courses.json (w tym samym katalogu co index.html)

(async function () {
  const $ = (id) => document.getElementById(id);

  // Wymagane elementy z index.html
  const grid = $("grid");
  const q = $("q");
  const groupSel = $("group");
  const sortSel = $("sort");
  const count = $("count");
  const year = $("year");

  if (year) year.textContent = String(new Date().getFullYear());

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalize(s) {
    return (s || "").toString().toLowerCase().trim();
  }

  async function fetchJson(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Nie udało się pobrać ${url} (HTTP ${res.status})`);
    return res.json();
  }

  // Wczytanie danych
  let exams = [];
  let courses = {};

  try {
    [exams, courses] = await Promise.all([
      fetchJson("exams.json"),
      fetchJson("courses.json"),
    ]);
  } catch (err) {
    console.error(err);
    if (grid) {
      grid.innerHTML = `
        <div class="card">
          <div class="name">Błąd ładowania danych</div>
          <div class="meta">
            Upewnij się, że pliki <b>exams.json</b> i <b>courses.json</b> są obok <b>index.html</b>
            oraz że strona jest uruchomiona przez serwer (nie jako plik lokalny).
          </div>
        </div>
      `;
    }
    if (count) count.textContent = "0";
    return;
  }

  // Bezpieczne ujednolicenie struktury
  exams = Array.isArray(exams) ? exams : [];
  courses = (courses && typeof courses === "object") ? courses : {};

  // Uzupełnij dropdown grup
  (function buildGroups() {
    if (!groupSel) return;

    const groups = new Set();
    for (const e of exams) {
      const sym = e?.symbol;
      const g = sym && courses[sym] ? courses[sym].group : null;
      if (g) groups.add(String(g));
    }

    // wyczyść poza pierwszą opcją ("all") jeśli ktoś coś dopisał
    while (groupSel.options.length > 1) groupSel.remove(1);

    [...groups].sort((a, b) => a.localeCompare(b, "pl")).forEach((g) => {
      const opt = document.createElement("option");
      opt.value = g;
      opt.textContent = g;
      groupSel.appendChild(opt);
    });
  })();

  function getPayUrl(symbol) {
    const entry = courses[symbol];
    if (!entry) return "";
    const url = entry.payUrl || entry.payURL || entry.url || "";
    return String(url || "").trim();
  }

  function getGroup(symbol) {
    const entry = courses[symbol];
    const g = entry?.group;
    return g ? String(g) : "";
  }

  function render() {
    if (!grid) return;

    const query = normalize(q?.value);
    const group = groupSel?.value || "all";
    const sort = sortSel?.value || "symbol";

    let list = exams
      .filter((e) => e && e.symbol && e.name)
      .map((e) => ({ symbol: String(e.symbol).trim(), name: String(e.name).trim() }));

    // filtr wyszukiwania
    if (query) {
      list = list.filter((e) => {
        return normalize(e.symbol).includes(query) || normalize(e.name).includes(query);
      });
    }

    // filtr grupy
    if (group !== "all") {
      list = list.filter((e) => getGroup(e.symbol) === group);
    }

    // sortowanie
    list.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, "pl");
      return a.symbol.localeCompare(b.symbol, "pl");
    });

    if (count) count.textContent = `${list.length} kwalifikacji`;

    // render kafelków
    grid.innerHTML = "";
    for (const e of list) {
      const payUrl = getPayUrl(e.symbol);
      const g = getGroup(e.symbol);

      const card = document.createElement("div");
      card.className = "card";

      const btn = document.createElement("button");
      btn.className = "btn";
      btn.type = "button";

      btn.innerHTML = `
        <div>
          <div class="symbol">${escapeHtml(e.symbol)}</div>
          <div class="name">${escapeHtml(e.name)}</div>
          <div class="meta">
            ${g ? `Grupa: ${escapeHtml(g)}` : "Grupa: —"}
            • Płatność: ${payUrl ? "dostępna" : "brak"}
          </div>
        </div>
        <div class="right">→</div>
      `;

      btn.addEventListener("click", () => {
        if (!payUrl) {
          alert("Dla tej kwalifikacji nie ma jeszcze podpiętej płatności.");
          return;
        }
        window.location.href = payUrl;
      });

      card.appendChild(btn);
      grid.appendChild(card);
    }
  }

  // Obsługa zdarzeń
  q?.addEventListener("input", render);
  groupSel?.addEventListener("change", render);
  sortSel?.addEventListener("change", render);

  // Start
  render();
})();
