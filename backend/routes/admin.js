const express = require("express");
const router = express.Router();
const multer = require("multer");
const Disease = require("../models/Disease");
const apiKeyAuth = require("../middleware/apiKeyAuth");
const {
  parseWorkbook,
  rowToDisease,
  buildTemplateWorkbook,
  buildExportWorkbook,
} = require("../utils/excelSheet");

// Keep the uploaded workbook in memory only — we parse it and discard it,
// nothing ever touches disk on the server.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB is plenty for a spreadsheet
});

// All routes below require the x-api-key header (see middleware/apiKeyAuth.js)
router.use(apiKeyAuth);

// GET /api/admin/diseases  -> list everything including drafts
router.get("/diseases", async (req, res) => {
  try {
    const diseases = await Disease.find().sort({ updatedAt: -1 });
    res.json(diseases);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/diseases/template -> blank/example .xlsx for bulk import
// NOTE: must be declared before the "/diseases/:slug" route below so the
// literal path "template" doesn't get swallowed as a :slug param.
router.get("/diseases/template", (req, res) => {
  try {
    const buffer = buildTemplateWorkbook();
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", "attachment; filename=pathya-import-template.xlsx");
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/diseases/export -> .xlsx dump of every disease currently
// in the database, in the same format the importer expects (handy for
// backing up, editing in bulk, then re-uploading).
router.get("/diseases/export", async (req, res) => {
  try {
    const diseases = await Disease.find().sort({ sanskritName: 1 });
    const buffer = buildExportWorkbook(diseases);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", "attachment; filename=pathya-diseases-export.xlsx");
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/diseases/import  (multipart/form-data, field: "file")
// Bulk create/overwrite. Each row is matched to an existing disease by
// `slug`; if found, the ENTIRE document is replaced with the row's data
// (a true overwrite, not a shallow merge). If not found, a new disease
// is created. Rows are processed independently so one bad row doesn't
// block the rest of the sheet.
router.post("/diseases/import", upload.single("file"), async (req, res) => {
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

  for (let i = 0; i < rows.length; i++) {
    const rowNumber = i + 2; // account for header row, 1-indexed
    try {
      const parsed = rowToDisease(rows[i]);
      const existing = await Disease.findOne({ slug: parsed.slug });

      if (existing) {
        // True overwrite: replace the whole document body, bump version.
        parsed.version = (existing.version || 1) + 1;
        await Disease.replaceOne({ slug: parsed.slug }, parsed);
        result.updated++;
      } else {
        await Disease.create(parsed);
        result.created++;
      }
    } catch (err) {
      result.errors.push({
        row: rowNumber,
        slug: rows[i] && rows[i].slug ? String(rows[i].slug) : "(missing)",
        message: err.message,
      });
    }
  }

  res.json(result);
});

// GET /api/admin/diseases/:slug -> single disease, any status (draft or
// published), full raw document — used to populate the edit form.
router.get("/diseases/:slug", async (req, res) => {
  try {
    const disease = await Disease.findOne({ slug: req.params.slug });
    if (!disease) return res.status(404).json({ error: "Disease not found" });
    res.json(disease);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/diseases  -> create new (defaults to draft)
router.post("/diseases", async (req, res) => {
  try {
    const disease = new Disease({ ...req.body, reviewStatus: req.body.reviewStatus || "draft" });
    await disease.save();
    res.status(201).json(disease);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/admin/diseases/:slug -> update existing, bumps version number
router.put("/diseases/:slug", async (req, res) => {
  try {
    const existing = await Disease.findOne({ slug: req.params.slug });
    if (!existing) return res.status(404).json({ error: "Disease not found" });

    Object.assign(existing, req.body);
    existing.version = (existing.version || 1) + 1;
    await existing.save();

    res.json(existing);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/admin/diseases/:slug/publish -> flip draft to published
router.post("/diseases/:slug/publish", async (req, res) => {
  try {
    const disease = await Disease.findOneAndUpdate(
      { slug: req.params.slug },
      { reviewStatus: "published" },
      { new: true }
    );
    if (!disease) return res.status(404).json({ error: "Disease not found" });
    res.json(disease);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/diseases/:slug
router.delete("/diseases/:slug", async (req, res) => {
  try {
    const deleted = await Disease.findOneAndDelete({ slug: req.params.slug });
    if (!deleted) return res.status(404).json({ error: "Disease not found" });
    res.json({ message: "Deleted", slug: req.params.slug });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
