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
app.use("/api/admin", adminRoutes);

app.use((req, res) => res.status(404).json({ error: "Route not found" }));

// --- Start ---------------------------------------------------------------

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Pathya-Apathya Advisor API running on port ${PORT}`);
  });
});