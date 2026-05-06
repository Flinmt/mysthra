const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");

const {
  copyCollaborationState,
  parseCollaborationRoom,
  removeCollaborationState
} = require("../../src/services/collaboration");
const { getDataRoot, resolveWorldRoot } = require("../../src/data");

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

test("collaboration state follows tab copy and delete lifecycle", async () => {
  const worldName = "collab-state-world";
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
