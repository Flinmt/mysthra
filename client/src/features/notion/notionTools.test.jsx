import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NotionFormattingToolbar, NotionSideMenu } from './notionTools'

const mocks = vi.hoisted(() => ({
  block: {
    id: 'block-1',
    type: 'paragraph',
    props: {},
    content: [{ type: 'text', text: 'Parent', styles: {} }],
    children: [{
      id: 'block-2',
      type: 'paragraph',
      props: {},
      content: [{ type: 'text', text: 'Child', styles: {} }],
      children: []
    }]
  },
  editor: {
    getSelection: vi.fn(),
    insertBlocks: vi.fn(),
    removeBlocks: vi.fn(),
    getBlock: vi.fn(() => mocks.block),
    forEachBlock: vi.fn(callback => {
      callback(mocks.block)
      callback({ id: 'block-3', type: 'paragraph', content: [{ text: 'Destination' }], children: [] })
    }),
    transact: vi.fn(callback => callback()),
    updateBlock: vi.fn(),
    schema: { blockSchema: {
      paragraph: {}, heading: {}, bulletListItem: {}, numberedListItem: {},
      checkListItem: {}, quote: {}, divider: {}
    }}
  }
}))

vi.mock('@blocknote/core/extensions', () => ({ SideMenuExtension: {} }))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: key => key })
}))

vi.mock('@blocknote/react', () => {
  const Tool = ({ name }) => <button type="button">{name}</button>
  return {
    AddBlockButton: () => <Tool name="add-block" />,
    BasicTextStyleButton: ({ basicTextStyle }) => <Tool name={basicTextStyle} />,
    BlockColorsItem: ({ children }) => <div>{children}</div>,
    BlockTypeSelect: () => <Tool name="block-type" />,
    CreateLinkButton: () => <Tool name="create-link" />,
    DragHandleButton: ({ dragHandleMenu: Menu }) => <><Tool name="drag" /><Menu /></>,
    DragHandleMenu: ({ children }) => <div>{children}</div>,
    blockTypeSelectItems: () => [
      { name: 'Paragraph', type: 'paragraph', icon: () => null },
      { name: 'Heading', type: 'heading', icon: () => null },
      { name: 'Divider', type: 'divider', icon: () => null }
    ],
    FileCaptionButton: () => <Tool name="file-caption" />,
    FileDeleteButton: () => <Tool name="file-delete" />,
    FileDownloadButton: () => <Tool name="file-download" />,
    FilePreviewButton: () => <Tool name="file-preview" />,
    FileRenameButton: () => <Tool name="file-rename" />,
    FileReplaceButton: () => <Tool name="file-replace" />,
    FormattingToolbar: ({ children }) => <div>{children}</div>,
    NestBlockButton: () => <Tool name="nest" />,
    SideMenu: ({ children }) => <div>{children}</div>,
    TableCellMergeButton: () => <Tool name="table-merge" />,
    TableColumnHeaderItem: ({ children }) => <div>{children}</div>,
    TableRowHeaderItem: ({ children }) => <div>{children}</div>,
    TextAlignButton: ({ textAlignment }) => <Tool name={`align-${textAlignment}`} />,
    UnnestBlockButton: () => <Tool name="unnest" />,
    useBlockNoteEditor: () => mocks.editor,
    useComponentsContext: () => ({
      Generic: {
        Menu: {
          Root: ({ children }) => <div>{children}</div>,
          Trigger: ({ children }) => <div>{children}</div>,
          Dropdown: ({ children }) => <div>{children}</div>,
          Item: ({ children, onClick, className }) => (
            <button type="button" className={className} onClick={onClick}>{children}</button>
          )
        }
      }
    }),
    useDictionary: () => ({
      drag_handle: {
        header_row_menuitem: 'header-row',
        header_column_menuitem: 'header-column',
        colors_menuitem: 'colors'
      }
    }),
    useExtensionState: (_extension, { selector }) => selector({ block: mocks.block })
  }
})

describe('notion tools', () => {
  afterEach(cleanup)

  beforeEach(() => {
    mocks.editor.getSelection.mockReset()
    mocks.editor.insertBlocks.mockReset()
    mocks.editor.removeBlocks.mockReset()
    mocks.editor.getBlock.mockClear()
    mocks.editor.forEachBlock.mockClear()
    mocks.editor.transact.mockClear()
    mocks.editor.updateBlock.mockClear()
  })

  it('keeps the formatting toolbar focused on working contextual commands', () => {
    const onOpenPageLink = vi.fn()
    render(<NotionFormattingToolbar onOpenPageLink={onOpenPageLink} pageLinkLabel="Page link" />)

    expect(screen.getByText('block-type')).not.toBeNull()
    expect(screen.getByText('bold')).not.toBeNull()
    expect(screen.queryByText(/comment/i)).toBeNull()

    fireEvent.mouseDown(screen.getByTitle('Page link'))
    expect(onOpenPageLink).toHaveBeenCalledOnce()
  })

  it('duplicates a block tree without reusing persisted block ids', () => {
    render(<NotionSideMenu />)

    expect(screen.getByText('colors')).not.toBeNull()
    fireEvent.click(screen.getByText('workspace.notion_duplicate_block'))

    expect(mocks.editor.insertBlocks).toHaveBeenCalledOnce()
    const [blocks, referenceBlock, placement] = mocks.editor.insertBlocks.mock.calls[0]
    expect(blocks[0]).not.toHaveProperty('id')
    expect(blocks[0].children[0]).not.toHaveProperty('id')
    expect(referenceBlock).toBe(mocks.block)
    expect(placement).toBe('after')
  })

  it('deletes the hovered block through the editor API', () => {
    render(<NotionSideMenu />)

    fireEvent.click(screen.getByText('workspace.notion_delete_block'))

    expect(mocks.editor.removeBlocks).toHaveBeenCalledWith([mocks.block])
  })

  it('transforms the active block using the compatible schema item', () => {
    render(<NotionSideMenu />)

    fireEvent.click(screen.getByText('Paragraph'))

    expect(mocks.editor.transact).toHaveBeenCalledOnce()
    expect(mocks.editor.updateBlock).toHaveBeenCalledWith(mocks.block, {
      type: 'paragraph',
      props: undefined
    })
  })

  it('moves the active block before a valid document destination', () => {
    render(<NotionSideMenu />)

    fireEvent.click(screen.getByText('workspace.notion_move_before'))

    expect(mocks.editor.removeBlocks).toHaveBeenCalledWith([mocks.block])
    expect(mocks.editor.insertBlocks).toHaveBeenCalledWith([mocks.block], 'block-3', 'before')
  })
})
