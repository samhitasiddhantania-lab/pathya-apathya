const express = require("express");
const router = express.Router();
const Disease = require("../models/Disease");
const apiKeyAuth = require("../middleware/apiKeyAuth");

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
