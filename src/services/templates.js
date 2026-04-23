const fs = require("node:fs/promises");
const path = require("node:path");

const { ensureWorldStructure, getWorldPaths, resolveWorldPath, validateFileName } = require("../data");

function templateNameFromFile(fileName) {
  return path.basename(fileName, ".html");
}

function buildTemplateFileName(templateName) {
  const safeTemplateName = validateFileName(templateName);
  return `${safeTemplateName}.html`;
}

function getTemplatePath(worldName, templateName) {
  const fileName = buildTemplateFileName(templateName);
  return resolveWorldPath(worldName, "templates", fileName);
}

async function listTemplates(worldName) {
  await ensureWorldStructure(worldName);

  const { templates: templatesDirectory } = getWorldPaths(worldName);
  const entries = await fs.readdir(templatesDirectory, { withFileTypes: true });
  const templateFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".html"))
    .sort((left, right) => left.name.localeCompare(right.name));

  return templateFiles.map((entry) => ({
    name: templateNameFromFile(entry.name),
    fileName: entry.name,
    filePath: path.join(templatesDirectory, entry.name)
  }));
}

async function readTemplate(worldName, templateName) {
  await ensureWorldStructure(worldName);

  const fileName = buildTemplateFileName(templateName);
  const filePath = getTemplatePath(worldName, templateName);

  try {
    const content = await fs.readFile(filePath, "utf8");

    return {
      name: templateNameFromFile(fileName),
      fileName,
      filePath,
      content
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      const notFoundError = new Error("Template not found");
      notFoundError.code = "TEMPLATE_NOT_FOUND";
      notFoundError.value = templateName;
      throw notFoundError;
    }

    throw error;
  }
}

async function loadTemplates(worldName) {
  const items = await listTemplates(worldName);

  return {
    items
  };
}

module.exports = {
  buildTemplateFileName,
  getTemplatePath,
  listTemplates,
  loadTemplates,
  readTemplate,
  templateNameFromFile
};
