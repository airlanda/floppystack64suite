const express = require("express");

const { authenticateUser, createUser, toPublicUser } = require("../../data/usersStore");
const { signAuthToken } = require("../../services/authTokens");
const { requireAuth } = require("../../middleware/auth");

const router = express.Router();

router.post("/register", (req, res) => {
  try {
    const { username, password, displayName, callsign } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: "username and password are required." });
    }

    const user = createUser({ username, password, displayName, callsign });
    const publicUser = toPublicUser(user);
    const token = signAuthToken({ userId: publicUser.id, username: publicUser.username });
    return res.status(201).json({ token, user: publicUser });
  } catch (error) {
    return res.status(400).json({ error: error.message || "Failed to create user." });
  }
});

router.post("/login", (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: "username and password are required." });
    }

    const user = authenticateUser({ username, password });
    if (!user) {
      return res.status(401).json({ error: "Invalid username or password." });
    }

    const publicUser = toPublicUser(user);
    const token = signAuthToken({ userId: publicUser.id, username: publicUser.username });
    return res.json({ token, user: publicUser });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Login failed." });
  }
});

router.get("/me", requireAuth, (req, res) => {
  return res.json({ user: req.authUser });
});

router.post("/logout", requireAuth, (_req, res) => {
  return res.json({ success: true });
});

module.exports = router;
