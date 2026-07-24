const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { getDataRoot } = require("../data");
const { getAdminUsername } = require("../utils/auth");
const { normalizeGlobalRole } = require("../utils/roles");

const USERS_FILE = process.env.USERS_FILE || path.join(getDataRoot(), "users.json");
const USERNAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]{1,38}[A-Za-z0-9]$|^[A-Za-z0-9]{2}$/;

async function loadUserStore() {
  try {
    const content = await fs.readFile(USERS_FILE, "utf-8");
    const parsed = JSON.parse(content);
    return { users: Array.isArray(parsed.users) ? parsed.users : [] };
  } catch {
    return { users: [] };
  }
}

async function saveUserStore(store) {
  await fs.mkdir(path.dirname(USERS_FILE), { recursive: true });
  await fs.writeFile(USERS_FILE, JSON.stringify(store, null, 2), "utf-8");
}

function normalizeUsername(username) {
  return String(username || "").trim().toLowerCase();
}

function validateUsername(username) {
  const normalized = normalizeUsername(username);
  if (!USERNAME_PATTERN.test(normalized)) {
    const error = new Error("Username must be 2-40 characters using letters, numbers, dots, underscores, or hyphens");
    error.code = "INVALID_USER_INPUT";
    throw error;
  }
  if (normalized === normalizeUsername(getAdminUsername())) {
    const error = new Error("Username is reserved for the global admin");
    error.code = "USER_ALREADY_EXISTS";
    throw error;
  }
  return normalized;
}

function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    createdAt: user.createdAt,
    globalRole: normalizeGlobalRole(user.globalRole)
  };
}

function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString("hex");
    crypto.scrypt(String(password), salt, 64, (error, key) => {
      if (error) reject(error);
      else resolve(`scrypt:${salt}:${key.toString("hex")}`);
    });
  });
}

function verifyPassword(password, passwordHash) {
  return new Promise((resolve) => {
    const [algorithm, salt, hash] = String(passwordHash || "").split(":");
    if (algorithm !== "scrypt" || !salt || !hash) {
      resolve(false);
      return;
    }

    crypto.scrypt(String(password), salt, 64, (error, key) => {
      if (error) {
        resolve(false);
        return;
      }
      const expected = Buffer.from(hash, "hex");
      const actual = key;
      resolve(expected.length === actual.length && crypto.timingSafeEqual(expected, actual));
    });
  });
}

async function listUsers() {
  const store = await loadUserStore();
  return store.users.map(sanitizeUser);
}

async function listLoginUsers() {
  const store = await loadUserStore();
  return [
    { id: "root", username: getAdminUsername(), globalRole: "root" },
    ...store.users.map((user) => ({
        id: user.id,
        username: user.username,
        globalRole: normalizeGlobalRole(user.globalRole)
      }))
  ];
}

async function getUserById(userId) {
  const store = await loadUserStore();
  return sanitizeUser(store.users.find((user) => user.id === userId));
}

async function createUser(data) {
  const username = validateUsername(data?.username);
  const password = String(data?.password || "");
  if (password.length < 4) {
    const error = new Error("Password must have at least 4 characters");
    error.code = "INVALID_USER_INPUT";
    throw error;
  }

  const store = await loadUserStore();
  if (store.users.some((user) => normalizeUsername(user.username) === username)) {
    const error = new Error("User already exists");
    error.code = "USER_ALREADY_EXISTS";
    throw error;
  }

  const user = {
    id: crypto.randomUUID(),
    username,
    passwordHash: await hashPassword(password),
    createdAt: Date.now(),
    globalRole: null
  };
  store.users.push(user);
  await saveUserStore(store);
  return sanitizeUser(user);
}

async function changeUserPassword(userId, password) {
  const nextPassword = String(password || "");
  if (nextPassword.length < 4) {
    const error = new Error("Password must have at least 4 characters");
    error.code = "INVALID_USER_INPUT";
    throw error;
  }

  const store = await loadUserStore();
  const user = store.users.find((item) => item.id === userId);
  if (!user) {
    const error = new Error("User not found");
    error.code = "USER_NOT_FOUND";
    throw error;
  }

  user.passwordHash = await hashPassword(nextPassword);
  await saveUserStore(store);
  return sanitizeUser(user);
}

async function deleteUser(userId) {
  const store = await loadUserStore();
  const userIndex = store.users.findIndex((item) => item.id === userId);
  if (userIndex === -1) {
    const error = new Error("User not found");
    error.code = "USER_NOT_FOUND";
    throw error;
  }

  const [user] = store.users.splice(userIndex, 1);
  await saveUserStore(store);
  return sanitizeUser(user);
}

async function setUserGlobalRole(userId, globalRole) {
  if (globalRole !== null && globalRole !== "server-admin") {
    const error = new Error("Invalid global role");
    error.code = "INVALID_USER_INPUT";
    throw error;
  }

  const store = await loadUserStore();
  const user = store.users.find((item) => item.id === userId);
  if (!user) {
    const error = new Error("User not found");
    error.code = "USER_NOT_FOUND";
    throw error;
  }

  user.globalRole = globalRole;
  await saveUserStore(store);
  return sanitizeUser(user);
}

async function authenticateUser(username, password) {
  const normalized = normalizeUsername(username);
  const store = await loadUserStore();
  const user = store.users.find((item) => normalizeUsername(item.username) === normalized);
  if (!user) return null;
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return null;
  return sanitizeUser(user);
}

module.exports = {
  authenticateUser,
  changeUserPassword,
  createUser,
  deleteUser,
  getUserById,
  listLoginUsers,
  listUsers,
  normalizeUsername,
  setUserGlobalRole
};
