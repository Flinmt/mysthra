import { SideMenuExtension } from '@blocknote/core/extensions'
import { useMemo } from 'react'
import {
  AddBlockButton,
  BasicTextStyleButton,
  BlockColorsItem,
  BlockTypeSelect,
  CreateLinkButton,
  DragHandleButton,
  DragHandleMenu,
  blockTypeSelectItems,
  FileCaptionButton,
  FileDeleteButton,
  FileDownloadButton,
  FilePreviewButton,
  FileRenameButton,
  FileReplaceButton,
  FormattingToolbar,
  NestBlockButton,
  SideMenu,
  TableCellMergeButton,
  TableColumnHeaderItem,
  TableRowHeaderItem,
  TextAlignButton,
  UnnestBlockButton,
  useBlockNoteEditor,
  useComponentsContext,
  useDictionary,
  useExtensionState
} from '@blocknote/react'
import { ArrowDownToLine, ArrowUpToLine, Copy, Link2, Trash2, WandSparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  NotionMenuDropdown,
  NotionMenuDivider,
  NotionMenuItem,
  NotionMenuRoot,
  NotionMenuTrigger,
  NotionToolbarButton
} from './notionUi'

function copyBlockWithoutIds(block) {
  const copy = { ...block }
  const children = copy.children
  delete copy.id
  delete copy.children
  return {
    ...copy,
    ...(children?.length ? { children: children.map(copyBlockWithoutIds) } : {})
  }
}

function useSideMenuBlock() {
  const editor = useBlockNoteEditor()
  const block = useExtensionState(SideMenuExtension, {
    editor,
    selector: state => state?.block
  })
  return { block, editor }
}

function getBlockLabel(block, index) {
  const text = Array.isArray(block.content)
    ? block.content.map(item => item.text || '').join('').trim()
    : ''
  return text || `${block.type} ${index + 1}`
}

function isDescendant(block, possibleDescendantId) {
  return block.children?.some(child => child.id === possibleDescendantId || isDescendant(child, possibleDescendantId))
}

function DuplicateBlockItem() {
  const components = useComponentsContext()
  const { t } = useTranslation()
  const { block, editor } = useSideMenuBlock()

  if (!components || !block) return null

  return (
    <NotionMenuItem
      className="bn-menu-item notion-block-menu-item"
      icon={<Copy size={14} />}
      onClick={() => {
        const selectedBlocks = editor.getSelection()?.blocks
        const sourceBlocks = selectedBlocks?.some(selected => selected.id === block.id)
          ? selectedBlocks
          : [block]
        editor.insertBlocks(
          sourceBlocks.map(copyBlockWithoutIds),
          sourceBlocks[sourceBlocks.length - 1],
          'after'
        )
      }}
    >
      {t('workspace.notion_duplicate_block')}
    </NotionMenuItem>
  )
}

function DeleteBlockItem() {
  const components = useComponentsContext()
  const { t } = useTranslation()
  const { block, editor } = useSideMenuBlock()

  if (!components || !block) return null

  return (
    <NotionMenuItem
      className="bn-menu-item notion-block-menu-item is-danger"
      icon={<Trash2 size={14} />}
      onClick={() => {
        const selectedBlocks = editor.getSelection()?.blocks
        editor.removeBlocks(selectedBlocks?.some(selected => selected.id === block.id) ? selectedBlocks : [block])
      }}
    >
      {t('workspace.notion_delete_block')}
    </NotionMenuItem>
  )
}

function TransformBlockItem() {
  const components = useComponentsContext()
  const { t } = useTranslation()
  const dictionary = useDictionary()
  const { block, editor } = useSideMenuBlock()
  const items = useMemo(() => {
    const allowedTypes = new Set([
      'paragraph', 'heading', 'bulletListItem', 'numberedListItem',
      'checkListItem', 'quote', 'divider'
    ])
    return blockTypeSelectItems(dictionary).filter(item => (
      allowedTypes.has(item.type) && editor.schema.blockSchema[item.type]
    ))
  }, [block, dictionary, editor])

  if (!components || !block || !items.length) return null

  return (
    <NotionMenuRoot sub>
      <NotionMenuTrigger sub>
        <NotionMenuItem
          className="bn-menu-item notion-block-menu-item"
          subTrigger
          icon={<WandSparkles size={14} />}
        >
          {t('workspace.notion_transform_block')}
        </NotionMenuItem>
      </NotionMenuTrigger>
      <NotionMenuDropdown sub className="bn-drag-handle-submenu">
        {items.map(item => {
          const Icon = item.icon
          return (
            <NotionMenuItem
              key={item.type}
              className="bn-menu-item notion-block-menu-item"
              icon={<Icon size={14} />}
              checked={block.type === item.type}
              onClick={() => {
                const selectedBlocks = editor.getSelection()?.blocks || [block]
                editor.transact(() => {
                  selectedBlocks.forEach(selected => editor.updateBlock(selected, {
                    type: item.type,
                    props: item.props
                  }))
                })
              }}
            >
              {item.name}
            </NotionMenuItem>
          )
        })}
      </NotionMenuDropdown>
    </NotionMenuRoot>
  )
}

function MoveBlockItem() {
  const components = useComponentsContext()
  const { t } = useTranslation()
  const { block, editor } = useSideMenuBlock()
  const destinations = useMemo(() => {
    if (!block) return []
    const result = []
    let index = 0
    editor.forEachBlock(candidate => {
      if (candidate.id !== block.id && !isDescendant(block, candidate.id)) {
        result.push({ block: candidate, label: getBlockLabel(candidate, index) })
      }
      index += 1
      return true
    })
    return result
  }, [block, editor])

  if (!components || !block || !destinations.length) return null

  return (
    <NotionMenuRoot sub>
      <NotionMenuTrigger sub>
        <NotionMenuItem
          className="bn-menu-item notion-block-menu-item"
          subTrigger
          icon={<ArrowUpToLine size={14} />}
        >
          {t('workspace.notion_move_block')}
        </NotionMenuItem>
      </NotionMenuTrigger>
      <NotionMenuDropdown sub className="bn-drag-handle-submenu">
        {destinations.map(({ block: target, label }) => (
          <NotionMenuItem
            key={target.id}
            className="bn-menu-item notion-block-menu-item"
            icon={<ArrowDownToLine size={14} />}
            onClick={() => {
              const movedBlock = editor.getBlock(block.id)
              if (!movedBlock) return
              editor.removeBlocks([movedBlock])
              editor.insertBlocks([movedBlock], target.id, 'before')
            }}
          >
            {t('workspace.notion_move_before', { name: label })}
          </NotionMenuItem>
        ))}
      </NotionMenuDropdown>
    </NotionMenuRoot>
  )
}

function NotionDragHandleMenu() {
  const dictionary = useDictionary()
  return (
    <DragHandleMenu>
      <DuplicateBlockItem />
      <TransformBlockItem />
      <BlockColorsItem>{dictionary.drag_handle.colors_menuitem}</BlockColorsItem>
      <MoveBlockItem />
      <NotionMenuDivider />
      <TableRowHeaderItem>{dictionary.drag_handle.header_row_menuitem}</TableRowHeaderItem>
      <TableColumnHeaderItem>{dictionary.drag_handle.header_column_menuitem}</TableColumnHeaderItem>
      <NotionMenuDivider />
      <DeleteBlockItem />
    </DragHandleMenu>
  )
}

export function NotionSideMenu() {
  return (
    <SideMenu className="notion-ui-side-menu">
      <AddBlockButton />
      <DragHandleButton dragHandleMenu={NotionDragHandleMenu} />
    </SideMenu>
  )
}

export function NotionFormattingToolbar({ onOpenPageLink, pageLinkLabel }) {
  return (
    <FormattingToolbar className="notion-ui-toolbar">
      <BlockTypeSelect />
      <TableCellMergeButton />
      <FileCaptionButton />
      <FileReplaceButton />
      <FileRenameButton />
      <FileDeleteButton />
      <FileDownloadButton />
      <FilePreviewButton />
      <BasicTextStyleButton basicTextStyle="bold" />
      <BasicTextStyleButton basicTextStyle="italic" />
      <BasicTextStyleButton basicTextStyle="underline" />
      <BasicTextStyleButton basicTextStyle="strike" />
      <TextAlignButton textAlignment="left" />
      <TextAlignButton textAlignment="center" />
      <TextAlignButton textAlignment="right" />
      <NestBlockButton />
      <UnnestBlockButton />
      <CreateLinkButton />
      <NotionToolbarButton
        className="page-link-toolbar-button"
        icon={<Link2 size={16} />}
        mainTooltip={pageLinkLabel || 'Page link'}
        onMouseDown={(event) => {
          event.preventDefault()
          onOpenPageLink?.()
        }}
        label={pageLinkLabel || 'Page link'}
      />
    </FormattingToolbar>
  )
}
