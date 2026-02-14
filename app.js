(async function () {
  const grid = document.getElementById("grid");
  const q = document.getElementById("q");
  const groupSel = document.getElementById("group");
  const sortSel = document.getElementById("sort");
  const count = document.getElementById("count");
  document.getElementById("year").textContent = new Date().getFullYear();

  const [exams, courses] = await Promise.all([
    fetch("exams.json").then(r => r.json()),
    fetch("courses.json").then(r => r.json())
  ]);

  // zbuduj listę grup
  const groups = new Set();
  for (const e of exams) {
    const g = courses?.[e.symbol]?.group;
    if (g) groups.add(g);
  }
  [...groups].sort().forEach(g => {
    const opt = document.createElement("option");
    opt.value = g;
    opt.textContent = g;
    groupSel.appendChild(opt);
  });

  function normalize(s){ return (s||"").toLowerCase().trim(); }

  function render(){
    const query = normalize(q.value);
    const group = groupSel.value;
    const sort = sortSel.value;

    let list = exams.slice();

    // filtr: wyszukiwanie
    if (query) {
      list = list.filter(e =>
        normalize(e.symbol).includes(query) ||
        normalize(e.name).includes(query)
      );
    }

    // filtr: grupa
    if (group !== "all") {
      list = list.filter(e => (courses?.[e.symbol]?.group || "") === group);
    }

    // sort
    list.sort((a,b) => {
      if (sort === "name") return a.name.localeCompare(b.name, "pl");
      return a.symbol.localeCompare(b.symbol, "pl");
    });

    count.textContent = `${list.length} kwalifikacji`;

    grid.innerHTML = "";
    for (const e of list) {
      const cfg = courses?.[e.symbol];
      const payUrl = cfg?.payUrl;

      const card = document.createElement("div");
      card.className = "card";

      const btn = document.createElement("button");
      btn.className = "btn";
      btn.type = "button";

      btn.innerHTML = `
        <div>
          <div class="symbol">${e.symbol}</div>
          <div class="name">${e.name}</div>
          <div class="meta">${cfg?.group ? `Branża: ${cfg.group}` : "Branża: —"} • Płatność: ${payUrl ? "dostępna" : "brak"}</div>
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

  q.addEventListener("input", render);
  groupSel.addEventListener("change", render);
  sortSel.addEventListener("change", render);
  render();
})();
