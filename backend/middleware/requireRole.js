// Must run AFTER requireAuth, which sets req.user.
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated." });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `This action requires ${allowedRoles.join(" or ")} role. Your role: ${req.user.role}.`,
      });
    }
    next();
  };
}

module.exports = requireRole;
