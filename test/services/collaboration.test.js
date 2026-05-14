const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");

const {
  copyCollaborationState,
  createCollaborationServer,
  parseCollaborationRoom,
  removeCollaborationState,
  resolveTabRoom
} = require("../../src/services/collaboration");
const { createDocument } = require("../../src/services/tree");
const { createWorld, updateWorld } = require("../../src/services/worlds");
const { getDataRoot, resolveWorldRoot } = require("../../src/data");
const { generateSessionToken } = require("../../src/utils/auth");
const { HocuspocusProvider } = require("../../client/node_modules/@hocuspocus/provider");
const Y = require("yjs");

const createdWorlds = new Set();

test.after(async () => {
  await Promise.all(
    [...createdWorlds].map((worldName) =>
      fs.rm(resolveWorldRoot(worldName), { recursive: true, force: true })
    )
  );
});

test("parseCollaborationRoom accepts presence and wiki tab room names", () => {
  assert.deepEqual(parseCollaborationRoom("world:collab-world:presence"), {
    type: "presence",
    worldId: "collab-world"
  });

  assert.deepEqual(parseCollaborationRoom("world:collab-world:tab:tab-123"), {
    type: "tab",
    worldId: "collab-world",
    tabUid: "tab-123"
  });

  assert.throws(
    () => parseCollaborationRoom("world:collab-world:asset:file-123"),
    { code: "INVALID_COLLABORATION_ROOM" }
  );
});

test("resolveTabRoom accepts wiki and map tabs only", async () => {
  const worldName = `collab-map-world-${Date.now()}`;
  createdWorlds.add(worldName);
  await createWorld({ name: worldName });

  const wikiTab = await createDocument(worldName, "Wiki Tab", "", {
    type: "tab",
    contentType: "wiki"
  });
  const mapTab = await createDocument(worldName, "Map Tab", "", {
    type: "tab",
    contentType: "map"
  });
  const invalidTab = await createDocument(worldName, "Secret Tab", "", {
    type: "tab",
    contentType: "secret"
  });

  assert.equal((await resolveTabRoom({ type: "tab", worldId: worldName, tabUid: wikiTab.uid })).tabUid, wikiTab.uid);
  assert.equal((await resolveTabRoom({ type: "tab", worldId: worldName, tabUid: mapTab.uid })).tabUid, mapTab.uid);

  await assert.rejects(
    () => resolveTabRoom({ type: "tab", worldId: worldName, tabUid: invalidTab.uid }),
    { code: "DOCUMENT_NOT_FOUND" }
  );
});

test("collaboration state follows tab copy and delete lifecycle", async () => {
  const worldName = `collab-state-world-${Date.now()}`;
  createdWorlds.add(worldName);
  const sourceUid = "source-tab";
  const targetUid = "target-tab";
  const yjsRoot = path.join(getDataRoot(), "worlds", worldName, "yjs");
  const sourcePath = path.join(yjsRoot, `${sourceUid}.bin`);
  const targetPath = path.join(yjsRoot, `${targetUid}.bin`);

  await fs.mkdir(yjsRoot, { recursive: true });
  await fs.writeFile(sourcePath, Buffer.from("state"));

  await copyCollaborationState(
    worldName,
    { uid: sourceUid, type: "tab" },
    { uid: targetUid, type: "tab" }
  );

  assert.equal(await fs.readFile(targetPath, "utf-8"), "state");

  await removeCollaborationState(worldName, { uid: targetUid, type: "tab" });

  await assert.rejects(
    () => fs.stat(targetPath),
    { code: "ENOENT" }
  );
});

function createLocalWebSocketPolyfill(server, cookie = "") {
  return class LocalWebSocket {
    constructor(url) {
      this.url = url;
      this.readyState = 0;
      this.listeners = {};
      this.serverSocket = {
        readyState: 1,
        send: (data) => this.dispatch("message", { data }),
        close: (code = 1000, reason = "") => {
          this.readyState = 3;
          this.dispatch("close", { code, reason });
        }
      };
      this.connection = server.handleConnection(
        this.serverSocket,
        new Request(url, { headers: cookie ? { cookie } : {} })
      );
      setTimeout(() => {
        this.readyState = 1;
        this.dispatch("open", {});
      }, 0);
    }

    addEventListener(name, handler) {
      if (!this.listeners[name]) this.listeners[name] = new Set();
      this.listeners[name].add(handler);
    }

    removeEventListener(name, handler) {
      this.listeners[name]?.delete(handler);
    }

    dispatch(name, event) {
      for (const handler of this.listeners[name] || []) {
        handler(event);
      }
    }

    send(data) {
      this.connection.handleMessage(data instanceof Uint8Array ? data : new Uint8Array(data));
    }

    close(code = 1000, reason = "") {
      this.readyState = 3;
      this.connection.handleClose({ code, reason });
      this.dispatch("close", { code, reason });
    }
  };
}

async function waitFor(assertion, timeoutMs = 2500) {
  const start = Date.now();
  let lastError;
  while (Date.now() - start < timeoutMs) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await new Promise(resolve => setTimeout(resolve, 25));
    }
  }
  throw lastError;
}

test("hocuspocus providers sync and persist tab state", async () => {
  const worldName = `collab-runtime-${Date.now()}`;
  createdWorlds.add(worldName);
  await createWorld({ name: worldName });
  const tab = await createDocument(worldName, "Runtime Wiki", "", {
    type: "tab",
    contentType: "wiki"
  });

  const token = generateSessionToken({ userId: "admin", username: "admin", isAdmin: true });
  const server = createCollaborationServer();
  const WebSocketPolyfill = createLocalWebSocketPolyfill(server, `mysthra_session=${token}`);
  const roomName = `world:${worldName}:tab:${tab.uid}`;
  const firstDoc = new Y.Doc();
  const secondDoc = new Y.Doc();
  const authenticatedScopes = [];
  const firstProvider = new HocuspocusProvider({
    url: "ws://local/collaboration",
    name: roomName,
    document: firstDoc,
    WebSocketPolyfill,
    onAuthenticated: ({ scope }) => authenticatedScopes.push(scope)
  });
  const secondProvider = new HocuspocusProvider({
    url: "ws://local/collaboration",
    name: roomName,
    document: secondDoc,
    WebSocketPolyfill,
    onAuthenticated: ({ scope }) => authenticatedScopes.push(scope)
  });
  const firstItems = firstDoc.getArray("runtimeItems");
  const secondItems = secondDoc.getArray("runtimeItems");

  try {
    await waitFor(() => assert.equal(authenticatedScopes.filter(scope => scope === "read-write").length, 2));
    firstItems.push(["synced"]);
    await waitFor(() => assert.deepEqual(secondItems.toArray(), ["synced"]));

    firstProvider.destroy();
    secondProvider.destroy();
    await new Promise(resolve => setTimeout(resolve, 250));

    const statePath = path.join(getDataRoot(), "worlds", worldName, "yjs", `${tab.uid}.bin`);
    const persisted = await fs.stat(statePath);
    assert.ok(persisted.size > 0);

    const reloadDoc = new Y.Doc();
    const reloadProvider = new HocuspocusProvider({
      url: "ws://local/collaboration",
      name: roomName,
      document: reloadDoc,
      WebSocketPolyfill
    });
    try {
      await waitFor(() => assert.deepEqual(reloadDoc.getArray("runtimeItems").toArray(), ["synced"]));
    } finally {
      reloadProvider.destroy();
      reloadDoc.destroy();
    }
  } finally {
    firstProvider.destroy();
    secondProvider.destroy();
    firstDoc.destroy();
    secondDoc.destroy();
    await new Promise(resolve => setTimeout(resolve, 250));
  }
});

test("unauthenticated collaboration is read-only only for public worlds", async () => {
  const publicWorld = `collab-public-${Date.now()}`;
  const privateWorld = `collab-private-${Date.now()}`;
  createdWorlds.add(publicWorld);
  createdWorlds.add(privateWorld);
  await createWorld({ name: publicWorld });
  await createWorld({ name: privateWorld });
  await updateWorld(publicWorld, { publicRead: true });
  const publicTab = await createDocument(publicWorld, "Public Wiki", "", {
    type: "tab",
    contentType: "wiki"
  });
  const privateTab = await createDocument(privateWorld, "Private Wiki", "", {
    type: "tab",
    contentType: "wiki"
  });

  const server = createCollaborationServer();
  const publicDoc = new Y.Doc();
  const privateDoc = new Y.Doc();
  const publicScopes = [];
  const privateFailures = [];
  const PublicWebSocket = createLocalWebSocketPolyfill(server);
  const PrivateWebSocket = createLocalWebSocketPolyfill(server);
  const publicProvider = new HocuspocusProvider({
    url: "ws://local/collaboration",
    name: `world:${publicWorld}:tab:${publicTab.uid}`,
    document: publicDoc,
    WebSocketPolyfill: PublicWebSocket,
    onAuthenticated: ({ scope }) => publicScopes.push(scope)
  });
  const privateProvider = new HocuspocusProvider({
    url: "ws://local/collaboration",
    name: `world:${privateWorld}:tab:${privateTab.uid}`,
    document: privateDoc,
    WebSocketPolyfill: PrivateWebSocket,
    onAuthenticationFailed: ({ reason }) => privateFailures.push(reason)
  });

  try {
    await waitFor(() => assert.equal(publicScopes.includes("readonly"), true));
    await waitFor(() => assert.equal(privateFailures.includes("unauthorized"), true));
  } finally {
    publicProvider.destroy();
    privateProvider.destroy();
    publicDoc.destroy();
    privateDoc.destroy();
    await new Promise(resolve => setTimeout(resolve, 250));
  }
});
