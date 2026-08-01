const express = require("express");
const router = express.Router();
const AdminUser = require("../models/AdminUser");
const apiKeyAuth = require("../middleware/apiKeyAuth");
const { hashPassword } = require("../utils/auth");

// Every route here requires the master ADMIN_API_KEY, not a user login —
// this is how the practice owner bootstraps and manages doctor/editor
// accounts. Regular day-to-day content work uses /api/admin/auth/login
// and per-user JWTs instead (see routes/auth.js).
router.use(apiKeyAuth);

function toSafeUser(user) {
  return {
    email: user.email,
    role: user.role,
    active: user.active,
    lastLoginAt: user.lastLoginAt,
    lockedUntil: user.lockedUntil,
    createdAt: user.createdAt,
  };
}

// GET /api/admin/users -> list all accounts (no password hashes returned)
router.get("/", async (req, res) => {
  try {
    const users = await AdminUser.find().sort({ createdAt: 1 });
    res.json(users.map(toSafeUser));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/users  { email, password, role } -> create a new account
router.post("/", async (req, res) => {
  try {
    const email = (req.body.email || "").trim().toLowerCase();
    const password = req.body.password || "";
    const role = req.body.role === "admin" ? "admin" : "editor";

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters." });
    }

    const existing = await AdminUser.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    const passwordHash = await hashPassword(password);
    const user = await AdminUser.create({ email, passwordHash, role });
    res.status(201).json(toSafeUser(user));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/admin/users/:email  { role?, active?, password? } -> update an account
router.patch("/:email", async (req, res) => {
  try {
    const user = await AdminUser.findOne({ email: req.params.email.toLowerCase() });
    if (!user) return res.status(404).json({ error: "Account not found." });

    if (req.body.role) user.role = req.body.role === "admin" ? "admin" : "editor";
    if (typeof req.body.active === "boolean") user.active = req.body.active;
    if (req.body.password) {
      if (req.body.password.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters." });
      }
      user.passwordHash = await hashPassword(req.body.password);
    }
    // Manually unlocking a locked-out account:
    if (req.body.unlock) {
      user.failedLoginAttempts = 0;
      user.lockedUntil = null;
    }

    await user.save();
    res.json(toSafeUser(user));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/admin/users/:email
router.delete("/:email", async (req, res) => {
  try {
    const deleted = await AdminUser.findOneAndDelete({ email: req.params.email.toLowerCase() });
    if (!deleted) return res.status(404).json({ error: "Account not found." });
    res.json({ message: "Deleted", email: deleted.email });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
