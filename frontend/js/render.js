function esc(str) {
  if (str === undefined || str === null) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function renderItemList(items, cssClass) {
  if (!items || items.length === 0) return `<li class="${cssClass}">— none listed —</li>`;
  return items
    .map(
      (i) => `<li class="${cssClass}">
        <strong>${esc(i.name)}</strong>
        ${i.note ? `<span class="item-note">${esc(i.note)}</span>` : ""}
        ${i.clinicalNote ? `<span class="item-note">${esc(i.clinicalNote)}</span>` : ""}
        ${i.conditionalNote ? `<span class="item-note">⚠ ${esc(i.conditionalNote)}</span>` : ""}
      </li>`
    )
    .join("");
}

// ---------------- DOCTOR VIEW ----------------

function renderDoctorCard(d) {
  const tabs = ["Ahara", "Vihara", "Nidana", "Dinacharya", "Ritucharya", "References"];

  const nidanaHtml = (d.nidana || [])
    .map((n) => `<li class="pill-list-item">${esc(n.text)}</li>`)
    .join("");

  const dinacharyaHtml = (d.dinacharya || [])
    .map(
      (s) => `<li><strong>${esc(s.timeOfDay)}:</strong> ${esc(s.activity)}
        ${s.clinicalNote ? `<span class="item-note">${esc(s.clinicalNote)}</span>` : ""}</li>`
    )
    .join("");

  const ritucharyaHtml = (d.ritucharya || [])
    .map(
      (r) => `<li><strong>${esc(r.season)}${r.season === d.currentSeason ? " (current)" : ""}:</strong> ${esc(r.modification)}</li>`
    )
    .join("");

  const citationsHtml = (d.citations || [])
    .map(
      (c) => `<div class="citation">
        <strong>${esc(c.granth)}</strong> — ${esc(c.sthana)} ${esc(c.adhyaya)} (${esc(c.shlokaNumber)})<br/>
        ${esc(c.translation)}
      </div>`
    )
    .join("");

  const precautionsHtml = (d.precautions || [])
    .map((p) => `<div class="precaution-banner">⚠ ${esc(p)}</div>`)
    .join("");

  return `
    <div class="card">
      <span class="season-badge">Current Ritu: ${esc(d.currentSeason)}</span>
      <h2>${esc(d.sanskritName)} ${d.transliteration ? `(${esc(d.transliteration)})` : ""}</h2>
      <div>Dosha: ${(d.doshaInvolvement || []).map(esc).join(", ")} · ${esc(d.category || "")}</div>

      ${precautionsHtml}

      <div class="tabs" id="doctorTabs">
        ${tabs.map((t, i) => `<button data-tab="${t}" class="${i === 0 ? "active" : ""}">${t}</button>`).join("")}
      </div>

      <div class="tab-panel active" data-panel="Ahara">
        <div class="grid-two">
          <div>
            <div class="section-title">Pathya Ahara</div>
            <ul class="pill-list">${renderItemList(d.pathyaAhara, "pathya-item")}</ul>
          </div>
          <div>
            <div class="section-title">Apathya Ahara</div>
            <ul class="pill-list">${renderItemList(d.apathyaAhara, "apathya-item")}</ul>
          </div>
        </div>
      </div>

      <div class="tab-panel" data-panel="Vihara">
        <div class="grid-two">
          <div>
            <div class="section-title">Pathya Vihara</div>
            <ul class="pill-list">${renderItemList(d.pathyaVihara, "pathya-item")}</ul>
          </div>
          <div>
            <div class="section-title">Apathya Vihara</div>
            <ul class="pill-list">${renderItemList(d.apathyaVihara, "apathya-item")}</ul>
          </div>
        </div>
      </div>

      <div class="tab-panel" data-panel="Nidana">
        <div class="section-title">Nidana to avoid</div>
        <ul class="pill-list">${nidanaHtml || "<li>—</li>"}</ul>
      </div>

      <div class="tab-panel" data-panel="Dinacharya">
        <div class="section-title">Dinacharya advice</div>
        <ul class="pill-list">${dinacharyaHtml || "<li>—</li>"}</ul>
      </div>

      <div class="tab-panel" data-panel="Ritucharya">
        <div class="section-title">Ritucharya modifications</div>
        <ul class="pill-list">${ritucharyaHtml || "<li>—</li>"}</ul>
      </div>

      <div class="tab-panel" data-panel="References">
        <div class="section-title">Classical References</div>
        ${citationsHtml || "<div>No citations recorded.</div>"}
      </div>

      <div class="share-bar">
        <button onclick="switchMode('patient')">👁 Preview Patient Version</button>
      </div>
    </div>
  `;
}

// ---------------- PATIENT VIEW ----------------

function renderPatientCard(d) {
  const precautionsHtml = (d.precautions || [])
    .map((p) => `<div class="precaution-banner">⚠ ${esc(p)}</div>`)
    .join("");

  const educationHtml = (d.education || [])
    .map((e) => `<li class="pill-list-item">${esc(e.text)}</li>`)
    .join("");

  const ritucharyaHtml = (d.ritucharya || [])
    .map((r) => `<li>${esc(r.note)}</li>`)
    .join("");

  const dinacharyaHtml = (d.dinacharya || [])
    .map((s) => `<li><strong>${esc(s.timeOfDay)}:</strong> ${esc(s.activity)}</li>`)
    .join("");

  const nidanaHtml = (d.nidana || []).map((n) => `<li>${esc(n)}</li>`).join("");

  return `
    <div class="card">
      <span class="season-badge">This season (${esc(d.currentSeason)})</span>
      <h2>${esc(d.name)}</h2>

      ${precautionsHtml}

      <div class="section-title">✅ Foods to eat</div>
      <ul class="pill-list">${renderItemList(d.pathyaAhara, "pathya-item")}</ul>

      <div class="section-title">🚫 Foods to avoid</div>
      <ul class="pill-list">${renderItemList(d.apathyaAhara, "apathya-item")}</ul>

      <div class="section-title">✅ Lifestyle habits to follow</div>
      <ul class="pill-list">${renderItemList(d.pathyaVihara, "pathya-item")}</ul>

      <div class="section-title">🚫 Lifestyle habits to avoid</div>
      <ul class="pill-list">${renderItemList(d.apathyaVihara, "apathya-item")}</ul>

      <div class="section-title">🕐 Your daily routine</div>
      <ul class="pill-list">${dinacharyaHtml || "<li>—</li>"}</ul>

      <div class="section-title">🍃 Seasonal tips (right now)</div>
      <ul class="pill-list">${ritucharyaHtml || "<li>No specific tip for this season.</li>"}</ul>

      <div class="section-title">❗ What tends to trigger this</div>
      <ul class="pill-list">${nidanaHtml || "<li>—</li>"}</ul>

      <div class="section-title">💡 Good to know</div>
      <ul class="pill-list">${educationHtml || "<li>—</li>"}</ul>

      <div class="share-bar">
        <button onclick="window.print()">🖨 Print / Save as PDF</button>
      </div>
    </div>
  `;
}
