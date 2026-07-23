import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

function getThemeTokensForPortal() {
  if (typeof document === 'undefined') return undefined
  const themeSource = document.querySelector('.workspace-studio-shell')
  if (!themeSource) return undefined

  const computed = window.getComputedStyle(themeSource)
  const read = (name, fallback) => computed.getPropertyValue(name).trim() || fallback

  return {
    '--notion-ui-surface': read('--theme-custom-surface', read('--world-theme-surface', '#202326')),
    '--notion-ui-surface-raised': read('--theme-custom-surface', read('--world-theme-surface', '#262a2e')),
    '--notion-ui-text': read('--text-primary', read('--world-theme-text', '#f1f5f9')),
    '--notion-ui-text-muted': read('--text-secondary', read('--world-theme-muted', '#94a3b8')),
    '--notion-ui-border': read('--workspace-theme-accent-border', read('--world-theme-accent-border', '#ffffff1f')),
    '--notion-ui-hover': read('--workspace-theme-accent-soft', read('--world-theme-accent-soft', '#ffffff0f')),
    '--notion-ui-selected': read('--workspace-theme-accent-hover', read('--world-theme-accent-hover', '#ffffff18')),
    '--notion-ui-focus': read('--workspace-theme-secondary-border', '#ffffff30'),
    '--notion-ui-shadow': `0 12px 28px ${read('--bg-color', read('--world-theme-background', '#000000'))}c7`,
    '--bn-colors-side-menu': read('--arcane-color', read('--world-theme-secondary', '#b08d57'))
  }
}

function groupItems(items) {
  const groups = []
  const groupsByName = new Map()

  items.forEach((item, index) => {
    const name = item.group || ''
    let group = groupsByName.get(name)
    if (!group) {
      group = { name, items: [] }
      groupsByName.set(name, group)
      groups.push(group)
    }
    group.items.push({ item, index })
  })

  return groups
}

export function NotionSuggestionMenu({ items, loadingState, selectedIndex, onItemClick }) {
  const { t } = useTranslation()
  const groups = groupItems(items)
  const themeStyle = getThemeTokensForPortal()
  const menuRef = useRef(null)

  useEffect(() => {
    if (selectedIndex === undefined || typeof document === 'undefined') return
    const selectedItem = menuRef.current?.querySelector(`#bn-suggestion-menu-item-${selectedIndex}`)
    if (!selectedItem || !menuRef.current) return
    const menu = menuRef.current
    const itemTop = selectedItem.offsetTop
    const itemBottom = itemTop + selectedItem.offsetHeight
    if (itemTop < menu.scrollTop) menu.scrollTop = itemTop
    if (itemBottom > menu.scrollTop + menu.clientHeight) {
      menu.scrollTop = itemBottom - menu.clientHeight
    }
  }, [selectedIndex])

  if (loadingState === 'loading-initial' || loadingState === 'loading') {
    return (
      <div className="notion-command-menu" role="listbox" aria-busy="true" style={themeStyle}>
        <div className="notion-command-menu-loading">
          <span className="notion-command-menu-loading-dot" />
          <span>...</span>
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="notion-command-menu" role="listbox" style={themeStyle}>
        <div className="notion-command-menu-empty">{t('workspace.notion_command_empty')}</div>
      </div>
    )
  }

  return (
    <div ref={menuRef} className="notion-command-menu" role="listbox" aria-label="Comandos" style={themeStyle}>
      <div className="notion-command-menu-header">
        <span className="notion-command-menu-trigger">/</span>
        <span>{t('workspace.notion_command_menu_title')}</span>
      </div>
      <ul className="notion-command-list">
        {groups.flatMap(group => [
          ...(group.name ? [
            <li className="notion-command-group-label" key={`group-${group.name}`}>
              {group.name}
            </li>
          ] : []),
          ...group.items.map(({ item, index }) => (
            <li className="notion-command-list-item" key={item.id || item.key || `${item.title}-${index}`}>
              <button
                type="button"
                role="option"
                id={`bn-suggestion-menu-item-${index}`}
                aria-selected={selectedIndex === index}
                className={`notion-command-item${selectedIndex === index ? ' is-selected' : ''}`}
                onMouseDown={event => event.preventDefault()}
                onClick={() => onItemClick?.(item)}
              >
                <span className="notion-command-item-icon">{item.icon}</span>
                <span className="notion-command-item-title">{item.title}</span>
              </button>
            </li>
          ))
        ])}
      </ul>
    </div>
  )
}
