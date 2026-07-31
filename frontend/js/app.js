let currentMode = "doctor"; // 'doctor' | 'patient'
let currentSlug = null;
let searchDebounce = null;

const searchInput = document.getElementById("searchInput");
const suggestionsEl = document.getElementById("suggestions");
const resultArea = document.getElementById("resultArea");
const langSelect = document.getElementById("langSelect");

document.getElementById("modeDoctor").addEventListener("click", () => switchMode("doctor"));
document.getElementById("modePatient").addEventListener("click", () => switchMode("patient"));
langSelect.addEventListener("change", () => currentSlug && loadDisease(currentSlug));

function switchMode(mode) {
  currentMode = mode;
  document.getElementById("modeDoctor").classList.toggle("active", mode === "doctor");
  document.getElementById("modePatient").classList.toggle("active", mode === "patient");
  if (currentSlug) loadDisease(currentSlug);
}

searchInput.addEventListener("input", () => {
  clearTimeout(searchDebounce);
  const q = searchInput.value.trim();
  if (!q) {
    suggestionsEl.innerHTML = "";
    return;
  }
  searchDebounce = setTimeout(async () => {
    try {
      const results = await Api.search(q);
      renderSuggestions(results);
    } catch (e) {
      console.error(e);
    }
  }, 250);
});

function renderSuggestions(results) {
  if (!results.length) {
    suggestionsEl.innerHTML = "";
    return;
  }
  suggestionsEl.innerHTML = results
    .map(
      (r) =>
        `<li data-slug="${r.slug}">${r.sanskritName}${r.commonName && r.commonName.en ? " — " + r.commonName.en : ""}</li>`
    )
    .join("");

  suggestionsEl.querySelectorAll("li").forEach((li) => {
    li.addEventListener("click", () => {
      searchInput.value = li.textContent;
      suggestionsEl.innerHTML = "";
      loadDisease(li.dataset.slug);
    });
  });
}

async function loadDisease(slug) {
  currentSlug = slug;
  resultArea.innerHTML = `<div class="empty-state">Loading...</div>`;
  try {
    const lang = langSelect.value;
    const data = await Api.getDisease(slug, currentMode, lang);
    resultArea.innerHTML = currentMode === "doctor" ? renderDoctorCard(data) : renderPatientCard(data);

    if (currentMode === "doctor") wireDoctorTabs();

    // cache last viewed card for offline access (see service-worker.js)
    try {
      localStorage.setItem(`cached_${slug}_${currentMode}_${lang}`, JSON.stringify(data));
    } catch (e) {
      /* storage full or unavailable, ignore */
    }
  } catch (err) {
    // fall back to any locally cached copy if network fails (offline support)
    const cached = localStorage.getItem(`cached_${slug}_${currentMode}_${langSelect.value}`);
    if (cached) {
      const data = JSON.parse(cached);
      resultArea.innerHTML =
        `<div class="precaution-banner">You're offline — showing last saved version.</div>` +
        (currentMode === "doctor" ? renderDoctorCard(data) : renderPatientCard(data));
      if (currentMode === "doctor") wireDoctorTabs();
    } else {
      resultArea.innerHTML = `<div class="empty-state">Could not load this condition. Check your connection.</div>`;
    }
  }
}

function wireDoctorTabs() {
  const buttons = document.querySelectorAll("#doctorTabs button");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
      document.querySelector(`.tab-panel[data-panel="${btn.dataset.tab}"]`).classList.add("active");
    });
  });
}

// Register service worker for offline/PWA support
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch((e) => console.warn("SW failed", e));
  });
}
