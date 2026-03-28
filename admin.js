// =========================
// LOGOWANIE
// =========================

const ADMIN_PASSWORD = "Egzaminyzawodowe-2026";

function login() {
  const input = document.getElementById("passwordInput").value;
  const error = document.getElementById("loginError");

  if (input === ADMIN_PASSWORD) {
    document.getElementById("loginBox").classList.add("hidden");
    document.getElementById("adminPanel").classList.remove("hidden");
  } else {
    error.style.display = "block";
  }
}



// =========================
// GENEROWANIE KURSU
// =========================

async function generateCourse() {
  const symbol = document.getElementById("symbol").value.trim();
  const name = document.getElementById("courseName").value.trim();
  const podstawa = document.getElementById("podstawa").value.trim();
  const description = document.getElementById("description").value.trim();

  const lang = document.querySelector("input[name='lang']:checked").value;
  const mode = document.querySelector("input[name='mode']:checked").value;

  if (!symbol || !name || !podstawa) {
    alert("Uzupełnij symbol, nazwę kursu i podstawę programową.");
    return;
  }

  const resultBox = document.getElementById("result");
  const downloadBtn = document.getElementById("downloadBtn");

  resultBox.classList.remove("hidden");
  resultBox.textContent = "Generowanie kursu… proszę czekać.";

  // PROMPT PL
  const promptPL = `
Stwórz kompletny kurs zawodowy w języku polskim.

Nazwa kursu: ${name}
Symbol kwalifikacji: ${symbol}
Opis kursu: ${description}
Podstawa programowa:
${podstawa}

Tryb generowania: ${mode === "fixed" ? "5 modułów × 5 lekcji" : "AI dobiera liczbę modułów i lekcji"}

Struktura JSON:
{
  "symbol": "",
  "name": "",
  "lang": "pl",
  "description": "",
  "modules": [
    {
      "title": "",
      "lessons": [
        {
          "title": "",
          "content": ""
        }
      ]
    }
  ],
  "exam": {
    "questions": [
      {
        "question": "",
        "answers": ["", "", "", ""],
        "correct": 0
      }
    ]
  }
}

Zwróć TYLKO poprawny JSON, bez komentarzy i bez tekstu poza JSON.
  `;

  // PROMPT EN
  const promptEN = `
Create a complete professional training course in English.

Course name: ${name}
Qualification symbol: ${symbol}
Course description: ${description}
Curriculum:
${podstawa}

Generation mode: ${mode === "fixed" ? "5 modules × 5 lessons" : "AI chooses the structure"}

JSON structure:
{
  "symbol": "",
  "name": "",
  "lang": "en",
  "description": "",
  "modules": [
    {
      "title": "",
      "lessons": [
        {
          "title": "",
          "content": ""
        }
      ]
    }
  ],
  "exam": {
    "questions": [
      {
        "question": "",
        "answers": ["", "", "", ""],
        "correct": 0
      }
    ]
  }
}

Return ONLY valid JSON, no comments, no extra text.
  `;

  const finalPrompt = lang === "pl" ? promptPL : promptEN;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer YOUR_OPENAI_API_KEY"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: finalPrompt }],
        temperature: 0.7
      })
    });

    const data = await response.json();
    const jsonText = data.choices[0].message.content;

    // Nazwa pliku kursu
    const fileName = `${symbol}.json`;

    // Podpowiedź do courses-index.json
    const hint = `
---------------------------------------
Dodaj do courses-index.json na stronie:
"${fileName}"
---------------------------------------
`;

    resultBox.textContent = jsonText + "\n\n" + hint;
    downloadBtn.classList.remove("hidden");

    window.generatedJSON = jsonText;
    window.generatedFileName = fileName;

  } catch (err) {
    resultBox.textContent = "Błąd podczas generowania kursu.";
  }
}



// =========================
// POBIERANIE JSON
// =========================

function downloadJSON() {
  const blob = new Blob([window.generatedJSON], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;

  a.download = window.generatedFileName || "kurs.json";

  a.click();
  URL.revokeObjectURL(url);
}
