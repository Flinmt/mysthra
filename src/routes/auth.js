const { sendJson } = require("../utils/http");
const {
  clearSession,
  createExpiredSessionCookie,
  createSessionCookie,
  generateSessionToken,
  getAdminUsername,
  getAuthenticatedUser,
  getMasterPassword,
  safeCompare
} = require("../utils/auth");
const { authenticateUser, listLoginUsers } = require("../services");
const { getErrorMessage, getErrorStatusCode } = require("./errors");

function getPublicUser(user) {
  if (!user) return null;
  return { userId: user.userId, username: user.username, globalRole: user.globalRole || null };
}

async function handleAuthRoute({ request, response, pathname, parseJsonBody }) {
  if (request.method === "POST" && pathname === "/api/auth/login") {
    try {
      const body = await parseJsonBody(request);
      const { password } = body;
      const username = body.username || getAdminUsername();
      const isRootLogin = String(username).trim().toLowerCase() === getAdminUsername().toLowerCase();

      if (isRootLogin && typeof password === "string" && safeCompare(password, getMasterPassword())) {
        const user = { userId: "root", username: getAdminUsername(), globalRole: "root" };
        const token = generateSessionToken(user);
        response.setHeader("Set-Cookie", createSessionCookie(token, request));
        sendJson(response, 200, { success: true, user });
        return true;
      }

      const user = await authenticateUser(username, password);
      if (user) {
        const publicUser = { userId: user.id, username: user.username, globalRole: user.globalRole };
        const token = generateSessionToken(publicUser);
        response.setHeader("Set-Cookie", createSessionCookie(token, request));
        sendJson(response, 200, { success: true, user: publicUser });
        return true;
      }
      sendJson(response, 401, { error: "Invalid username or password" });
    } catch (error) {
      const statusCode = getErrorStatusCode(error);
      sendJson(response, statusCode, { error: statusCode === 413 ? getErrorMessage(error, statusCode) : "Invalid request" });
    }
    return true;
  }

  if (request.method === "POST" && pathname === "/api/auth/logout") {
    const cookieHeader = request.headers?.cookie;
    if (cookieHeader) {
      const cookies = cookieHeader.split(";").reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split("=");
        acc[key] = value;
        return acc;
      }, {});
      if (cookies.mysthra_session) clearSession(cookies.mysthra_session);
    }
    response.setHeader("Set-Cookie", createExpiredSessionCookie(request));
    sendJson(response, 200, { success: true });
    return true;
  }

  if (request.method === "GET" && pathname === "/api/auth/verify") {
    const user = getAuthenticatedUser(request);
    sendJson(response, 200, { authenticated: Boolean(user), user: getPublicUser(user) });
    return true;
  }

  if (request.method === "GET" && pathname === "/api/auth/users") {
    try {
      sendJson(response, 200, { items: await listLoginUsers() });
    } catch {
      sendJson(response, 200, { items: [{ id: "root", username: getAdminUsername(), globalRole: "root" }] });
    }
    return true;
  }

  return false;
}

module.exports = { handleAuthRoute };
