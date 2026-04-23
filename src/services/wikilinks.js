function normalizeWikilinkTarget(target) {
  return String(target).trim().replace(/\s+/g, " ");
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

module.exports = {
  extractWikilinks,
  normalizeWikilinkTarget
};
