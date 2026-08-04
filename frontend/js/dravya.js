// Dravya module: doctor-only. Reuses the SAME login session (localStorage
// keys) as admin.js, so being logged into the Admin panel already logs you
// into this page too. Talks only to /api/dravya/* — never touches
// /api/diseases or /api/admin/diseases, so the existing module is
// completely unaffected by anything here.

const TOKEN_STORAGE = "pathya_admin_token";
const EMAIL_STORAGE = "pathya_admin_email";
const ROLE_STORAGE = "pathya_admin_role";

let allTags = { rasa: [], guna: [], dosha: [], indication: [] };
let allDravyas = [];
let editingId = null;
let currentRole = null;

// ---------------------------------------------------------------- helpers

function esc(str) {
  if (str === undefined || str === null) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function getToken() {
  return localStorage.getItem(TOKEN_STORAGE) || "";
}

async function dravyaFetch(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}/dravya${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${getToken()}`, ...(options.headers || {}) },
  });
  if (res.status === 401) {
    clearSession();
    showLoginGate("Session expired or invalid. Please sign in again.");
    throw new Error("Unauthorized");
  }
  return res;
}

function clearSession() {
  localStorage.removeItem(TOKEN_STORAGE);
  localStorage.removeItem(EMAIL_STORAGE);
  localStorage.removeItem(ROLE_STORAGE);
  currentRole = null;
}

// ---------------------------------------------------------------- login / session

function showLoginGate(message) {
  document.getElementById("loginGate").style.display = "block";
  document.getElementById("dravyaContent").style.display = "none";
  document.getElementById("logoutBtn").style.display = "none";
  document.getElementById("roleBadge").style.display = "none";
  document.getElementById("loginError").textContent = message || "";
}

function applyRoleVisibility(role) {
  const isAdmin = role === "admin";
  document.querySelectorAll(".admin-only-section").forEach((el) => {
    el.dataset.hidden = isAdmin ? "false" : "true";
  });
}

async function showDravyaContent(email, role) {
  currentRole = role;
  document.getElementById("loginGate").style.display = "none";
  document.getElementById("dravyaContent").style.display = "block";
  document.getElementById("logoutBtn").style.display = "inline-block";
  const badge = document.getElementById("roleBadge");
  badge.textContent = `${email} · ${role}`;
  badge.style.display = "inline-block";
  applyRoleVisibility(role);

  await loadTags();
  await loadDravyaList();
}

async function trySession() {
  const token = getToken();
  const email = localStorage.getItem(EMAIL_STORAGE);
  const role = localStorage.getItem(ROLE_STORAGE);
  if (!token || !email || !role) {
    showLoginGate();
    return;
  }
  try {
    const res = await dravyaFetch("/tags");
    if (!res.ok) throw new Error("Session check failed");
    await showDravyaContent(email, role);
  } catch (err) {
    // dravyaFetch already cleared session + showed login gate on 401
  }
}

document.getElementById("loginBtn").addEventListener("click", async () => {
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const errorBox = document.getElementById("loginError");
  errorBox.textContent = "";

  if (!email || !password) {
    errorBox.textContent = "Enter both email and password.";
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/admin/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      errorBox.textContent = data.error || "Sign-in failed.";
      return;
    }

    localStorage.setItem(TOKEN_STORAGE, data.token);
    localStorage.setItem(EMAIL_STORAGE, data.email);
    localStorage.setItem(ROLE_STORAGE, data.role);

    document.getElementById("loginPassword").value = "";
    await showDravyaContent(data.email, data.role);
  } catch (err) {
    errorBox.textContent = "Could not reach the server: " + err.message;
  }
});

document.getElementById("loginPassword").addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("loginBtn").click();
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  clearSession();
  showLoginGate("");
});

// ---------------------------------------------------------------- tabs

document.querySelectorAll(".dravya-tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".dravya-tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".dravya-tab-panel").forEach((p) => (p.style.display = "none"));
    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`).style.display = "block";
  });
});

// ---------------------------------------------------------------- tags (growing checkbox lists)

const CATEGORIES = ["rasa", "guna", "dosha", "indication"];

async function loadTags() {
  const res = await dravyaFetch("/tags");
  allTags = await res.json();
  CATEGORIES.forEach((cat) => renderCheckboxGroup(cat, []));
  populateIndicationSelects();
}

function renderCheckboxGroup(category, checkedValues) {
  const wrap = document.getElementById(`checkboxes-${category}`);
  const options = allTags[category] || [];
  wrap.innerHTML =
    options
      .map(
        (val) => `
      <label>
        <input type="checkbox" value="${esc(val)}" ${checkedValues.includes(val) ? "checked" : ""} />
        ${esc(val)}
      </label>`
      )
      .join("") || `<span class="muted">No options yet — add the first one below.</span>`;
}

function getCheckedValues(category) {
  const wrap = document.getElementById(`checkboxes-${category}`);
  return [...wrap.querySelectorAll('input[type="checkbox"]:checked')].map((cb) => cb.value);
}

document.querySelectorAll(".add-checkbox-btn").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const category = btn.dataset.category;
    const input = document.querySelector(`.new-checkbox-input[data-category="${category}"]`);
    const value = input.value.trim();
    if (!value) return;

    // Preserve what's currently checked so adding a new option doesn't
    // uncheck everything else already selected on this entry.
    const currentlyChecked = getCheckedValues(category);

    try {
      const res = await dravyaFetch("/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, value }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Could not add that checkbox.");
        return;
      }
      const tagsRes = await dravyaFetch("/tags");
      allTags = await tagsRes.json();
      // New option arrives checked, since the editor clearly wants it for
      // the entry they're currently filling in.
      renderCheckboxGroup(category, [...currentlyChecked, value]);
      populateIndicationSelects();
      input.value = "";
    } catch (err) {
      // dravyaFetch already handles 401
    }
  });
});

function populateIndicationSelects() {
  const options =
    `<option value="">— choose an indication —</option>` +
    (allTags.indication || []).map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join("");
  const browseSel = document.getElementById("browseIndicationSelect");
  const diagSel = document.getElementById("diagnosisIndicationSelect");
  const browsePrev = browseSel.value;
  const diagPrev = diagSel.value;
  browseSel.innerHTML = options;
  diagSel.innerHTML = options.replace("choose an indication", "choose a diagnosis");
  browseSel.value = browsePrev;
  diagSel.value = diagPrev;
}

// ---------------------------------------------------------------- Dravya list

async function loadDravyaList() {
  const res = await dravyaFetch("/");
  allDravyas = await res.json();
  renderDravyaTable();
  refreshAnalyzerDravyaOptions();
}

function renderDravyaTable() {
  const filter = (document.getElementById("dravyaListFilter").value || "").toLowerCase();
  const rows = allDravyas
    .filter((d) => d.name.toLowerCase().includes(filter))
    .map(
      (d) => `
      <tr>
        <td>${esc(d.name)}${d.commonName ? ` <span class="muted">(${esc(d.commonName)})</span>` : ""}</td>
        <td>${(d.rasa || []).map((v) => `<span class="tag-pill">${esc(v)}</span>`).join("")}</td>
        <td>${(d.guna || []).map((v) => `<span class="tag-pill">${esc(v)}</span>`).join("")}</td>
        <td>${(d.dosha || []).map((v) => `<span class="tag-pill">${esc(v)}</span>`).join("")}</td>
        <td>${(d.indications || []).map((v) => `<span class="tag-pill">${esc(v)}</span>`).join("")}</td>
        <td class="row-actions">
          <button data-action="edit" data-id="${d._id}">Edit</button>
          <button data-action="delete" data-id="${d._id}" class="danger">Delete</button>
        </td>
      </tr>`
    )
    .join("");
  document.getElementById("dravyaListBody").innerHTML =
    rows || `<tr><td colspan="6" class="muted">No Dravya entries yet.</td></tr>`;
}

document.getElementById("dravyaListFilter").addEventListener("input", renderDravyaTable);

document.getElementById("dravyaListBody").addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const id = btn.dataset.id;
  const dravya = allDravyas.find((d) => d._id === id);

  if (btn.dataset.action === "edit") {
    openDravyaEditor(dravya);
  } else if (btn.dataset.action === "delete") {
    if (!confirm(`Delete "${dravya.name}"? This can't be undone.`)) return;
    try {
      const res = await dravyaFetch(`/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Delete failed.");
        return;
      }
      await loadDravyaList();
    } catch (err) {
      // dravyaFetch already handles 401
    }
  }
});

// ---------------------------------------------------------------- bulk excel import/export (admin only)

async function downloadDravyaFile(path, filename) {
  const res = await dravyaFetch(path);
  if (!res.ok) {
    alert("Download failed.");
    return;
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

document.getElementById("downloadDravyaTemplateBtn").addEventListener("click", () =>
  downloadDravyaFile("/template", "dravya-import-template.xlsx")
);

document.getElementById("downloadDravyaExportBtn").addEventListener("click", () =>
  downloadDravyaFile("/export", "dravya-export.xlsx")
);

document.getElementById("uploadDravyaExcelBtn").addEventListener("click", async () => {
  const fileInput = document.getElementById("dravyaExcelFileInput");
  const resultBox = document.getElementById("dravyaImportResult");
  if (!fileInput.files.length) {
    resultBox.innerHTML = `<div class="error-text">Choose a .xlsx file first.</div>`;
    return;
  }

  const formData = new FormData();
  formData.append("file", fileInput.files[0]);

  resultBox.innerHTML = `<div class="muted">Uploading and processing…</div>`;

  try {
    const res = await dravyaFetch("/import", { method: "POST", body: formData });
    const data = await res.json();

    if (!res.ok) {
      resultBox.innerHTML = `<div class="error-text">${esc(data.error || "Import failed.")}</div>`;
      return;
    }

    const errHtml = (data.errors || [])
      .map((e) => `<div>Row ${e.row} (name: ${esc(e.name)}): ${esc(e.message)}</div>`)
      .join("");

    resultBox.innerHTML = `
      <div class="import-summary">
        Processed ${data.totalRows} row(s) — <strong>${data.created} created</strong>,
        <strong>${data.updated} overwritten</strong>${data.errors.length ? `, <strong>${data.errors.length} failed</strong>` : ""}.
        ${errHtml ? `<div class="err-list">${errHtml}</div>` : ""}
      </div>`;

    fileInput.value = "";
    await loadTags();
    await loadDravyaList();
  } catch (err) {
    resultBox.innerHTML = `<div class="error-text">Upload failed: ${esc(err.message)}</div>`;
  }
});

// ---------------------------------------------------------------- Dravya editor form

function openDravyaEditor(dravya) {
  editingId = dravya ? dravya._id : null;
  document.getElementById("dravyaEditorTitle").textContent = dravya ? `Edit: ${dravya.name}` : "New Dravya";
  document.getElementById("dravyaEditorSection").style.display = "block";
  document.getElementById("dravyaEditorSection").scrollIntoView({ behavior: "smooth" });

  const form = document.getElementById("dravyaForm");
  form.reset();
  form.name.value = dravya ? dravya.name || "" : "";
  form.commonName.value = dravya ? dravya.commonName || "" : "";
  form.notes.value = dravya ? dravya.notes || "" : "";

  renderCheckboxGroup("rasa", dravya ? dravya.rasa || [] : []);
  renderCheckboxGroup("guna", dravya ? dravya.guna || [] : []);
  renderCheckboxGroup("dosha", dravya ? dravya.dosha || [] : []);
  renderCheckboxGroup("indication", dravya ? dravya.indications || [] : []);
}

function closeDravyaEditor() {
  document.getElementById("dravyaEditorSection").style.display = "none";
  editingId = null;
}

document.getElementById("newDravyaBtn").addEventListener("click", () => openDravyaEditor(null));
document.getElementById("closeDravyaEditorBtn").addEventListener("click", closeDravyaEditor);
document.getElementById("cancelDravyaEditBtn").addEventListener("click", closeDravyaEditor);

document.getElementById("dravyaForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const errorBox = document.getElementById("dravyaEditorError");
  errorBox.textContent = "";

  const payload = {
    name: form.name.value.trim(),
    commonName: form.commonName.value.trim() || undefined,
    notes: form.notes.value.trim() || undefined,
    rasa: getCheckedValues("rasa"),
    guna: getCheckedValues("guna"),
    dosha: getCheckedValues("dosha"),
    indications: getCheckedValues("indication"),
  };

  if (!payload.name) {
    errorBox.textContent = "Name is required.";
    return;
  }

  try {
    const res = editingId
      ? await dravyaFetch(`/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await dravyaFetch(`/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

    const data = await res.json();
    if (!res.ok) {
      errorBox.textContent = data.error || "Something went wrong saving this Dravya.";
      return;
    }

    closeDravyaEditor();
    await loadDravyaList();
  } catch (err) {
    errorBox.textContent = "Request failed: " + err.message;
  }
});

// ---------------------------------------------------------------- browse by indication

document.getElementById("browseIndicationSelect").addEventListener("change", async (e) => {
  const tag = e.target.value;
  const resultBox = document.getElementById("browseResults");
  if (!tag) {
    resultBox.innerHTML = "";
    return;
  }
  resultBox.innerHTML = `<p class="muted">Loading…</p>`;
  try {
    const [listRes, profileRes] = await Promise.all([
      dravyaFetch(`/by-indication/${encodeURIComponent(tag)}`),
      dravyaFetch(`/quality-profile/${encodeURIComponent(tag)}`),
    ]);
    const list = await listRes.json();
    const profile = await profileRes.json();

    const listHtml = list.length
      ? `<table class="admin-table"><thead><tr><th>Name</th><th>Rasa</th><th>Guna</th><th>Dosha</th></tr></thead><tbody>${list
          .map(
            (d) => `<tr>
              <td>${esc(d.name)}</td>
              <td>${(d.rasa || []).map((v) => `<span class="tag-pill">${esc(v)}</span>`).join("")}</td>
              <td>${(d.guna || []).map((v) => `<span class="tag-pill">${esc(v)}</span>`).join("")}</td>
              <td>${(d.dosha || []).map((v) => `<span class="tag-pill">${esc(v)}</span>`).join("")}</td>
            </tr>`
          )
          .join("")}</tbody></table>`
      : `<p class="muted">No Dravyas checked for "${esc(tag)}" yet.</p>`;

    resultBox.innerHTML = `
      <h3>${list.length} Dravya(s) indicated for "${esc(tag)}"</h3>
      ${listHtml}
      <h3 style="margin-top:18px;">Quality profile (derived from these entries)</h3>
      ${renderTallyHtml(profile.tally)}
    `;
  } catch (err) {
    // dravyaFetch already handles 401
  }
});

// ---------------------------------------------------------------- habit analyzer

function refreshAnalyzerDravyaOptions() {
  document.querySelectorAll(".analyzer-row select.dravya-select").forEach((sel) => {
    const prev = sel.value;
    sel.innerHTML =
      `<option value="">— choose a Dravya —</option>` +
      allDravyas.map((d) => `<option value="${d._id}">${esc(d.name)}</option>`).join("");
    sel.value = prev;
  });
}

function addAnalyzerRow() {
  const wrap = document.getElementById("analyzerRows");
  const row = document.createElement("div");
  row.className = "analyzer-row";
  row.innerHTML = `
    <select class="dravya-select">
      <option value="">— choose a Dravya —</option>
      ${allDravyas.map((d) => `<option value="${d._id}">${esc(d.name)}</option>`).join("")}
    </select>
    <select class="freq-select">
      <option value="">Frequency (optional)</option>
      <option value="occasional">Occasional</option>
      <option value="weekly">Weekly</option>
      <option value="daily">Daily</option>
    </select>
    <button type="button" class="link-btn remove-row-btn" style="color:#b00;">✕ Remove</button>
  `;
  row.querySelector(".remove-row-btn").addEventListener("click", () => row.remove());
  wrap.appendChild(row);
}

document.getElementById("addAnalyzerRowBtn").addEventListener("click", addAnalyzerRow);

function renderTallyHtml(tally) {
  const groups = ["rasa", "guna", "dosha"];
  const labels = { rasa: "Rasa", guna: "Guna", dosha: "Dosha" };
  let html = "";
  groups.forEach((g) => {
    const entries = Object.entries(tally[g] || {}).sort((a, b) => b[1] - a[1]);
    html += `<div class="tally-group-title">${labels[g]}</div>`;
    html += entries.length
      ? `<table class="tally-table"><tbody>${entries
          .map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v}</td></tr>`)
          .join("")}</tbody></table>`
      : `<p class="muted">None recorded.</p>`;
  });
  return html;
}

document.getElementById("runAnalyzerBtn").addEventListener("click", async () => {
  const resultBox = document.getElementById("analyzerResult");
  const rows = [...document.querySelectorAll("#analyzerRows .analyzer-row")];
  const items = rows
    .map((row) => ({
      dravyaId: row.querySelector(".dravya-select").value,
      frequency: row.querySelector(".freq-select").value || null,
    }))
    .filter((i) => i.dravyaId);

  if (!items.length) {
    resultBox.innerHTML = `<div class="error-text">Add at least one Dravya first.</div>`;
    return;
  }

  try {
    const res = await dravyaFetch("/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    const data = await res.json();
    if (!res.ok) {
      resultBox.innerHTML = `<div class="error-text">${esc(data.error || "Analysis failed.")}</div>`;
      return;
    }
    resultBox.innerHTML = `
      <h3>Weighted quality tally</h3>
      <p class="muted">Based on: ${data.items
        .map((i) => `${esc(i.name)}${i.frequency ? ` (${esc(i.frequency)})` : ""}`)
        .join(", ")}</p>
      ${renderTallyHtml(data.tally)}
    `;
  } catch (err) {
    // dravyaFetch already handles 401
  }
});

// ---------------------------------------------------------------- what's good for a diagnosis

document.getElementById("diagnosisIndicationSelect").addEventListener("change", async (e) => {
  const tag = e.target.value;
  const resultBox = document.getElementById("diagnosisResult");
  if (!tag) {
    resultBox.innerHTML = "";
    return;
  }
  resultBox.innerHTML = `<p class="muted">Loading…</p>`;
  try {
    const res = await dravyaFetch(`/quality-profile/${encodeURIComponent(tag)}`);
    const profile = await res.json();
    resultBox.innerHTML = `
      <p class="muted">Derived from ${profile.dravyaCount} Dravya(s) checked for "${esc(tag)}".</p>
      ${renderTallyHtml(profile.tally)}
    `;
  } catch (err) {
    // dravyaFetch already handles 401
  }
});

// ---------------------------------------------------------------- boot

(function init() {
  trySession();
  addAnalyzerRow(); // start with one row so the analyzer isn't empty
})();
