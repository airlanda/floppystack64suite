const { verifyAuthToken } = require("../services/authTokens");
const { findUserById, toPublicUser } = require("../data/usersStore");

function extractBearerToken(req) {
  const value = req.headers?.authorization || "";
  const [scheme, token] = value.split(" ");
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== "bearer") return null;
  return token;
}

function resolveAuth(req) {
  const token = extractBearerToken(req);
  if (!token) return null;
  const payload = verifyAuthToken(token);
  if (!payload) return null;
  const user = findUserById(payload.sub);
  if (!user) return null;
  return toPublicUser(user);
}

function optionalAuth(req, _res, next) {
  req.authUser = resolveAuth(req);
  next();
}

function requireAuth(req, res, next) {
  req.authUser = resolveAuth(req);
  if (!req.authUser) {
    return res.status(401).json({ error: "Authentication required." });
  }
  return next();
}

module.exports = {
  optionalAuth,
  requireAuth,
};

