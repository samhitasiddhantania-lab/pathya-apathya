const mongoose = require("mongoose");

/*
  DESIGN NOTE:
  This is the "growing checkbox list" backing store for the Dravya module.
  It is intentionally separate from anything in Disease.js / the main
  Pathya-Apathya module — per design decision, this module's tag sets
  (Rasa, Guna, Dosha, Indication) are independent and do NOT reuse the
  existing Disease collection.

  Every time someone types a brand-new checkbox label (for any of the four
  categories) and it gets saved, one row is added here. From then on it
  shows up as an available checkbox option for every future Dravya entry,
  for every editor.
*/

const DravyaTagSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      required: true,
      enum: ["rasa", "guna", "dosha", "varga", "indication"],
      index: true,
    },
    value: { type: String, required: true, trim: true }, // e.g. "Madhura", "Guru", "Vata-hara", "Pandu"
    createdByEmail: String,
  },
  { timestamps: true }
);

// Case-insensitive de-dupe within a category: "Madhura" and "madhura" are
// the same checkbox, not two.
DravyaTagSchema.index({ category: 1, value: 1 }, { unique: true, collation: { locale: "en", strength: 2 } });

module.exports = mongoose.model("DravyaTag", DravyaTagSchema);
