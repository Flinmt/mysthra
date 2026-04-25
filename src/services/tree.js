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
        
        let icon = null;
        let uid = null;
        try {
          const metaPath = path.join(dirPath, entry.name, "metadata.json");
          let meta = {};
          let metaExists = false;
          try {
            const metaStr = await fs.readFile(metaPath, "utf-8");
            meta = JSON.parse(metaStr);
            metaExists = true;
          } catch (e) {
            // Meta doesn't exist or is invalid
          }

          let changed = false;
          if (meta.icon) icon = meta.icon;
          
          if (meta.uid) {
            uid = meta.uid;
          } else {
            uid = crypto.randomUUID();
            meta.uid = uid;
            changed = true;
          }

          if (changed) {
            await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), "utf-8");
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
          children
        });
      }
    }
    
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    
    return nodes;
  }
  
  return walk(pagesDir);
}

async function createDocument(worldName, docPath, content) {
  const safeName = validateWorldName(worldName);
  const safePath = validateRelativePath(docPath);
  await ensureWorldStructure(safeName);
  const { pages: pagesDir } = getWorldPaths(safeName);
  
  const fullDirPath = path.join(pagesDir, safePath);
  
  await fs.mkdir(fullDirPath, { recursive: true });
  
  const indexPath = path.join(fullDirPath, "index.md");
  await fs.writeFile(indexPath, content || "", "utf-8");

  // Create metadata with a new UID
  const uid = crypto.randomUUID();
  const metaPath = path.join(fullDirPath, "metadata.json");
  await fs.writeFile(metaPath, JSON.stringify({ uid }, null, 2), "utf-8");
  
  return { success: true, path: safePath, uid };
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
  const { pages: pagesDir } = getWorldPaths(safeName);
  
  const fullDirPath = path.join(pagesDir, safePath);
  
  try {
    await fs.rm(fullDirPath, { recursive: true, force: true });
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
  const { pages: pagesDir } = getWorldPaths(safeName);
  
  const parentDir = path.dirname(safeOldPath);
  const newPath = path.join(parentDir, newName);
  
  const fullOldPath = path.join(pagesDir, safeOldPath);
  const fullNewPath = path.join(pagesDir, newPath);
  
  try {
    await fs.rename(fullOldPath, fullNewPath);
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
  readDocument,
  updateDocumentMetadata,
  deleteDocument,
  renameDocument,
  moveDocument
};
