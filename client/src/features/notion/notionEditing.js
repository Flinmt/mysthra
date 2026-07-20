export function handleNotionPaste({ defaultPasteHandler }) {
  return defaultPasteHandler({
    prioritizeMarkdownOverHTML: false,
    plainTextAsMarkdown: true
  })
}

export const NOTION_EDITING_OPTIONS = Object.freeze({
  autofocus: false,
  tabBehavior: 'prefer-navigate-ui',
  trailingBlock: true,
  pasteHandler: handleNotionPaste,
  domAttributes: {
    editor: {
      autocapitalize: 'sentences',
      autocorrect: 'on',
      spellcheck: 'true'
    }
  }
})
