const crypto = require("node:crypto");

// Store active sessions in memory
const activeSessions = new Set();

function generateSessionToken() {
  const token = crypto.randomBytes(32).toString("hex");
  activeSessions.add(token);
  return token;
}

function isValidSession(token) {
  return activeSessions.has(token);
}

function clearSession(token) {
  activeSessions.delete(token);
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
