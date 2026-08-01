const mongoose = require("mongoose");

// Individual doctor/editor accounts. Created and managed via the
// master-key-protected /api/admin/users routes (see routes/users.js) —
// NOT self-registerable, since this is an internal content tool.
const AdminUserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["admin", "editor"], default: "editor" },
    active: { type: Boolean, default: true },

    // --- brute-force lockout tracking ---
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AdminUser", AdminUserSchema);
