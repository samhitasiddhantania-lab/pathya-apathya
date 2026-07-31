const mongoose = require("mongoose");

/*
  DESIGN NOTE (MVP simplification):
  The full architecture doc normalizes citations, pathya-apathya items, etc.
  into separate collections for large-scale reuse. For this MVP we embed
  everything inside one Disease document, because:
    - Reads are single-query fast (no joins) — good for OPD speed.
    - Content volume at launch (tens to a couple hundred diseases) doesn't
      need cross-collection reuse yet.
  When you outgrow this (multiple doctors contributing, shared food-item
  master list, etc.), split `pathyaAhara/apathyaAhara/vihara` items and
  `citations` into their own collections as described in the architecture doc.
*/

const CitationSchema = new mongoose.Schema(
  {
    granth: { type: String, required: true }, // e.g. "Charaka Samhita"
    sthana: String, // e.g. "Chikitsa Sthana"
    adhyaya: String, // chapter
    shlokaNumber: String,
    originalShloka: String, // Devanagari or transliteration
    translation: String, // plain English/regional meaning
  },
  { _id: false }
);

const AharaViharaItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true }, // Sanskrit/common name
    regionalNames: { type: Map, of: String, default: {} }, // {hi: "...", ta: "..."}
    clinicalNote: String, // rationale for doctor view (may include Sanskrit terms)
    patientNote: { type: String, required: true }, // plain-language rationale, mandatory
    conditionalNote: String, // e.g. "only if Kapha-dominant"
    imageUrl: String,
  },
  { _id: false }
);

const RoutineStepSchema = new mongoose.Schema(
  {
    timeOfDay: String, // "Early Morning", "Morning", "Afternoon", "Evening", "Night"
    activity: String,
    clinicalNote: String,
    patientNote: String,
  },
  { _id: false }
);

const RitucharyaModSchema = new mongoose.Schema(
  {
    season: { type: String, required: true }, // "Hemanta", "Shishira", "Vasanta", ...
    modification: String,
    patientNote: String,
  },
  { _id: false }
);

const EducationPointSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    category: {
      type: String,
      enum: ["general", "warning", "myth-busting", "reassurance"],
      default: "general",
    },
  },
  { _id: false }
);

const DiseaseSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, index: true }, // "pandu"
    sanskritName: { type: String, required: true }, // "Pandu Roga"
    transliteration: String,
    commonName: { type: Map, of: String, default: {} }, // {en: "Anemia", hi: "...", ta: "..."}
    synonyms: [String], // alternate spellings/search terms

    doshaInvolvement: [String], // ["Pitta", "Kapha"] etc.
    category: String, // e.g. "Rasavaha Vyadhi"

    nidana: [
      {
        text: { type: String, required: true },
        patientNote: String,
        _id: false,
      },
    ],

    pathyaAhara: [AharaViharaItemSchema],
    apathyaAhara: [AharaViharaItemSchema],
    pathyaVihara: [AharaViharaItemSchema],
    apathyaVihara: [AharaViharaItemSchema],

    dinacharya: [RoutineStepSchema],
    ritucharya: [RitucharyaModSchema],

    precautions: [String], // red-flag items, shown prominently to both audiences
    patientEducation: [EducationPointSchema],

    citations: [CitationSchema],

    reviewStatus: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
    },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

// Text index for search across the fields doctors/patients are likely to type
DiseaseSchema.index({
  sanskritName: "text",
  transliteration: "text",
  synonyms: "text",
});

module.exports = mongoose.model("Disease", DiseaseSchema);
