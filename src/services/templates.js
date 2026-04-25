const fs = require("node:fs/promises");
const path = require("node:path");

const { getTemplatesRoot, validateFileName, validateRelativePath, ensureDirectory } = require("../data/filesystem");
const { escapeHtml, sanitizeHtml } = require("./rendering");

function templateNameFromFile(fileName) {
  const ext = path.extname(fileName);
  return path.basename(fileName, ext);
}

function buildTemplateFileName(templateName, type = 'layout') {
  const safeTemplateName = validateFileName(templateName);
  const ext = type === 'content' ? '.md' : '.html';
  return `${safeTemplateName}${ext}`;
}

async function listTemplates() {
  const root = getTemplatesRoot();
  await ensureDirectory(root);

  async function walk(dirPath, relativePath = "") {
    let entries = [];
    try {
      entries = await fs.readdir(dirPath, { withFileTypes: true });
    } catch (e) {
      return [];
    }
    
    const nodes = [];
    for (const entry of entries) {
      const currentRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
      
      if (entry.isDirectory()) {
        const children = await walk(path.join(dirPath, entry.name), currentRelativePath);
        nodes.push({
          name: entry.name,
          path: currentRelativePath,
          type: "folder",
          children
        });
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        if (['.html', '.md'].includes(ext)) {
          nodes.push({
            name: path.basename(entry.name, ext),
            path: currentRelativePath,
            type: ext === '.md' ? 'content' : 'layout',
            fileName: entry.name
          });
        }
      }
    }
    return nodes.sort((a, b) => {
      if (a.type === "folder" && b.type !== "folder") return -1;
      if (a.type !== "folder" && b.type === "folder") return 1;
      return a.name.localeCompare(b.name);
    });
  }

  return await walk(root);
}

async function readTemplate(relativePath) {
  const root = getTemplatesRoot();
  const safePath = validateRelativePath(relativePath);
  const filePath = path.join(root, safePath);

  try {
    const content = await fs.readFile(filePath, "utf8");
    console.log('Backend readTemplate:', { filePath, contentLength: content.length });
    const ext = path.extname(filePath);
    
    return {
      name: path.basename(filePath, ext),
      path: safePath,
      content,
      type: ext === '.md' ? 'content' : 'layout'
    };
  } catch (error) {
    const notFoundError = new Error("Template not found");
    notFoundError.code = "TEMPLATE_NOT_FOUND";
    throw notFoundError;
  }
}

async function saveTemplate(name, content, parentPath = "", type = 'content') {
  console.log('Service saveTemplate:', { name, parentPath, type, contentLength: content?.length });
  const root = getTemplatesRoot();
  const safeParent = parentPath ? validateRelativePath(parentPath) : "";
  const fileName = buildTemplateFileName(name, type);
  
  const targetDir = path.join(root, safeParent);
  await ensureDirectory(targetDir);
  
  const filePath = path.join(targetDir, fileName);
  await fs.writeFile(filePath, content, "utf8");
  
  return { 
    name, 
    path: parentPath ? `${parentPath}/${fileName}` : fileName, 
    type 
  };
}

async function createTemplateFolder(folderPath) {
  const root = getTemplatesRoot();
  const safePath = validateRelativePath(folderPath);
  const fullPath = path.join(root, safePath);
  
  await ensureDirectory(fullPath);
  return { path: safePath, type: 'folder' };
}

async function deleteTemplate(relativePath) {
  const root = getTemplatesRoot();
  const safePath = validateRelativePath(relativePath);
  const fullPath = path.join(root, safePath);
  
  await fs.rm(fullPath, { recursive: true, force: true });
  return { success: true };
}

async function moveTemplate(sourcePath, targetPath) {
  const root = getTemplatesRoot();
  const safeSource = validateRelativePath(sourcePath);
  const safeTarget = validateRelativePath(targetPath);
  
  const fullSource = path.join(root, safeSource);
  const fullTarget = path.join(root, safeTarget);
  
  await ensureDirectory(path.dirname(fullTarget));
  await fs.rename(fullSource, fullTarget);
  
  return { source: safeSource, target: safeTarget };
}

function injectTemplateContent(templateHtml, contentHtml) {
  const template = String(templateHtml);
  if (template.includes("{{content}}")) {
    return template.replace(/{{content}}/g, contentHtml);
  }
  if (template.includes("</body>")) {
    return template.replace("</body>", `${contentHtml}</body>`);
  }
  return `${template}${contentHtml}`;
}

function applyTemplate(templateHtml, context = {}) {
  const contentHtml = typeof context.content === "string" ? context.content : "";
  const title = typeof context.title === "string" ? context.title : "";
  const themeHref = typeof context.themeHref === "string" ? context.themeHref : "";

  let output = injectTemplateContent(templateHtml, contentHtml);
  output = output.replace(/{{title}}/g, escapeHtml(title));
  output = output.replace(/{{themeHref}}/g, escapeHtml(themeHref));

  return sanitizeHtml(output);
}

module.exports = {
  applyTemplate,
  buildTemplateFileName,
  injectTemplateContent,
  listTemplates,
  readTemplate,
  saveTemplate,
  createTemplateFolder,
  deleteTemplate,
  moveTemplate,
  templateNameFromFile
};
