import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const sourceRoot = path.resolve(import.meta.dirname, '../..')
const globalStyles = fs.readFileSync(path.join(sourceRoot, 'index.css'), 'utf8')
const workspaceEntry = fs.readFileSync(path.join(import.meta.dirname, 'index.css'), 'utf8')
const workspaceFiles = fs.readdirSync(import.meta.dirname).filter(file => file.endsWith('.css'))
const workspaceStyles = workspaceFiles.map(file => fs.readFileSync(path.join(import.meta.dirname, file), 'utf8')).join('\n')

describe('workspace style boundaries', () => {
  it('keeps workspace-owned selectors out of the global stylesheet', () => {
    expect(globalStyles).not.toMatch(/\.(?:workspace-|sidebar-nexus|world-navigator|document-|editor-|map-|board-)/)
    expect(globalStyles).not.toContain('[data-world-theme=')
  })

  it('loads every workspace domain in a stable cascade order', () => {
    const imports = [...workspaceEntry.matchAll(/@import '\.\/(.+\.css)'/g)].map(match => match[1])

    expect(imports).toEqual([
      'shell.css',
      'tokens.css',
      'primitives.css',
      'topbar.css',
      'document.css',
      'editors.css',
      'tab-type-selector.css',
      'tiptap.css',
      'asset-explorer.css',
      'map.css',
      'board.css',
      'overlays.css',
      'themes.css',
      'permissions.css',
      'sidebar.css',
      'responsive.css'
    ])
  })

  it('keeps the Notion writing surface compact and avoids a fixed editor height', () => {
    const tiptap = fs.readFileSync(path.join(import.meta.dirname, 'tiptap.css'), 'utf8')
    const editors = fs.readFileSync(path.join(import.meta.dirname, 'editors.css'), 'utf8')
    const markdownTheme = fs.readFileSync(path.join(sourceRoot, 'workspace/markdownTheme.js'), 'utf8')
    const document = fs.readFileSync(path.join(import.meta.dirname, 'document.css'), 'utf8')

    expect(tiptap).not.toContain('min-height: 420px')
    expect(editors).toContain('--workspace-editor-body-font-size: 13px')
    expect(tiptap).toContain('font-size: var(--workspace-editor-body-font-size)')
    expect(markdownTheme).toContain("fontSize: 'calc(var(--workspace-editor-body-font-size, 13px) + 1px)'")
    expect(markdownTheme).toContain('font-size: var(--workspace-editor-body-font-size, 13px)')
    expect(tiptap).toContain('padding: 0 28px 80px')
    expect(document).toContain('width: min(780px,100% - 80px)')
    expect(document).toContain('.editor-page.is-wiki-page.is-wide-content .document-content-frame')
    expect(document).toContain('height: 148px')
  })

  it('matches the page link search density and palette distribution to the navigator', () => {
    const editors = fs.readFileSync(path.join(import.meta.dirname, 'editors.css'), 'utf8')
    const themes = fs.readFileSync(path.join(import.meta.dirname, 'themes.css'), 'utf8')

    expect(editors).toContain('--insert-bg: color-mix(in srgb, var(--world-theme-background) 28%, var(--workspace-shell-surface))')
    expect(editors).toContain('.workspace-container .workspace-insert-search.is-page-link')
    expect(editors).toContain('width: min(430px, calc(100vw - 24px))')
    expect(editors).toContain('.workspace-insert-search-field')
    expect(editors).toContain('height: 32px')
    expect(editors).toContain('box-shadow: inset 2px 0 0 var(--insert-accent)')
    expect(editors).not.toContain('linear-gradient(#181622fa,#090b11fa)')
    expect(themes).toContain('.workspace-container .glass-panel:not(.workspace-insert-search)')
    expect(themes).not.toContain('.workspace-container .workspace-insert-result span')
  })

  it('keeps palette ownership centralized and free from the legacy purple theme', () => {
    expect(workspaceStyles).not.toMatch(/#(?:8b5cf6|a78bfa|c4b5fd|ddd6fe|5d34d0|a855f7|7c3aed|00f0ff)/i)
    expect(fs.readFileSync(path.join(import.meta.dirname, 'themes.css'), 'utf8')).not.toContain('[data-world-theme=')
  })

  it('keeps world selection cards in a compact landscape format', () => {
    const dashboard = fs.readFileSync(path.join(sourceRoot, 'styles/world-dashboard.css'), 'utf8')

    expect(dashboard).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))')
    expect(dashboard).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))')
    expect(dashboard).toContain('height: 168px')
    expect(dashboard).toContain('height: 150px')
    expect(dashboard).toContain('var(--world-card-accent)')
    expect(dashboard).not.toContain('aspect-ratio: 16 / 10')
  })

  it('matches the asset explorer density and palette distribution to the navigator', () => {
    const explorer = fs.readFileSync(path.join(import.meta.dirname, 'asset-explorer.css'), 'utf8')

    expect(explorer).toContain('--asset-explorer-bg: color-mix(in srgb, var(--world-theme-background) 28%, var(--workspace-shell-surface))')
    expect(explorer).toContain('--asset-explorer-raised: color-mix(in srgb, var(--world-theme-surface) 24%, var(--workspace-shell-raised))')
    expect(explorer).toContain('--asset-explorer-control: color-mix(in srgb, var(--world-theme-background) 18%, var(--workspace-shell-bg))')
    expect(explorer).toContain('grid-template-rows: 40px 40px 38px minmax(0, 1fr) 26px')
    expect(explorer).toContain('border-radius: 6px')
    expect(explorer).toContain('min-height: 112px')
    expect(explorer).toContain('background: var(--asset-explorer-raised)')
  })

  it('defines the studio shell in a single module', () => {
    const shellOwners = workspaceFiles.filter(file => fs.readFileSync(path.join(import.meta.dirname, file), 'utf8').includes('.workspace-container.workspace-studio-shell'))

    expect(shellOwners).toEqual(['shell.css'])
  })

  it('keeps the world navigator final cascade in its component stylesheet', () => {
    const imports = [...workspaceEntry.matchAll(/@import '\.\/(.+\.css)'/g)].map(match => match[1])
    const navigatorSelectors = /(?:tree-node|asset-tree-node|sidebar-search-bar|sidebar-nexus-tab|sidebar-empty|world-navigator)/
    const competingFiles = workspaceFiles.filter(file => file !== 'sidebar.css' && navigatorSelectors.test(fs.readFileSync(path.join(import.meta.dirname, file), 'utf8')))
    const sidebar = fs.readFileSync(path.join(import.meta.dirname, 'sidebar.css'), 'utf8')

    expect(imports.indexOf('sidebar.css')).toBeGreaterThan(imports.indexOf('themes.css'))
    expect(sidebar).toContain('--navigator-accent: var(--world-theme-accent)')
    expect(sidebar).toContain('.tree-node:hover .tree-node-actions')
    expect(sidebar).not.toContain('.tree-node:focus-within .tree-node-actions')
    expect(competingFiles).toEqual([])
  })

  it('keeps document permission styling isolated from shared editor and overlay styles', () => {
    const imports = [...workspaceEntry.matchAll(/@import '\.\/(.+\.css)'/g)].map(match => match[1])
    const competingFiles = workspaceFiles.filter(file => file !== 'permissions.css' && fs.readFileSync(path.join(import.meta.dirname, file), 'utf8').includes('document-permissions'))
    const permissions = fs.readFileSync(path.join(import.meta.dirname, 'permissions.css'), 'utf8')

    expect(imports.indexOf('permissions.css')).toBeGreaterThan(imports.indexOf('themes.css'))
    expect(permissions).toContain('--permissions-accent: var(--world-theme-accent)')
    expect(permissions).toContain('--permissions-text: var(--workspace-shell-text)')
    expect(competingFiles).toEqual([])
  })

  it('keeps authored text neutral while allowing themed surfaces and controls', () => {
    const tokens = fs.readFileSync(path.join(import.meta.dirname, 'tokens.css'), 'utf8')
    const markdownTheme = fs.readFileSync(path.join(sourceRoot, 'workspace/markdownTheme.js'), 'utf8')

    expect(tokens).toContain('--workspace-editor-text: var(--workspace-shell-text)')
    expect(tokens).toContain('--workspace-editor-muted: var(--workspace-shell-muted)')
    expect(markdownTheme).toContain("color: 'var(--workspace-editor-text)'")
    expect(markdownTheme).not.toMatch(/#(?:8b5cf6|a78bfa|c4b5fd|ddd6fe)/i)
  })

  it('scopes deletion confirmations to the selected world theme', () => {
    const tokens = fs.readFileSync(path.join(import.meta.dirname, 'tokens.css'), 'utf8')
    const overlays = fs.readFileSync(path.join(import.meta.dirname, 'overlays.css'), 'utf8')

    expect(tokens).toContain('.workspace-container .delete-item-dialog')
    expect(overlays).toContain('background: var(--accent-color)')
    expect(overlays).toContain('background: var(--workspace-theme-secondary-soft)')
  })

  it('scopes contextual menus to the selected world theme', () => {
    const tokens = fs.readFileSync(path.join(import.meta.dirname, 'tokens.css'), 'utf8')
    const themes = fs.readFileSync(path.join(import.meta.dirname, 'themes.css'), 'utf8')

    expect(tokens).toContain('.workspace-container .context-menu')
    expect(tokens).toContain('.workspace-container .editor-world-actions-menu')
    expect(themes).toContain('color-mix(in srgb, var(--arcane-color) 78%, var(--text-primary))')
    expect(themes).toContain('background: var(--workspace-theme-secondary-soft)')
    expect(themes).toMatch(/\.workspace-container \.editor-world-actions-menu \{\s+background: color-mix\(in srgb, var\(--theme-custom-surface\) 94%, var\(--theme-custom-bg\)\);\s+-webkit-backdrop-filter: none;\s+backdrop-filter: none;/)
  })

  it('keeps the document icon picker compact and scoped to the world theme', () => {
    const tokens = fs.readFileSync(path.join(import.meta.dirname, 'tokens.css'), 'utf8')
    const overlays = fs.readFileSync(path.join(import.meta.dirname, 'overlays.css'), 'utf8')
    const pickerStyles = overlays.slice(
      overlays.indexOf('.document-icon-picker-backdrop'),
      overlays.indexOf('.duplicate-modal-overlay')
    )

    expect(tokens).toContain('.workspace-container .document-icon-picker')
    expect(pickerStyles).toContain('var(--theme-custom-surface)')
    expect(pickerStyles).toContain('var(--workspace-theme-accent-border)')
    expect(pickerStyles).toContain('var(--workspace-theme-secondary-soft)')
    expect(pickerStyles).not.toContain('backdrop-filter')
    expect(workspaceStyles).not.toContain('.icon-selector-dropdown')
    expect(workspaceStyles).not.toContain('.icon-option')
  })

  it('scopes the slash menu to the selected world theme', () => {
    const tiptap = fs.readFileSync(path.join(import.meta.dirname, 'tiptap.css'), 'utf8')
    const slashMenuStyles = tiptap.slice(tiptap.indexOf('.tiptap-slash-menu-group +'))

    expect(tiptap).toContain('.workspace-container .workspace-content-theme .tiptap-editor')
    expect(tiptap).toContain('--tiptap-menu-surface: color-mix(in srgb, var(--theme-custom-surface) 94%, var(--theme-custom-bg))')
    expect(tiptap).toContain('--tiptap-menu-accent: var(--accent-color)')
    expect(slashMenuStyles).not.toContain('var(--workspace-shell-copper)')
    expect(slashMenuStyles).not.toContain('var(--workspace-shell-raised)')
  })

  it('scopes toggle headings to the selected world theme', () => {
    const tiptap = fs.readFileSync(path.join(import.meta.dirname, 'tiptap.css'), 'utf8')

    expect(tiptap).toContain('--tiptap-toggle-accent: var(--accent-color)')
    expect(tiptap).toContain('--tiptap-toggle-line: var(--workspace-theme-accent-border)')
    expect(tiptap).toContain('.tiptap-toggle-heading[data-open="false"]')
    expect(tiptap).toContain('.tiptap-active-block.is-empty::before')
    expect(tiptap).toContain('content: attr(data-placeholder)')
    expect(tiptap).not.toContain('.tiptap-placeholder')
    const placeholderRule = tiptap.match(/\.tiptap-active-block\.is-empty::before\s*\{([^}]+)\}/)?.[1]
    expect(placeholderRule).not.toContain('overflow: hidden')
  })

  it('scopes workspace notifications to the selected world theme', () => {
    const tokens = fs.readFileSync(path.join(import.meta.dirname, 'tokens.css'), 'utf8')
    const overlays = fs.readFileSync(path.join(import.meta.dirname, 'overlays.css'), 'utf8')

    expect(tokens).toContain('.workspace-container .workspace-toast')
    expect(overlays).toContain('--toast-tone: var(--accent-color)')
    expect(overlays).toContain('--toast-tone: var(--arcane-color)')
    expect(overlays).toContain('var(--theme-custom-surface)')
  })
})
