// Admin panel logic: auth gate, disease list, manual CRUD editor,
// and bulk Excel import/export. Talks to /api/admin/* which requires the
// x-api-key header (checked server-side against ADMIN_API_KEY env var).

const KEY_STORAGE = "pathya_admin_key";
let allDiseases = [];
let editingSlug = null; // null = creating a new disease

// ---------------------------------------------------------------- helpers

function esc(str) {
  if (str === undefined || str === null) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function getKey() {
  return localStorage.getItem(KEY_STORAGE) || "";
}

function authHeaders(extra = {}) {
  return { "x-api-key": getKey(), ...extra };
}

async function adminFetch(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}/admin${path}`, {
    ...options,
    headers: { ...authHeaders(options.headers || {}) },
  });
  if (res.status === 401) {
    localStorage.removeItem(KEY_STORAGE);
    showLoginGate("Session expired or invalid key. Please sign in again.");
    throw new Error("Unauthorized");
  }
  return res;
}

function csvToList(str) {
  return (str || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------- auth gate

function showLoginGate(message) {
  document.getElementById("loginGate").style.display = "block";
  document.getElementById("adminContent").style.display = "none";
  document.getElementById("logoutBtn").style.display = "none";
  document.getElementById("loginError").textContent = message || "";
}

function showAdminContent() {
  document.getElementById("loginGate").style.display = "none";
  document.getElementById("adminContent").style.display = "block";
  document.getElementById("logoutBtn").style.display = "inline-block";
}

async function tryConnect(key) {
  localStorage.setItem(KEY_STORAGE, key);
  try {
    const res = await fetch(`${API_BASE_URL}/admin/diseases`, { headers: authHeaders() });
    if (res.status === 401) {
      localStorage.removeItem(KEY_STORAGE);
      showLoginGate("Invalid API key.");
      return;
    }
    if (!res.ok) {
      showLoginGate("Could not reach the server. Check your connection and try again.");
      return;
    }
    showAdminContent();
    await loadDiseaseList();
  } catch (err) {
    localStorage.removeItem(KEY_STORAGE);
    showLoginGate("Could not reach the server: " + err.message);
  }
}

document.getElementById("connectBtn").addEventListener("click", () => {
  const key = document.getElementById("apiKeyInput").value.trim();
  if (!key) return;
  tryConnect(key);
});

document.getElementById("apiKeyInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("connectBtn").click();
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem(KEY_STORAGE);
  showLoginGate("");
});

// ---------------------------------------------------------------- disease list

async function loadDiseaseList() {
  const res = await adminFetch("/diseases");
  allDiseases = await res.json();
  renderDiseaseList();
}

function renderDiseaseList() {
  const filter = document.getElementById("listFilter").value.trim().toLowerCase();
  const rows = allDiseases
    .filter((d) => {
      if (!filter) return true;
      const en = (d.commonName && d.commonName.en) || "";
      return (
        d.slug.toLowerCase().includes(filter) ||
        d.sanskritName.toLowerCase().includes(filter) ||
        en.toLowerCase().includes(filter)
      );
    })
    .map(
      (d) => `
      <tr>
        <td><strong>${esc(d.sanskritName)}</strong>${d.transliteration ? `<br/><span class="muted">${esc(d.transliteration)}</span>` : ""}</td>
        <td>${esc(d.slug)}</td>
        <td><span class="status-pill ${d.reviewStatus}">${esc(d.reviewStatus)}</span></td>
        <td>${d.updatedAt ? new Date(d.updatedAt).toLocaleDateString() : ""}</td>
        <td class="row-actions">
          <button data-action="edit" data-slug="${esc(d.slug)}">Edit</button>
          ${d.reviewStatus !== "published" ? `<button data-action="publish" data-slug="${esc(d.slug)}">Publish</button>` : ""}
          <button data-action="delete" data-slug="${esc(d.slug)}" class="danger">Delete</button>
        </td>
      </tr>`
    )
    .join("");

  document.getElementById("diseaseListBody").innerHTML =
    rows || `<tr><td colspan="5" class="muted">No diseases yet.</td></tr>`;
}

document.getElementById("listFilter").addEventListener("input", renderDiseaseList);

document.getElementById("diseaseListBody").addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const { action, slug } = btn.dataset;

  if (action === "edit") {
    const res = await adminFetch(`/diseases/${encodeURIComponent(slug)}`);
    const disease = await res.json();
    openEditor(disease);
  }

  if (action === "publish") {
    await adminFetch(`/diseases/${encodeURIComponent(slug)}/publish`, { method: "POST" });
    await loadDiseaseList();
  }

  if (action === "delete") {
    if (!confirm(`Delete "${slug}" permanently? This cannot be undone.`)) return;
    await adminFetch(`/diseases/${encodeURIComponent(slug)}`, { method: "DELETE" });
    await loadDiseaseList();
  }
});

// ---------------------------------------------------------------- repeaters
// Generic repeatable-row builder used for every array field in the schema.
// Each container div has data-fields="a,b,c" and optionally
// data-select-<fieldName>="opt1,opt2,..." to render that field as a <select>.

function repeaterFieldConfig(container) {
  const fields = container.dataset.fields.split(",");
  const dataset = container.dataset;
  // HTML lowercases attribute names, so "data-select-timeOfDay" ends up as
  // dataset.selectTimeofday, not selectTimeOfDay. Match case-insensitively
  // instead of reconstructing camelCase, which would miss multi-cap keys.
  const wanted = fields.map((key) => `select${key}`.toLowerCase());
  return fields.map((key, idx) => {
    const target = wanted[idx];
    const matchedKey = Object.keys(dataset).find((k) => k.toLowerCase() === target);
    return { key, options: matchedKey ? dataset[matchedKey].split(",") : null };
  });
}

function addRepeaterRow(containerId, values = {}) {
  const container = document.getElementById(containerId);
  const fields = repeaterFieldConfig(container);
  const row = document.createElement("div");
  row.className = "repeater-row";

  fields.forEach(({ key, options }) => {
    const wrap = document.createElement("div");
    wrap.className = "field-wrap";
    const label = document.createElement("label");
    label.textContent = key === "value" ? "text" : key.replace(/([A-Z])/g, " $1");
    wrap.appendChild(label);

    let input;
    if (options) {
      input = document.createElement("select");
      options.forEach((opt) => {
        const o = document.createElement("option");
        o.value = opt;
        o.textContent = opt;
        input.appendChild(o);
      });
      if (values[key]) input.value = values[key];
    } else {
      input = document.createElement("input");
      input.type = "text";
      input.value = values[key] || "";
    }
    input.dataset.field = key;
    wrap.appendChild(input);
    row.appendChild(wrap);
  });

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "remove-row-btn";
  removeBtn.textContent = "×";
  removeBtn.title = "Remove";
  removeBtn.addEventListener("click", () => row.remove());
  row.appendChild(removeBtn);

  container.appendChild(row);
}

function readRepeater(containerId, singleField) {
  const container = document.getElementById(containerId);
  const rows = Array.from(container.querySelectorAll(".repeater-row"));
  return rows
    .map((row) => {
      if (singleField) {
        const input = row.querySelector("[data-field]");
        return input.value.trim();
      }
      const obj = {};
      row.querySelectorAll("[data-field]").forEach((input) => {
        const val = input.value.trim();
        if (val) obj[input.dataset.field] = val;
      });
      return obj;
    })
    .filter((v) => (singleField ? v : Object.keys(v).length > 0));
}

document.querySelectorAll(".add-row-btn").forEach((btn) => {
  btn.addEventListener("click", () => addRepeaterRow(btn.dataset.target));
});

function clearRepeater(containerId) {
  document.getElementById(containerId).innerHTML = "";
}

// ---------------------------------------------------------------- editor

const SIMPLE_LIST_REPEATERS = { "rep-precautions": true };
const OBJECT_REPEATERS = [
  "rep-commonName",
  "rep-nidana",
  "rep-pathyaAhara",
  "rep-apathyaAhara",
  "rep-pathyaVihara",
  "rep-apathyaVihara",
  "rep-dinacharya",
  "rep-ritucharya",
  "rep-patientEducation",
  "rep-citations",
];

function resetForm() {
  document.getElementById("diseaseForm").reset();
  [...OBJECT_REPEATERS, "rep-precautions"].forEach(clearRepeater);
  document.getElementById("editorError").textContent = "";
}

function openEditor(disease) {
  resetForm();
  editingSlug = disease ? disease.slug : null;
  document.getElementById("editorTitle").textContent = disease ? `Edit: ${disease.sanskritName}` : "New disease";
  document.getElementById("editorSection").style.display = "block";
  document.getElementById("editorSection").scrollIntoView({ behavior: "smooth" });

  const form = document.getElementById("diseaseForm");

  if (disease) {
    form.slug.value = disease.slug || "";
    form.slug.disabled = true; // slug is the immutable key once created
    form.sanskritName.value = disease.sanskritName || "";
    form.transliteration.value = disease.transliteration || "";
    form.category.value = disease.category || "";
    form.doshaInvolvement.value = (disease.doshaInvolvement || []).join(", ");
    form.synonyms.value = (disease.synonyms || []).join(", ");
    form.reviewStatus.value = disease.reviewStatus || "draft";

    const commonName = disease.commonName instanceof Object ? disease.commonName : {};
    Object.entries(commonName).forEach(([lang, value]) => addRepeaterRow("rep-commonName", { lang, value }));

    (disease.nidana || []).forEach((n) => addRepeaterRow("rep-nidana", n));
    (disease.pathyaAhara || []).forEach((i) => addRepeaterRow("rep-pathyaAhara", i));
    (disease.apathyaAhara || []).forEach((i) => addRepeaterRow("rep-apathyaAhara", i));
    (disease.pathyaVihara || []).forEach((i) => addRepeaterRow("rep-pathyaVihara", i));
    (disease.apathyaVihara || []).forEach((i) => addRepeaterRow("rep-apathyaVihara", i));
    (disease.dinacharya || []).forEach((s) => addRepeaterRow("rep-dinacharya", s));
    (disease.ritucharya || []).forEach((r) => addRepeaterRow("rep-ritucharya", r));
    (disease.precautions || []).forEach((p) => addRepeaterRow("rep-precautions", { value: p }));
    (disease.patientEducation || []).forEach((e) => addRepeaterRow("rep-patientEducation", e));
    (disease.citations || []).forEach((c) => addRepeaterRow("rep-citations", c));
  } else {
    form.slug.disabled = false;
  }
}

document.getElementById("newDiseaseBtn").addEventListener("click", () => openEditor(null));
document.getElementById("closeEditorBtn").addEventListener("click", closeEditor);
document.getElementById("cancelEditBtn").addEventListener("click", closeEditor);

function closeEditor() {
  document.getElementById("editorSection").style.display = "none";
  editingSlug = null;
}

document.getElementById("diseaseForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const errorBox = document.getElementById("editorError");
  errorBox.textContent = "";

  const commonNameRows = readRepeater("rep-commonName");
  const commonName = {};
  commonNameRows.forEach((r) => {
    if (r.lang && r.value) commonName[r.lang.trim()] = r.value;
  });

  const payload = {
    slug: form.slug.value.trim(),
    sanskritName: form.sanskritName.value.trim(),
    transliteration: form.transliteration.value.trim() || undefined,
    category: form.category.value.trim() || undefined,
    doshaInvolvement: csvToList(form.doshaInvolvement.value),
    synonyms: csvToList(form.synonyms.value),
    reviewStatus: form.reviewStatus.value,
    commonName,
    nidana: readRepeater("rep-nidana"),
    pathyaAhara: readRepeater("rep-pathyaAhara"),
    apathyaAhara: readRepeater("rep-apathyaAhara"),
    pathyaVihara: readRepeater("rep-pathyaVihara"),
    apathyaVihara: readRepeater("rep-apathyaVihara"),
    dinacharya: readRepeater("rep-dinacharya"),
    ritucharya: readRepeater("rep-ritucharya"),
    precautions: readRepeater("rep-precautions", true),
    patientEducation: readRepeater("rep-patientEducation"),
    citations: readRepeater("rep-citations"),
  };

  if (!payload.slug || !payload.sanskritName) {
    errorBox.textContent = "Slug and Sanskrit name are required.";
    return;
  }

  try {
    const res = editingSlug
      ? await adminFetch(`/diseases/${encodeURIComponent(editingSlug)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await adminFetch(`/diseases`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

    const data = await res.json();
    if (!res.ok) {
      errorBox.textContent = data.error || "Something went wrong saving this disease.";
      return;
    }

    closeEditor();
    await loadDiseaseList();
  } catch (err) {
    errorBox.textContent = "Request failed: " + err.message;
  }
});

// ---------------------------------------------------------------- excel import/export

async function downloadFile(path, filename) {
  const res = await adminFetch(path);
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

document.getElementById("downloadTemplateBtn").addEventListener("click", () =>
  downloadFile("/diseases/template", "pathya-import-template.xlsx")
);

document.getElementById("downloadExportBtn").addEventListener("click", () =>
  downloadFile("/diseases/export", "pathya-diseases-export.xlsx")
);

document.getElementById("uploadExcelBtn").addEventListener("click", async () => {
  const fileInput = document.getElementById("excelFileInput");
  const resultBox = document.getElementById("importResult");
  if (!fileInput.files.length) {
    resultBox.innerHTML = `<div class="error-text">Choose a .xlsx file first.</div>`;
    return;
  }

  const formData = new FormData();
  formData.append("file", fileInput.files[0]);

  resultBox.innerHTML = `<div class="muted">Uploading and processing…</div>`;

  try {
    const res = await adminFetch("/diseases/import", { method: "POST", body: formData });
    const data = await res.json();

    if (!res.ok) {
      resultBox.innerHTML = `<div class="error-text">${esc(data.error || "Import failed.")}</div>`;
      return;
    }

    const errHtml = (data.errors || [])
      .map((e) => `<div>Row ${e.row} (slug: ${esc(e.slug)}): ${esc(e.message)}</div>`)
      .join("");

    resultBox.innerHTML = `
      <div class="import-summary">
        Processed ${data.totalRows} row(s) — <strong>${data.created} created</strong>,
        <strong>${data.updated} overwritten</strong>${data.errors.length ? `, <strong>${data.errors.length} failed</strong>` : ""}.
        ${errHtml ? `<div class="err-list">${errHtml}</div>` : ""}
      </div>`;

    fileInput.value = "";
    await loadDiseaseList();
  } catch (err) {
    resultBox.innerHTML = `<div class="error-text">Upload failed: ${esc(err.message)}</div>`;
  }
});

// ---------------------------------------------------------------- boot

(function init() {
  const key = getKey();
  if (key) {
    tryConnect(key);
  } else {
    showLoginGate();
  }
})();
