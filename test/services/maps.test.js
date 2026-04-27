const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const test = require("node:test");

const { resolveWorldRoot } = require("../../src/data");
const { router } = require("../../src/routes");
const { generateSessionToken } = require("../../src/utils/auth");
const {
  createMap,
  listMaps,
  readMap,
  updateMap
} = require("../../src/services/maps");

const createdWorlds = new Set();

async function resetWorld(worldName) {
  createdWorlds.add(worldName);
  await fs.rm(resolveWorldRoot(worldName), { recursive: true, force: true });
}

function createAuthenticatedHeaders() {
  return {
    cookie: `mysthra_session=${generateSessionToken()}`
  };
}

function createJsonRequest(method, url, body) {
  const payload = JSON.stringify(body);
  return {
    method,
    url,
    headers: createAuthenticatedHeaders(),
    on(event, handler) {
      if (event === "data") handler(payload);
      if (event === "end") handler();
    }
  };
}

function createJsonResponse(result) {
  return {
    writeHead(statusCode, headers) {
      result.statusCode = statusCode;
      result.headers = headers;
    },
    end(body) {
      result.body = JSON.parse(body);
    }
  };
}

test.after(async () => {
  await Promise.all(
    [...createdWorlds].map((worldName) =>
      fs.rm(resolveWorldRoot(worldName), { recursive: true, force: true })
    )
  );
});

test("createMap stores a map with normalized pins", async () => {
  const worldName = "maps-create-world";
  await resetWorld(worldName);

  const map = await createMap(worldName, {
    name: "Mapa do Norte",
    imagePath: "maps/norte.webp",
    pins: [
      {
        label: "Capital",
        x: 0.25,
        y: 0.75,
        target: "cidades/capital"
      }
    ]
  });

  assert.equal(map.id, "mapa-do-norte");
  assert.equal(map.imagePath, "maps/norte.webp");
  assert.equal(map.pins.length, 1);
  assert.equal(typeof map.pins[0].id, "string");
  assert.equal(map.pins[0].target, "cidades/capital");
});

test("listMaps and readMap return stored maps", async () => {
  const worldName = "maps-list-world";
  await resetWorld(worldName);

  await createMap(worldName, {
    name: "Mapa Um",
    imagePath: "maps/um.webp"
  });

  const maps = await listMaps(worldName);
  const map = await readMap(worldName, "mapa-um");

  assert.equal(maps.length, 1);
  assert.equal(maps[0].id, "mapa-um");
  assert.equal(map.name, "Mapa Um");
});

test("updateMap replaces pins and preserves id", async () => {
  const worldName = "maps-update-world";
  await resetWorld(worldName);

  await createMap(worldName, {
    name: "Mapa",
    imagePath: "maps/base.webp"
  });

  const map = await updateMap(worldName, "mapa", {
    name: "Mapa Editado",
    pins: [
      {
        id: "pin-1",
        label: "Portal",
        x: 0.5,
        y: 0.5
      }
    ]
  });

  assert.equal(map.id, "mapa");
  assert.equal(map.name, "Mapa Editado");
  assert.equal(map.imagePath, "maps/base.webp");
  assert.equal(map.pins[0].id, "pin-1");
});

test("createMap rejects invalid pin coordinates", async () => {
  const worldName = "maps-invalid-world";
  await resetWorld(worldName);

  await assert.rejects(
    () => createMap(worldName, {
      name: "Mapa",
      imagePath: "maps/base.webp",
      pins: [{ label: "Fora", x: 1.5, y: 0.2 }]
    }),
    { code: "INVALID_MAP_INPUT" }
  );
});

test("POST /api/worlds/:id/maps creates a map payload", async () => {
  const worldName = "maps-route-world";
  await resetWorld(worldName);

  const result = {};
  await router(
    createJsonRequest("POST", `/api/worlds/${worldName}/maps`, {
      name: "Mapa de Rota",
      imagePath: "maps/route.webp"
    }),
    createJsonResponse(result)
  );

  assert.equal(result.statusCode, 201);
  assert.equal(result.body.id, "mapa-de-rota");
});

test("GET /api/worlds/:id/maps requires auth when public read is disabled", async () => {
  const originalPublicRead = process.env.PUBLIC_READ;
  delete process.env.PUBLIC_READ;

  try {
    const result = {};
    await router(
      { method: "GET", url: "/api/worlds/maps-route-world/maps" },
      createJsonResponse(result)
    );

    assert.equal(result.statusCode, 401);
  } finally {
    if (originalPublicRead === undefined) delete process.env.PUBLIC_READ;
    else process.env.PUBLIC_READ = originalPublicRead;
  }
});
