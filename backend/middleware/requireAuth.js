const AdminUser = require("../models/AdminUser");
const { verifyToken } = require("../utils/auth");

// Verifies the Authorization: Bearer <token> header, then re-checks the
// user record in the DB (not just trusting the token payload) so a
// deactivated account is locked out immediately rather than waiting for
// the token to expire.
async function requireAuth(req, res, next) {
  const header = req.header("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Missing or malformed Authorization header." });
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired session. Please log in again." });
  }

  const user = await AdminUser.findById(payload.sub);
  if (!user || !user.active) {
    return res.status(401).json({ error: "This account is no longer active." });
  }

  req.user = { id: user._id.toString(), email: user.email, role: user.role };
  next();
}

module.exports = requireAuth;
