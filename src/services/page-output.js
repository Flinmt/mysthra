const { readPage } = require("./pages");
const { renderMarkdownToHtml } = require("./rendering");
const { resolveAppliedTheme } = require("./themes");

const PAGE_THEME_OVERRIDE_PATTERN = /^<!--\s*theme:\s*([A-Za-z0-9][A-Za-z0-9 _.-]*[A-Za-z0-9]|[A-Za-z0-9])\s*-->\s*\n*/i;

function parsePageThemeOverride(content) {
  const match = String(content).match(PAGE_THEME_OVERRIDE_PATTERN);

  if (!match) {
    return null;
  }

  return match[1].trim();
}

function stripPageThemeOverride(content) {
  return String(content).replace(PAGE_THEME_OVERRIDE_PATTERN, "");
}

async function renderPageOutput(worldName, pageIdOrSlug) {
  const page = await readPage(worldName, pageIdOrSlug);
  const pageThemeOverride = parsePageThemeOverride(page.content);
  const renderableContent = stripPageThemeOverride(page.content);
  const html = renderMarkdownToHtml(renderableContent);
  const appliedTheme = await resolveAppliedTheme(worldName, pageThemeOverride);
  const themeReference = appliedTheme.theme
    ? {
        name: appliedTheme.theme.name,
        fileName: appliedTheme.theme.fileName,
        href: appliedTheme.theme.href,
        source: appliedTheme.source
      }
    : null;

  return {
    page: {
      ...page,
      content: renderableContent,
      themeOverride: pageThemeOverride
    },
    html,
    theme: themeReference
  };
}

module.exports = {
  parsePageThemeOverride,
  renderPageOutput,
  stripPageThemeOverride
};
