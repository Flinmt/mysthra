const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const SESSION_FILE = process.env.SESSION_FILE || path.join(process.cwd(), "data", "sessions.json");
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function getAdminUsername() {
  return process.env.ADMIN_USERNAME || "admin";
}

function getMasterPassword() {
  const configuredPassword = process.env.MASTER_PASSWORD;

  if (configuredPassword) {
    return configuredPassword;
  }

  if (process.env.NODE_ENV === "production") {
    const error = new Error("MASTER_PASSWORD must be configured in production");
    error.code = "AUTH_CONFIGURATION_ERROR";
    throw error;
  }

  return "admin";
}

function safeCompare(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

// Helper to load sessions from disk
function loadSessions() {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      const data = fs.readFileSync(SESSION_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        const migrated = {};
        for (const token of parsed) {
          migrated[token] = {
            userId: "admin",
            username: getAdminUsername(),
            isAdmin: true
          };
        }
        return migrated;
      }
      return parsed && typeof parsed === "object" ? parsed : {};
    }
  } catch (e) {
    console.error("Failed to load sessions:", e);
  }
  return {};
}

// Helper to save sessions to disk
function saveSessions(sessions) {
  try {
    const dir = path.dirname(SESSION_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(SESSION_FILE, JSON.stringify(sessions, null, 2), 'utf-8');
  } catch (e) {
    console.error("Failed to save sessions:", e);
  }
}

let activeSessions = loadSessions();

function generateSessionToken(user) {
  const token = crypto.randomBytes(32).toString("hex");
  activeSessions[token] = {
    userId: user.userId || user.id,
    username: user.username,
    isAdmin: Boolean(user.isAdmin)
  };
  saveSessions(activeSessions);
  return token;
}

function isHttpsRequest(request) {
  return request?.socket?.encrypted === true || request?.headers?.["x-forwarded-proto"] === "https";
}

function createSessionCookie(token, request) {
  const secure = process.env.NODE_ENV === "production" || isHttpsRequest(request) ? "; Secure" : "";
  return `mysthra_session=${token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${SESSION_MAX_AGE_SECONDS}${secure}`;
}

function createExpiredSessionCookie(request) {
  const secure = process.env.NODE_ENV === "production" || isHttpsRequest(request) ? "; Secure" : "";
  return `mysthra_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict${secure}`;
}

function isValidSession(token) {
  return Boolean(activeSessions[token]);
}

function clearSession(token) {
  delete activeSessions[token];
  saveSessions(activeSessions);
}

function clearSessionsForUser(userId) {
  let changed = false;
  for (const [token, session] of Object.entries(activeSessions)) {
    if (session?.userId === userId) {
      delete activeSessions[token];
      changed = true;
    }
  }
  if (changed) saveSessions(activeSessions);
}

// Helper to extract session cookie
function getSessionCookie(request) {
  const cookieHeader = request.headers?.cookie;
  if (!cookieHeader) return null;
  
  const cookies = cookieHeader.split(";").reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split("=");
    acc[key] = value;
    return acc;
  }, {});
  
  return cookies.mysthra_session || null;
}

function isAuthenticated(request) {
  const token = getSessionCookie(request);
  return token ? isValidSession(token) : false;
}

function getAuthenticatedUser(request) {
  const token = getSessionCookie(request);
  if (!token) return null;
  return activeSessions[token] || null;
}

module.exports = {
  createExpiredSessionCookie,
  createSessionCookie,
  generateSessionToken,
  getAdminUsername,
  getAuthenticatedUser,
  getMasterPassword,
  isValidSession,
  clearSession,
  clearSessionsForUser,
  getSessionCookie,
  isAuthenticated,
  safeCompare
};
