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
      'notion.css',
      'tiptap.css',
      'map.css',
      'board.css',
      'overlays.css',
      'themes.css',
      'permissions.css',
      'sidebar.css',
      'responsive.css'
    ])
  })

  it('keeps BlockNote styling isolated in the Notion domain', () => {
    const notion = fs.readFileSync(path.join(import.meta.dirname, 'notion.css'), 'utf8')
    const competingFiles = workspaceFiles.filter(file => file !== 'notion.css' && /(?:\.bn-|\[data-file-block\])/.test(fs.readFileSync(path.join(import.meta.dirname, file), 'utf8')))

    expect(notion).toContain('.notion-editor')
    expect(notion).not.toContain('.wiki-block-editor')
    expect(competingFiles).toEqual([])
  })

  it('keeps the Notion writing surface compact and avoids a fixed editor height', () => {
    const notion = fs.readFileSync(path.join(import.meta.dirname, 'notion.css'), 'utf8')
    const document = fs.readFileSync(path.join(import.meta.dirname, 'document.css'), 'utf8')

    expect(notion).not.toContain('min-height: 420px')
    expect(notion).toContain('font-size: 13px')
    expect(notion).toContain('padding: 0 28px')
    expect(document).toContain('width: min(780px,100% - 80px)')
    expect(document).toContain('.editor-page.is-wiki-page.is-wide-content .document-content-frame')
    expect(document).toContain('height: 148px')
  })

  it('keeps palette ownership centralized and free from the legacy purple theme', () => {
    expect(workspaceStyles).not.toMatch(/#(?:8b5cf6|a78bfa|c4b5fd|ddd6fe|5d34d0|a855f7|7c3aed|00f0ff)/i)
    expect(fs.readFileSync(path.join(import.meta.dirname, 'themes.css'), 'utf8')).not.toContain('[data-world-theme=')
  })

  it('defines the studio shell in a single module', () => {
    const shellOwners = workspaceFiles.filter(file => fs.readFileSync(path.join(import.meta.dirname, file), 'utf8').includes('.workspace-container.workspace-studio-shell'))

    expect(shellOwners).toEqual(['shell.css'])
  })

  it('keeps the world navigator final cascade in its component stylesheet', () => {
    const imports = [...workspaceEntry.matchAll(/@import '\.\/(.+\.css)'/g)].map(match => match[1])
    const navigatorSelectors = /(?:tree-node|asset-tree-node|sidebar-search-bar|sidebar-nexus-tab|sidebar-empty|world-navigator)/
    const competingFiles = workspaceFiles.filter(file => file !== 'sidebar.css' && navigatorSelectors.test(fs.readFileSync(path.join(import.meta.dirname, file), 'utf8')))

    expect(imports.indexOf('sidebar.css')).toBeGreaterThan(imports.indexOf('themes.css'))
    expect(fs.readFileSync(path.join(import.meta.dirname, 'sidebar.css'), 'utf8')).toContain('--navigator-accent: var(--world-theme-accent)')
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

  it('scopes the experimental slash menu to the selected world theme', () => {
    const tiptap = fs.readFileSync(path.join(import.meta.dirname, 'tiptap.css'), 'utf8')
    const slashMenuStyles = tiptap.slice(tiptap.indexOf('.tiptap-slash-menu-group +'))

    expect(tiptap).toContain('.workspace-container .workspace-content-theme .tiptap-editor')
    expect(tiptap).toContain('--tiptap-menu-surface: color-mix(in srgb, var(--theme-custom-surface) 94%, var(--theme-custom-bg))')
    expect(tiptap).toContain('--tiptap-menu-accent: var(--accent-color)')
    expect(slashMenuStyles).not.toContain('var(--workspace-shell-copper)')
    expect(slashMenuStyles).not.toContain('var(--workspace-shell-raised)')
  })

  it('scopes experimental toggle headings to the selected world theme', () => {
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
