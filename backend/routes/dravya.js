const express = require("express");
const router = express.Router();
const multer = require("multer");
const Dravya = require("../models/Dravya");
const DravyaTag = require("../models/DravyaTag");
const requireAuth = require("../middleware/requireAuth");
const requireRole = require("../middleware/requireRole");
const { logAction } = require("../utils/audit");
const {
  parseWorkbook,
  rowToDravya,
  buildTemplateWorkbook,
  buildExportWorkbook,
} = require("../utils/dravyaExcelSheet");

const CATEGORIES = ["rasa", "guna", "dosha", "indication"];

// Kept in memory only — parsed and discarded, never written to disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Doctor-only module: no public routes here at all. Every route below
// requires a logged-in account (same JWT session as /api/admin).
router.use(requireAuth);

// ---------------------------------------------------------------- weighting
// Optional per-Dravya consumption frequency in the habit analyzer.
// Blank/unspecified frequency counts as a flat 1, same as "occasional".
const FREQUENCY_WEIGHTS = { occasional: 1, weekly: 2, daily: 3 };
function weightFor(frequency) {
  if (!frequency) return 1;
  const key = String(frequency).trim().toLowerCase();
  return FREQUENCY_WEIGHTS[key] || 1;
}

// Idempotently registers a tag value under a category (case-insensitive
// de-dupe via the schema's collation index) — used both by the explicit
// "+ add checkbox" action and as a safety net when a Dravya is saved with
// a brand-new tag value that was typed but not separately registered.
async function ensureTag(category, value, email) {
  const trimmed = (value || "").trim();
  if (!trimmed) return null;
  return DravyaTag.findOneAndUpdate(
    { category, value: trimmed },
    { $setOnInsert: { category, value: trimmed, createdByEmail: email } },
    { new: true, upsert: true, collation: { locale: "en", strength: 2 } }
  );
}

// ---------------------------------------------------------------- tags (growing checkbox lists)

// GET /api/dravya/tags -> { rasa: [...], guna: [...], dosha: [...], indication: [...] }
router.get("/tags", async (req, res) => {
  try {
    const all = await DravyaTag.find().sort({ value: 1 });
    const grouped = { rasa: [], guna: [], dosha: [], indication: [] };
    all.forEach((t) => grouped[t.category].push(t.value));
    res.json(grouped);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/dravya/tags  { category, value } -> add a brand-new checkbox
// option. Any logged-in editor can do this (not admin-only) — it's meant
// to be added inline while entering a Dravya, by whoever is entering it.
router.post("/tags", async (req, res) => {
  try {
    const { category, value } = req.body;
    if (!CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `category must be one of: ${CATEGORIES.join(", ")}` });
    }
    if (!value || !value.trim()) {
      return res.status(400).json({ error: "value is required" });
    }
    const tag = await ensureTag(category, value, req.user.email);
    res.status(201).json(tag);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---------------------------------------------------------------- lookups (used by the "browse by indication" view + habit analyzer)

// GET /api/dravya/by-indication/:tag -> every Dravya checked for this indication
router.get("/by-indication/:tag", async (req, res) => {
  try {
    const dravyas = await Dravya.find({ indications: req.params.tag }).sort({ name: 1 });
    res.json(dravyas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dravya/quality-profile/:indication -> aggregated Rasa/Guna/Dosha
// tally across every Dravya checked for that indication — "what quality of
// dravya is generally good for this disease", derived from the data itself.
router.get("/quality-profile/:indication", async (req, res) => {
  try {
    const dravyas = await Dravya.find({ indications: req.params.indication });
    const tally = { rasa: {}, guna: {}, dosha: {} };
    dravyas.forEach((d) => {
      ["rasa", "guna", "dosha"].forEach((field) => {
        (d[field] || []).forEach((val) => {
          tally[field][val] = (tally[field][val] || 0) + 1;
        });
      });
    });
    res.json({ indication: req.params.indication, dravyaCount: dravyas.length, tally });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/dravya/analyze  { items: [{ dravyaId, frequency? }] }
// One-off habit analyzer: NOT saved anywhere, purely computed and returned.
// Tallies Rasa/Guna/Dosha across the selected Dravyas, weighted by the
// optional frequency (occasional=1, weekly=2, daily=3; blank=1). Does NOT
// attempt to identify a disease/Nidana — that's a separate, manual step.
router.post("/analyze", async (req, res) => {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (!items.length) {
      return res.status(400).json({ error: "items[] is required (at least one Dravya)." });
    }

    const ids = items.map((i) => i.dravyaId).filter(Boolean);
    const dravyas = await Dravya.find({ _id: { $in: ids } });
    const byId = {};
    dravyas.forEach((d) => (byId[d._id.toString()] = d));

    const tally = { rasa: {}, guna: {}, dosha: {} };
    const usedItems = [];
    const notFound = [];

    items.forEach((item) => {
      const d = byId[item.dravyaId];
      if (!d) {
        notFound.push(item.dravyaId);
        return;
      }
      const weight = weightFor(item.frequency);
      ["rasa", "guna", "dosha"].forEach((field) => {
        (d[field] || []).forEach((val) => {
          tally[field][val] = (tally[field][val] || 0) + weight;
        });
      });
      usedItems.push({ dravyaId: d._id, name: d.name, frequency: item.frequency || null, weight });
    });

    res.json({ items: usedItems, notFound, tally });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---------------------------------------------------------------- Dravya CRUD

// GET /api/dravya -> list all
router.get("/", async (req, res) => {
  try {
    const dravyas = await Dravya.find().sort({ updatedAt: -1 });
    res.json(dravyas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dravya/template -> blank/example .xlsx for bulk import (admin only)
// NOTE: must be declared before "/:id" so the literal path "template"
// doesn't get swallowed as a :id param.
router.get("/template", requireRole("admin"), (req, res) => {
  try {
    const buffer = buildTemplateWorkbook();
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", "attachment; filename=dravya-import-template.xlsx");
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dravya/export -> .xlsx dump of every Dravya currently in the
// database, in the same format the importer expects (admin only).
router.get("/export", requireRole("admin"), async (req, res) => {
  try {
    const dravyas = await Dravya.find().sort({ name: 1 });
    const buffer = buildExportWorkbook(dravyas);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", "attachment; filename=dravya-export.xlsx");
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/dravya/import  (multipart/form-data, field: "file") — admin only.
// Each row is matched to an existing Dravya by `name` (case-insensitive);
// if found, the ENTIRE document is replaced with the row's data (a true
// overwrite); if not found, a new Dravya is created. Rows are processed
// independently so one bad row doesn't block the rest. Every checkbox
// value used gets registered via the same de-duping ensureTag() used by
// the single-entry form, so re-uploading the same sheet twice never
// creates duplicate checkboxes.
router.post("/import", requireRole("admin"), upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded. Expected a form field named 'file'." });
  }

  let rows;
  try {
    rows = parseWorkbook(req.file.buffer);
  } catch (err) {
    return res.status(400).json({ error: "Could not read that file as an Excel workbook: " + err.message });
  }

  if (!rows.length) {
    return res.status(400).json({ error: "The sheet has no data rows." });
  }

  const result = { totalRows: rows.length, created: 0, updated: 0, errors: [] };
  const affectedNames = [];
  const tagPromises = [];

  for (let i = 0; i < rows.length; i++) {
    const rowNumber = i + 2; // account for header row, 1-indexed
    try {
      const parsed = rowToDravya(rows[i]);
      const existing = await Dravya.findOne({ name: parsed.name }).collation({ locale: "en", strength: 2 });

      if (existing) {
        Object.assign(existing, parsed);
        await existing.save();
        result.updated++;
      } else {
        await Dravya.create({ ...parsed, createdByEmail: req.user.email });
        result.created++;
      }
      affectedNames.push(parsed.name);

      ["rasa", "guna", "dosha", "indications"].forEach((field) => {
        const category = field === "indications" ? "indication" : field;
        (parsed[field] || []).forEach((v) => tagPromises.push(ensureTag(category, v, req.user.email)));
      });
    } catch (err) {
      result.errors.push({
        row: rowNumber,
        name: rows[i] && rows[i].name ? String(rows[i].name) : "(missing)",
        message: err.message,
      });
    }
  }

  await Promise.all(tagPromises);

  await logAction({
    action: "bulk_import",
    entityType: "dravya",
    slug: affectedNames.join(", "),
    user: req.user,
    summary: `Bulk import: ${result.created} created, ${result.updated} overwritten, ${result.errors.length} failed (${result.totalRows} rows total).`,
    meta: result,
  });

  res.json(result);
});

// GET /api/dravya/:id -> single
router.get("/:id", async (req, res) => {
  try {
    const dravya = await Dravya.findById(req.params.id);
    if (!dravya) return res.status(404).json({ error: "Dravya not found" });
    res.json(dravya);
  } catch (err) {
    res.status(404).json({ error: "Dravya not found" });
  }
});

// POST /api/dravya -> create. Also auto-registers any brand-new tag values
// used (rasa/guna/dosha/indications) so they persist as checkbox options
// even if the client didn't separately call POST /tags first.
router.post("/", async (req, res) => {
  try {
    const { name, commonName, notes, rasa = [], guna = [], dosha = [], indications = [] } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "name is required" });
    }

    const dravya = new Dravya({
      name: name.trim(),
      commonName,
      notes,
      rasa,
      guna,
      dosha,
      indications,
      createdByEmail: req.user.email,
    });
    await dravya.save();

    await Promise.all([
      ...rasa.map((v) => ensureTag("rasa", v, req.user.email)),
      ...guna.map((v) => ensureTag("guna", v, req.user.email)),
      ...dosha.map((v) => ensureTag("dosha", v, req.user.email)),
      ...indications.map((v) => ensureTag("indication", v, req.user.email)),
    ]);

    await logAction({
      action: "create",
      entityType: "dravya",
      slug: dravya.name,
      user: req.user,
      summary: `Created Dravya "${dravya.name}".`,
    });

    res.status(201).json(dravya);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/dravya/:id -> update
router.put("/:id", async (req, res) => {
  try {
    const existing = await Dravya.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Dravya not found" });

    const { name, commonName, notes, rasa = [], guna = [], dosha = [], indications = [] } = req.body;
    Object.assign(existing, { name, commonName, notes, rasa, guna, dosha, indications });
    await existing.save();

    await Promise.all([
      ...rasa.map((v) => ensureTag("rasa", v, req.user.email)),
      ...guna.map((v) => ensureTag("guna", v, req.user.email)),
      ...dosha.map((v) => ensureTag("dosha", v, req.user.email)),
      ...indications.map((v) => ensureTag("indication", v, req.user.email)),
    ]);

    await logAction({
      action: "update",
      entityType: "dravya",
      slug: existing.name,
      user: req.user,
      summary: `Updated Dravya "${existing.name}".`,
    });

    res.json(existing);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/dravya/:id (admin only, consistent with the disease module's convention)
router.delete("/:id", requireRole("admin"), async (req, res) => {
  try {
    const deleted = await Dravya.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Dravya not found" });

    await logAction({
      action: "delete",
      entityType: "dravya",
      slug: deleted.name,
      user: req.user,
      summary: `Deleted Dravya "${deleted.name}".`,
    });

    res.json({ message: "Deleted", id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
