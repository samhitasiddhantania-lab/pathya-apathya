const AuditLog = require("../models/AuditLog");

// Fire-and-forget style logging: a failed audit write should never break
// the actual request, so callers `await` this but errors here are only
// console.error'd, never thrown back up.
async function logAction({ action, slug, user, summary, meta }) {
  try {
    await AuditLog.create({
      action,
      slug,
      performedByEmail: user.email,
      performedByRole: user.role,
      summary,
      meta,
    });
  } catch (err) {
    console.error("Failed to write audit log entry:", err.message);
  }
}

module.exports = { logAction };
