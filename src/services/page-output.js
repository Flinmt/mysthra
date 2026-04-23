const { readPage } = require("./pages");
const { renderMarkdownToHtml } = require("./rendering");
const { getAppliedTheme } = require("./themes");

async function renderPageOutput(worldName, pageIdOrSlug) {
  const page = await readPage(worldName, pageIdOrSlug);
  const html = renderMarkdownToHtml(page.content);
  const theme = await getAppliedTheme(worldName);
  const themeReference = theme
    ? {
        name: theme.name,
        fileName: theme.fileName,
        href: theme.href
      }
    : null;

  return {
    page,
    html,
    theme: themeReference
  };
}

module.exports = {
  renderPageOutput
};
