const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { getWorldPaths, validateRelativePath, ensureWorldStructure, validateWorldName } = require("../data/filesystem");

async function getFileTree(worldName) {
  const safeName = validateWorldName(worldName);
  await ensureWorldStructure(safeName);
  
  const { pages: pagesDir } = getWorldPaths(safeName);
  
  async function walk(dirPath, relativePath = "") {
    let entries;
    try {
      entries = await fs.readdir(dirPath, { withFileTypes: true });
    } catch (e) {
      return [];
    }
    
    const nodes = [];
    
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue; // ignore hidden
      
      if (entry.isDirectory()) {
        const currentRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
        
        let metadata = {};
        let icon = null;
        let uid = null;
        try {
          const metaPath = path.join(dirPath, entry.name, "metadata.json");
          try {
            const metaStr = await fs.readFile(metaPath, "utf-8");
            metadata = JSON.parse(metaStr);
          } catch (e) {
            // Meta doesn't exist or is invalid
          }

          let changed = false;
          if (metadata.icon) icon = metadata.icon;
          
          if (metadata.uid) {
            uid = metadata.uid;
          } else {
            uid = crypto.randomUUID();
            metadata.uid = uid;
            changed = true;
          }

          if (changed) {
            await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2), "utf-8");
          }
        } catch (e) {
          // ignore error in individual meta reading
        }
        
        const children = await walk(path.join(dirPath, entry.name), currentRelativePath);
        
        nodes.push({
          name: entry.name,
          path: currentRelativePath,
          type: "document",
          icon,
          uid,
          contentType: metadata.contentType || "wiki",
          relationToParent: metadata.relationToParent || "tree",
          metadata,
          children
        });
      }
    }
    
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    
    return nodes;
  }
  
  return walk(pagesDir);
}

async function readDocumentMetadata(pagesDir, safePath) {
  const metaPath = path.join(pagesDir, safePath, "metadata.json");
  try {
    const metaStr = await fs.readFile(metaPath, "utf-8");
    return JSON.parse(metaStr);
  } catch (e) {
    return {};
  }
}

async function writeDocumentMetadata(pagesDir, safePath, metadata) {
  const metaPath = path.join(pagesDir, safePath, "metadata.json");
  await fs.mkdir(path.dirname(metaPath), { recursive: true });
  await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2), "utf-8");
}

async function createDocument(worldName, docPath, content, metadata = {}) {
  const safeName = validateWorldName(worldName);
  const safePath = validateRelativePath(docPath);
  await ensureWorldStructure(safeName);
  const { pages: pagesDir } = getWorldPaths(safeName);
  
  const fullDirPath = path.join(pagesDir, safePath);
  
  await fs.mkdir(fullDirPath, { recursive: true });
  
  const indexPath = path.join(fullDirPath, "index.md");
  await fs.writeFile(indexPath, content || "", "utf-8");

  const currentMeta = await readDocumentMetadata(pagesDir, safePath);
  const uid = currentMeta.uid || crypto.randomUUID();
  const nextMeta = {
    ...currentMeta,
    ...metadata,
    uid,
    contentType: metadata.contentType || currentMeta.contentType || "wiki"
  };
  await writeDocumentMetadata(pagesDir, safePath, nextMeta);
  
  return { success: true, path: safePath, uid };
}

async function createDocumentPlaceholder(worldName, docPath, metadata = {}) {
  const safeName = validateWorldName(worldName);
  const safePath = validateRelativePath(docPath);
  await ensureWorldStructure(safeName);
  const { pages: pagesDir } = getWorldPaths(safeName);
  const fullDirPath = path.join(pagesDir, safePath);
  await fs.mkdir(fullDirPath, { recursive: true });

  const currentMeta = await readDocumentMetadata(pagesDir, safePath);
  const uid = currentMeta.uid || crypto.randomUUID();
  const nextMeta = {
    ...currentMeta,
    ...metadata,
    uid,
    contentType: metadata.contentType || currentMeta.contentType || "unset"
  };
  await writeDocumentMetadata(pagesDir, safePath, nextMeta);

  return { success: true, path: safePath, uid, metadata: nextMeta };
}

async function readDocument(worldName, docPath) {
  const safeName = validateWorldName(worldName);
  const safePath = validateRelativePath(docPath);
  const { pages: pagesDir } = getWorldPaths(safeName);
  
  const indexPath = path.join(pagesDir, safePath, "index.md");
  try {
    const content = await fs.readFile(indexPath, "utf-8");
    return { path: safePath, content };
  } catch (e) {
    const error = new Error("Document not found");
    error.code = "DOCUMENT_NOT_FOUND";
    throw error;
  }
}

async function updateDocumentMetadata(worldName, docPath, metadata) {
  const safeName = validateWorldName(worldName);
  const safePath = validateRelativePath(docPath);
  const { pages: pagesDir } = getWorldPaths(safeName);
  
  const metaPath = path.join(pagesDir, safePath, "metadata.json");
  
  let currentMeta = {};
  try {
    const metaStr = await fs.readFile(metaPath, "utf-8");
    currentMeta = JSON.parse(metaStr);
  } catch (e) {
    // Doesn't exist yet
  }
  
  const newMeta = { ...currentMeta, ...metadata };
  await fs.writeFile(metaPath, JSON.stringify(newMeta, null, 2), "utf-8");
  
  return { success: true, metadata: newMeta };
}

async function deleteDocument(worldName, docPath) {
  const safeName = validateWorldName(worldName);
  const safePath = validateRelativePath(docPath);
  const { pages: pagesDir, maps: mapsDir } = getWorldPaths(safeName);
  
  const fullDirPath = path.join(pagesDir, safePath);
  console.log(`[Backend] deleteDocument: world=${worldName}, path=${docPath}, fullPath=${fullDirPath}`);
  
  try {
    await fs.rm(fullDirPath, { recursive: true, force: true });

    // Also remove the corresponding maps directory so map tabs don't leave ghosts
    const mapsPath = path.join(mapsDir, safePath);
    await fs.rm(mapsPath, { recursive: true, force: true }).catch(() => {});

    return { success: true };
  } catch (e) {
    const error = new Error("Failed to delete document");
    error.code = "DELETE_FAILED";
    throw error;
  }
}

async function renameDocument(worldName, oldPath, newName) {
  const safeName = validateWorldName(worldName);
  const safeOldPath = validateRelativePath(oldPath);
  const { pages: pagesDir, maps: mapsDir } = getWorldPaths(safeName);
  
  const parentDir = path.dirname(safeOldPath);
  const newPath = path.join(parentDir, newName);
  
  const fullOldPath = path.join(pagesDir, safeOldPath);
  const fullNewPath = path.join(pagesDir, newPath);
  
  try {
    await fs.rename(fullOldPath, fullNewPath);

    // Also rename the corresponding maps directory so map tabs stay in sync
    const mapsOldPath = path.join(mapsDir, safeOldPath);
    const mapsNewPath = path.join(mapsDir, newPath);
    try {
      await fs.access(mapsOldPath);
      await fs.rename(mapsOldPath, mapsNewPath);
    } catch (_) {
      // Maps directory doesn't exist for this document — that's fine
    }

    return { success: true, newPath };
  } catch (e) {
    const error = new Error("Failed to rename document");
    error.code = "RENAME_FAILED";
    throw error;
  }
}

async function moveDocument(worldName, sourcePath, targetPath) {
  const safeName = validateWorldName(worldName);
  const safeSource = validateRelativePath(sourcePath);
  const safeTarget = validateRelativePath(targetPath);
  const { pages: pagesDir } = getWorldPaths(safeName);
  
  const fullSource = path.join(pagesDir, safeSource);
  const fullTarget = path.join(pagesDir, safeTarget);
  
  try {
    await fs.mkdir(path.dirname(fullTarget), { recursive: true });
    await fs.rename(fullSource, fullTarget);
    return { success: true, targetPath: safeTarget };
  } catch (e) {
    throw new Error("Failed to move document: " + e.message);
  }
}

module.exports = {
  getFileTree,
  createDocument,
  createDocumentPlaceholder,
  readDocument,
  updateDocumentMetadata,
  deleteDocument,
  renameDocument,
  moveDocument
};
