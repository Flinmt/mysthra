import { useComponentsContext } from '@blocknote/react'

function joinClasses(...classes) {
  return classes.filter(Boolean).join(' ')
}

export function NotionMenuItem({ className, ...props }) {
  const components = useComponentsContext()
  const MenuItem = components?.Generic.Menu.Item
  if (!MenuItem) return null

  return <MenuItem className={joinClasses('notion-ui-menu-item', className)} {...props} />
}

export function NotionMenuRoot({ children, ...props }) {
  const components = useComponentsContext()
  const MenuRoot = components?.Generic.Menu.Root
  if (!MenuRoot) return null

  return <MenuRoot {...props}>{children}</MenuRoot>
}

export function NotionMenuTrigger({ children, ...props }) {
  const components = useComponentsContext()
  const MenuTrigger = components?.Generic.Menu.Trigger
  if (!MenuTrigger) return null

  return <MenuTrigger {...props}>{children}</MenuTrigger>
}

export function NotionMenuDropdown({ children, className, ...props }) {
  const components = useComponentsContext()
  const MenuDropdown = components?.Generic.Menu.Dropdown
  if (!MenuDropdown) return null

  return (
    <MenuDropdown className={joinClasses('notion-ui-menu-dropdown', className)} {...props}>
      {children}
    </MenuDropdown>
  )
}

export function NotionMenuDivider({ className, ...props }) {
  const components = useComponentsContext()
  const MenuDivider = components?.Generic.Menu.Divider
  if (!MenuDivider) return null

  return <MenuDivider className={joinClasses('notion-ui-menu-divider', className)} {...props} />
}

export function NotionPopoverRoot({ children, ...props }) {
  const components = useComponentsContext()
  const PopoverRoot = components?.Generic.Popover.Root
  if (!PopoverRoot) return null

  return <PopoverRoot {...props}>{children}</PopoverRoot>
}

export function NotionPopoverContent({ children, className, ...props }) {
  const components = useComponentsContext()
  const PopoverContent = components?.Generic.Popover.Content
  if (!PopoverContent) return null

  return (
    <PopoverContent className={joinClasses('notion-ui-popover-content', className)} {...props}>
      {children}
    </PopoverContent>
  )
}

export function NotionPopoverTrigger({ children, ...props }) {
  const components = useComponentsContext()
  const PopoverTrigger = components?.Generic.Popover.Trigger
  if (!PopoverTrigger) return null

  return <PopoverTrigger {...props}>{children}</PopoverTrigger>
}

export function NotionToolbarButton({ className, ...props }) {
  const components = useComponentsContext()
  const ToolbarButton = components?.FormattingToolbar.Button
  if (!ToolbarButton) return null

  return <ToolbarButton className={joinClasses('notion-ui-toolbar-button', className)} {...props} />
}
