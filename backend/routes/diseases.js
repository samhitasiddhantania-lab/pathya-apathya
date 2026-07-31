const express = require("express");
const router = express.Router();
const Disease = require("../models/Disease");

// --- Helpers -----------------------------------------------------------

// Approx Indian Ritu (season) calendar by month, used to auto-highlight the
// currently relevant Ritucharya section for patients. Doctors can still see
// all seasons.
function currentRitu(date = new Date()) {
  const month = date.getMonth() + 1; // 1-12
  if ([12, 1].includes(month)) return "Hemanta";
  if ([2, 3].includes(month)) return "Shishira";
  if ([4, 5].includes(month)) return "Vasanta";
  if ([6, 7].includes(month)) return "Grishma";
  if ([8, 9].includes(month)) return "Varsha";
  return "Sharad"; // 10, 11
}

// Strips/simplifies a disease document for the patient audience:
// removes clinical-only notes, keeps only patientNote/patient-facing text.
function toPatientView(diseaseDoc, lang) {
  const d = diseaseDoc.toObject ? diseaseDoc.toObject() : diseaseDoc;
  const pick = (map) => (map && map[lang]) || (map && map.en) || undefined;

  const simplifyItems = (items = []) =>
    items.map((i) => ({
      name: pick(i.regionalNames) || i.name,
      note: i.patientNote,
      conditionalNote: i.conditionalNote,
      imageUrl: i.imageUrl,
    }));

  return {
    slug: d.slug,
    name: pick(d.commonName) || d.sanskritName,
    nidana: (d.nidana || []).map((n) => n.patientNote || n.text),
    pathyaAhara: simplifyItems(d.pathyaAhara),
    apathyaAhara: simplifyItems(d.apathyaAhara),
    pathyaVihara: simplifyItems(d.pathyaVihara),
    apathyaVihara: simplifyItems(d.apathyaVihara),
    dinacharya: (d.dinacharya || []).map((s) => ({
      timeOfDay: s.timeOfDay,
      activity: s.patientNote || s.activity,
    })),
    currentSeason: currentRitu(),
    ritucharya: (d.ritucharya || []).filter((r) => r.season === currentRitu()).map((r) => ({
      season: r.season,
      note: r.patientNote || r.modification,
    })),
    precautions: d.precautions || [],
    education: (d.patientEducation || []).map((e) => ({ text: e.text, category: e.category })),
  };
}

function toDoctorView(diseaseDoc) {
  const d = diseaseDoc.toObject ? diseaseDoc.toObject() : diseaseDoc;
  return {
    ...d,
    currentSeason: currentRitu(),
  };
}

// --- Routes --------------------------------------------------------------

// GET /api/diseases/search?q=pandu
router.get("/search", async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    if (!q) return res.json([]);

    const regex = new RegExp(q, "i");
    const results = await Disease.find({
      reviewStatus: "published",
      $or: [
        { sanskritName: regex },
        { transliteration: regex },
        { synonyms: regex },
        { slug: regex },
      ],
    })
      .select("slug sanskritName transliteration commonName")
      .limit(15);

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/diseases  (list all published, for browse/index pages)
router.get("/", async (req, res) => {
  try {
    const diseases = await Disease.find({ reviewStatus: "published" }).select(
      "slug sanskritName transliteration commonName"
    );
    res.json(diseases);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/diseases/:slug?audience=doctor|patient&lang=en
router.get("/:slug", async (req, res) => {
  try {
    const disease = await Disease.findOne({ slug: req.params.slug, reviewStatus: "published" });
    if (!disease) return res.status(404).json({ error: "Disease not found" });

    const audience = req.query.audience === "patient" ? "patient" : "doctor";
    const lang = req.query.lang || "en";

    if (audience === "patient") {
      return res.json(toPatientView(disease, lang));
    }
    return res.json(toDoctorView(disease));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
