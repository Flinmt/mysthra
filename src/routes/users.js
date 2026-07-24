const { sendJson } = require("../utils/http");
const { clearSessionsForUser, getAdminUsername } = require("../utils/auth");
const { isGlobalAdmin, isRoot, isServerAdmin } = require("../utils/roles");
const {
  changeUserPassword,
  createUser,
  deleteUser,
  getUserById,
  getWorldAccessCounts,
  listUsers,
  listUserWorldAccess,
  removeUserFromAllWorlds,
  setUserGlobalRole
} = require("../services");
const { getErrorMessage, getErrorStatusCode } = require("./errors");

function sendForbidden(response) {
  sendJson(response, 403, { error: "Forbidden" });
}

function requireAdmin(response, user) {
  if (isGlobalAdmin(user)) return true;
  sendForbidden(response);
  return false;
}

async function handleUserRoute({ request, response, pathname, currentUser, parseJsonBody }) {
  if (!pathname.startsWith("/api/users")) return false;

  if (pathname === "/api/users") {
    if (!requireAdmin(response, currentUser)) return true;
    if (request.method === "GET") {
      try {
        const users = await listUsers();
        const accessCounts = await getWorldAccessCounts();
        sendJson(response, 200, {
          items: [
            { id: "root", username: getAdminUsername(), globalRole: "root", worldCount: null },
            ...users.map((user) => ({ ...user, worldCount: accessCounts[user.id] || 0 }))
          ]
        });
      } catch {
        sendJson(response, 500, { error: "Failed to list users" });
      }
      return true;
    }
    if (request.method === "POST") {
      try {
        sendJson(response, 201, await createUser(await parseJsonBody(request)));
      } catch (error) {
        const statusCode = getErrorStatusCode(error);
        sendJson(response, statusCode, { error: getErrorMessage(error, statusCode) });
      }
      return true;
    }
  }

  if (/^\/api\/users\/[^/]+\/worlds$/.test(pathname) && request.method === "GET") {
    if (!requireAdmin(response, currentUser)) return true;
    try {
      const userId = decodeURIComponent(pathname.split("/")[3]);
      const targetUser = userId === "root" ? { id: "root" } : await getUserById(userId);
      if (!targetUser) sendJson(response, 404, { error: "User not found" });
      else sendJson(response, 200, { items: await listUserWorldAccess(userId) });
    } catch (error) {
      const statusCode = getErrorStatusCode(error);
      sendJson(response, statusCode, { error: getErrorMessage(error, statusCode) });
    }
    return true;
  }

  if (/^\/api\/users\/[^/]+\/password$/.test(pathname) && request.method === "PATCH") {
    if (!requireAdmin(response, currentUser)) return true;
    try {
      const userId = decodeURIComponent(pathname.split("/")[3]);
      const targetUser = await getUserById(userId);
      if (!targetUser || (isServerAdmin(currentUser) && targetUser.globalRole === "server-admin")) {
        sendForbidden(response);
      } else {
        const user = await changeUserPassword(userId, (await parseJsonBody(request)).password);
        clearSessionsForUser(userId);
        sendJson(response, 200, user);
      }
    } catch (error) {
      const statusCode = getErrorStatusCode(error);
      sendJson(response, statusCode, { error: getErrorMessage(error, statusCode) });
    }
    return true;
  }

  if (/^\/api\/users\/[^/]+\/role$/.test(pathname) && request.method === "PATCH") {
    if (!isRoot(currentUser)) {
      sendForbidden(response);
      return true;
    }
    try {
      const userId = decodeURIComponent(pathname.split("/")[3]);
      if (userId === "root") sendForbidden(response);
      else {
        const body = await parseJsonBody(request);
        const user = await setUserGlobalRole(userId, body.globalRole === null ? null : body.globalRole);
        clearSessionsForUser(userId);
        sendJson(response, 200, user);
      }
    } catch (error) {
      const statusCode = getErrorStatusCode(error);
      sendJson(response, statusCode, { error: getErrorMessage(error, statusCode) });
    }
    return true;
  }

  if (/^\/api\/users\/[^/]+$/.test(pathname) && request.method === "DELETE") {
    if (!requireAdmin(response, currentUser)) return true;
    try {
      const userId = decodeURIComponent(pathname.split("/")[3]);
      const targetUser = await getUserById(userId);
      if (!targetUser || (isServerAdmin(currentUser) && targetUser.globalRole === "server-admin")) {
        sendForbidden(response);
      } else {
        const user = await deleteUser(userId);
        await removeUserFromAllWorlds(userId);
        clearSessionsForUser(userId);
        sendJson(response, 200, user);
      }
    } catch (error) {
      const statusCode = getErrorStatusCode(error);
      sendJson(response, statusCode, { error: getErrorMessage(error, statusCode) });
    }
    return true;
  }

  return false;
}

module.exports = { handleUserRoute };
