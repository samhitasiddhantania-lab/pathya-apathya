const express = require("express");
const router = express.Router();
const multer = require("multer");
const Disease = require("../models/Disease");
const AuditLog = require("../models/AuditLog");
const requireAuth = require("../middleware/requireAuth");
const requireRole = require("../middleware/requireRole");
const { logAction } = require("../utils/audit");
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

// Every route below requires a logged-in user (JWT from /api/admin/auth/login).
// Some routes additionally require the "admin" role via requireRole("admin");
// "editor" accounts can create/edit drafts but not publish, delete, bulk
// import/export, or view the audit log.
router.use(requireAuth);

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
router.get("/diseases/template", requireRole("admin"), (req, res) => {
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
router.get("/diseases/export", requireRole("admin"), async (req, res) => {
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

// GET /api/admin/diseases/audit-log?slug=&action=&email=&limit=
// NOTE: also declared before "/diseases/:slug" for the same reason as above.
router.get("/diseases/audit-log", requireRole("admin"), async (req, res) => {
  try {
    const filter = {};
    if (req.query.slug) filter.slug = req.query.slug;
    if (req.query.action) filter.action = req.query.action;
    if (req.query.email) filter.performedByEmail = req.query.email.toLowerCase();

    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const entries = await AuditLog.find(filter).sort({ createdAt: -1 }).limit(limit);
    res.json(entries);
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
router.post("/diseases/import", requireRole("admin"), upload.single("file"), async (req, res) => {
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
  const affectedSlugs = [];

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
      affectedSlugs.push(parsed.slug);
    } catch (err) {
      result.errors.push({
        row: rowNumber,
        slug: rows[i] && rows[i].slug ? String(rows[i].slug) : "(missing)",
        message: err.message,
      });
    }
  }

  await logAction({
    action: "bulk_import",
    slug: affectedSlugs.join(", "),
    user: req.user,
    summary: `Bulk import: ${result.created} created, ${result.updated} overwritten, ${result.errors.length} failed (${result.totalRows} rows total).`,
    meta: result,
  });

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
// Editors can create diseases, but only as drafts — reviewStatus is
// forced to "draft" for anyone who isn't an admin, regardless of what
// the request body says.
router.post("/diseases", async (req, res) => {
  try {
    const requestedStatus = req.body.reviewStatus || "draft";
    const reviewStatus = req.user.role === "admin" ? requestedStatus : "draft";

    const disease = new Disease({ ...req.body, reviewStatus });
    await disease.save();

    await logAction({
      action: "create",
      slug: disease.slug,
      user: req.user,
      summary: `Created "${disease.sanskritName}" (${disease.slug}) as ${reviewStatus}.`,
    });

    res.status(201).json(disease);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/admin/diseases/:slug -> update existing, bumps version number
// Editors cannot use this to publish — if they submit reviewStatus:
// "published" on an unpublished disease, it's silently kept as-is instead.
router.put("/diseases/:slug", async (req, res) => {
  try {
    const existing = await Disease.findOne({ slug: req.params.slug });
    if (!existing) return res.status(404).json({ error: "Disease not found" });

    const body = { ...req.body };
    if (req.user.role !== "admin") {
      // Editors can't change review status at all via this route — only
      // through the admin-only /publish endpoint (and only admins can hit that).
      delete body.reviewStatus;
    }

    Object.assign(existing, body);
    existing.version = (existing.version || 1) + 1;
    await existing.save();

    await logAction({
      action: "update",
      slug: existing.slug,
      user: req.user,
      summary: `Updated "${existing.sanskritName}" (${existing.slug}), now v${existing.version}.`,
    });

    res.json(existing);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/admin/diseases/:slug/publish -> flip draft to published (admin only)
router.post("/diseases/:slug/publish", requireRole("admin"), async (req, res) => {
  try {
    const disease = await Disease.findOneAndUpdate(
      { slug: req.params.slug },
      { reviewStatus: "published" },
      { new: true }
    );
    if (!disease) return res.status(404).json({ error: "Disease not found" });

    await logAction({
      action: "publish",
      slug: disease.slug,
      user: req.user,
      summary: `Published "${disease.sanskritName}" (${disease.slug}).`,
    });

    res.json(disease);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/diseases/:slug (admin only)
router.delete("/diseases/:slug", requireRole("admin"), async (req, res) => {
  try {
    const deleted = await Disease.findOneAndDelete({ slug: req.params.slug });
    if (!deleted) return res.status(404).json({ error: "Disease not found" });

    await logAction({
      action: "delete",
      slug: deleted.slug,
      user: req.user,
      summary: `Deleted "${deleted.sanskritName}" (${deleted.slug}).`,
    });

    res.json({ message: "Deleted", slug: req.params.slug });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
