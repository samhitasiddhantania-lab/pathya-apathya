// Very simple shared-secret auth for the admin/content routes.
// Good enough for a solo-maintainer MVP. Replace with proper login-based
// role auth (doctor/admin accounts) once you have multiple contributors.

function apiKeyAuth(req, res, next) {
  const providedKey = req.header("x-api-key");
  const realKey = process.env.ADMIN_API_KEY;

  if (!realKey) {
    return res.status(500).json({ error: "Server misconfigured: ADMIN_API_KEY not set." });
  }

  if (!providedKey || providedKey !== realKey) {
    return res.status(401).json({ error: "Invalid or missing API key." });
  }

  next();
}

module.exports = apiKeyAuth;
