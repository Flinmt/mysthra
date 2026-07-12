const GLOBAL_ROLES = new Set(["root", "server-admin"]);

function normalizeGlobalRole(role) {
  return role === "server-admin" ? "server-admin" : null;
}

function isRoot(user) {
  return user?.globalRole === "root";
}

function isServerAdmin(user) {
  return user?.globalRole === "server-admin";
}

function isGlobalAdmin(user) {
  return GLOBAL_ROLES.has(user?.globalRole);
}

module.exports = {
  isGlobalAdmin,
  isRoot,
  isServerAdmin,
  normalizeGlobalRole
};
