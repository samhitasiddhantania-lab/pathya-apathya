const mongoose = require("mongoose");

// One entry per admin action that changes data. Written by
// utils/audit.js#logAction(), read via GET /api/admin/audit-log
// (admin role only).
const AuditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      enum: ["create", "update", "delete", "publish", "bulk_import"],
    },
    entityType: { type: String, default: "disease" },
    slug: String, // not indexed as unique — same slug can appear many times over its history

    performedByEmail: { type: String, required: true },
    performedByRole: { type: String, required: true },

    summary: String, // short human-readable description shown in the audit table
    meta: mongoose.Schema.Types.Mixed, // e.g. { created: 4, updated: 2, errors: [...] } for bulk_import
  },
  { timestamps: true }
);

AuditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model("AuditLog", AuditLogSchema);
