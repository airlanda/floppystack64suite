const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();
const manifestPaths = {
  default: path.resolve(__dirname, "../../data/fs64-remote-manifest.json"),
  angular: path.resolve(__dirname, "../../data/fs64-angular-remote-manifest.json"),
};

function getManifestPath(requestedManifest) {
  return manifestPaths[requestedManifest] || manifestPaths.default;
}

router.get("/manifest", (_req, res) => {
  try {
    const manifestKey = String(_req.query.manifest || "default").trim().toLowerCase();
    const manifestPath = getManifestPath(manifestKey);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    return res.json(manifest);
  } catch (error) {
    console.error("Failed to read FS64 remote manifest:", error);
    return res.status(500).json({ error: "Failed to load FS64 remote manifest." });
  }
});

module.exports = router;
