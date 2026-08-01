const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const AdminUser = require("../models/AdminUser");
const { comparePassword, signToken } = require("../utils/auth");

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

// IP-based limiter, on top of the per-account lockout below — stops both
// "hammer one account" and "spray many emails from one IP" attacks.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Too many login attempts from this network. Please wait a few minutes and try again." },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/admin/auth/login  { email, password } -> { token, email, role }
router.post("/login", loginLimiter, async (req, res) => {
  try {
    const email = (req.body.email || "").trim().toLowerCase();
    const password = req.body.password || "";

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const user = await AdminUser.findOne({ email });

    // Don't reveal whether the email exists — same generic message either way.
    const genericError = { error: "Invalid email or password." };

    if (!user || !user.active) {
      return res.status(401).json(genericError);
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockedUntil - new Date()) / 60000);
      return res.status(423).json({
        error: `This account is temporarily locked due to repeated failed logins. Try again in about ${minutesLeft} minute(s).`,
      });
    }

    const isMatch = await comparePassword(password, user.passwordHash);

    if (!isMatch) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;

      if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
        user.lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
        user.failedLoginAttempts = 0;
        await user.save();
        return res.status(423).json({
          error: `Too many failed attempts. This account is locked for ${LOCKOUT_MINUTES} minutes.`,
        });
      }

      await user.save();
      return res.status(401).json(genericError);
    }

    // Success — reset lockout state, issue token.
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    user.lastLoginAt = new Date();
    await user.save();

    const token = signToken(user);
    res.json({ token, email: user.email, role: user.role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
