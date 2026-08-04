const mongoose = require("mongoose");

/*
  DESIGN NOTE:
  Separate module, separate collection — deliberately not linked to
  Disease.js. A Dravya (food/substance, e.g. "Dadima" / pomegranate) carries
  its own Ayurvedic quality tags plus a set of indication checkboxes, all
  drawn from the growing DravyaTag lists.
*/

const DravyaSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // e.g. "Dadima"
    commonName: String, // e.g. "Pomegranate"
    notes: String, // free-text clinical note, optional

    rasa: [String], // e.g. ["Madhura"]
    guna: [String], // e.g. ["Guru"]
    dosha: [String], // e.g. ["Vata-hara"]
    indications: [String], // e.g. ["Pandu", "Amavata", "Swasa"] — checked diseases/conditions

    createdByEmail: String,
  },
  { timestamps: true }
);

DravyaSchema.index({ name: "text", commonName: "text" });
DravyaSchema.index({ indications: 1 });

module.exports = mongoose.model("Dravya", DravyaSchema);
