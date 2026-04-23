function normalizeWikilinkTarget(target) {
  return String(target).trim().replace(/\s+/g, " ");
}

function slugFromWikilinkTarget(target) {
  return normalizeWikilinkTarget(target)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function extractWikilinks(markdown) {
  const source = String(markdown);
  const pattern = /\[\[([^[\]]+)\]\]/g;
  const links = [];
  let match;

  while ((match = pattern.exec(source)) !== null) {
    const rawTarget = match[1];
    const target = normalizeWikilinkTarget(rawTarget);

    if (!target) {
      continue;
    }

    links.push({
      raw: match[0],
      target,
      index: match.index,
      length: match[0].length
    });
  }

  return links;
}

function renderWikilinksToHtml(markdown, options = {}) {
  const source = String(markdown);
  const resolvedSlugs = new Set(
    Array.isArray(options.resolvedSlugs) ? options.resolvedSlugs : []
  );
  const basePath = options.basePath || "/pages";

  return source.replace(/\[\[([^[\]]+)\]\]/g, (raw, rawTarget) => {
    const target = normalizeWikilinkTarget(rawTarget);

    if (!target) {
      return raw;
    }

    const slug = slugFromWikilinkTarget(target);

    if (!slug) {
      return raw;
    }

    const href = `${basePath}/${slug}`;

    if (resolvedSlugs.size > 0 && !resolvedSlugs.has(slug)) {
      return `<a class="wikilink unresolved" data-slug="${slug}" href="${href}">${target}</a>`;
    }

    return `<a class="wikilink" data-slug="${slug}" href="${href}">${target}</a>`;
  });
}

module.exports = {
  extractWikilinks,
  normalizeWikilinkTarget,
  renderWikilinksToHtml,
  slugFromWikilinkTarget
};
