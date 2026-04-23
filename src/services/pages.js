const fs = require("node:fs/promises");
const path = require("node:path");

const { ensureWorldStructure, getWorldPaths, resolveWorldPath, validateFileName } = require("../data");

function slugFromFileName(fileName) {
  return path.basename(fileName, ".md");
}

function buildPageFileName(pageIdOrSlug) {
  const safePageId = validateFileName(pageIdOrSlug);
  return `${safePageId}.md`;
}

function normalizeSlugPart(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function slugFromTitle(title) {
  const slug = normalizeSlugPart(title);

  if (!slug) {
    const error = new Error("Title must produce a valid slug");
    error.code = "INVALID_PAGE_TITLE";
    error.value = title;
    throw error;
  }

  return slug;
}

function titleFromMarkdown(content, slug) {
  const firstHeadingMatch = content.match(/^#\s+(.+)$/m);

  if (firstHeadingMatch) {
    return firstHeadingMatch[1].trim();
  }

  return slug;
}

async function listPages(worldName) {
  await ensureWorldStructure(worldName);

  const { pages: pagesDirectory } = getWorldPaths(worldName);
  const directoryEntries = await fs.readdir(pagesDirectory, { withFileTypes: true });
  const markdownFiles = directoryEntries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .sort((left, right) => left.name.localeCompare(right.name));

  const pages = await Promise.all(
    markdownFiles.map(async (file) => {
      const filePath = path.join(pagesDirectory, file.name);
      const content = await fs.readFile(filePath, "utf8");
      const slug = slugFromFileName(file.name);

      return {
        id: slug,
        title: titleFromMarkdown(content, slug),
        slug,
        filePath
      };
    })
  );

  return pages;
}

async function readPage(worldName, pageIdOrSlug) {
  await ensureWorldStructure(worldName);

  const fileName = buildPageFileName(pageIdOrSlug);
  const filePath = resolveWorldPath(worldName, "pages", fileName);

  try {
    const content = await fs.readFile(filePath, "utf8");
    const slug = slugFromFileName(fileName);

    return {
      id: slug,
      title: titleFromMarkdown(content, slug),
      slug,
      filePath,
      content
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      const notFoundError = new Error("Page not found");
      notFoundError.code = "PAGE_NOT_FOUND";
      notFoundError.page = pageIdOrSlug;
      throw notFoundError;
    }

    throw error;
  }
}

async function createPage(worldName, input) {
  await ensureWorldStructure(worldName);

  const title = typeof input?.title === "string" ? input.title.trim() : "";
  const content = typeof input?.content === "string" ? input.content : "";
  const explicitSlug = typeof input?.slug === "string" ? input.slug.trim() : "";
  const allowOverwrite = input?.allowOverwrite === true;

  if (!title) {
    const error = new Error("Title is required");
    error.code = "INVALID_PAGE_INPUT";
    throw error;
  }

  const slug = explicitSlug ? normalizeSlugPart(explicitSlug) : slugFromTitle(title);

  if (!slug) {
    const error = new Error("Slug is required");
    error.code = "INVALID_PAGE_INPUT";
    throw error;
  }

  const fileName = buildPageFileName(slug);
  const filePath = resolveWorldPath(worldName, "pages", fileName);

  try {
    if (!allowOverwrite) {
      await fs.access(filePath);
      const existsError = new Error("Page already exists");
      existsError.code = "PAGE_ALREADY_EXISTS";
      existsError.page = slug;
      throw existsError;
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  await fs.writeFile(filePath, content, "utf8");

  return readPage(worldName, slug);
}

module.exports = {
  buildPageFileName,
  createPage,
  listPages,
  readPage,
  slugFromTitle,
  slugFromFileName,
  titleFromMarkdown
};
