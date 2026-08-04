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
const dravyaRoutes = require("./routes/dravya");
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

// Separate module (Dravya database + habit analyzer) — doctor-only,
// requires the same login as /api/admin, but kept as its own route file/
// collection set so it never touches the Disease/Pathya-Apathya module.
app.use("/api/dravya", dravyaRoutes);

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

// Keep-alive "robot" for Render's free tier: it spins the service down after
// ~15 minutes with no incoming requests, causing the next real request (e.g.
// an admin login) to fail while it cold-starts. Render automatically sets
// RENDER_EXTERNAL_URL to this service's own public URL, so we just ping our
// own /api/health endpoint on a timer to keep generating traffic. This is a
// no-op locally/on other hosts since RENDER_EXTERNAL_URL won't be set there.
function startKeepAlive() {
  const selfUrl = process.env.RENDER_EXTERNAL_URL;
  if (!selfUrl) return; // not running on Render (e.g. local dev) — skip

  const PING_INTERVAL_MS = 10 * 60 * 1000; // 10 min, comfortably under the ~15 min idle timeout

  setInterval(async () => {
    try {
      const res = await fetch(`${selfUrl}/api/health`);
      console.log(`[keep-alive] ping ${res.status} at ${new Date().toISOString()}`);
    } catch (err) {
      console.warn(`[keep-alive] ping failed: ${err.message}`);
    }
  }, PING_INTERVAL_MS);

  console.log(`[keep-alive] enabled, pinging ${selfUrl}/api/health every ${PING_INTERVAL_MS / 60000} min`);
}

connectDB().then(async () => {
  await ensureFirstAdmin();
  app.listen(PORT, () => {
    console.log(`Pathya-Apathya Advisor API running on port ${PORT}`);
    startKeepAlive();
  });
});