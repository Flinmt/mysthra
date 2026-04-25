const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const SESSION_FILE = path.join(process.cwd(), 'src', 'data', 'sessions.json');

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

function isValidSession(token) {
  return activeSessions.has(token);
}

function clearSession(token) {
  activeSessions.delete(token);
  saveSessions(activeSessions);
}

// Helper to extract session cookie
function getSessionCookie(request) {
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) return null;
  
  const cookies = cookieHeader.split(";").reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split("=");
    acc[key] = value;
    return acc;
  }, {});
  
  return cookies.mythra_session || null;
}

function isAuthenticated(request) {
  const token = getSessionCookie(request);
  return token ? isValidSession(token) : false;
}

module.exports = {
  generateSessionToken,
  isValidSession,
  clearSession,
  getSessionCookie,
  isAuthenticated
};
