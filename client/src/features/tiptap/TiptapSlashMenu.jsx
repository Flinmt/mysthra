import { useEffect, useRef } from 'react'

export default function TiptapSlashMenu({ items, selectedIndex, onSelect, onClose }) {
  const menuRef = useRef(null)
  const groups = items.reduce((result, item, index) => {
    const group = result.find(entry => entry.name === item.group)
    if (group) group.items.push({ item, index })
    else result.push({ name: item.group, items: [{ item, index }] })
    return result
  }, [])
  useEffect(() => {
    const item = menuRef.current?.querySelector(`[data-index="${selectedIndex}"]`)
    item?.scrollIntoView?.({ block: 'nearest' })
  }, [selectedIndex])

  return (
    <div ref={menuRef} className="tiptap-slash-menu" role="listbox" aria-label="Comandos">
      {groups.map(group => (
        <div className="tiptap-slash-menu-group" key={group.name}>
          <div className="tiptap-slash-menu-group-label">{group.name}</div>
          {group.items.map(({ item, index }) => (
            <button
              key={item.id}
              type="button"
              role="option"
              data-index={index}
              aria-selected={index === selectedIndex}
              className={index === selectedIndex ? 'is-selected' : ''}
              onMouseDown={event => event.preventDefault()}
              onClick={() => onSelect(item)}
            >
              <span className="tiptap-slash-menu-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      ))}
      {!items.length && <div className="tiptap-slash-menu-empty">Nenhum comando encontrado</div>}
      <button type="button" className="tiptap-slash-menu-close" onClick={onClose}>Esc para fechar</button>
    </div>
  )
}
