const express = require("express");

const { requireAuth } = require("../../middleware/auth");
const {
  appendEvent,
  getProgressForUser,
  getGamificationStateForUser,
  setGamificationStateForUser,
  getGamificationStandings,
} = require("../../data/playerProgressStore");
const { findUserById, toPublicUser } = require("../../data/usersStore");

const router = express.Router();

router.get("/me/progress", requireAuth, (req, res) => {
  const progress = getProgressForUser(req.authUser.id);
  return res.json({ userId: req.authUser.id, progress });
});

router.post("/me/events", requireAuth, (req, res) => {
  const { type, payload } = req.body || {};
  if (!type || typeof type !== "string") {
    return res.status(400).json({ error: "type is required." });
  }

  const progress = appendEvent(req.authUser.id, type, payload || {});
  return res.status(201).json({ userId: req.authUser.id, progress });
});

router.get("/me/gamification", requireAuth, (req, res) => {
  const state = getGamificationStateForUser(req.authUser.id);
  return res.json({ userId: req.authUser.id, state });
});

router.put("/me/gamification", requireAuth, (req, res) => {
  const state = req.body?.state;
  if (!state || typeof state !== "object") {
    return res.status(400).json({ error: "state object is required." });
  }
  const saved = setGamificationStateForUser(req.authUser.id, state);
  return res.json({ userId: req.authUser.id, state: saved });
});

router.get("/standings", requireAuth, (req, res) => {
  const limit = Number(req.query?.limit || 50);
  const rows = getGamificationStandings(limit).map((entry) => {
    const user = findUserById(entry.userId);
    const publicUser = user ? toPublicUser(user) : null;
    return {
      ...entry,
      user: publicUser || {
        id: entry.userId,
        username: "unknown",
        displayName: "Unknown User",
        callsign: "UNK",
      },
    };
  });
  return res.json({ standings: rows });
});

module.exports = router;
