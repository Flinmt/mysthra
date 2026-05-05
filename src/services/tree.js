const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { getWorldPaths, validateRelativePath, ensureWorldStructure, validateWorldName } = require("../data/filesystem");
const { updateIndex, removeFromIndex } = require("./indexer");

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
        const fullDirPath = path.join(dirPath, entry.name);
        
        let metadata = {};
        try {
          const metaPath = path.join(fullDirPath, "metadata.json");
          const metaStr = await fs.readFile(metaPath, "utf-8");
          metadata = JSON.parse(metaStr);
        } catch (e) {
          // Meta doesn't exist or is invalid
        }

        // Se não tiver UID, gera um e salva (Garante consistência)
        if (!metadata.uid) {
          metadata.uid = crypto.randomUUID();
          await fs.writeFile(path.join(fullDirPath, "metadata.json"), JSON.stringify(metadata, null, 2));
          updateIndex(safeName, metadata.uid, currentRelativePath);
        }

        const children = await walk(fullDirPath, currentRelativePath);
        
        nodes.push({
          name: metadata.name || entry.name, // Prioriza o nome de exibição
          path: currentRelativePath,
          uid: metadata.uid,
          icon: metadata.icon || null,
          type: metadata.type || "container", 
          contentType: metadata.contentType || (metadata.type === "tab" ? "wiki" : null),
          metadata,
          children
        });
      }
    }
    
    nodes.sort((a, b) => {
      const orderA = a.metadata?.order ?? 999;
      const orderB = b.metadata?.order ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name);
    });
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
  const rawPath = validateRelativePath(docPath);
  await ensureWorldStructure(safeName);
  const { pages: pagesDir } = getWorldPaths(safeName);
  
  // NOVO PADRÃO: Extraímos o nome de exibição do caminho enviado
  const parentPath = path.dirname(rawPath);
  const displayName = path.basename(rawPath);
  const uid = metadata.uid || crypto.randomUUID();
  
  // O caminho físico será composto pelos UIDs dos pais + o novo UID
  const safePath = (parentPath === "." ? uid : `${parentPath}/${uid}`).replace(/\\/g, "/");
  const fullDirPath = path.join(pagesDir, safePath);
  
  await fs.mkdir(fullDirPath, { recursive: true });
  
  // Se for uma aba do tipo WIKI, salvamos o arquivo de conteúdo Markdown
  if (metadata.type === "tab" && (metadata.contentType === "wiki" || !metadata.contentType)) {
    const indexPath = path.join(fullDirPath, "index.md");
    await fs.writeFile(indexPath, content || "", "utf-8");
  }

  const currentMeta = await readDocumentMetadata(pagesDir, safePath);
  
  // Ordem de criação
  let order = currentMeta.order;
  if (metadata.type === "tab" && order === undefined) {
    const parentDir = path.dirname(fullDirPath);
    try {
      const peers = await fs.readdir(parentDir);
      order = peers.length;
    } catch (e) {
      order = 1;
    }
  }

  const nextMeta = {
    ...currentMeta,
    ...metadata,
    name: metadata.name || displayName, // Salva o nome amigável aqui
    uid,
    order: order ?? 0,
    type: metadata.type || currentMeta.type || "container",
    contentType: metadata.contentType || currentMeta.contentType || (metadata.type === "tab" ? "wiki" : null)
  };
  await writeDocumentMetadata(pagesDir, safePath, nextMeta);
  
  updateIndex(safeName, uid, safePath);
  
  return { success: true, path: safePath, uid, name: nextMeta.name };
}

async function createDocumentPlaceholder(worldName, docPath, metadata = {}) {
  return createDocument(worldName, docPath, "", metadata);
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
    const error = new Error("Document content not found (This might be a container)");
    error.code = "DOCUMENT_NOT_FOUND";
    throw error;
  }
}

async function updateDocumentContent(worldName, docPath, content) {
  const safeName = validateWorldName(worldName);
  const safePath = validateRelativePath(docPath);
  const { pages: pagesDir } = getWorldPaths(safeName);
  const metadata = await readDocumentMetadata(pagesDir, safePath);

  if (metadata.type !== "tab") {
    const error = new Error("Only tab documents can store editable content");
    error.code = "DOCUMENT_NOT_FOUND";
    throw error;
  }

  const indexPath = path.join(pagesDir, safePath, "index.md");
  await fs.writeFile(indexPath, content, "utf-8");
  return { success: true, path: safePath };
}

async function updateDocumentMetadata(worldName, docPath, metadata) {
  const safeName = validateWorldName(worldName);
  const safePath = validateRelativePath(docPath);
  const { pages: pagesDir } = getWorldPaths(safeName);
  
  const currentMeta = await readDocumentMetadata(pagesDir, safePath);
  const newMeta = { ...currentMeta, ...metadata };
  await writeDocumentMetadata(pagesDir, safePath, newMeta);
  
  return { success: true, metadata: newMeta };
}

async function deleteDocument(worldName, docPath) {
  const safeName = validateWorldName(worldName);
  const safePath = validateRelativePath(docPath);
  const { pages: pagesDir } = getWorldPaths(safeName);
  
  const fullDirPath = path.join(pagesDir, safePath);
  
  try {
    const metadata = await readDocumentMetadata(pagesDir, safePath);
    await fs.rm(fullDirPath, { recursive: true, force: true });
    
    if (metadata.uid) {
      removeFromIndex(safeName, metadata.uid);
    }

    return { success: true };
  } catch (e) {
    throw new Error("Failed to delete document");
  }
}

async function renameDocument(worldName, docPath, newName) {
  const safeName = validateWorldName(worldName);
  const { pages: pagesDir } = getWorldPaths(safeName);
  const safePath = validateRelativePath(docPath);

  const metadata = await readDocumentMetadata(pagesDir, safePath);
  metadata.name = newName;
  await writeDocumentMetadata(pagesDir, safePath, metadata);
  
  return { success: true, path: safePath, name: newName, uid: metadata.uid };
}

async function moveDocument(worldName, sourcePath, targetPath) {
  const safeName = validateWorldName(worldName);
  const safeSource = validateRelativePath(sourcePath);
  const safeTarget = validateRelativePath(targetPath);
  const { pages: pagesDir } = getWorldPaths(safeName);
  
  const fullSource = path.join(pagesDir, safeSource);
  const fullTarget = path.join(pagesDir, safeTarget);
  
  try {
    const metadata = await readDocumentMetadata(pagesDir, safeSource);
    await fs.mkdir(path.dirname(fullTarget), { recursive: true });
    await fs.rename(fullSource, fullTarget);
    
    if (metadata.uid) {
      updateIndex(safeName, metadata.uid, safeTarget);
    }
    
    return { success: true, targetPath: safeTarget };
  } catch (e) {
    throw new Error("Failed to move document: " + e.message);
  }
}

async function getUniqueSiblingName(pagesDir, parentPath, baseName) {
  const parentDir = parentPath ? path.join(pagesDir, parentPath) : pagesDir;
  const siblingNames = new Set();

  try {
    const entries = await fs.readdir(parentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const siblingPath = parentPath ? `${parentPath}/${entry.name}` : entry.name;
      const metadata = await readDocumentMetadata(pagesDir, siblingPath);
      siblingNames.add(metadata.name || entry.name);
    }
  } catch (e) {
    // Missing parent will be handled by the caller when filesystem operations run.
  }

  if (!siblingNames.has(baseName)) return baseName;

  let suffix = 2;
  while (siblingNames.has(`${baseName} ${suffix}`)) {
    suffix += 1;
  }
  return `${baseName} ${suffix}`;
}

async function copyDocumentDirectory(safeName, pagesDir, sourcePath, targetPath, options = {}) {
  const sourceDir = path.join(pagesDir, sourcePath);
  const targetDir = path.join(pagesDir, targetPath);
  const sourceMetadata = await readDocumentMetadata(pagesDir, sourcePath);
  const uid = path.basename(targetPath);
  const metadata = {
    ...sourceMetadata,
    ...(options.metadataOverrides || {}),
    uid,
    name: options.name || sourceMetadata.name || path.basename(targetPath)
  };

  await fs.mkdir(targetDir, { recursive: true });
  await writeDocumentMetadata(pagesDir, targetPath, metadata);
  updateIndex(safeName, uid, targetPath);

  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "metadata.json" || entry.name.startsWith(".")) continue;

    const childSource = `${sourcePath}/${entry.name}`;
    const childTarget = `${targetPath}/${crypto.randomUUID()}`;

    if (entry.isDirectory()) {
      if (!options.includeChildren) continue;
      await copyDocumentDirectory(safeName, pagesDir, childSource, childTarget, {
        includeChildren: true,
        metadataOverrides: options.metadataOverrides
      });
      continue;
    }

    if (entry.isFile()) {
      await fs.copyFile(path.join(sourceDir, entry.name), path.join(targetDir, entry.name));
    }
  }

  return { path: targetPath, uid, name: metadata.name };
}

async function duplicateDocument(worldName, docPath, options = {}) {
  const safeName = validateWorldName(worldName);
  const safePath = validateRelativePath(docPath);
  const { pages: pagesDir } = getWorldPaths(safeName);
  const sourceDir = path.join(pagesDir, safePath);

  try {
    const stat = await fs.stat(sourceDir);
    if (!stat.isDirectory()) {
      const error = new Error("Document not found");
      error.code = "DOCUMENT_NOT_FOUND";
      throw error;
    }
  } catch (error) {
    if (error.code === "DOCUMENT_NOT_FOUND") throw error;
    const notFound = new Error("Document not found");
    notFound.code = "DOCUMENT_NOT_FOUND";
    throw notFound;
  }

  const parentPath = path.dirname(safePath) === "." ? "" : path.dirname(safePath).replace(/\\/g, "/");
  const sourceMetadata = await readDocumentMetadata(pagesDir, safePath);
  const sourceName = sourceMetadata.name || path.basename(safePath);
  const copyName = await getUniqueSiblingName(pagesDir, parentPath, options.name || `${sourceName} Copy`);
  const targetUid = crypto.randomUUID();
  const targetPath = parentPath ? `${parentPath}/${targetUid}` : targetUid;
  const copied = await copyDocumentDirectory(safeName, pagesDir, safePath, targetPath, {
    includeChildren: Boolean(options.includeChildren),
    name: copyName,
    metadataOverrides: options.metadataOverrides
  });

  return { success: true, ...copied };
}

module.exports = {
  getFileTree,
  createDocument,
  createDocumentPlaceholder,
  readDocument,
  updateDocumentContent,
  updateDocumentMetadata,
  deleteDocument,
  renameDocument,
  moveDocument,
  duplicateDocument
};
