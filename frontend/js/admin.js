// Admin panel logic: per-user JWT auth (with role-based permissions),
// disease list, manual CRUD editor, bulk Excel import/export (admin only),
// audit log (admin only), and a master-key-gated user management panel.

const TOKEN_STORAGE = "pathya_admin_token";
const EMAIL_STORAGE = "pathya_admin_email";
const ROLE_STORAGE = "pathya_admin_role";

let allDiseases = [];
let editingSlug = null; // null = creating a new disease
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

function csvToList(str) {
  return (str || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------- JWT-authenticated requests

async function adminFetch(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}/admin${path}`, {
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
  document.getElementById("adminContent").style.display = "none";
  document.getElementById("logoutBtn").style.display = "none";
  document.getElementById("roleBadge").style.display = "none";
  document.getElementById("loginError").textContent = message || "";
}

function applyRoleVisibility(role) {
  currentRole = role;
  const isAdmin = role === "admin";

  document.querySelectorAll(".admin-only-section").forEach((el) => {
    el.dataset.hidden = isAdmin ? "false" : "true";
  });

  // Editors can create/edit drafts but never flip reviewStatus to
  // published directly — hide that option rather than let them pick it
  // and silently have the server ignore it.
  const reviewSelect = document.querySelector('select[name="reviewStatus"]');
  if (reviewSelect) {
    const publishedOption = [...reviewSelect.options].find((o) => o.value === "published");
    if (publishedOption) publishedOption.disabled = !isAdmin;
  }
}

function showAdminContent(email, role) {
  document.getElementById("loginGate").style.display = "none";
  document.getElementById("adminContent").style.display = "block";
  document.getElementById("logoutBtn").style.display = "inline-block";
  const badge = document.getElementById("roleBadge");
  badge.textContent = `${email} · ${role}`;
  badge.style.display = "inline-block";
  applyRoleVisibility(role);
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
    const res = await adminFetch("/diseases");
    if (!res.ok) throw new Error("Session check failed");
    showAdminContent(email, role);
    await loadDiseaseList();
    if (role === "admin") await loadAuditLog();
  } catch (err) {
    // adminFetch already cleared session + showed login gate on 401
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
    showAdminContent(data.email, data.role);
    await loadDiseaseList();
    if (data.role === "admin") await loadAuditLog();
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

// ---------------------------------------------------------------- master-key user management
// Entirely separate auth path: uses x-api-key (ADMIN_API_KEY), not the JWT
// session above. Lets the key-holder create/manage accounts even before
// anyone can log in normally.

function masterHeaders(extra = {}) {
  return { "x-api-key": document.getElementById("masterKeyInput").value.trim(), ...extra };
}

async function loadUserList() {
  const errorBox = document.getElementById("masterKeyError");
  errorBox.textContent = "";
  try {
    const res = await fetch(`${API_BASE_URL}/admin/users`, { headers: masterHeaders() });
    const data = await res.json();
    if (!res.ok) {
      errorBox.textContent = data.error || "Could not load accounts — check the master key.";
      document.getElementById("userMgmtWrap").style.display = "none";
      return;
    }
    document.getElementById("userMgmtWrap").style.display = "block";
    renderUserList(data);
  } catch (err) {
    errorBox.textContent = "Could not reach the server: " + err.message;
  }
}

function renderUserList(users) {
  const rows = users
    .map(
      (u) => `
      <tr>
        <td>${esc(u.email)}</td>
        <td>${esc(u.role)}</td>
        <td>${u.active ? "Active" : "Deactivated"}${u.lockedUntil && new Date(u.lockedUntil) > new Date() ? " · 🔒 locked" : ""}</td>
        <td>${u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "never"}</td>
        <td class="row-actions">
          <button data-user-action="toggleRole" data-email="${esc(u.email)}" data-role="${u.role === "admin" ? "editor" : "admin"}">
            Make ${u.role === "admin" ? "editor" : "admin"}
          </button>
          <button data-user-action="toggleActive" data-email="${esc(u.email)}" data-active="${!u.active}">
            ${u.active ? "Deactivate" : "Reactivate"}
          </button>
          ${u.lockedUntil && new Date(u.lockedUntil) > new Date() ? `<button data-user-action="unlock" data-email="${esc(u.email)}">Unlock</button>` : ""}
          <button data-user-action="delete" data-email="${esc(u.email)}" class="danger">Delete</button>
        </td>
      </tr>`
    )
    .join("");
  document.getElementById("userListBody").innerHTML =
    rows || `<tr><td colspan="5" class="muted">No accounts yet — create the first one below.</td></tr>`;
}

document.getElementById("masterConnectBtn").addEventListener("click", loadUserList);

document.getElementById("userListBody").addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-user-action]");
  if (!btn) return;
  const { userAction, email } = btn.dataset;
  const resultBox = document.getElementById("userMgmtResult");
  resultBox.textContent = "";

  try {
    let res;
    if (userAction === "toggleRole") {
      res = await fetch(`${API_BASE_URL}/admin/users/${encodeURIComponent(email)}`, {
        method: "PATCH",
        headers: masterHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ role: btn.dataset.role }),
      });
    } else if (userAction === "toggleActive") {
      res = await fetch(`${API_BASE_URL}/admin/users/${encodeURIComponent(email)}`, {
        method: "PATCH",
        headers: masterHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ active: btn.dataset.active === "true" }),
      });
    } else if (userAction === "unlock") {
      res = await fetch(`${API_BASE_URL}/admin/users/${encodeURIComponent(email)}`, {
        method: "PATCH",
        headers: masterHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ unlock: true }),
      });
    } else if (userAction === "delete") {
      if (!confirm(`Delete the account "${email}"? This cannot be undone.`)) return;
      res = await fetch(`${API_BASE_URL}/admin/users/${encodeURIComponent(email)}`, {
        method: "DELETE",
        headers: masterHeaders(),
      });
    }
    const data = await res.json();
    if (!res.ok) {
      resultBox.innerHTML = `<div class="error-text">${esc(data.error || "Action failed.")}</div>`;
      return;
    }
    await loadUserList();
  } catch (err) {
    resultBox.innerHTML = `<div class="error-text">${esc(err.message)}</div>`;
  }
});

document.getElementById("createUserBtn").addEventListener("click", async () => {
  const email = document.getElementById("newUserEmail").value.trim();
  const password = document.getElementById("newUserPassword").value;
  const role = document.getElementById("newUserRole").value;
  const resultBox = document.getElementById("userMgmtResult");
  resultBox.textContent = "";

  if (!email || !password) {
    resultBox.innerHTML = `<div class="error-text">Email and password are required.</div>`;
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/admin/users`, {
      method: "POST",
      headers: masterHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ email, password, role }),
    });
    const data = await res.json();
    if (!res.ok) {
      resultBox.innerHTML = `<div class="error-text">${esc(data.error || "Could not create account.")}</div>`;
      return;
    }
    document.getElementById("newUserEmail").value = "";
    document.getElementById("newUserPassword").value = "";
    resultBox.innerHTML = `<div class="import-summary">Created ${esc(data.email)} as ${esc(data.role)}.</div>`;
    await loadUserList();
  } catch (err) {
    resultBox.innerHTML = `<div class="error-text">${esc(err.message)}</div>`;
  }
});

// ---------------------------------------------------------------- disease list

async function loadDiseaseList() {
  const res = await adminFetch("/diseases");
  allDiseases = await res.json();
  renderDiseaseList();
}

function renderDiseaseList() {
  const filter = document.getElementById("listFilter").value.trim().toLowerCase();
  const isAdmin = currentRole === "admin";
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
          <button data-action="qr" data-slug="${esc(d.slug)}" data-name="${esc(d.sanskritName)}">QR</button>
          ${isAdmin && d.reviewStatus !== "published" ? `<button data-action="publish" data-slug="${esc(d.slug)}">Publish</button>` : ""}
          ${isAdmin ? `<button data-action="delete" data-slug="${esc(d.slug)}" class="danger">Delete</button>` : ""}
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

  if (action === "qr") {
    openQrViewer(slug, btn.dataset.name);
  }

  if (action === "publish") {
    await adminFetch(`/diseases/${encodeURIComponent(slug)}/publish`, { method: "POST" });
    await loadDiseaseList();
    if (currentRole === "admin") await loadAuditLog();
  }

  if (action === "delete") {
    if (!confirm(`Delete "${slug}" permanently? This cannot be undone.`)) return;
    await adminFetch(`/diseases/${encodeURIComponent(slug)}`, { method: "DELETE" });
    await loadDiseaseList();
    if (currentRole === "admin") await loadAuditLog();
  }
});

// ---------------------------------------------------------------- QR code viewer
// Generates a printable QR code per disease, encoding a deep link back into
// this app (index.html?slug=...) that opens straight to the patient-mode
// view — see app.js's handleDeepLink(). Uses the free api.qrserver.com
// service to render the actual QR image, so nothing new to install.

function buildPatientLink(slug) {
  // Works out index.html's URL relative to wherever admin.html is hosted,
  // so this keeps working whether the site sits at the domain root or in
  // a subfolder.
  const indexUrl = new URL("index.html", window.location.href);
  indexUrl.search = `?slug=${encodeURIComponent(slug)}`;
  return indexUrl.toString();
}

function qrImageUrl(link, size = 400) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(link)}`;
}

let currentQrSlug = null;

function openQrViewer(slug, name) {
  currentQrSlug = slug;
  const link = buildPatientLink(slug);
  document.getElementById("qrDiseaseName").textContent = `${name} (${slug})`;
  document.getElementById("qrLinkText").value = link;
  document.getElementById("qrImage").src = qrImageUrl(link);
  document.getElementById("qrSection").style.display = "block";
  document.getElementById("qrSection").scrollIntoView({ behavior: "smooth" });
}

document.getElementById("closeQrBtn").addEventListener("click", () => {
  document.getElementById("qrSection").style.display = "none";
  currentQrSlug = null;
});

document.getElementById("copyQrLinkBtn").addEventListener("click", async () => {
  const input = document.getElementById("qrLinkText");
  input.select();
  try {
    await navigator.clipboard.writeText(input.value);
    const btn = document.getElementById("copyQrLinkBtn");
    const original = btn.textContent;
    btn.textContent = "Copied!";
    setTimeout(() => (btn.textContent = original), 1500);
  } catch (err) {
    // Clipboard API can fail without HTTPS/permissions — the text is
    // still selected, so a manual Ctrl+C still works as a fallback.
  }
});

document.getElementById("downloadQrBtn").addEventListener("click", async () => {
  if (!currentQrSlug) return;
  const link = buildPatientLink(currentQrSlug);
  const imgUrl = qrImageUrl(link, 600); // higher res for print
  try {
    const res = await fetch(imgUrl);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentQrSlug}-qr.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    // Cross-origin fetch blocked or offline — fall back to opening the
    // image directly so the user can right-click "Save image as...".
    window.open(imgUrl, "_blank");
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

  applyRoleVisibility(currentRole);
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
    if (currentRole === "admin") await loadAuditLog();
  } catch (err) {
    errorBox.textContent = "Request failed: " + err.message;
  }
});

// ---------------------------------------------------------------- excel import/export (admin only)

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
    await loadAuditLog();
  } catch (err) {
    resultBox.innerHTML = `<div class="error-text">Upload failed: ${esc(err.message)}</div>`;
  }
});

// ---------------------------------------------------------------- audit log (admin only)

async function loadAuditLog() {
  try {
    const res = await adminFetch("/diseases/audit-log?limit=100");
    if (!res.ok) return; // 403 for non-admins is expected, just skip silently
    const entries = await res.json();
    renderAuditLog(entries);
  } catch (err) {
    // adminFetch already handles 401; other errors just leave the table as-is
  }
}

function renderAuditLog(entries) {
  const rows = entries
    .map(
      (e) => `
      <tr>
        <td>${new Date(e.createdAt).toLocaleString()}</td>
        <td>${esc(e.action)}</td>
        <td>${esc(e.slug || "")}</td>
        <td>${esc(e.performedByEmail)} <span class="role-note">(${esc(e.performedByRole)})</span></td>
        <td>${esc(e.summary || "")}</td>
      </tr>`
    )
    .join("");
  document.getElementById("auditLogBody").innerHTML =
    rows || `<tr><td colspan="5" class="muted">No activity recorded yet.</td></tr>`;
}

document.getElementById("refreshAuditBtn").addEventListener("click", loadAuditLog);

// ---------------------------------------------------------------- boot

(function init() {
  trySession();
})();
