// Converts between the flat Dravya schema and a spreadsheet-friendly row
// format, for bulk authoring/overwriting Dravya entries from Excel.
//
// CONVENTION (same as the Disease bulk importer):
//   - Multiple checkbox values in one cell are separated with  |
//   - Each value gets registered as a checkbox option automatically on
//     import (same de-dupe logic as the single-entry form), so a typo like
//     "Madhur" vs "Madhura" will create a second, separate checkbox — keep
//     spelling consistent with what's already in the app if you want rows
//     to share existing checkboxes rather than create new ones.

const XLSX = require("xlsx");

const LIST_SEP = "|";

function splitList(cell) {
  if (cell === undefined || cell === null) return [];
  return String(cell)
    .split(LIST_SEP)
    .map((s) => s.trim())
    .filter(Boolean);
}

function joinList(items) {
  return (items || []).join(` ${LIST_SEP} `);
}

const COLUMNS = ["name", "commonName", "notes", "rasa", "guna", "dosha", "indications"];

const EXAMPLE_ROW = {
  name: "Dadima",
  commonName: "Pomegranate",
  notes: "Commonly used to build healthy blood.",
  rasa: "Madhura | Amla",
  guna: "Guru",
  dosha: "Vata-hara",
  indications: "Pandu | Amavata | Swasa",
};

const README_LINES = [
  ["Dravya Module — Bulk Import Template"],
  [""],
  ["HOW TO USE"],
  ["1. Fill one row per Dravya on the 'Dravyas' sheet. Do not rename columns."],
  ["2. 'name' is the matching key. Uploading a row whose name already exists"],
  ["   (case-insensitive) OVERWRITES that Dravya completely."],
  ["3. Only 'name' is required. Leave any other cell blank to skip it."],
  [""],
  ["CHECKBOX FIELDS — separate multiple values with  |  (pipe)"],
  ["  rasa: Madhura | Amla"],
  ["  guna: Guru | Snigdha"],
  ["  dosha: Vata-hara | Kapha-hara"],
  ["  indications: Pandu | Amavata | Swasa"],
  [""],
  ["Any value not already an existing checkbox option is added automatically"],
  ["as a new one (case-insensitive de-duped) — keep spelling consistent with"],
  ["what's already in the app if you want a row to reuse an existing checkbox"],
  ["instead of creating a near-duplicate one."],
];

function dravyaToRow(d) {
  return {
    name: d.name || "",
    commonName: d.commonName || "",
    notes: d.notes || "",
    rasa: joinList(d.rasa),
    guna: joinList(d.guna),
    dosha: joinList(d.dosha),
    indications: joinList(d.indications),
  };
}

function rowToDravya(row) {
  const get = (key) => {
    const val = row[key];
    return val === undefined || val === null ? "" : String(val).trim();
  };

  const name = get("name");
  if (!name) throw new Error("Missing required field: name");

  return {
    name,
    commonName: get("commonName") || undefined,
    notes: get("notes") || undefined,
    rasa: splitList(row.rasa),
    guna: splitList(row.guna),
    dosha: splitList(row.dosha),
    indications: splitList(row.indications),
  };
}

function parseWorkbook(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName =
    workbook.SheetNames.find((n) => n.toLowerCase() === "dravyas") || workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(sheet, { defval: "" });
}

function buildTemplateWorkbook() {
  const workbook = XLSX.utils.book_new();

  const dataSheet = XLSX.utils.json_to_sheet([EXAMPLE_ROW], { header: COLUMNS });
  dataSheet["!cols"] = COLUMNS.map(() => ({ wch: 30 }));
  XLSX.utils.book_append_sheet(workbook, dataSheet, "Dravyas");

  const readmeSheet = XLSX.utils.aoa_to_sheet(README_LINES);
  readmeSheet["!cols"] = [{ wch: 85 }];
  XLSX.utils.book_append_sheet(workbook, readmeSheet, "Read Me");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

function buildExportWorkbook(dravyas) {
  const rows = dravyas.map(dravyaToRow);
  const workbook = XLSX.utils.book_new();
  const dataSheet = XLSX.utils.json_to_sheet(rows.length ? rows : [EXAMPLE_ROW], { header: COLUMNS });
  dataSheet["!cols"] = COLUMNS.map(() => ({ wch: 30 }));
  XLSX.utils.book_append_sheet(workbook, dataSheet, "Dravyas");

  const readmeSheet = XLSX.utils.aoa_to_sheet(README_LINES);
  readmeSheet["!cols"] = [{ wch: 85 }];
  XLSX.utils.book_append_sheet(workbook, readmeSheet, "Read Me");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

module.exports = {
  parseWorkbook,
  rowToDravya,
  dravyaToRow,
  buildTemplateWorkbook,
  buildExportWorkbook,
};
