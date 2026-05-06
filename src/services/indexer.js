const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { getWorldsRoot, getWorldPaths, validateWorldName } = require("../data/filesystem");

// Mapa em memória: worldId -> Map<uid, relativePath>
const globalIndex = new Map();

/**
 * Escaneia recursivamente o diretório de páginas de um mundo para construir o índice de UIDs.
 */
async function indexWorld(worldName) {
  const safeName = validateWorldName(worldName);
  const { pages: pagesDir } = getWorldPaths(safeName);
  const worldMap = new Map();

  async function walk(dirPath, relativePath = "") {
    let entries;
    try {
      entries = await fs.readdir(dirPath, { withFileTypes: true });
    } catch (e) {
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;

      if (entry.isDirectory()) {
        const currentRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
        const fullDirPath = path.join(dirPath, entry.name);
        const metaPath = path.join(fullDirPath, "metadata.json");

        let metadata = {};
        let uid = null;
        let changed = false;

        try {
          const metaStr = await fs.readFile(metaPath, "utf-8");
          metadata = JSON.parse(metaStr);
          uid = metadata.uid;
        } catch (e) {
          // Meta não existe ou inválido
        }

        if (!uid) {
          uid = crypto.randomUUID();
          metadata.uid = uid;
          changed = true;
        }

        if (changed) {
          await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2), "utf-8");
        }

        // Mapeia o UID para o caminho relativo
        worldMap.set(uid, currentRelativePath);

        // Continua a varredura
        await walk(fullDirPath, currentRelativePath);
      }
    }
  }

  await walk(pagesDir);
  globalIndex.set(safeName, worldMap);
  console.log(`[Indexer] World "${safeName}" indexed. ${worldMap.size} nodes found.`);
}

/**
 * Inicializa o índice para todos os mundos existentes.
 */
async function initializeIndex() {
  const worldsRoot = getWorldsRoot();
  try {
    const entries = await fs.readdir(worldsRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        await indexWorld(entry.name);
      }
    }
  } catch (e) {
    console.error("[Indexer] Failed to initialize index:", e.message);
  }
}

/**
 * Retorna o caminho relativo de um documento baseado no seu UID.
 */
function getPathByUid(worldName, uid) {
  const worldMap = globalIndex.get(worldName);
  return worldMap ? worldMap.get(uid) : null;
}

/**
 * Atualiza o índice manualmente (útil após renomeações ou criações).
 */
function updateIndex(worldName, uid, relativePath) {
  let worldMap = globalIndex.get(worldName);
  if (!worldMap) {
    worldMap = new Map();
    globalIndex.set(worldName, worldMap);
  }
  worldMap.set(uid, relativePath);
}

/**
 * Remove um UID do índice.
 */
function removeFromIndex(worldName, uid) {
  const worldMap = globalIndex.get(worldName);
  if (worldMap) {
    worldMap.delete(uid);
  }
}

/**
 * Remove um mundo inteiro do índice.
 */
function removeWorldFromIndex(worldName) {
  globalIndex.delete(worldName);
}

module.exports = {
  initializeIndex,
  indexWorld,
  getPathByUid,
  updateIndex,
  removeFromIndex,
  removeWorldFromIndex
};
