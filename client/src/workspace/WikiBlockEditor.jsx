import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Columns2, Columns3, Link2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { BlockNoteSchema, combineByGroup } from '@blocknote/core';
import { filterSuggestionItems, insertOrUpdateBlockForSlashMenu } from '@blocknote/core/extensions';
import * as blockNoteLocales from '@blocknote/core/locales';
import {
  AddBlockButton,
  AddCommentButton,
  AddTiptapCommentButton,
  BasicTextStyleButton,
  BlockTypeSelect,
  CreateLinkButton,
  DragHandleButton,
  DragHandleMenu,
  FileCaptionButton,
  FileDeleteButton,
  FileDownloadButton,
  FilePreviewButton,
  FileRenameButton,
  FileReplaceButton,
  FormattingToolbar,
  FormattingToolbarController,
  NestBlockButton,
  RemoveBlockItem,
  SideMenu,
  SideMenuController,
  SuggestionMenuController,
  TableCellMergeButton,
  TableColumnHeaderItem,
  TableRowHeaderItem,
  TextAlignButton,
  UnnestBlockButton,
  getDefaultReactSlashMenuItems,
  useCreateBlockNote,
  useDictionary
} from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import { blocksToYXmlFragment } from '@blocknote/core/yjs';
import { locales as multiColumnLocales, multiColumnDropCursor, withMultiColumn } from '@blocknote/xl-multi-column';
import '@blocknote/mantine/style.css';
import { useCollaborationRoom } from '../useCollaborationRoom';
import WorkspaceInsertSearch from './WorkspaceInsertSearch';
import { prepareAssetUpload } from './utils';
import { isInternalPageLink } from './utils';

const WIKI_BLOCKNOTE_SCHEMA = withMultiColumn(BlockNoteSchema.create());
const DEFAULT_ALLOWED_LINK_PROTOCOLS = /^(https?|ftps?|mailto|tel|callto|sms|cid|xmpp):/i;

function isAllowedLink(href = '') {
  const value = String(href || '').trim();
  return DEFAULT_ALLOWED_LINK_PROTOCOLS.test(value) || isInternalPageLink(value);
}

function getBlockNoteLocaleKey(language = 'en') {
  const normalized = String(language || 'en').toLowerCase();
  if (normalized === 'zh-tw' || normalized === 'zh_tw') return 'zhTW';
  return normalized.split('-')[0] || 'en';
}

function mergeBlockNoteDictionaries(base, extension) {
  const merged = { ...base };
  for (const [key, value] of Object.entries(extension || {})) {
    if (
      value
      && typeof value === 'object'
      && !Array.isArray(value)
      && base?.[key]
      && typeof base[key] === 'object'
      && !Array.isArray(base[key])
    ) {
      merged[key] = mergeBlockNoteDictionaries(base[key], value);
    } else {
      merged[key] = value;
    }
  }
  return merged;
}

function getBlockNoteDictionary(language = 'en') {
  const localeKey = getBlockNoteLocaleKey(language);
  const coreDictionary = blockNoteLocales[localeKey] || blockNoteLocales.en;
  const multiColumnDictionary = multiColumnLocales[localeKey] || multiColumnLocales.en;
  return mergeBlockNoteDictionaries(coreDictionary, multiColumnDictionary);
}

function createColumnListBlock(columnCount) {
  return {
    type: 'columnList',
    children: Array.from({ length: columnCount }, () => ({
      type: 'column',
      children: [{ type: 'paragraph' }]
    }))
  };
}

function getMythraMultiColumnSlashMenuItems(editor, dictionary) {
  const slashMenu = dictionary?.slash_menu || {};
  const twoColumns = slashMenu.two_columns || {
    title: 'Duas Colunas',
    subtext: 'Duas colunas lado a lado',
    aliases: ['colunas', 'linha', 'dividir'],
    group: slashMenu.heading?.group || 'Blocos básicos'
  };
  const threeColumns = slashMenu.three_columns || {
    title: 'Três Colunas',
    subtext: 'Três colunas lado a lado',
    aliases: ['colunas', 'linha', 'dividir'],
    group: slashMenu.heading?.group || 'Blocos básicos'
  };

  return [
    {
      ...twoColumns,
      icon: <Columns2 size={18} />,
      onItemClick: () => insertOrUpdateBlockForSlashMenu(editor, createColumnListBlock(2))
    },
    {
      ...threeColumns,
      icon: <Columns3 size={18} />,
      onItemClick: () => insertOrUpdateBlockForSlashMenu(editor, createColumnListBlock(3))
    }
  ];
}

function MythraDragHandleMenu() {
  const dict = useDictionary();

  return (
    <DragHandleMenu>
      <RemoveBlockItem>{dict.drag_handle.delete_menuitem}</RemoveBlockItem>
      <TableRowHeaderItem>
        {dict.drag_handle.header_row_menuitem}
      </TableRowHeaderItem>
      <TableColumnHeaderItem>
        {dict.drag_handle.header_column_menuitem}
      </TableColumnHeaderItem>
    </DragHandleMenu>
  );
}

function MythraSideMenu() {
  return (
    <SideMenu>
      <AddBlockButton />
      <DragHandleButton dragHandleMenu={MythraDragHandleMenu} />
    </SideMenu>
  );
}

function MythraFormattingToolbar({ onOpenPageLink, pageLinkLabel }) {
  return (
    <FormattingToolbar>
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
      <button
        type="button"
        className="bn-button page-link-toolbar-button"
        onMouseDown={(event) => {
          event.preventDefault();
          onOpenPageLink?.();
        }}
        title={pageLinkLabel || 'Page link'}
      >
        <Link2 size={16} />
      </button>
      <AddCommentButton />
      <AddTiptapCommentButton />
    </FormattingToolbar>
  );
}

function parseBlockNoteContent(content = '') {
  if (!content.trim()) return null;
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    return null;
  }
  return null;
}

export default function WikiBlockEditor({
  content,
  contentKey,
  editable,
  locked,
  worldId,
  collaborationRoom,
  currentUser,
  isVisitor = false,
  getAssetUrl,
  onRequestAssets,
  labels,
  documentTree = [],
  assetTree = [],
  onNavigateToPageLink,
  onVisitorCountChange,
  onCollaborationSaveState,
  onChange
}) {
  const { i18n } = useTranslation();
  const [insertSearch, setInsertSearch] = useState({ isOpen: false, x: 0, y: 0, mode: 'all', selectedText: '' });
  const onNavigateToPageLinkRef = useRef(onNavigateToPageLink);
  const collaborationRoomState = useCollaborationRoom({
    roomName: collaborationRoom,
    currentUser,
    isVisitor,
    locked
  });
  const {
    doc: collaborationDoc,
    provider: collaborationProvider,
    user: collaborationUser,
    readOnly: collaborationServerReadOnly,
    synced: collaborationSynced,
    saveStatus: collaborationSaveStatus,
    dirty: collaborationDirty,
    awarenessStates: collaborationAwarenessStates,
    setAwarenessField: setCollaborationAwarenessField
  } = collaborationRoomState;
  const collaborationFragment = useMemo(
    () => collaborationDoc?.getXmlFragment('blocknote') || null,
    [collaborationDoc]
  );
  const collaborationState = useMemo(() => {
    if (!collaborationFragment || !collaborationDoc || !collaborationProvider) return null;
    return {
      doc: collaborationDoc,
      provider: collaborationProvider,
      fragment: collaborationFragment
    };
  }, [collaborationDoc, collaborationFragment, collaborationProvider]);
  const collaborationReadOnly = Boolean(locked || collaborationServerReadOnly);
  const initialBlocks = useMemo(() => collaborationState ? null : parseBlockNoteContent(content), [collaborationState, content]);
  const initialContentRef = useRef(content);
  const isLoadingRef = useRef(true);
  const onChangeRef = useRef(onChange);
  const emitFrameRef = useRef(null);
  const legacyMigrationRef = useRef('');
  const dictionary = useMemo(() => getBlockNoteDictionary(i18n.language), [i18n.language]);

  useEffect(() => {
    onNavigateToPageLinkRef.current = onNavigateToPageLink;
  }, [onNavigateToPageLink]);

  const editor = useCreateBlockNote(
    {
      schema: WIKI_BLOCKNOTE_SCHEMA,
      dictionary,
      dropCursor: multiColumnDropCursor,
      ...(collaborationState
        ? {
          collaboration: {
            fragment: collaborationState.fragment,
            user: collaborationUser,
            provider: collaborationState.provider,
            showCursorLabels: 'activity'
          }
        }
        : initialBlocks ? { initialContent: initialBlocks } : {}),
      links: {
        isValidLink: isAllowedLink,
        onClick: (event) => {
          const href = event.target?.closest?.('a')?.getAttribute('href') || '';
          if (!isInternalPageLink(href)) return false;
          event.preventDefault();
          onNavigateToPageLinkRef.current?.(href);
          return true;
        }
      },
      uploadFile: async (file) => {
        const prepared = await prepareAssetUpload(file);
        if (!prepared.contentType.startsWith('image/')) {
          throw new Error('Only images can be uploaded to image blocks');
        }
        const query = new URLSearchParams({
          path: '',
          filename: prepared.filename
        });
        const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/assets/upload?${query.toString()}`, {
          method: 'POST',
          headers: { 'Content-Type': prepared.contentType },
          body: prepared.blob
        });
        if (!res.ok) throw new Error('Failed to upload image');
        const uploaded = await res.json();
        await onRequestAssets?.();
        return getAssetUrl(uploaded.path);
      }
    },
    [contentKey, collaborationRoom, collaborationProvider, dictionary]
  );

  const insertPageLink = useCallback(({ href, label }) => {
    if (!href) return;
    editor.createLink(href, label || labels.pageLink || 'Page link');
    editor.focus();
  }, [editor, labels.pageLink]);
  const getSlashMenuItems = useCallback(
    async (query) => {
      try {
        return filterSuggestionItems(
          combineByGroup(
            getDefaultReactSlashMenuItems(editor),
            getMythraMultiColumnSlashMenuItems(editor, dictionary)
          ),
          query
        );
      } catch {
        return filterSuggestionItems(getDefaultReactSlashMenuItems(editor), query);
      }
    },
    [dictionary, editor]
  );

  useEffect(() => {
    if (!collaborationState) {
      onVisitorCountChange?.(0);
      onCollaborationSaveState?.({ status: 'saved', dirty: false });
      return;
    }
    if (isVisitor) {
      setCollaborationAwarenessField('visitor', { viewing: true });
    }
    const count = collaborationAwarenessStates.filter(state => state?.visitor?.viewing).length;
    onVisitorCountChange?.(count);
    onCollaborationSaveState?.({
      status: collaborationSaveStatus,
      dirty: collaborationDirty
    });
  }, [
    collaborationAwarenessStates,
    collaborationDirty,
    collaborationSaveStatus,
    collaborationState,
    isVisitor,
    onCollaborationSaveState,
    onVisitorCountChange,
    setCollaborationAwarenessField
  ]);

  const insertImageBlock = useCallback((url, name = '') => {
    const cursorBlock = editor.getTextCursorPosition().block;
    editor.insertBlocks(
      [{
        type: 'image',
        props: {
          url,
          name
        }
      }],
      cursorBlock,
      'after'
    );
    editor.focus();
  }, [editor]);

  const uploadAndInsertImage = useCallback(async (file) => {
    const prepared = await prepareAssetUpload(file);
    if (!prepared.contentType.startsWith('image/')) return;
    const query = new URLSearchParams({
      path: '',
      filename: prepared.filename
    });
    const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/assets/upload?${query.toString()}`, {
      method: 'POST',
      headers: { 'Content-Type': prepared.contentType },
      body: prepared.blob
    });
    if (!res.ok) throw new Error('Failed to upload image');
    const uploaded = await res.json();
    await onRequestAssets?.();
    insertImageBlock(getAssetUrl(uploaded.path), uploaded.name || prepared.filename);
  }, [getAssetUrl, insertImageBlock, onRequestAssets, worldId]);

  const emitEditorDocument = useCallback(() => {
    if (collaborationState) return;
    if (isLoadingRef.current || !editable) return;
    onChangeRef.current(JSON.stringify(editor.document));
    if (emitFrameRef.current) {
      window.cancelAnimationFrame(emitFrameRef.current);
    }
    emitFrameRef.current = window.requestAnimationFrame(() => {
      emitFrameRef.current = null;
      onChangeRef.current(JSON.stringify(editor.document));
    });
  }, [collaborationState, editable, editor]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    return () => {
      if (emitFrameRef.current) {
        window.cancelAnimationFrame(emitFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const loadLegacyMarkdown = async () => {
      if (collaborationState) {
        isLoadingRef.current = false;
        return;
      }
      const source = initialContentRef.current || '';
      const nativeBlocks = parseBlockNoteContent(source);
      if (nativeBlocks) {
        isLoadingRef.current = false;
        return;
      }

      if (!source.trim()) {
        isLoadingRef.current = false;
        return;
      }

      try {
        const blocks = await editor.tryParseMarkdownToBlocks(source);
        if (isCancelled) return;
        editor.replaceBlocks(editor.document, blocks);
        isLoadingRef.current = false;
        emitEditorDocument();
      } catch {
        isLoadingRef.current = false;
      }
    };

    loadLegacyMarkdown();

    return () => {
      isCancelled = true;
    };
  }, [collaborationState, contentKey, editor, emitEditorDocument]);

  useEffect(() => {
    if (!collaborationState || !collaborationSynced || collaborationServerReadOnly) return;
    if (legacyMigrationRef.current === contentKey) return;
    if (collaborationState.fragment.length > 0) return;
    const source = initialContentRef.current || '';
    if (!source.trim()) return;

    let isCancelled = false;
    const migrateLegacyContent = async () => {
      try {
        const nativeBlocks = parseBlockNoteContent(source);
        const blocks = nativeBlocks || await editor.tryParseMarkdownToBlocks(source);
        if (isCancelled || !Array.isArray(blocks) || blocks.length === 0 || collaborationState.fragment.length > 0) return;
        collaborationState.doc.transact(() => {
          if (collaborationState.fragment.length === 0) {
            blocksToYXmlFragment(editor, blocks, collaborationState.fragment);
          }
        });
        legacyMigrationRef.current = contentKey;
      } catch {
        legacyMigrationRef.current = contentKey;
      }
    };

    migrateLegacyContent();
    return () => {
      isCancelled = true;
    };
  }, [
    collaborationServerReadOnly,
    collaborationSynced,
    collaborationState,
    contentKey,
    editor
  ]);

  return (
    <div
      className="wiki-block-editor"
      onContextMenu={async (event) => {
        if (!editable) return;
        event.preventDefault();
        await onRequestAssets?.();
        setInsertSearch({ isOpen: true, x: event.clientX, y: event.clientY, mode: 'all', selectedText: editor.getSelectedText?.().trim() || '' });
      }}
      onDragOver={(event) => {
        if (!editable) return;
        const hasImageAsset = event.dataTransfer.types.includes('application/x-mythra-asset-image');
        const hasImageFile = Array.from(event.dataTransfer.items || []).some(item => item.kind === 'file' && item.type.startsWith('image/'));
        if (hasImageAsset || hasImageFile) {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
        }
      }}
      onDrop={async (event) => {
        if (!editable) return;
        const assetPayload = event.dataTransfer.getData('application/x-mythra-asset-image');
        if (assetPayload) {
          event.preventDefault();
          try {
            const asset = JSON.parse(assetPayload);
            insertImageBlock(getAssetUrl(asset.path), asset.name);
          } catch {
            // Ignore invalid drag payloads from outside the app.
          }
          return;
        }

        const imageFiles = Array.from(event.dataTransfer.files || []).filter(file => file.type.startsWith('image/'));
        if (imageFiles.length === 0) return;
        event.preventDefault();
        for (const file of imageFiles) {
          await uploadAndInsertImage(file);
        }
      }}
    >
      {editable && insertSearch.isOpen && (
        <WorkspaceInsertSearch
          documentTree={documentTree}
          assetTree={assetTree}
          mode={insertSearch.mode}
          supportedAssets={['image']}
          selectedText={insertSearch.selectedText}
          position={insertSearch.x || insertSearch.y ? { x: insertSearch.x, y: insertSearch.y } : null}
          getAssetUrl={getAssetUrl}
          labels={labels}
          onInsertPageLink={insertPageLink}
          onInsertAsset={asset => insertImageBlock(getAssetUrl(asset.path), asset.name)}
          onClose={() => setInsertSearch(prev => ({ ...prev, isOpen: false }))}
        />
      )}
      <BlockNoteView
        editor={editor}
        editable={editable && !collaborationReadOnly}
        theme="dark"
        slashMenu={false}
        sideMenu={false}
        formattingToolbar={false}
        onChange={emitEditorDocument}
      >
        <SideMenuController sideMenu={MythraSideMenu} />
        <FormattingToolbarController formattingToolbar={() => <MythraFormattingToolbar onOpenPageLink={() => setInsertSearch({ isOpen: true, x: 0, y: 0, mode: 'page-link', selectedText: editor.getSelectedText?.().trim() || '' })} pageLinkLabel={labels.pageLink} />} />
        <SuggestionMenuController
          triggerCharacter="/"
          getItems={getSlashMenuItems}
        />
      </BlockNoteView>
    </div>
  );
}
