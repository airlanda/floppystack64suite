const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const USERS_PATH = path.resolve(__dirname, "users.json");

function ensureUsersFile() {
  if (fs.existsSync(USERS_PATH)) return;
  fs.writeFileSync(USERS_PATH, "[]\n", "utf8");
}

function readUsers() {
  ensureUsersFile();
  const raw = fs.readFileSync(USERS_PATH, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];
  let changed = false;
  const normalized = parsed.map((entry) => {
    if (!entry || typeof entry !== "object") return entry;
    const fallbackCallsign = String(entry.username || "").trim().toUpperCase() || "PLAYER";
    if (entry.callsign && String(entry.callsign).trim()) return entry;
    changed = true;
    return {
      ...entry,
      callsign: fallbackCallsign,
    };
  });
  if (changed) writeUsers(normalized);
  return normalized;
}

function writeUsers(users) {
  fs.writeFileSync(USERS_PATH, `${JSON.stringify(users, null, 2)}\n`, "utf8");
}

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

function validateUsername(username) {
  return /^[a-z0-9._-]{3,24}$/.test(username);
}

function validatePassword(password) {
  return typeof password === "string" && password.length >= 8;
}

function normalizeCallsign(value, usernameFallback = "") {
  const text = String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 18);
  if (text) return text.toUpperCase();
  return String(usernameFallback || "PLAYER").trim().toUpperCase();
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password, storedHash) {
  const parts = String(storedHash || "").split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = parts[1];
  const expectedHex = parts[2];
  const actual = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, "hex");
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual);
}

function toPublicUser(user) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName || user.username,
    callsign: normalizeCallsign(user.callsign, user.username),
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt || null,
  };
}

function findUserByUsername(usernameInput) {
  const username = normalizeUsername(usernameInput);
  const users = readUsers();
  return users.find((user) => normalizeUsername(user.username) === username) || null;
}

function findUserById(userId) {
  const users = readUsers();
  return users.find((user) => String(user.id) === String(userId)) || null;
}

function createUser({ username: usernameInput, password, displayName, callsign }) {
  const username = normalizeUsername(usernameInput);
  if (!validateUsername(username)) {
    throw new Error("Username must be 3-24 chars: letters, numbers, dot, underscore, dash.");
  }
  if (!validatePassword(password)) {
    throw new Error("Password must be at least 8 characters.");
  }

  const users = readUsers();
  if (users.some((user) => normalizeUsername(user.username) === username)) {
    throw new Error("Username already exists.");
  }

  const now = new Date().toISOString();
  const nextUser = {
    id: crypto.randomUUID(),
    username,
    displayName: String(displayName || "").trim() || username,
    callsign: normalizeCallsign(callsign, username),
    passwordHash: hashPassword(password),
    createdAt: now,
    lastLoginAt: null,
  };

  users.push(nextUser);
  writeUsers(users);
  return nextUser;
}

function authenticateUser({ username: usernameInput, password }) {
  const username = normalizeUsername(usernameInput);
  const users = readUsers();
  const user = users.find((entry) => normalizeUsername(entry.username) === username);
  if (!user) return null;
  if (!verifyPassword(password, user.passwordHash)) return null;

  user.lastLoginAt = new Date().toISOString();
  writeUsers(users);
  return user;
}

module.exports = {
  authenticateUser,
  createUser,
  findUserById,
  findUserByUsername,
  normalizeUsername,
  toPublicUser,
};
