const { readPage } = require("./pages");
const { renderMarkdownToHtml } = require("./rendering");
const { resolveAppliedTheme } = require("./themes");
const { applyTemplate, readTemplate } = require("./templates");

const PAGE_THEME_OVERRIDE_PATTERN = /^<!--\s*theme:\s*([A-Za-z0-9][A-Za-z0-9 _.-]*[A-Za-z0-9]|[A-Za-z0-9])\s*-->\s*\n*/i;
const PAGE_TEMPLATE_OVERRIDE_PATTERN = /^<!--\s*template:\s*([A-Za-z0-9][A-Za-z0-9 _.-]*[A-Za-z0-9]|[A-Za-z0-9])\s*-->\s*\n*/i;

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

function parsePageTemplateOverride(content) {
  const match = String(content).match(PAGE_TEMPLATE_OVERRIDE_PATTERN);

  if (!match) {
    return null;
  }

  return match[1].trim();
}

function stripPageTemplateOverride(content) {
  return String(content).replace(PAGE_TEMPLATE_OVERRIDE_PATTERN, "");
}

async function renderPageOutput(worldName, pageIdOrSlug) {
  const page = await readPage(worldName, pageIdOrSlug);
  const pageThemeOverride = parsePageThemeOverride(page.content);
  const pageTemplateOverride = parsePageTemplateOverride(page.content);
  const renderableContent = stripPageTemplateOverride(stripPageThemeOverride(page.content));
  const html = renderMarkdownToHtml(renderableContent);
  const appliedTheme = await resolveAppliedTheme(worldName, pageThemeOverride);
  const template = pageTemplateOverride ? await readTemplate(pageTemplateOverride) : null;
  const themeReference = appliedTheme.theme
    ? {
        name: appliedTheme.theme.name,
        fileName: appliedTheme.theme.fileName,
        href: appliedTheme.theme.href,
        source: appliedTheme.source
      }
    : null;
  const templateReference = template
    ? {
        name: template.name,
        fileName: template.fileName
      }
    : null;
  const documentHtml = template
    ? applyTemplate(template.content, {
        content: html,
        title: page.title,
        themeHref: themeReference ? themeReference.href : ""
      })
    : html;

  return {
    page: {
      ...page,
      content: renderableContent,
      themeOverride: pageThemeOverride,
      templateOverride: pageTemplateOverride
    },
    html,
    documentHtml,
    template: templateReference,
    theme: themeReference
  };
}

module.exports = {
  parsePageThemeOverride,
  parsePageTemplateOverride,
  renderPageOutput,
  stripPageThemeOverride
  ,
  stripPageTemplateOverride
};
