const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createSessionCookie,
  getMasterPassword,
  safeCompare
} = require("../../src/utils/auth");
const { isGlobalAdmin, isRoot, isServerAdmin, normalizeGlobalRole } = require("../../src/utils/roles");

test("getMasterPassword requires explicit configuration in production", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalMasterPassword = process.env.MASTER_PASSWORD;

  try {
    delete process.env.MASTER_PASSWORD;
    process.env.NODE_ENV = "production";

    assert.throws(() => getMasterPassword(), { code: "AUTH_CONFIGURATION_ERROR" });

    process.env.MASTER_PASSWORD = "configured-secret";
    assert.equal(getMasterPassword(), "configured-secret");
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;

    if (originalMasterPassword === undefined) delete process.env.MASTER_PASSWORD;
    else process.env.MASTER_PASSWORD = originalMasterPassword;
  }
});

test("session cookies use secure attributes in production", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "production";

    const cookie = createSessionCookie("token", { headers: {} });

    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Strict/);
    assert.match(cookie, /Max-Age=86400/);
    assert.match(cookie, /Secure/);
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  }
});

test("safeCompare compares matching strings without plain equality", () => {
  assert.equal(safeCompare("secret", "secret"), true);
  assert.equal(safeCompare("secret", "different"), false);
});

test("global roles distinguish root, server admin, and common users", () => {
  assert.equal(isRoot({ globalRole: "root" }), true);
  assert.equal(isServerAdmin({ globalRole: "server-admin" }), true);
  assert.equal(isGlobalAdmin({ globalRole: "root" }), true);
  assert.equal(isGlobalAdmin({ globalRole: "server-admin" }), true);
  assert.equal(isGlobalAdmin({ globalRole: null }), false);
  assert.equal(normalizeGlobalRole("root"), null);
  assert.equal(normalizeGlobalRole("server-admin"), "server-admin");
});
