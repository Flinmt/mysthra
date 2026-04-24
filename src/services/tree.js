const fs = require("node:fs/promises");
const path = require("node:path");
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
        try {
          const metaPath = path.join(dirPath, entry.name, "metadata.json");
          const metaStr = await fs.readFile(metaPath, "utf-8");
          const meta = JSON.parse(metaStr);
          if (meta.icon) icon = meta.icon;
        } catch (e) {
          // No metadata or invalid JSON, ignore
        }
        
        const children = await walk(path.join(dirPath, entry.name), currentRelativePath);
        
        nodes.push({
          name: entry.name,
          path: currentRelativePath,
          type: "document",
          icon,
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
  
  return { success: true, path: safePath };
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

module.exports = {
  getFileTree,
  createDocument,
  readDocument,
  updateDocumentMetadata,
  deleteDocument,
  renameDocument
};
