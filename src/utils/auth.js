const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const SESSION_FILE = process.env.SESSION_FILE || path.join(process.cwd(), "data", "sessions.json");
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

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
      return new Set(JSON.parse(data));
    }
  } catch (e) {
    console.error("Failed to load sessions:", e);
  }
  return new Set();
}

// Helper to save sessions to disk
function saveSessions(sessions) {
  try {
    const dir = path.dirname(SESSION_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(SESSION_FILE, JSON.stringify([...sessions]), 'utf-8');
  } catch (e) {
    console.error("Failed to save sessions:", e);
  }
}

let activeSessions = loadSessions();

function generateSessionToken() {
  const token = crypto.randomBytes(32).toString("hex");
  activeSessions.add(token);
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
  return activeSessions.has(token);
}

function clearSession(token) {
  activeSessions.delete(token);
  saveSessions(activeSessions);
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

module.exports = {
  createExpiredSessionCookie,
  createSessionCookie,
  generateSessionToken,
  getMasterPassword,
  isValidSession,
  clearSession,
  getSessionCookie,
  isAuthenticated,
  safeCompare
};
