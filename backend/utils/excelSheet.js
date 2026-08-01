// Converts between the nested Disease mongoose schema and a flat,
// spreadsheet-friendly row format so a doctor/content-editor can bulk
// author or bulk overwrite disease entries from Excel/Google Sheets.
//
// CONVENTIONS (also shown to the user in the "Read Me" sheet of the
// downloadable template):
//   - Multiple items in a list are separated with  " | "
//   - Sub-fields inside one item are separated with " :: "
//
// Example — pathyaAhara cell:
//   "Purana Shali (aged rice) :: Old rice is easier to digest :: Laghu, supports Agni |
//    Mudga (moong dal) :: Light and nourishing"
//
// Column order matches COLUMNS below; buildTemplateWorkbook() and
// parseWorkbook() both key off that single source of truth so they can't
// drift apart.

const XLSX = require("xlsx");

const LIST_SEP = "|";
const FIELD_SEP = "::";

function splitList(cell) {
  if (cell === undefined || cell === null) return [];
  return String(cell)
    .split(LIST_SEP)
    .map((s) => s.trim())
    .filter(Boolean);
}

function splitFields(item) {
  return item.split(FIELD_SEP).map((s) => s.trim());
}

function joinList(items) {
  return (items || []).join(` ${LIST_SEP} `);
}

// --- Column definitions --------------------------------------------------
// Each column has: key (spreadsheet header), toCell(disease) -> string,
// and is handled explicitly in rowToDisease() below.

const COLUMNS = [
  "slug",
  "sanskritName",
  "transliteration",
  "commonName_en",
  "commonName_hi",
  "synonyms",
  "doshaInvolvement",
  "category",
  "reviewStatus",
  "nidana",
  "pathyaAhara",
  "apathyaAhara",
  "pathyaVihara",
  "apathyaVihara",
  "dinacharya",
  "ritucharya",
  "precautions",
  "patientEducation",
  "citations",
];

const EXAMPLE_ROW = {
  slug: "pandu",
  sanskritName: "Pandu Roga",
  transliteration: "Pandu",
  commonName_en: "Anemia / Pallor disease",
  commonName_hi: "पांडु रोग (रक्ताल्पता)",
  synonyms: "pandu roga | panduroga | anemia",
  doshaInvolvement: "Pitta | Vitiated Rasa-Rakta",
  category: "Rasavaha & Raktavaha Vyadhi",
  reviewStatus: "draft",
  nidana: "Excess Katu-Amla-Lavana rasa :: Eating too much spicy, sour or salty food | Chronic Agnimandya :: Long-standing weak digestion",
  pathyaAhara: "Purana Shali (aged rice) :: Old rice is easier to digest :: Laghu, supports Agni | Dadima (pomegranate) :: Helps build healthy blood :: Raktavardhaka, Hridya",
  apathyaAhara: "Madya (alcohol) :: Avoid alcohol completely | Stale/reheated food :: Avoid stale or repeatedly reheated food",
  pathyaVihara: "Regular mild Vyayama :: Do light daily exercise like walking",
  apathyaVihara: "Divaswapna (day sleep) :: Avoid sleeping during the day",
  dinacharya: "Early Morning :: Ushapana (warm water) :: Drink a glass of warm water after waking up :: Supports Agni | Night :: Early light dinner, sleep by 10pm :: Eat an early light dinner and sleep on time",
  ritucharya: "Varsha :: Favor light warm freshly-cooked food :: In the monsoon, eat only fresh warm light food",
  precautions: "Persistent breathlessness or fainting needs urgent medical evaluation | Pandu in pregnancy needs specialist supervision",
  patientEducation: "Pandu roga is broadly similar to anemia/low blood count :: general | Diet changes support but do not replace treatment :: warning",
  citations: "Charaka Samhita :: Chikitsa Sthana :: 16 :: 5-10 :: General principles of Pandu chikitsa",
};

const README_LINES = [
  ["Pathya-Apathya Advisor — Bulk Import Template"],
  [""],
  ["HOW TO USE"],
  ["1. Fill one row per disease on the 'Diseases' sheet. Do not rename columns."],
  ["2. 'slug' is the unique key. Uploading a row whose slug already exists"],
  ["   OVERWRITES that disease completely (all fields are replaced)."],
  ["3. Leave reviewStatus blank or 'draft' to keep it hidden from patients/doctors"],
  ["   until you publish it from the admin panel. Use 'published' to make it live."],
  [""],
  ["LIST FIELDS — separate multiple entries with  |  (pipe)"],
  ["  e.g. synonyms: anemia | pandu roga | panduroga"],
  [""],
  ["ITEM FIELDS — inside one list entry, separate sub-fields with  ::  (double colon)"],
  ["  pathyaAhara / apathyaAhara / pathyaVihara / apathyaVihara:"],
  ["    name :: patientNote :: clinicalNote :: conditionalNote"],
  ["  nidana:"],
  ["    text :: patientNote"],
  ["  dinacharya:"],
  ["    timeOfDay :: activity :: patientNote :: clinicalNote"],
  ["  ritucharya:"],
  ["    season :: modification :: patientNote"],
  ["  patientEducation:"],
  ["    text :: category (general | warning | myth-busting | reassurance)"],
  ["  citations:"],
  ["    granth :: sthana :: adhyaya :: shlokaNumber :: translation"],
  ["  precautions: plain text, no :: needed, just separate with |"],
  [""],
  ["Only 'slug' and 'sanskritName' are required. Leave any other cell blank to skip it."],
];

// --- Disease document -> flat row ----------------------------------------

function itemToCell(fields) {
  return fields.map((f) => (f === undefined || f === null ? "" : String(f))).join(` ${FIELD_SEP} `);
}

function diseaseToRow(d) {
  const commonName = d.commonName instanceof Map ? Object.fromEntries(d.commonName) : d.commonName || {};

  return {
    slug: d.slug || "",
    sanskritName: d.sanskritName || "",
    transliteration: d.transliteration || "",
    commonName_en: commonName.en || "",
    commonName_hi: commonName.hi || "",
    synonyms: joinList(d.synonyms),
    doshaInvolvement: joinList(d.doshaInvolvement),
    category: d.category || "",
    reviewStatus: d.reviewStatus || "draft",
    nidana: joinList((d.nidana || []).map((n) => itemToCell([n.text, n.patientNote]))),
    pathyaAhara: joinList((d.pathyaAhara || []).map((i) => itemToCell([i.name, i.patientNote, i.clinicalNote, i.conditionalNote]))),
    apathyaAhara: joinList((d.apathyaAhara || []).map((i) => itemToCell([i.name, i.patientNote, i.clinicalNote, i.conditionalNote]))),
    pathyaVihara: joinList((d.pathyaVihara || []).map((i) => itemToCell([i.name, i.patientNote, i.clinicalNote, i.conditionalNote]))),
    apathyaVihara: joinList((d.apathyaVihara || []).map((i) => itemToCell([i.name, i.patientNote, i.clinicalNote, i.conditionalNote]))),
    dinacharya: joinList((d.dinacharya || []).map((s) => itemToCell([s.timeOfDay, s.activity, s.patientNote, s.clinicalNote]))),
    ritucharya: joinList((d.ritucharya || []).map((r) => itemToCell([r.season, r.modification, r.patientNote]))),
    precautions: joinList(d.precautions),
    patientEducation: joinList((d.patientEducation || []).map((e) => itemToCell([e.text, e.category]))),
    citations: joinList((d.citations || []).map((c) => itemToCell([c.granth, c.sthana, c.adhyaya, c.shlokaNumber, c.translation]))),
  };
}

// --- Flat row -> Disease document ----------------------------------------

function rowToDisease(row) {
  const get = (key) => {
    const val = row[key];
    return val === undefined || val === null ? "" : String(val).trim();
  };

  const slug = get("slug");
  const sanskritName = get("sanskritName");
  if (!slug) throw new Error("Missing required field: slug");
  if (!sanskritName) throw new Error("Missing required field: sanskritName");

  const reviewStatusRaw = get("reviewStatus").toLowerCase();
  const reviewStatus = reviewStatusRaw === "published" ? "published" : "draft";

  const commonName = {};
  if (get("commonName_en")) commonName.en = get("commonName_en");
  if (get("commonName_hi")) commonName.hi = get("commonName_hi");

  const nidana = splitList(row.nidana).map((item) => {
    const [text, patientNote] = splitFields(item);
    return { text: text || item, patientNote: patientNote || undefined };
  });

  const parseAharaVihara = (cell) =>
    splitList(cell).map((item) => {
      const [name, patientNote, clinicalNote, conditionalNote] = splitFields(item);
      return {
        name: name || item,
        patientNote: patientNote || name || item,
        clinicalNote: clinicalNote || undefined,
        conditionalNote: conditionalNote || undefined,
      };
    });

  const dinacharya = splitList(row.dinacharya).map((item) => {
    const [timeOfDay, activity, patientNote, clinicalNote] = splitFields(item);
    return { timeOfDay, activity, patientNote, clinicalNote: clinicalNote || undefined };
  });

  const ritucharya = splitList(row.ritucharya).map((item) => {
    const [season, modification, patientNote] = splitFields(item);
    return { season, modification, patientNote };
  });

  const patientEducation = splitList(row.patientEducation).map((item) => {
    const [text, category] = splitFields(item);
    const validCategories = ["general", "warning", "myth-busting", "reassurance"];
    return {
      text: text || item,
      category: validCategories.includes(category) ? category : "general",
    };
  });

  const citations = splitList(row.citations).map((item) => {
    const [granth, sthana, adhyaya, shlokaNumber, translation] = splitFields(item);
    return { granth: granth || item, sthana, adhyaya, shlokaNumber, translation };
  });

  return {
    slug,
    sanskritName,
    transliteration: get("transliteration") || undefined,
    commonName,
    synonyms: splitList(row.synonyms),
    doshaInvolvement: splitList(row.doshaInvolvement),
    category: get("category") || undefined,
    reviewStatus,
    nidana,
    pathyaAhara: parseAharaVihara(row.pathyaAhara),
    apathyaAhara: parseAharaVihara(row.apathyaAhara),
    pathyaVihara: parseAharaVihara(row.pathyaVihara),
    apathyaVihara: parseAharaVihara(row.apathyaVihara),
    dinacharya,
    ritucharya,
    precautions: splitList(row.precautions),
    patientEducation,
    citations,
  };
}

// --- Workbook helpers ------------------------------------------------------

function parseWorkbook(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName =
    workbook.SheetNames.find((n) => n.toLowerCase() === "diseases") || workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  return rows;
}

function buildTemplateWorkbook() {
  const workbook = XLSX.utils.book_new();

  const dataSheet = XLSX.utils.json_to_sheet([EXAMPLE_ROW], { header: COLUMNS });
  dataSheet["!cols"] = COLUMNS.map(() => ({ wch: 32 }));
  XLSX.utils.book_append_sheet(workbook, dataSheet, "Diseases");

  const readmeSheet = XLSX.utils.aoa_to_sheet(README_LINES);
  readmeSheet["!cols"] = [{ wch: 90 }];
  XLSX.utils.book_append_sheet(workbook, readmeSheet, "Read Me");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

function buildExportWorkbook(diseases) {
  const rows = diseases.map(diseaseToRow);
  const workbook = XLSX.utils.book_new();
  const dataSheet = XLSX.utils.json_to_sheet(rows.length ? rows : [EXAMPLE_ROW], { header: COLUMNS });
  dataSheet["!cols"] = COLUMNS.map(() => ({ wch: 32 }));
  XLSX.utils.book_append_sheet(workbook, dataSheet, "Diseases");

  const readmeSheet = XLSX.utils.aoa_to_sheet(README_LINES);
  readmeSheet["!cols"] = [{ wch: 90 }];
  XLSX.utils.book_append_sheet(workbook, readmeSheet, "Read Me");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

module.exports = {
  parseWorkbook,
  rowToDisease,
  diseaseToRow,
  buildTemplateWorkbook,
  buildExportWorkbook,
};
