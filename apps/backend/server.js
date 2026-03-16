const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");

function loadDotEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return;

  const raw = fs.readFileSync(envPath, "utf8");
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;

    const idx = trimmed.indexOf("=");
    if (idx <= 0) return;

    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  });
}

loadDotEnvFile(path.resolve(__dirname, ".env"));

const itemsRoutes = require("./routes/api/items");
const metadataRoutes = require("./routes/api/metadata");
const gamesRoutes = require("./routes/api/games");
const storesRoutes = require("./routes/api/stores");
const authRoutes = require("./routes/api/auth");
const playerRoutes = require("./routes/api/player");
const mfeRoutes = require("./routes/api/mfe");
const { startMetadataWorker } = require("./services/metadata/metadataWorker");

const legacyWebDistPath = path.resolve(__dirname, "../web-legacy/dist");
const app = express();

app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = new Set([
    'http://localhost:4200',
    'http://localhost:4201',
    'http://localhost:4202',
    'http://localhost:4300',
    'http://127.0.0.1:4200',
    'http://127.0.0.1:4201',
    'http://127.0.0.1:4202',
    'http://127.0.0.1:4300',
  ]);

  if (origin && allowedOrigins.has(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
  }

  res.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

app.use(express.json({ limit: "8mb" }));

app.use("/api/items", itemsRoutes);
app.use("/api/metadata", metadataRoutes);
app.use("/api/games", gamesRoutes);
app.use("/api/stores", storesRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/player", playerRoutes);
app.use("/api/mfe", mfeRoutes);
app.use("/metadata-assets", express.static(path.resolve(__dirname, "data", "metadata-assets")));

// When the legacy web app is built in the monorepo, backend serves that static output directly.
if (fs.existsSync(legacyWebDistPath)) {
  app.use(express.static(legacyWebDistPath));

  app.get("*", (req, res, next) => {
    if (req.path.includes(".") || req.path.startsWith("/assets/")) return next();
    res.sendFile(path.join(legacyWebDistPath, "index.html"));
  });
}

app.use((req, res) => res.status(404).send("Not found"));

const db = require("./config/keys").mongoURI;

const port = process.env.PORT || 5000;

startMetadataWorker();

app.listen(port, () => console.log(`Woooshhh! Server Started! on port ${port}`));

