import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const surfaceMocks = vi.hoisted(() => ({ editorOptions: null, suggestionMenuProps: null }))

vi.mock('@blocknote/mantine', () => ({
  BlockNoteView: ({ children, editable }) => (
    <div data-testid="blocknote-view" data-editable={String(editable)}>{children}</div>
  )
}))

vi.mock('@blocknote/react', () => ({
  FormattingToolbarController: () => <div data-testid="formatting-toolbar-controller" />,
  SideMenuController: () => <div data-testid="side-menu-controller" />,
  SuggestionMenuController: (props) => {
    surfaceMocks.suggestionMenuProps = props
    return <div data-testid="suggestion-menu-controller" />
  },
  useCreateBlockNote: (options) => {
    surfaceMocks.editorOptions = options
    return {
      createLink: vi.fn(),
      document: [],
      focus: vi.fn(),
      getSelectedText: vi.fn(() => ''),
      replaceBlocks: vi.fn()
    }
  }
}))

vi.mock('@blocknote/xl-multi-column', () => ({ multiColumnDropCursor: {} }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: 'pt-BR' } }) }))
vi.mock('./notionCommands', () => ({ getNotionSlashMenuItems: vi.fn(() => []) }))
vi.mock('./notionSchema', () => ({
  getNotionDictionary: (_language, placeholders) => ({ placeholders }),
  isAllowedNotionLink: vi.fn(() => true),
  NOTION_SCHEMA: {}
}))
vi.mock('./notionTools', () => ({
  NotionFormattingToolbar: () => null,
  NotionSideMenu: () => null
}))
vi.mock('./useNotionAssets', () => ({
  uploadNotionImage: vi.fn(),
  useNotionAssets: () => ({
    insertImage: vi.fn(),
    onDragOver: vi.fn(),
    onDrop: vi.fn()
  })
}))

import NotionSurface from './NotionSurface'

const baseProps = {
  content: '',
  contentKey: 'tab-1',
  worldId: 'world-1',
  collaborationState: null,
  collaborationUser: null,
  collaborationReadOnly: false,
  collaborationSynced: true,
  requestMigration: vi.fn(),
  getAssetUrl: path => `/assets/${path}`,
  onRequestAssets: vi.fn(),
  labels: {
    emptyPlaceholder: "Comece a escrever ou use '/' para comandos",
    blockPlaceholder: "Digite ou use '/'",
    commandMenuLabel: 'Comandos de bloco',
    commandMenuLoading: 'Carregando comandos...',
    commandMenuEmpty: 'Nenhum comando encontrado',
    commandGroupText: 'Texto',
    commandGroupLists: 'Listas',
    commandGroupStructure: 'Estrutura',
    commandGroupMedia: 'Mídia',
    pageLink: 'Link de página'
  },
  onChange: vi.fn()
}

describe('NotionSurface editing modes', () => {
  beforeEach(() => {
    surfaceMocks.editorOptions = null
    surfaceMocks.suggestionMenuProps = null
  })

  afterEach(cleanup)

  it('configures writing tools and uploads only for editable documents', () => {
    render(<NotionSurface {...baseProps} editable />)

    expect(screen.getByTestId('blocknote-view').getAttribute('data-editable')).toBe('true')
    expect(screen.queryByTestId('side-menu-controller')).not.toBeNull()
    expect(screen.queryByTestId('formatting-toolbar-controller')).not.toBeNull()
    expect(screen.queryByTestId('suggestion-menu-controller')).not.toBeNull()
    expect(surfaceMocks.editorOptions.autofocus).toBe(false)
    expect(surfaceMocks.editorOptions.tabBehavior).toBe('prefer-navigate-ui')
    expect(surfaceMocks.editorOptions.uploadFile).toEqual(expect.any(Function))
    expect(surfaceMocks.suggestionMenuProps.getItems).toEqual(expect.any(Function))
    expect(surfaceMocks.suggestionMenuProps.suggestionMenuComponent).toBeUndefined()
  })

  it('does not expose editing tools or uploads in readonly mode', () => {
    render(<NotionSurface {...baseProps} editable collaborationReadOnly />)

    expect(screen.getByTestId('blocknote-view').getAttribute('data-editable')).toBe('false')
    expect(screen.queryByTestId('side-menu-controller')).toBeNull()
    expect(screen.queryByTestId('formatting-toolbar-controller')).toBeNull()
    expect(screen.queryByTestId('suggestion-menu-controller')).toBeNull()
    expect(surfaceMocks.editorOptions.uploadFile).toBeUndefined()
  })
})
