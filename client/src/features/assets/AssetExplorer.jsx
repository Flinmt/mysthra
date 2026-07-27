import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronRight,
  Clipboard,
  Copy,
  FileAudio,
  FileImage,
  Folder,
  FolderPlus,
  Grid2X2,
  List,
  MoreVertical,
  Pencil,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash,
  Trash2,
  Undo2,
  Upload,
  X
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  createAssetFolder,
  emptyAssetTrash,
  getAssetFileUrl,
  getAssetThumbnailUrl,
  loadAssetPermissions,
  loadAssetTrash,
  loadAssetTree,
  renameAssetItem,
  runAssetAction,
  saveAssetPermissions,
  uploadAsset
} from './assetApi'

const ACCESS_RANK = new Map(['none', 'read', 'write', 'admin'].map((access, index) => [access, index]))

function hasItemAccess(item, required) {
  if (item && !item.currentUserAccess) return true
  return (ACCESS_RANK.get(item?.currentUserAccess) || 0) >= (ACCESS_RANK.get(required) || 0)
}

function flattenTree(items, parentPath = '', output = []) {
  for (const item of items) {
    output.push({ ...item, parentPath })
    if (item.type === 'folder') flattenTree(item.children || [], item.path, output)
  }
  return output
}

function parentPath(value = '') {
  const parts = value.split('/').filter(Boolean)
  parts.pop()
  return parts.join('/')
}

function formatSize(bytes, language) {
  if (!Number.isFinite(bytes)) return ''
  return new Intl.NumberFormat(language, {
    style: 'unit',
    unit: bytes >= 1024 * 1024 ? 'megabyte' : 'kilobyte',
    maximumFractionDigits: 1
  }).format(bytes >= 1024 * 1024 ? bytes / (1024 * 1024) : bytes / 1024)
}

function AssetIcon({ item, worldId }) {
  if (item.type === 'folder') return <Folder className="asset-explorer-folder-icon" aria-hidden="true" />
  if (item.mediaType === 'image') {
    return <img src={getAssetThumbnailUrl(worldId, item)} alt="" draggable="false" />
  }
  return item.mediaType === 'audio'
    ? <FileAudio aria-hidden="true" />
    : <FileImage aria-hidden="true" />
}

export default function AssetExplorer({
  worldId,
  initialFolderPath = '',
  mode = 'manage',
  mediaFilter = null,
  readOnly = false,
  clipboard,
  onClipboardChange,
  onAssetsChange,
  onInsert,
  onClose,
  addToast
}) {
  const { t, i18n } = useTranslation()
  const dialogRef = useRef(null)
  const uploadInputRef = useRef(null)
  const folderInputRef = useRef(null)
  const inlineRenameInputRef = useRef(null)
  const [tree, setTree] = useState([])
  const [trash, setTrash] = useState([])
  const [currentPath, setCurrentPath] = useState(initialFolderPath)
  const [history, setHistory] = useState([initialFolderPath])
  const [historyIndex, setHistoryIndex] = useState(0)
  const [selection, setSelection] = useState(new Set())
  const [anchorId, setAnchorId] = useState('')
  const [query, setQuery] = useState('')
  const [view, setView] = useState(() => localStorage.getItem(`mysthra.asset-view.${worldId}`) || 'grid')
  const [sort, setSort] = useState(() => localStorage.getItem(`mysthra.asset-sort.${worldId}`) || 'name')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [uploads, setUploads] = useState([])
  const [inlineRename, setInlineRename] = useState(null)
  const [emptyTrashPrompt, setEmptyTrashPrompt] = useState(false)
  const [contextMenu, setContextMenu] = useState(null)
  const [accessPanel, setAccessPanel] = useState({
    isOpen: false,
    item: null,
    loading: false,
    members: [],
    permissions: { inherit: true, users: {} },
    error: ''
  })
  const [undoStack, setUndoStack] = useState([])
  const isInsertMode = mode === 'insert'
  const inTrash = currentPath === ':trash'

  const flatItems = useMemo(() => flattenTree(tree), [tree])
  const folders = useMemo(() => flatItems.filter(item => item.type === 'folder'), [flatItems])
  const currentFolder = folders.find(item => item.path === currentPath) || null
  const currentItems = useMemo(() => {
    const source = inTrash
      ? trash
      : query.trim()
        ? flatItems.filter(item => item.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
        : currentPath
          ? currentFolder?.children || []
          : tree
    const visible = isInsertMode && mediaFilter
      ? source.filter(item => item.type === 'folder' || item.mediaType === mediaFilter)
      : source
    return [...visible].sort((left, right) => {
      if (!inTrash && left.type !== right.type) return left.type === 'folder' ? -1 : 1
      if (sort === 'size') return (right.size || 0) - (left.size || 0)
      if (sort === 'type') return String(left.mediaType || left.type).localeCompare(String(right.mediaType || right.type))
      return left.name.localeCompare(right.name, i18n.language)
    })
  }, [currentFolder, currentPath, flatItems, i18n.language, inTrash, isInsertMode, mediaFilter, query, sort, trash, tree])
  const selectedItems = currentItems.filter(item => selection.has(item.id))
  const selectedItemsWritable = selectedItems.length > 0 && selectedItems.every(item => hasItemAccess(item, 'write'))
  const canWriteCurrentFolder = !readOnly && !inTrash && (!currentFolder || hasItemAccess(currentFolder, 'write'))
  const accessOptions = [
    ['inherit', t('assetExplorer.accessInherited')],
    ['none', t('assetExplorer.accessNone')],
    ['read', t('assetExplorer.accessRead')],
    ['write', t('assetExplorer.accessWrite')]
  ]
  const preview = selectedItems.length === 1 && selectedItems[0].type === 'file' ? selectedItems[0] : null
  const insertableAsset = isInsertMode && preview && (!mediaFilter || preview.mediaType === mediaFilter) ? preview : null

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [assetsResult, trashResult] = await Promise.all([
        loadAssetTree(worldId),
        readOnly || isInsertMode ? Promise.resolve({ items: [] }) : loadAssetTrash(worldId)
      ])
      setTree(assetsResult.items || [])
      setTrash(trashResult.items || [])
      onAssetsChange?.()
    } catch (error) {
      addToast?.(error.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [addToast, isInsertMode, onAssetsChange, readOnly, worldId])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    localStorage.setItem(`mysthra.asset-view.${worldId}`, view)
  }, [view, worldId])

  useEffect(() => {
    localStorage.setItem(`mysthra.asset-sort.${worldId}`, sort)
  }, [sort, worldId])

  useEffect(() => {
    if (!inlineRename?.item.id) return undefined
    const frame = window.requestAnimationFrame(() => {
      inlineRenameInputRef.current?.focus()
      inlineRenameInputRef.current?.select()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [inlineRename?.item.id])

  const navigate = useCallback((nextPath, replace = false) => {
    setCurrentPath(nextPath)
    setSelection(new Set())
    setQuery('')
    if (replace) return
    setHistory(previous => [...previous.slice(0, historyIndex + 1), nextPath])
    setHistoryIndex(previous => previous + 1)
  }, [historyIndex])

  const executeAction = useCallback(async (action, ids, targetFolder = null, undo = null) => {
    if (readOnly || !ids.length) return
    setBusy(true)
    try {
      const result = await runAssetAction(worldId, action, ids, targetFolder)
      if (undo) setUndoStack(previous => [...previous, undo])
      setSelection(new Set())
      await refresh()
      return result
    } catch (error) {
      addToast?.(error.message, 'error')
    } finally {
      setBusy(false)
    }
  }, [addToast, readOnly, refresh, setBusy, worldId])

  const createNewFolder = async () => {
    if (!canWriteCurrentFolder || busy) return
    setBusy(true)
    setQuery('')
    try {
      const created = await createAssetFolder(worldId, currentPath, t('assetExplorer.defaultFolderName'))
      setUndoStack(previous => [...previous, { action: 'trash', ids: [created.id] }])
      await refresh()
      setSelection(new Set([created.id]))
      setAnchorId(created.id)
      setInlineRename({ item: created, value: created.name })
    } catch (error) {
      addToast?.(error.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const commitInlineRename = async () => {
    if (!inlineRename) return
    const pending = inlineRename
    const newName = pending.value.trim()
    setInlineRename(null)
    if (!newName || newName === pending.item.name) return
    setBusy(true)
    try {
      await renameAssetItem(worldId, pending.item, newName)
      setUndoStack(previous => [...previous, { action: 'rename', item: pending.item, name: pending.item.name }])
      await refresh()
    } catch (error) {
      addToast?.(error.message, 'error')
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const getMoveUndo = useCallback(ids => {
    const groups = new Map()
    for (const id of ids) {
      const item = flatItems.find(candidate => candidate.id === id)
      if (!item) continue
      const key = item.parentPath || ''
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(id)
    }
    return {
      action: 'moves',
      groups: [...groups].map(([path, groupIds]) => ({
        ids: groupIds,
        target: folders.find(folder => folder.path === path) || null
      }))
    }
  }, [flatItems, folders])

  const paste = useCallback(async () => {
    if (!canWriteCurrentFolder || !clipboard?.ids?.length || clipboard.worldId !== worldId) return
    const moveUndo = clipboard.mode === 'cut' ? getMoveUndo(clipboard.ids) : null
    const result = await executeAction(
      clipboard.mode === 'cut' ? 'move' : 'copy',
      clipboard.ids,
      currentFolder
    )
    if (clipboard.mode === 'cut' && result) {
      setUndoStack(previous => [...previous, moveUndo])
      onClipboardChange(null)
    }
    if (clipboard.mode === 'copy' && result) {
      const createdIds = result.items?.filter(item => item.id && !item.error).map(item => item.id) || []
      setUndoStack(previous => [...previous, { action: 'trash', ids: createdIds }])
    }
  }, [canWriteCurrentFolder, clipboard, currentFolder, executeAction, getMoveUndo, onClipboardChange, worldId])

  const undo = useCallback(async () => {
    const command = undoStack.at(-1)
    if (!command) return
    setUndoStack(previous => previous.slice(0, -1))
    if (command.action === 'trash') await executeAction('trash', command.ids)
    if (command.action === 'restore') await executeAction('restore', command.ids)
    if (command.action === 'moves') {
      for (const group of command.groups) await executeAction('move', group.ids, group.target)
    }
    if (command.action === 'rename') {
      try {
        await renameAssetItem(worldId, command.item, command.name)
        await refresh()
      } catch (error) {
        addToast?.(error.message, 'error')
      }
    }
  }, [addToast, executeAction, refresh, undoStack, worldId])

  const dropAssets = async (event, targetFolder) => {
    if (targetFolder && !hasItemAccess(targetFolder, 'write')) return
    if (!targetFolder && !canWriteCurrentFolder) return
    const ids = JSON.parse(event.dataTransfer.getData('application/x-mysthra-assets') || '[]')
    if (!ids.length) return
    const action = event.ctrlKey ? 'copy' : 'move'
    const result = await executeAction(action, ids, targetFolder)
    if (!result) return
    if (action === 'move') {
      setUndoStack(previous => [...previous, getMoveUndo(ids)])
    } else {
      const createdIds = result.items?.filter(item => item.id && !item.error).map(item => item.id) || []
      setUndoStack(previous => [...previous, { action: 'trash', ids: createdIds }])
    }
  }

  useEffect(() => {
    if (dialogRef.current && !dialogRef.current.contains(document.activeElement)) {
      dialogRef.current.focus()
    }
    const handleKeyDown = event => {
      const modifier = event.ctrlKey || event.metaKey
      if (event.key === 'Escape') {
        if (accessPanel.isOpen) {
          setAccessPanel(previous => ({ ...previous, isOpen: false }))
        } else if (contextMenu || emptyTrashPrompt) {
          setContextMenu(null)
          setEmptyTrashPrompt(false)
        } else onClose()
      }
      if (event.key === 'Tab') {
        const focusable = [...dialogRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), audio[controls]')]
        const first = focusable[0]
        const last = focusable.at(-1)
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }
      if (!isInsertMode && modifier && event.key.toLowerCase() === 'a' && !['INPUT', 'TEXTAREA'].includes(event.target.tagName)) {
        event.preventDefault()
        setSelection(new Set(currentItems.map(item => item.id)))
      }
      if (!readOnly && modifier && event.key.toLowerCase() === 'c' && selectedItems.length) {
        event.preventDefault()
        onClipboardChange({ mode: 'copy', ids: selectedItems.map(item => item.id), worldId })
      }
      if (!readOnly && modifier && event.key.toLowerCase() === 'x' && selectedItemsWritable && !inTrash) {
        event.preventDefault()
        onClipboardChange({ mode: 'cut', ids: selectedItems.map(item => item.id), worldId })
      }
      if (!readOnly && modifier && event.key.toLowerCase() === 'v') {
        event.preventDefault()
        paste()
      }
      if (!readOnly && modifier && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        undo()
      }
      if (!readOnly && (event.key === 'Delete' || event.key === 'Backspace') && selectedItemsWritable && !['INPUT', 'TEXTAREA'].includes(event.target.tagName)) {
        event.preventDefault()
        executeAction(inTrash ? 'delete-permanently' : 'trash', selectedItems.map(item => item.id), null, inTrash
          ? null
          : { action: 'restore', ids: selectedItems.map(item => item.id) })
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [accessPanel.isOpen, contextMenu, currentItems, emptyTrashPrompt, executeAction, inTrash, isInsertMode, onClipboardChange, onClose, paste, readOnly, selectedItems, selectedItemsWritable, undo, worldId])

  const chooseItem = (event, item, index) => {
    if (isInsertMode) {
      setAnchorId(item.id)
      setSelection(new Set([item.id]))
      return
    }
    const next = new Set(event.ctrlKey || event.metaKey ? selection : [])
    if (event.shiftKey && anchorId) {
      const anchorIndex = currentItems.findIndex(candidate => candidate.id === anchorId)
      if (anchorIndex >= 0) {
        const [start, end] = [anchorIndex, index].sort((left, right) => left - right)
        currentItems.slice(start, end + 1).forEach(candidate => next.add(candidate.id))
      } else {
        next.add(item.id)
      }
    } else if (next.has(item.id)) {
      next.delete(item.id)
    } else {
      next.add(item.id)
    }
    setAnchorId(item.id)
    setSelection(next)
  }

  const uploadFiles = async fileList => {
    const requestedFiles = [...fileList]
    const files = isInsertMode && mediaFilter
      ? requestedFiles.filter(file => {
          const extension = file.name.split('.').pop()?.toLowerCase()
          if (mediaFilter === 'image') {
            return file.type.startsWith('image/') || ['gif', 'jpg', 'jpeg', 'png', 'webp'].includes(extension)
          }
          return file.type.startsWith('audio/') || ['m4a', 'mp3', 'mp4', 'ogg', 'opus', 'wav'].includes(extension)
        })
      : requestedFiles
    if (files.length !== requestedFiles.length) {
      addToast?.(t('assetExplorer.wrongMediaType'), 'error')
    }
    if (!canWriteCurrentFolder || !files.length) return
    setBusy(true)
    const createdIds = []
    const createdItems = []
    const knownFolders = new Set(folders.map(folder => folder.path))
    try {
      for (const file of files) {
        const relativeParts = String(file.webkitRelativePath || '').split('/').filter(Boolean)
        relativeParts.pop()
        let targetPath = currentPath
        for (const part of relativeParts) {
          const folderPath = targetPath ? `${targetPath}/${part}` : part
          if (!knownFolders.has(folderPath)) {
            const created = await createAssetFolder(worldId, targetPath, part)
            knownFolders.add(created.path)
            targetPath = created.path
            continue
          }
          targetPath = folderPath
        }
        setUploads(previous => [...previous, { name: file.name, progress: 0 }])
        const uploaded = await uploadAsset(worldId, targetPath, file, progress => {
          setUploads(previous => previous.map(entry => entry.name === file.name ? { ...entry, progress } : entry))
        })
        if (uploaded.id) createdIds.push(uploaded.id)
        if (uploaded.id) createdItems.push(uploaded)
        setUploads(previous => previous.filter(entry => entry.name !== file.name))
      }
      if (createdIds.length) setUndoStack(previous => [...previous, { action: 'trash', ids: createdIds }])
      await refresh()
      if (isInsertMode && createdItems[0]) {
        const uploadedFolderPath = parentPath(createdItems[0].path)
        if (uploadedFolderPath !== currentPath) navigate(uploadedFolderPath)
        setSelection(new Set([createdItems[0].id]))
        setAnchorId(createdItems[0].id)
      }
    } catch (error) {
      addToast?.(error.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const breadcrumbParts = currentPath === ':trash' ? [] : currentPath.split('/').filter(Boolean)

  const openAccessPanel = async item => {
    if (!item?.canManagePermissions) return
    setAccessPanel(previous => ({ ...previous, isOpen: true, item, loading: true, error: '' }))
    try {
      const result = await loadAssetPermissions(worldId, item)
      setAccessPanel({
        isOpen: true,
        item,
        loading: false,
        members: result.members || [],
        permissions: result.permissions || { inherit: true, users: {} },
        error: ''
      })
    } catch (error) {
      setAccessPanel(previous => ({ ...previous, loading: false, error: error.message }))
    }
  }

  const setAccessRule = (principal, access) => {
    setAccessPanel(previous => {
      const permissions = {
        ...previous.permissions,
        users: { ...(previous.permissions.users || {}) }
      }
      if (principal === 'worldMembers') {
        if (access === 'inherit') delete permissions.worldMembers
        else permissions.worldMembers = access
      } else if (access === 'inherit') {
        delete permissions.users[principal]
      } else {
        permissions.users[principal] = access
      }
      return { ...previous, permissions }
    })
  }

  const commitAccessPanel = async () => {
    if (!accessPanel.item) return
    setAccessPanel(previous => ({ ...previous, loading: true, error: '' }))
    try {
      await saveAssetPermissions(worldId, accessPanel.item, accessPanel.permissions)
      setAccessPanel(previous => ({ ...previous, isOpen: false, loading: false }))
      await refresh()
      addToast?.(t('common.saved'), 'success')
    } catch (error) {
      setAccessPanel(previous => ({ ...previous, loading: false, error: error.message }))
    }
  }

  return (
    <div className="asset-explorer-backdrop" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section
        ref={dialogRef}
        className="asset-explorer"
        role="dialog"
        aria-modal="true"
        aria-label={t('assetExplorer.title')}
        tabIndex="-1"
        onContextMenu={event => event.preventDefault()}
      >
        <header className="asset-explorer-titlebar">
          <div>
            <strong>{t('assetExplorer.title')}</strong>
            <span>{isInsertMode ? t(mediaFilter ? `assetExplorer.insert${mediaFilter === 'audio' ? 'Audio' : 'Image'}` : 'assetExplorer.insertMedia') : t('assetExplorer.worldLibrary')}</span>
          </div>
          <button type="button" onClick={onClose} aria-label={t('common.close')}><X /></button>
        </header>

        <div className="asset-explorer-toolbar">
          <div className="asset-explorer-navigation">
            <button type="button" disabled={historyIndex === 0} onClick={() => {
              const nextIndex = historyIndex - 1
              setHistoryIndex(nextIndex)
              setCurrentPath(history[nextIndex])
              setSelection(new Set())
            }} aria-label={t('assetExplorer.back')}><ArrowLeft /></button>
            <button type="button" disabled={historyIndex >= history.length - 1} onClick={() => {
              const nextIndex = historyIndex + 1
              setHistoryIndex(nextIndex)
              setCurrentPath(history[nextIndex])
              setSelection(new Set())
            }} aria-label={t('assetExplorer.forward')}><ArrowRight /></button>
            <button type="button" disabled={!currentPath || inTrash} onClick={() => navigate(parentPath(currentPath))} aria-label={t('assetExplorer.up')}><ArrowUp /></button>
            <button type="button" onClick={refresh} aria-label={t('assetExplorer.refresh')}><RefreshCw /></button>
          </div>
          <nav className="asset-explorer-breadcrumbs" aria-label={t('assetExplorer.location')}>
            <button type="button" onClick={() => navigate('')}>{t('assetExplorer.assets')}</button>
            {inTrash ? <><ChevronRight /><span>{t('assetExplorer.trash')}</span></> : breadcrumbParts.map((part, index) => (
              <React.Fragment key={`${part}-${index}`}>
                <ChevronRight />
                <button type="button" onClick={() => navigate(breadcrumbParts.slice(0, index + 1).join('/'))}>{part}</button>
              </React.Fragment>
            ))}
          </nav>
          <label className="asset-explorer-search">
            <Search />
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder={t('assetExplorer.search')} />
          </label>
        </div>

        <div className="asset-explorer-commandbar">
          {isInsertMode && (
            <button
              type="button"
              className="asset-explorer-insert"
              disabled={!insertableAsset}
              onClick={() => insertableAsset && onInsert?.(insertableAsset)}
            ><Check />{t('assetExplorer.insert')}</button>
          )}
          {canWriteCurrentFolder && <>
            <button type="button" onClick={() => uploadInputRef.current?.click()} disabled={busy}><Upload />{t('assetExplorer.uploadFiles')}</button>
            <button type="button" onClick={() => folderInputRef.current?.click()} disabled={busy}><FolderPlus />{t('assetExplorer.uploadFolder')}</button>
            <button type="button" onClick={createNewFolder} disabled={busy}><FolderPlus />{t('assetExplorer.newFolder')}</button>
          </>}
          {!readOnly && inTrash && trash.length > 0 && (
            <button type="button" className="danger" onClick={() => setEmptyTrashPrompt(true)}><Trash2 />{t('assetExplorer.emptyTrash')}</button>
          )}
          <span className="asset-explorer-command-spacer" />
          {!readOnly && <button type="button" onClick={undo} disabled={!undoStack.length} aria-label={t('assetExplorer.undo')}><Undo2 /></button>}
          <select value={sort} onChange={event => setSort(event.target.value)} aria-label={t('assetExplorer.sort')}>
            <option value="name">{t('assetExplorer.sortName')}</option>
            <option value="type">{t('assetExplorer.sortType')}</option>
            <option value="size">{t('assetExplorer.sortSize')}</option>
          </select>
          <button type="button" className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')} aria-label={t('assetExplorer.grid')}><Grid2X2 /></button>
          <button type="button" className={view === 'list' ? 'active' : ''} onClick={() => setView('list')} aria-label={t('assetExplorer.list')}><List /></button>
        </div>

        <div className="asset-explorer-layout">
          <aside className="asset-explorer-sidebar" aria-label={t('assetExplorer.sections')}>
            <button type="button" className={!inTrash ? 'active' : ''} onClick={() => navigate('')}><Folder />{t('assetExplorer.assets')}</button>
            {!readOnly && !isInsertMode && <button type="button" className={inTrash ? 'active' : ''} onClick={() => navigate(':trash')}><Trash2 />{t('assetExplorer.trash')}<span>{trash.length || ''}</span></button>}
          </aside>

          <main
            className={`asset-explorer-content ${view} ${loading || currentItems.length === 0 ? 'is-state' : ''}`}
            onClick={event => {
              if (event.target === event.currentTarget) setSelection(new Set())
            }}
            onDragOver={event => event.preventDefault()}
            onContextMenu={event => {
              event.preventDefault()
              if (event.target.closest('.asset-explorer-item')) return
              setSelection(new Set())
              setContextMenu({
                x: Math.max(8, Math.min(event.clientX, window.innerWidth - 220)),
                y: Math.max(8, Math.min(event.clientY, window.innerHeight - (inTrash ? 150 : 360))),
                item: null
              })
            }}
            onDrop={event => {
              event.preventDefault()
              if (event.dataTransfer.files.length) uploadFiles(event.dataTransfer.files)
              else dropAssets(event, currentFolder)
            }}
          >
            {loading ? <div className="asset-explorer-state"><RefreshCw className="spin" />{t('common.loading')}</div>
              : currentItems.length === 0
                ? <div className="asset-explorer-state">
                    {inTrash && !query ? <Trash2 /> : <Folder />}
                    {query ? t('assetExplorer.noResults') : inTrash ? t('assetExplorer.trashEmpty') : t('assetExplorer.empty')}
                  </div>
                : currentItems.map((item, index) => (
                  <div
                    role="button"
                    tabIndex="0"
                    key={item.trashId || item.id}
                    className={`asset-explorer-item ${item.type === 'folder' ? 'is-folder' : ''} ${selection.has(item.id) ? 'selected' : ''}`}
                    draggable={!readOnly && !inTrash && hasItemAccess(item, 'write') && (!selection.has(item.id) || selectedItemsWritable)}
                    onDragStart={event => {
                      const ids = selection.has(item.id) ? [...selection] : [item.id]
                      event.dataTransfer.setData('application/x-mysthra-assets', JSON.stringify(ids))
                      event.dataTransfer.effectAllowed = 'copyMove'
                    }}
                    onDragOver={event => {
                      if (item.type === 'folder' && hasItemAccess(item, 'write')) event.preventDefault()
                    }}
                    onDrop={event => {
                      if (item.type !== 'folder' || !hasItemAccess(item, 'write')) return
                      event.preventDefault()
                      event.stopPropagation()
                      dropAssets(event, item)
                    }}
                    onClick={event => chooseItem(event, item, index)}
                    onKeyDown={event => {
                      if (event.key === 'Enter' && item.type === 'folder') navigate(item.path)
                      if (event.key === 'Enter' && item.type === 'file' && isInsertMode && (!mediaFilter || item.mediaType === mediaFilter)) onInsert?.(item)
                      if (event.key === ' ') {
                        event.preventDefault()
                        chooseItem(event, item, index)
                      }
                    }}
                    onDoubleClick={() => {
                      if (item.type === 'folder') navigate(item.path)
                      if (item.type === 'file' && isInsertMode && (!mediaFilter || item.mediaType === mediaFilter)) onInsert?.(item)
                    }}
                    onContextMenu={event => {
                      event.preventDefault()
                      event.stopPropagation()
                      if (!selection.has(item.id)) setSelection(new Set([item.id]))
                      setContextMenu({
                        x: Math.max(8, Math.min(event.clientX, window.innerWidth - 220)),
                        y: Math.max(8, Math.min(event.clientY, window.innerHeight - (inTrash ? 190 : 430))),
                        item
                      })
                    }}
                  >
                    <span className={`asset-explorer-item-preview ${item.type === 'folder' ? 'is-folder' : ''}`}><AssetIcon item={item} worldId={worldId} /></span>
                    {inlineRename?.item.id === item.id
                      ? <input
                          className="asset-explorer-inline-rename"
                          value={inlineRename.value}
                          ref={inlineRenameInputRef}
                          onClick={event => event.stopPropagation()}
                          onDoubleClick={event => event.stopPropagation()}
                          onChange={event => {
                            const value = event.target.value
                            setInlineRename(previous => ({ ...previous, value }))
                          }}
                          onBlur={commitInlineRename}
                          onKeyDown={event => {
                            event.stopPropagation()
                            if (event.key === 'Enter') {
                              event.preventDefault()
                              commitInlineRename()
                            } else if (event.key === 'Escape') {
                              event.preventDefault()
                              setInlineRename(null)
                            }
                          }}
                        />
                      : <span className="asset-explorer-item-name">{item.name}</span>}
                    <span className="asset-explorer-item-meta">{inTrash ? new Date(item.deletedAt).toLocaleDateString(i18n.language) : formatSize(item.size, i18n.language)}</span>
                    <MoreVertical className="asset-explorer-item-more" />
                  </div>
                ))}
          </main>

          <aside className={`asset-explorer-preview ${preview ? 'visible' : ''}`}>
            {preview && <>
              <strong>{preview.name}</strong>
              {preview.mediaType === 'image'
                ? <img src={getAssetFileUrl(worldId, preview)} alt={preview.name} />
                : <audio src={getAssetFileUrl(worldId, preview)} controls />}
              <dl>
                <dt>{t('assetExplorer.type')}</dt><dd>{preview.contentType}</dd>
                <dt>{t('assetExplorer.size')}</dt><dd>{formatSize(preview.size, i18n.language)}</dd>
                <dt>{t('assetExplorer.path')}</dt><dd>{preview.path}</dd>
              </dl>
            </>}
          </aside>
        </div>

        <footer className="asset-explorer-statusbar">
          <span>{t('assetExplorer.itemCount', { count: currentItems.length })}</span>
          <span>{selection.size ? t('assetExplorer.selectedCount', { count: selection.size }) : t('assetExplorer.dropHint')}</span>
        </footer>

        <input
          ref={uploadInputRef}
          type="file"
          multiple
          accept={isInsertMode && mediaFilter ? mediaFilter === 'audio' ? 'audio/*,.opus' : 'image/*' : 'image/*,audio/*,.opus'}
          hidden
          onChange={event => {
          uploadFiles(event.target.files)
          event.target.value = ''
          }}
        />
        <input ref={folderInputRef} type="file" multiple webkitdirectory="" hidden onChange={event => {
          uploadFiles(event.target.files)
          event.target.value = ''
        }} />

        {uploads.length > 0 && <div className="asset-explorer-uploads">
          {uploads.map(entry => <div key={entry.name}><span>{entry.name}</span><progress value={entry.progress} max="100" /></div>)}
        </div>}

        {emptyTrashPrompt && <div className="asset-explorer-dialog-backdrop">
          <section className="asset-explorer-dialog asset-explorer-trash-dialog" role="alertdialog" aria-modal="true" aria-labelledby="asset-explorer-trash-title" aria-describedby="asset-explorer-trash-description">
            <div className="asset-explorer-trash-dialog-mark" aria-hidden="true">
              <span><Trash /></span>
            </div>
            <div className="asset-explorer-trash-dialog-copy">
              <strong id="asset-explorer-trash-title">{t('assetExplorer.emptyTrashTitle')}</strong>
              <p id="asset-explorer-trash-description">{t('assetExplorer.emptyTrashDescription', { count: trash.length })}</p>
              <span>{t('assetExplorer.emptyTrashWarning')}</span>
            </div>
            <div className="asset-explorer-trash-dialog-actions">
              <button type="button" autoFocus onClick={() => setEmptyTrashPrompt(false)} disabled={busy}>{t('common.cancel')}</button>
              <button
                type="button"
                className="asset-explorer-trash-confirm"
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  try {
                    await emptyAssetTrash(worldId)
                    setEmptyTrashPrompt(false)
                    await refresh()
                  } catch (error) {
                    addToast?.(error.message, 'error')
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                <Trash2 />
                {busy ? t('assetExplorer.emptyingTrash') : t('assetExplorer.emptyTrash')}
              </button>
            </div>
          </section>
        </div>}

        {accessPanel.isOpen && <div className="asset-explorer-dialog-backdrop">
          <section className="asset-explorer-dialog asset-explorer-access-dialog" role="dialog" aria-modal="true" aria-labelledby="asset-explorer-access-title">
            <header>
              <span aria-hidden="true"><ShieldCheck /></span>
              <div>
                <strong id="asset-explorer-access-title">{t('assetExplorer.manageAccess')}</strong>
                <small>{accessPanel.item?.name}</small>
              </div>
              <button type="button" onClick={() => setAccessPanel(previous => ({ ...previous, isOpen: false }))} aria-label={t('common.close')}><X /></button>
            </header>
            <label className="asset-explorer-access-inherit">
              <input
                type="checkbox"
                checked={accessPanel.permissions.inherit !== false}
                onChange={event => setAccessPanel(previous => ({
                  ...previous,
                  permissions: { ...previous.permissions, inherit: event.target.checked }
                }))}
                disabled={accessPanel.loading}
              />
              <span>{t('assetExplorer.inheritAccess')}</span>
            </label>
            <div className="asset-explorer-access-list">
              <div className="asset-explorer-access-row">
                <strong>{t('assetExplorer.allWorldMembers')}</strong>
                <div>
                  {accessOptions.map(([access, label]) => (
                    <button
                      key={access}
                      type="button"
                      className={(accessPanel.permissions.worldMembers ?? 'inherit') === access ? 'active' : ''}
                      onClick={() => setAccessRule('worldMembers', access)}
                      disabled={accessPanel.loading}
                    >{label}</button>
                  ))}
                </div>
              </div>
              {accessPanel.members.map(member => {
                const userId = member.userId
                const access = accessPanel.permissions.users?.[userId] ?? 'inherit'
                return (
                  <div className="asset-explorer-access-row" key={userId}>
                    <strong>
                      {member.user?.username || userId}
                      {userId === accessPanel.item?.ownerUserId && <small>{t('assetExplorer.owner')}</small>}
                    </strong>
                    <div>
                      {accessOptions.map(([nextAccess, label]) => (
                        <button
                          key={nextAccess}
                          type="button"
                          className={access === nextAccess ? 'active' : ''}
                          onClick={() => setAccessRule(userId, nextAccess)}
                          disabled={accessPanel.loading || userId === accessPanel.item?.ownerUserId}
                        >{label}</button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
            {accessPanel.error && <p className="asset-explorer-access-error">{accessPanel.error}</p>}
            <footer>
              <button type="button" onClick={() => setAccessPanel(previous => ({ ...previous, isOpen: false }))} disabled={accessPanel.loading}>{t('common.cancel')}</button>
              <button type="button" className="primary" onClick={commitAccessPanel} disabled={accessPanel.loading}>{accessPanel.loading ? t('common.saving') : t('common.save')}</button>
            </footer>
          </section>
        </div>}

        {contextMenu && <div className="asset-explorer-context-dismiss" onMouseDown={() => setContextMenu(null)}>
          <div className="asset-explorer-context" style={{ left: contextMenu.x, top: contextMenu.y }} onMouseDown={event => event.stopPropagation()}>
            {canWriteCurrentFolder && <>
              <button type="button" onClick={() => { createNewFolder(); setContextMenu(null) }}><FolderPlus />{t('assetExplorer.newFolder')}</button>
              <button type="button" onClick={() => { uploadInputRef.current?.click(); setContextMenu(null) }}><Upload />{t('assetExplorer.uploadFiles')}</button>
              <button type="button" onClick={() => { folderInputRef.current?.click(); setContextMenu(null) }}><FolderPlus />{t('assetExplorer.uploadFolder')}</button>
              {clipboard?.ids?.length > 0 && clipboard.worldId === worldId && <button type="button" onClick={() => { paste(); setContextMenu(null) }}><Clipboard />{t('assetExplorer.paste')} ({clipboard.ids.length})</button>}
              <span className="asset-explorer-context-separator" />
            </>}
            {!readOnly && !inTrash && selection.size > 0 && <button type="button" onClick={() => { onClipboardChange({ mode: 'copy', ids: [...selection], worldId }); setContextMenu(null) }}><Copy />{t('assetExplorer.copy')}</button>}
            {!readOnly && !inTrash && selectedItemsWritable && <button type="button" onClick={() => { onClipboardChange({ mode: 'cut', ids: [...selection], worldId }); setContextMenu(null) }}><Clipboard />{t('assetExplorer.cut')}</button>}
            {!readOnly && !inTrash && selection.size === 1 && hasItemAccess(contextMenu.item, 'write') && <button type="button" onClick={() => { setInlineRename({ item: contextMenu.item, value: contextMenu.item.name }); setContextMenu(null) }}><Pencil />{t('common.rename')}</button>}
            {!inTrash && selection.size === 1 && contextMenu.item?.canManagePermissions && <button type="button" onClick={() => { openAccessPanel(contextMenu.item); setContextMenu(null) }}><ShieldCheck />{t('assetExplorer.manageAccess')}</button>}
            {!readOnly && inTrash && selectedItemsWritable && <button type="button" onClick={() => { executeAction('restore', [...selection], null, { action: 'trash', ids: [...selection] }); setContextMenu(null) }}><Undo2 />{t('assetExplorer.restore')}</button>}
            {!readOnly && selectedItemsWritable && <button type="button" className="danger" onClick={() => { executeAction(inTrash ? 'delete-permanently' : 'trash', [...selection]); setContextMenu(null) }}><Trash2 />{inTrash ? t('assetExplorer.deleteForever') : t('assetExplorer.trashAction')}</button>}
            <button type="button" onClick={() => { refresh(); setContextMenu(null) }}><RefreshCw />{t('assetExplorer.refresh')}</button>
          </div>
        </div>}
      </section>
    </div>
  )
}
