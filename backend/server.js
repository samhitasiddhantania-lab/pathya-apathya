require("dotenv").config();

console.log(
  "Loaded MONGODB_URI:",
  process.env.MONGODB_URI
    ? process.env.MONGODB_URI.replace(/:(.*?)@/, ":********@")
    : "NOT FOUND"
);

const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const connectDB = require("./config/db");

const diseaseRoutes = require("./routes/diseases");
const adminRoutes = require("./routes/admin");
const authRoutes = require("./routes/auth");
const usersRoutes = require("./routes/users");
const AdminUser = require("./models/AdminUser");
const { hashPassword } = require("./utils/auth");

const app = express();

// --- Middleware ---------------------------------------------------------

app.use(express.json({ limit: "2mb" }));

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      // allow no-origin requests (curl, mobile apps, server-to-server)
      if (
        !origin ||
        allowedOrigins.length === 0 ||
        allowedOrigins.includes(origin)
      ) {
        return callback(null, true);
      }
      callback(new Error("Not allowed by CORS"));
    },
  })
);

// Basic rate limiting to keep a free-tier server from being hammered
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
});

app.use("/api/", limiter);

// --- Routes --------------------------------------------------------------

app.get("/api/health", (req, res) =>
  res.json({
    status: "ok",
    time: new Date().toISOString(),
  })
);

app.use("/api/diseases", diseaseRoutes);

// IMPORTANT: these two must be registered BEFORE app.use("/api/admin", adminRoutes) —
// adminRoutes applies requireAuth (JWT) to everything under /api/admin, and login
// obviously can't require a JWT. Express matches middleware in registration order,
// so the more specific paths need to come first.
app.use("/api/admin/auth", authRoutes);
app.use("/api/admin/users", usersRoutes);
app.use("/api/admin", adminRoutes);

app.use((req, res) => res.status(404).json({ error: "Route not found" }));

// --- Start ---------------------------------------------------------------

const PORT = process.env.PORT || 5000;

// Bootstraps the very first admin account so there's a way in before any
// accounts exist. Only fires when the AdminUser collection is empty —
// harmless to leave these env vars set permanently, they're a no-op after
// the first successful run. Manage further accounts via
// /api/admin/users (protected by ADMIN_API_KEY) once you're in.
async function ensureFirstAdmin() {
  const email = process.env.INITIAL_ADMIN_EMAIL;
  const password = process.env.INITIAL_ADMIN_PASSWORD;

  if (!email || !password) return;

  const existingCount = await AdminUser.countDocuments();
  if (existingCount > 0) return;

  const passwordHash = await hashPassword(password);
  await AdminUser.create({ email: email.trim().toLowerCase(), passwordHash, role: "admin" });
  console.log(`Bootstrapped first admin account: ${email}`);
}

connectDB().then(async () => {
  await ensureFirstAdmin();
  app.listen(PORT, () => {
    console.log(`Pathya-Apathya Advisor API running on port ${PORT}`);
  });
});