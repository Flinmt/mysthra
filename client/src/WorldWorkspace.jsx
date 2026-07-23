import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLocation } from 'wouter';
import { Edit2, Folder, FileText, ChevronRight, ChevronDown, Plus, Sword, Swords, Shield, Castle, Map, Crown, Book, BookOpen, Scroll, ScrollText, Library, Star, Skull, Trash2, Search, Home, House, X, Copy, Image, Upload, Music, FolderPlus, MoveRight, LockKeyhole, Lock, LockOpen, MoveVertical, MoreVertical, Users, MapPin, Compass, Route, Flag, Landmark, Gem, Diamond, Flame, Eye, EyeOff, Maximize2, Minimize2, Sparkles, Tent, Mountain, Trees, TreePine, TreeDeciduous, DoorOpen, WandSparkles, Pickaxe, Axe, Hammer, Church, Ship, Anchor, Telescope, Moon, Sun, CloudLightning, Key, Coins, Footprints, Binoculars, Drama, Ghost, Sailboat, Waves, Pyramid, Feather, Archive, Boxes, Box, Briefcase, Building2, ClipboardList, Database, Dices, File, Files, FileArchive, FileBox, FileHeart, FileImage, FileLock, FilePenLine, FileSearch, FlaskConical, FolderArchive, FolderHeart, FolderOpen, FolderRoot, Folders, Gamepad2, Heart, Layers, Notebook, NotebookTabs, NotebookText, Package, Palette, Plane, Rocket, School, Shapes, ShipWheel, Sprout, Target, UserRound, UsersRound, Waypoints, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import MapEditor from './features/map/MapEditor';
import BoardEditor from './features/board/BoardEditor';
import { useCollaborationRoom } from './hooks/useCollaborationRoom';
import MarkdownHtmlEditor from './workspace/MarkdownHtmlEditor';
import NotionEditor from './features/notion/NotionEditor';
import TiptapEditor from './features/tiptap/TiptapEditor';
import TabTypeSelector from './workspace/TabTypeSelector';
import DeleteItemDialog from './workspace/DeleteItemDialog';
import { AssetContextMenu, AssetPreviewDialog, DocumentChrome, WorkspaceBody, WorkspaceBootScreen, WorkspaceSidebar, WorkspaceTabRow, WorkspaceTopbar } from './workspace/WorkspaceShell';
import { DocumentPermissionsDialog } from './features/world/WorldAccessDialogs';
import WorldSettingsDialog from './features/worlds/WorldSettingsDialog';
import { DEFAULT_WORLD_THEME, getWorldTheme, getWorldThemeShellStyle, getWorldThemeStyle } from './worldThemes';
import {
  clampCoverPosition,
  copyTextToClipboard,
  createInternalPageLink,
  findAssetByPath,
  findNodeByPath,
  findNodeByUid,
  formatAssetSize,
  getAssetFolders,
  getAssetImages,
  getCoverBackgroundVars,
  getDocumentContainers,
  getFileBaseName,
  getFileExtension,
  getFirstOrderedTab,
  getTreeChildren,
  getTabsForNode,
  parseInternalPageLink,
  isCollaborativeContentType,
  isInvalidAssetMoveTarget,
  isInvalidDocumentMoveTarget,
  isRootContainer,
  normalizeCoverArea,
  orderTreeWithHome,
  pathParent,
  prepareAssetUpload
} from './workspace/utils';

const DOCUMENT_ICON_CATEGORIES = [
  {
    id: 'general',
    labelKey: 'workspace.icon_category_general',
    icons: [
      { key: 'Folder', icon: Folder, aliases: ['folder', 'pasta', 'container', 'documento'] },
      { key: 'FolderOpen', icon: FolderOpen, aliases: ['open folder', 'pasta aberta'] },
      { key: 'FolderRoot', icon: FolderRoot, aliases: ['root', 'raiz'] },
      { key: 'Folders', icon: Folders, aliases: ['folders', 'pastas', 'colecao'] },
      { key: 'FolderHeart', icon: FolderHeart, aliases: ['favorite folder', 'pasta favorita', 'favorito'] },
      { key: 'FileText', icon: FileText, aliases: ['file', 'arquivo', 'texto'] },
      { key: 'File', icon: File, aliases: ['document', 'documento'] },
      { key: 'Files', icon: Files, aliases: ['files', 'arquivos'] },
      { key: 'Book', icon: Book, aliases: ['book', 'livro'] },
      { key: 'BookOpen', icon: BookOpen, aliases: ['open book', 'livro aberto'] },
      { key: 'Library', icon: Library, aliases: ['library', 'biblioteca'] },
      { key: 'Notebook', icon: Notebook, aliases: ['notebook', 'caderno'] },
      { key: 'NotebookTabs', icon: NotebookTabs, aliases: ['tabs', 'abas', 'caderno'] },
      { key: 'NotebookText', icon: NotebookText, aliases: ['notes', 'notas'] },
      { key: 'Scroll', icon: Scroll, aliases: ['scroll', 'pergaminho'] },
      { key: 'ScrollText', icon: ScrollText, aliases: ['scroll text', 'pergaminho texto'] },
      { key: 'Archive', icon: Archive, aliases: ['archive', 'arquivo morto'] },
      { key: 'FolderArchive', icon: FolderArchive, aliases: ['archive folder', 'pasta arquivo'] },
      { key: 'ClipboardList', icon: ClipboardList, aliases: ['list', 'lista', 'tarefas'] }
    ]
  },
  {
    id: 'world',
    labelKey: 'workspace.icon_category_world',
    icons: [
      { key: 'Map', icon: Map, aliases: ['map', 'mapa'] },
      { key: 'MapPin', icon: MapPin, aliases: ['pin', 'marcador', 'local'] },
      { key: 'Compass', icon: Compass, aliases: ['compass', 'bussola'] },
      { key: 'Route', icon: Route, aliases: ['route', 'rota', 'caminho'] },
      { key: 'Landmark', icon: Landmark, aliases: ['landmark', 'marco', 'monumento'] },
      { key: 'Castle', icon: Castle, aliases: ['castle', 'castelo', 'fortaleza'] },
      { key: 'Church', icon: Church, aliases: ['church', 'igreja', 'templo'] },
      { key: 'House', icon: House, aliases: ['house', 'casa'] },
      { key: 'Home', icon: Home, aliases: ['home', 'inicio', 'lar'] },
      { key: 'Building2', icon: Building2, aliases: ['building', 'predio', 'cidade'] },
      { key: 'School', icon: School, aliases: ['school', 'escola', 'academia'] },
      { key: 'Tent', icon: Tent, aliases: ['tent', 'tenda', 'acampamento'] },
      { key: 'Mountain', icon: Mountain, aliases: ['mountain', 'montanha'] },
      { key: 'Trees', icon: Trees, aliases: ['trees', 'arvores', 'floresta'] },
      { key: 'TreePine', icon: TreePine, aliases: ['pine', 'pinheiro'] },
      { key: 'TreeDeciduous', icon: TreeDeciduous, aliases: ['tree', 'arvore'] },
      { key: 'DoorOpen', icon: DoorOpen, aliases: ['door', 'porta', 'entrada'] },
      { key: 'Pyramid', icon: Pyramid, aliases: ['pyramid', 'piramide', 'ruinas'] }
    ]
  },
  {
    id: 'fantasy',
    labelKey: 'workspace.icon_category_fantasy',
    icons: [
      { key: 'Sword', icon: Sword, aliases: ['sword', 'espada'] },
      { key: 'Swords', icon: Swords, aliases: ['swords', 'espadas', 'batalha'] },
      { key: 'Shield', icon: Shield, aliases: ['shield', 'escudo'] },
      { key: 'Crown', icon: Crown, aliases: ['crown', 'coroa', 'rei', 'rainha'] },
      { key: 'Skull', icon: Skull, aliases: ['skull', 'caveira', 'morte'] },
      { key: 'Flame', icon: Flame, aliases: ['flame', 'fogo', 'chama'] },
      { key: 'WandSparkles', icon: WandSparkles, aliases: ['wand', 'varinha', 'magia'] },
      { key: 'Sparkles', icon: Sparkles, aliases: ['sparkles', 'brilho', 'magico'] },
      { key: 'Gem', icon: Gem, aliases: ['gem', 'gema', 'joia'] },
      { key: 'Diamond', icon: Diamond, aliases: ['diamond', 'diamante'] },
      { key: 'Ghost', icon: Ghost, aliases: ['ghost', 'fantasma'] },
      { key: 'Drama', icon: Drama, aliases: ['drama', 'mascara', 'teatro'] },
      { key: 'Dices', icon: Dices, aliases: ['dice', 'dados', 'rpg'] },
      { key: 'Gamepad2', icon: Gamepad2, aliases: ['game', 'jogo'] },
      { key: 'Star', icon: Star, aliases: ['star', 'estrela', 'favorito'] },
      { key: 'Zap', icon: Zap, aliases: ['zap', 'raio', 'energia'] }
    ]
  },
  {
    id: 'people',
    labelKey: 'workspace.icon_category_people',
    icons: [
      { key: 'Users', icon: Users, aliases: ['users', 'usuarios', 'grupo'] },
      { key: 'UsersRound', icon: UsersRound, aliases: ['people', 'pessoas', 'grupo'] },
      { key: 'UserRound', icon: UserRound, aliases: ['person', 'pessoa', 'personagem'] },
      { key: 'Flag', icon: Flag, aliases: ['flag', 'bandeira', 'faccao'] },
      { key: 'Eye', icon: Eye, aliases: ['eye', 'olho', 'observador'] },
      { key: 'Key', icon: Key, aliases: ['key', 'chave'] },
      { key: 'LockKeyhole', icon: LockKeyhole, aliases: ['lock', 'cadeado', 'segredo'] },
      { key: 'Coins', icon: Coins, aliases: ['coins', 'moedas', 'economia'] },
      { key: 'Briefcase', icon: Briefcase, aliases: ['briefcase', 'maleta', 'profissao'] },
      { key: 'Target', icon: Target, aliases: ['target', 'alvo', 'objetivo'] },
      { key: 'Heart', icon: Heart, aliases: ['heart', 'coracao', 'relacao'] }
    ]
  },
  {
    id: 'nature',
    labelKey: 'workspace.icon_category_nature',
    icons: [
      { key: 'Ship', icon: Ship, aliases: ['ship', 'navio'] },
      { key: 'Sailboat', icon: Sailboat, aliases: ['sailboat', 'barco', 'veleiro'] },
      { key: 'Anchor', icon: Anchor, aliases: ['anchor', 'ancora', 'porto'] },
      { key: 'ShipWheel', icon: ShipWheel, aliases: ['wheel', 'leme'] },
      { key: 'Waves', icon: Waves, aliases: ['waves', 'ondas', 'mar'] },
      { key: 'Plane', icon: Plane, aliases: ['plane', 'aviao', 'viagem'] },
      { key: 'Rocket', icon: Rocket, aliases: ['rocket', 'foguete', 'espaco'] },
      { key: 'Moon', icon: Moon, aliases: ['moon', 'lua', 'noite'] },
      { key: 'Sun', icon: Sun, aliases: ['sun', 'sol', 'dia'] },
      { key: 'CloudLightning', icon: CloudLightning, aliases: ['storm', 'tempestade', 'trovao'] },
      { key: 'Sprout', icon: Sprout, aliases: ['sprout', 'broto', 'planta'] },
      { key: 'Feather', icon: Feather, aliases: ['feather', 'pena'] },
      { key: 'Footprints', icon: Footprints, aliases: ['footprints', 'pegadas'] },
      { key: 'Binoculars', icon: Binoculars, aliases: ['binoculars', 'binoculos', 'exploracao'] },
      { key: 'Telescope', icon: Telescope, aliases: ['telescope', 'telescopio'] },
      { key: 'Waypoints', icon: Waypoints, aliases: ['waypoints', 'pontos', 'jornada'] }
    ]
  },
  {
    id: 'systems',
    labelKey: 'workspace.icon_category_systems',
    icons: [
      { key: 'Database', icon: Database, aliases: ['database', 'banco', 'dados'] },
      { key: 'Layers', icon: Layers, aliases: ['layers', 'camadas'] },
      { key: 'Boxes', icon: Boxes, aliases: ['boxes', 'caixas', 'modulos'] },
      { key: 'Box', icon: Box, aliases: ['box', 'caixa'] },
      { key: 'Package', icon: Package, aliases: ['package', 'pacote'] },
      { key: 'FileArchive', icon: FileArchive, aliases: ['archive file', 'arquivo'] },
      { key: 'FileBox', icon: FileBox, aliases: ['box file', 'arquivo caixa'] },
      { key: 'FileHeart', icon: FileHeart, aliases: ['heart file', 'arquivo importante'] },
      { key: 'FileImage', icon: FileImage, aliases: ['image file', 'imagem'] },
      { key: 'FileLock', icon: FileLock, aliases: ['locked file', 'arquivo trancado'] },
      { key: 'FilePenLine', icon: FilePenLine, aliases: ['edit file', 'editar'] },
      { key: 'FileSearch', icon: FileSearch, aliases: ['search file', 'pesquisar'] },
      { key: 'Shapes', icon: Shapes, aliases: ['shapes', 'formas'] },
      { key: 'Palette', icon: Palette, aliases: ['palette', 'paleta', 'cor'] },
      { key: 'Axe', icon: Axe, aliases: ['axe', 'machado'] },
      { key: 'Hammer', icon: Hammer, aliases: ['hammer', 'martelo'] },
      { key: 'Pickaxe', icon: Pickaxe, aliases: ['pickaxe', 'picareta'] }
    ]
  }
];

const DOCUMENT_ICON_OPTIONS = DOCUMENT_ICON_CATEGORIES.flatMap(category =>
  category.icons.map(icon => ({ ...icon, categoryId: category.id, categoryLabelKey: category.labelKey }))
);
const ICON_MAP = Object.fromEntries(DOCUMENT_ICON_OPTIONS.map(({ key, icon }) => [key, icon]));

function getDocumentIcon(icon) {
  return ICON_MAP[icon] || Folder;
}

function getTabTypeIcon(contentType) {
  if (contentType === 'tiptap') return FlaskConical;
  if (contentType === 'map') return Map;
  if (contentType === 'board') return Shapes;
  if (contentType === 'markdown') return FilePenLine;
  return FileText;
}

function normalizeIconSearch(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function AssetTree({ nodes, selectedAsset, selectedFolderPath, onSelectAsset, onSelectFolder, onCreateFolder, onContextMenu, renamingPath, onRename, onRequestRename, onDelete, isVisitor }) {
  if (!nodes || nodes.length === 0) return null;
  return (
    <ul className="asset-tree">
      {nodes.map(node => (
        <AssetTreeNode
          key={node.path}
          node={node}
          selectedAsset={selectedAsset}
          selectedFolderPath={selectedFolderPath}
          onSelectAsset={onSelectAsset}
          onSelectFolder={onSelectFolder}
          onCreateFolder={onCreateFolder}
          onContextMenu={onContextMenu}
          renamingPath={renamingPath}
          onRename={onRename}
          onRequestRename={onRequestRename}
          onDelete={onDelete}
          isVisitor={isVisitor}
        />
      ))}
    </ul>
  );
}

function AssetTreeNode({ node, selectedAsset, selectedFolderPath, onSelectAsset, onSelectFolder, onCreateFolder, onContextMenu, renamingPath, onRename, onRequestRename, onDelete, isVisitor }) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(true);
  const [editValue, setEditValue] = useState(node.name);
  const isFolder = node.type === 'folder';
  const isRenaming = renamingPath === node.path;
  const isSelected = isFolder ? selectedFolderPath === node.path : selectedAsset?.path === node.path;
  const Icon = isFolder ? Folder : node.mediaType === 'audio' ? Music : Image;

  useEffect(() => {
    if (isRenaming) setEditValue(node.name);
  }, [isRenaming, node.name]);

  useEffect(() => {
    if (renamingPath?.startsWith(`${node.path}/`)) setIsOpen(true);
  }, [node.path, renamingPath]);

  return (
    <li className="asset-tree-document">
      <div
        className={`asset-tree-node ${isSelected ? 'selected' : ''}`}
        draggable={!isRenaming && !isFolder && (node.mediaType === 'image' || node.mediaType === 'audio')}
        onDragStart={(event) => {
          if (isRenaming || isFolder || (node.mediaType !== 'image' && node.mediaType !== 'audio')) return;
          event.dataTransfer.effectAllowed = 'copy';
          event.dataTransfer.setData('application/x-mythra-asset', JSON.stringify({
            path: node.path,
            name: node.name,
            mediaType: node.mediaType
          }));
          if (node.mediaType === 'image') {
            event.dataTransfer.setData('application/x-mythra-asset-image', JSON.stringify({
              path: node.path,
              name: node.name,
              mediaType: node.mediaType
            }));
          }
          event.dataTransfer.setData('text/plain', node.name);
        }}
        onContextMenu={(event) => {
          if (isRenaming || (isVisitor && isFolder)) return;
          event.preventDefault();
          event.stopPropagation();
          onContextMenu(event, node);
        }}
        onClick={() => {
          if (isRenaming) return;
          if (isFolder) {
            setIsOpen(prev => !prev);
            onSelectFolder(node.path);
          } else {
            onSelectAsset(node);
          }
        }}
      >
        <span className={`tree-expander ${isFolder && node.children?.length ? 'has-children' : ''}`} aria-hidden="true">
          {isFolder && node.children?.length ? (isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : null}
        </span>
        <span className="tree-icon">
          <Icon size={14} />
        </span>
        {isRenaming ? (
          <input
            className="tree-rename-input"
            value={editValue}
            onChange={(event) => setEditValue(event.target.value)}
            onBlur={() => onRename(null)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') onRename(node, editValue);
              if (event.key === 'Escape') onRename(null);
            }}
            autoFocus
            onFocus={(event) => event.target.select()}
            onClick={(event) => event.stopPropagation()}
          />
        ) : (
          <span className="asset-tree-label">
            <span>{node.name}</span>
            {!isFolder && <small>{formatAssetSize(node.size)}</small>}
          </span>
        )}
        {!isVisitor && !isRenaming && (
          <span className="tree-node-actions asset-node-actions">
            {isFolder && (
              <button
                type="button"
                className="node-action-btn"
                onClick={(event) => {
                  event.stopPropagation();
                  setIsOpen(true);
                  onCreateFolder(node.path);
                }}
                title={t('common.create')}
                aria-label={t('common.create')}
              >
                <Plus size={14} />
              </button>
            )}
            <button
              type="button"
              className="node-action-btn"
              onClick={(event) => {
                event.stopPropagation();
                onRequestRename(node);
              }}
              title={t('common.rename')}
              aria-label={t('common.rename')}
            >
              <Edit2 size={14} />
            </button>
            <button
              type="button"
              className="node-action-btn danger"
              onClick={(event) => {
                event.stopPropagation();
                onDelete(node);
              }}
              title={t('common.delete')}
              aria-label={t('common.delete')}
            >
              <Trash2 size={14} />
            </button>
          </span>
        )}
      </div>
      {isFolder && isOpen && node.children?.length > 0 && (
        <AssetTree
          nodes={node.children}
          selectedAsset={selectedAsset}
          selectedFolderPath={selectedFolderPath}
          onSelectAsset={onSelectAsset}
          onSelectFolder={onSelectFolder}
          onCreateFolder={onCreateFolder}
          onContextMenu={onContextMenu}
          renamingPath={renamingPath}
          onRename={onRename}
          onRequestRename={onRequestRename}
          onDelete={onDelete}
          isVisitor={isVisitor}
        />
      )}
    </li>
  );
}

function FileTree({ nodes, onFileSelect, selectedFile, onCreateChild, onContextMenu, renamingPath, onRename, onRequestRename, onDelete, isSearching, isVisitor, worldData }) {
  if (!nodes || nodes.length === 0) return null;
  return (
    <ul className="file-tree">
      {nodes.filter(node => isSearching || node.type === 'container').map(node => (
        <FileTreeNode 
          key={node.path} 
          node={node} 
          onFileSelect={onFileSelect} 
          selectedFile={selectedFile} 
          onCreateChild={onCreateChild} 
          onContextMenu={onContextMenu} 
          renamingPath={renamingPath} 
          onRename={onRename} 
          onRequestRename={onRequestRename}
          onDelete={onDelete}
          isSearching={isSearching} 
          isVisitor={isVisitor} 
          worldData={worldData} 
        />
      ))}
    </ul>
  );
}

function FileTreeNode({ node, onFileSelect, selectedFile, onCreateChild, onContextMenu, renamingPath, onRename, onRequestRename, onDelete, isSearching, isVisitor, worldData }) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [editValue, setEditValue] = useState(node.name);
  const isSelected = selectedFile?.path === node.path;
  const isRenaming = renamingPath === node.path;
  const isHome = worldData?.homePage === node.path;
  const visibleChildren = isSearching ? (node.children || []) : getTreeChildren(node);
  const showChildren = isOpen || isSearching;
  const canWriteNode = !isVisitor && hasDocumentAccess(node.metadata?.currentUserAccess, 'write');
  const canReadNode = hasDocumentAccess(node.metadata?.currentUserAccess, 'read');
  const canAdminNode = !isVisitor && hasDocumentAccess(node.metadata?.currentUserAccess, 'admin');
  
  useEffect(() => {
    if (isRenaming) setEditValue(node.name);
  }, [isRenaming, node.name]);

  useEffect(() => {
    if (renamingPath?.startsWith(`${node.path}/`)) setIsOpen(true);
  }, [node.path, renamingPath]);

  return (
    <li className="tree-document">
      <div 
        className={`tree-node ${isSelected ? 'selected' : ''}`}
        draggable={!isRenaming && canWriteNode}
        onContextMenu={(e) => {
          if (!canReadNode) return;
          if (isRenaming) return;
          e.preventDefault();
          e.stopPropagation();
          onContextMenu(e, node);
        }}
      >
        <span
          className={`tree-expander ${visibleChildren.length > 0 ? 'has-children' : ''}`}
          onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
          aria-hidden="true"
        >
          {visibleChildren.length > 0 ? (showChildren ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : null}
        </span>
        <div
          className="tree-node-main"
          data-document-uid={node.uid}
          tabIndex={0}
          title={node.name}
          onClick={() => {
            if (isRenaming) return;
            onFileSelect(node);
          }}
          onKeyDown={(event) => {
            if (isRenaming || (event.key !== 'Enter' && event.key !== ' ')) return;
            event.preventDefault();
            onFileSelect(node);
          }}
        >
          <span className="tree-icon" aria-hidden="true">
            {React.createElement(getDocumentIcon(node.icon), { size: 14 })}
          </span>
          {isRenaming ? (
            <input
              className="tree-rename-input"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => onRename(null)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onRename(node, editValue);
                else if (e.key === 'Escape') onRename(null);
              }}
              autoFocus
              onFocus={(e) => e.target.select()}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="tree-node-label">
              <span>{node.name}</span>
              {isHome && <Home size={12} className="tree-home-indicator" title={t('workspace.home_page')} />}
            </span>
          )}
        </div>
        <div className="tree-node-actions">
          {canWriteNode && (
            <>
              <button
                type="button"
                className="node-action-btn"
                onClick={(e) => { e.stopPropagation(); setIsOpen(true); onCreateChild(node.path); }}
                title={t('common.create')}
              >
                <Plus size={14} />
              </button>
              <button
                type="button"
                className="node-action-btn"
                onClick={(e) => { e.stopPropagation(); onRequestRename(node); }}
                title={t('common.rename')}
              >
                <Edit2 size={14} />
              </button>
              {canAdminNode && (
                <button
                  type="button"
                  className="node-action-btn danger"
                  onClick={(e) => { e.stopPropagation(); onDelete(node); }}
                  title={t('common.delete')}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </>
          )}
        </div>
      </div>
      {showChildren && visibleChildren.length > 0 && <FileTree nodes={visibleChildren} onFileSelect={onFileSelect} selectedFile={selectedFile} onCreateChild={onCreateChild} onContextMenu={onContextMenu} renamingPath={renamingPath} onRename={onRename} onRequestRename={onRequestRename} onDelete={onDelete} isSearching={isSearching} isVisitor={isVisitor} worldData={worldData} />}
    </li>
  );
}

const DOCUMENT_ACCESS_RANK = { none: 0, read: 1, write: 2, admin: 3 };
const WORLD_THEME_CACHE_PREFIX = 'mysthra:world-theme:';
const SIDEBAR_COLLAPSED_KEY = 'mysthra:workspace-sidebar-collapsed';
const SIDEBAR_MOBILE_QUERY = '(max-width: 900px)';

function getCachedWorldTheme(worldId) {
  try {
    return getWorldTheme(window.localStorage.getItem(`${WORLD_THEME_CACHE_PREFIX}${worldId}`)).id;
  } catch {
    return DEFAULT_WORLD_THEME;
  }
}

function setCachedWorldTheme(worldId, themeId) {
  try {
    window.localStorage.setItem(`${WORLD_THEME_CACHE_PREFIX}${worldId}`, getWorldTheme(themeId).id);
  } catch {
    // Storage may be unavailable in private or restricted browsing contexts.
  }
}

function hasDocumentAccess(access, required) {
  return (DOCUMENT_ACCESS_RANK[access] || 0) >= (DOCUMENT_ACCESS_RANK[required] || 0);
}

function getDocumentBreadcrumb(nodes, targetPath, ancestors = []) {
  for (const node of nodes || []) {
    if (node.type !== 'container') continue;
    const branch = [...ancestors, { name: node.name, path: node.path }];
    if (node.path === targetPath) return branch;
    const match = getDocumentBreadcrumb(node.children, targetPath, branch);
    if (match.length > 0) return match;
  }
  return [];
}

export default function WorldWorkspace({ params, isVisitor = false, currentUser = null, languageSwitcher = null }) {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const worldId = decodeURIComponent(params.id);
  
  const [tree, setTree] = useState([]);
  const [selectedContainer, setSelectedContainer] = useState(null);
  const [activeTab, setActiveTab] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [contentLoading, setContentLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [viewMode, setViewMode] = useState('edit'); // 'view' or 'edit'
  const [searchQuery, setSearchQuery] = useState('');
  const [assetSearchQuery, setAssetSearchQuery] = useState('');
  const [iconSearchQuery, setIconSearchQuery] = useState('');
  const [activeSidebarTab, setActiveSidebarTab] = useState('wiki');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return window.sessionStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [isSidebarMobile, setIsSidebarMobile] = useState(() => window.matchMedia?.(SIDEBAR_MOBILE_QUERY).matches || false);
  const [isSidebarDrawerOpen, setIsSidebarDrawerOpen] = useState(false);
  const [assetTree, setAssetTree] = useState([]);
  const [assetLoading, setAssetLoading] = useState(false);
  const [assetUploading, setAssetUploading] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [previewAsset, setPreviewAsset] = useState(null);
  const [selectedAssetFolderPath, setSelectedAssetFolderPath] = useState('');
  const [worldData, setWorldData] = useState(null);
  const [worldDataLoaded, setWorldDataLoaded] = useState(false);
  const [treeLoaded, setTreeLoaded] = useState(false);
  const [cachedWorldTheme, setCachedWorldThemeState] = useState(() => getCachedWorldTheme(worldId));
  const [toasts, setToasts] = useState([]);
  const [saveStatus, setSaveStatus] = useState('saved');
  const assetFileInputRef = useRef(null);
  const coverFileInputRef = useRef(null);
  
  // Modals/UI State
  const [contextMenu, setContextMenu] = useState({ isOpen: false, x: 0, y: 0, node: null });
  const [tabContextMenu, setTabContextMenu] = useState({ isOpen: false, x: 0, y: 0, node: null });
  const [assetContextMenu, setAssetContextMenu] = useState({ isOpen: false, x: 0, y: 0, node: null });
  const [worldActionsMenu, setWorldActionsMenu] = useState(false);
  const [worldSettingsOpen, setWorldSettingsOpen] = useState(false);
  const [documentPermissionsPanel, setDocumentPermissionsPanel] = useState({ isOpen: false, loading: false, members: [], visitorAccess: "none", draft: { inherit: true, users: {} }, error: '' });
  const [worldPresenceUsers, setWorldPresenceUsers] = useState([]);
  const [activeTabVisitorCount, setActiveTabVisitorCount] = useState(0);
  const [duplicatePrompt, setDuplicatePrompt] = useState({ isOpen: false, node: null });
  const [documentMovePrompt, setDocumentMovePrompt] = useState({ isOpen: false, node: null, targetPath: '' });
  const [assetDuplicatePrompt, setAssetDuplicatePrompt] = useState({ isOpen: false, node: null });
  const [assetMovePrompt, setAssetMovePrompt] = useState({ isOpen: false, node: null, targetPath: '' });
  const [deletePrompt, setDeletePrompt] = useState({ isOpen: false, node: null, isDeleting: false });
  const [assetDeletePrompt, setAssetDeletePrompt] = useState({ isOpen: false, node: null });
  const [documentIconPicker, setDocumentIconPicker] = useState({ isOpen: false, top: 0, left: 0 });
  const [renamingPath, setRenamingPath] = useState(null);
  const [assetRenamingPath, setAssetRenamingPath] = useState(null);
  const [renamingTab, setRenamingTab] = useState({ path: '', value: '' });
  const [pageTitleEdit, setPageTitleEdit] = useState({ isEditing: false, value: '' });
  const [tabDraft, setTabDraft] = useState({ isOpen: false, name: '', isCreating: false });
  const [coverReposition, setCoverReposition] = useState({ isEditing: false, x: 50, y: 50, initialX: 50, initialY: 50, isDragging: false, dragStart: null });
  const assetUploadTargetPathRef = useRef('');
  const coverRef = useRef(null);
  const firstTabTypeRef = useRef(null);
  const latestContentRef = useRef('');
  const latestTabPathRef = useRef('');
  const selectedContainerPathRef = useRef('');
  const skipTitleRenameRef = useRef(false);
  const initialSharedSelectionRef = useRef(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const closeSidebarDrawer = useCallback(() => setIsSidebarDrawerOpen(false), []);
  const toggleSidebar = useCallback(() => {
    if (isSidebarMobile) setIsSidebarDrawerOpen(prev => !prev);
    else setIsSidebarCollapsed(prev => !prev);
  }, [isSidebarMobile]);
  const closeAssetPreview = useCallback(() => setPreviewAsset(null), []);

  useEffect(() => {
    const mediaQuery = window.matchMedia?.(SIDEBAR_MOBILE_QUERY);
    if (!mediaQuery) return undefined;
    const handleChange = event => {
      setIsSidebarMobile(event.matches);
      setIsSidebarDrawerOpen(false);
    };
    mediaQuery.addEventListener?.('change', handleChange);
    return () => mediaQuery.removeEventListener?.('change', handleChange);
  }, []);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(isSidebarCollapsed));
    } catch {
      // Session storage may be unavailable in restricted browsing contexts.
    }
  }, [isSidebarCollapsed]);

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  const fetchTree = useCallback(async () => {
    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/tree`);
      if (res.ok) {
        const data = await res.json();
        const items = data.items || [];
        setTree(items);
        return items;
      }
    } catch {
      addToast(t('common.error'), 'error');
    } finally {
      setTreeLoaded(true);
    }
    return null;
  }, [addToast, t, worldId]);

  const fetchWorldData = useCallback(async () => {
    setWorldDataLoaded(false);
    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/config`);
      if (res.ok) {
        const data = await res.json();
        setWorldData(data);
        setCachedWorldThemeState(getWorldTheme(data.theme).id);
        setCachedWorldTheme(worldId, data.theme);
      }
    } catch {
      setWorldData(null);
    } finally {
      setWorldDataLoaded(true);
    }
  }, [worldId]);

  const fetchAssets = useCallback(async () => {
    setAssetLoading(true);
    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/assets`);
      if (res.ok) {
        const data = await res.json();
        setAssetTree(data.items || []);
      }
    } catch {
      addToast(t('common.error'), 'error');
    } finally {
      setAssetLoading(false);
    }
  }, [addToast, t, worldId]);

  const handleWorldPresenceStateless = useCallback(({ payload }) => {
    try {
      const message = JSON.parse(payload);
      if (message.worldId !== worldId) return;
      if (message.type === 'document-tree') {
        fetchTree();
      }
    } catch {
      // Ignore stateless messages not produced by Mysthra.
    }
  }, [fetchTree, worldId]);

  const worldPresenceRoomName = (currentUser || isVisitor) ? `world:${worldId}:presence` : '';
  const worldPresence = useCollaborationRoom({
    roomName: worldPresenceRoomName,
    currentUser,
    isVisitor,
    onStateless: handleWorldPresenceStateless
  });
  const {
    provider: worldPresenceProvider,
    awarenessStates: worldPresenceAwarenessStates,
    setAwarenessField: setWorldPresenceAwarenessField
  } = worldPresence;

  useEffect(() => {
    const nextUsers = worldPresenceAwarenessStates
      .map(state => state.user)
      .filter(Boolean)
      .filter((user, index, users) => users.findIndex(item => item.id === user.id) === index);
    setWorldPresenceUsers(nextUsers);
  }, [worldPresenceAwarenessStates]);

  useEffect(() => {
    if (!worldPresenceProvider || (!currentUser && !isVisitor)) return;
    setWorldPresenceAwarenessField('location', {
      containerPath: selectedContainer?.path || '',
      containerName: selectedContainer?.name || '',
      tabPath: activeTab?.path || '',
      tabName: activeTab?.name || ''
    });
  }, [
    activeTab?.name,
    activeTab?.path,
    currentUser,
    isVisitor,
    selectedContainer?.name,
    selectedContainer?.path,
    setWorldPresenceAwarenessField,
    worldPresenceProvider
  ]);

  useEffect(() => {
    latestContentRef.current = fileContent;
    latestTabPathRef.current = activeTab?.path || '';
  }, [activeTab, fileContent]);

  useEffect(() => {
    setActiveTabVisitorCount(0);
  }, [activeTab?.path]);

  useEffect(() => {
    selectedContainerPathRef.current = selectedContainer?.path || '';
  }, [selectedContainer?.path]);


  const selectedContainerPath = selectedContainer?.path || '';
  const activeTabPath = activeTab?.path || '';

  useEffect(() => {
    if (!selectedContainerPath || !activeTabPath) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('document') === selectedContainerPath && params.get('tab') === activeTabPath) return;
    params.set('document', selectedContainerPath);
    params.set('tab', activeTabPath);
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
  }, [activeTabPath, selectedContainerPath]);

  const handleWikiContentChange = useCallback((nextContent) => {
    latestContentRef.current = nextContent;
    latestTabPathRef.current = activeTab?.path || '';
    setFileContent(nextContent);
    setIsDirty(true);
  }, [activeTab?.path]);

  const handleCollaborationSaveState = useCallback(({ status, dirty }) => {
    if (typeof dirty === 'boolean') {
      setIsDirty(dirty);
    }
    if (status) {
      setSaveStatus(status);
    }
  }, []);

  const saveDocument = useCallback(async (silent = true) => {
    if (!activeTab || isVisitor || !hasDocumentAccess(activeTab.metadata?.currentUserAccess, 'write')) return false;
    if (selectedContainer?.metadata?.locked) return false;
    const savedPath = activeTab.path;
    const savedContent = latestContentRef.current;
    setSaveStatus('saving');

    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/documents`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: savedPath,
          content: savedContent
        })
      });

      if (!res.ok) {
        setSaveStatus('error');
        if (!silent) addToast(t('common.error'), 'error');
        return false;
      }

      if (latestTabPathRef.current === savedPath && latestContentRef.current === savedContent) {
        setIsDirty(false);
        setSaveStatus('saved');
      }
      if (!silent) addToast(t('common.saved'), 'success');
      return true;
    } catch {
      setSaveStatus('error');
      if (!silent) addToast(t('common.error'), 'error');
      return false;
    }
  }, [activeTab, addToast, isVisitor, selectedContainer, t, worldId]);

  useEffect(() => {
    setTreeLoaded(false);
    setWorldDataLoaded(false);
    setCachedWorldThemeState(getCachedWorldTheme(worldId));
    fetchTree();
    fetchWorldData();
  }, [fetchTree, fetchWorldData, worldId]);

  useEffect(() => {
    setPageTitleEdit({ isEditing: false, value: selectedContainer?.name || '' });
    setTabDraft({ isOpen: false, name: '', isCreating: false });
    setCoverReposition({ isEditing: false, x: 50, y: 50, initialX: 50, initialY: 50, isDragging: false, dragStart: null });
    setViewMode('edit');
  }, [selectedContainer?.uid, selectedContainer?.name]);

  useEffect(() => {
    if (!activeTab || isVisitor || !isDirty || isCollaborativeContentType(activeTab.contentType)) return;

    setSaveStatus('idle');
    const timer = setTimeout(() => {
      saveDocument(true);
    }, 1500);

    return () => clearTimeout(timer);
  }, [activeTab, fileContent, isDirty, isVisitor, saveDocument]);

  useEffect(() => {
    if (activeSidebarTab === 'assets') {
      fetchAssets();
    }
  }, [activeSidebarTab, fetchAssets]);

  useEffect(() => {
    if (activeTab?.contentType === 'map' || activeTab?.contentType === 'board') {
      fetchAssets();
    }
  }, [activeTab?.contentType, fetchAssets]);

  useEffect(() => {
    setCoverReposition({ isEditing: false, x: 50, y: 50, initialX: 50, initialY: 50, isDragging: false, dragStart: null });
    setViewMode('edit');
  }, [activeTab?.uid]);

  useEffect(() => {
    if (!worldActionsMenu) return undefined;
    const close = () => setWorldActionsMenu(false);
    window.addEventListener('click', close);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [worldActionsMenu]);

  // Sincroniza o container selecionado quando a árvore muda (para refletir novas abas)
  useEffect(() => {
    let isCancelled = false;

    const clearActiveTab = () => {
      setActiveTab(null);
      setFileContent('');
      setContentLoading(false);
      setIsDirty(false);
    };

    const openReplacementTab = async (tabNode) => {
      if (!tabNode || isCancelled) {
        clearActiveTab();
        return;
      }

      if (tabNode.contentType === 'map' || tabNode.contentType === 'board') {
        setActiveTab(tabNode);
        setFileContent('');
        setContentLoading(false);
        setIsDirty(false);
        setSaveStatus('saved');
        return;
      }

      setActiveTab(tabNode);
      setFileContent('');
      setContentLoading(true);
      try {
        const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/documents?path=${encodeURIComponent(tabNode.path)}`);
        if (!res.ok || isCancelled) return;
        const data = await res.json();
        setFileContent(data.content);
        setIsDirty(false);
        setSaveStatus('saved');
      } catch {
        if (!isCancelled) addToast(t('common.error'), 'error');
      } finally {
        if (!isCancelled) setContentLoading(false);
      }
    };

    if (selectedContainer && tree.length === 0) {
      setSelectedContainer(null);
      clearActiveTab();
      return () => {
        isCancelled = true;
      };
    }

    let updatedContainer = selectedContainer;
    if (selectedContainer && tree.length > 0) {
      const updatedNode = findNodeByPath(tree, selectedContainer.path);
      if (updatedNode) {
        updatedContainer = updatedNode;
        setSelectedContainer(updatedNode);
      } else {
        setSelectedContainer(null);
        clearActiveTab();
        return () => {
          isCancelled = true;
        };
      }
    }

    if (activeTab && tree.length > 0) {
      const updatedTab = findNodeByPath(tree, activeTab.path);
      if (updatedTab) {
        setActiveTab(updatedTab);
      } else {
        openReplacementTab(getFirstOrderedTab(updatedContainer));
      }
    } else if (!activeTab && updatedContainer && tree.length > 0) {
      openReplacementTab(getFirstOrderedTab(updatedContainer));
    }

    return () => {
      isCancelled = true;
    };
  }, [activeTab, addToast, selectedContainer, t, tree, worldId]);

  const selectContainer = async (node) => {
    setSelectedContainer(node);
    if (isSidebarMobile) setIsSidebarDrawerOpen(false);
    const firstTab = getFirstOrderedTab(node);
    if (firstTab) {
      selectTab(firstTab);
    } else {
      setActiveTab(null);
      setFileContent('');
      setContentLoading(false);
    }
  };

  const selectTab = async (tabNode) => {
    if (isDirty && !isCollaborativeContentType(activeTab?.contentType)) {
      await new Promise(resolve => window.requestAnimationFrame(resolve));
      const saved = await saveDocument(true);
      if (!saved) return;
    }
    setTabDraft({ isOpen: false, name: '', isCreating: false });

    if (tabNode.contentType === 'map' || tabNode.contentType === 'board') {
      setActiveTab(tabNode);
      setFileContent('');
      setContentLoading(false);
      setIsDirty(false);
      setSaveStatus('saved');
      return;
    }
    
    setActiveTab(tabNode);
    setFileContent('');
    setContentLoading(true);
    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/documents?path=${encodeURIComponent(tabNode.path)}`);
      if (res.ok) {
        const data = await res.json();
        setFileContent(data.content);
        setIsDirty(false);
        setSaveStatus('saved');
      }
    } catch {
      addToast(t('common.error'), 'error');
    } finally {
      setContentLoading(false);
    }
  };

  const navigateToMapLink = async ({ linkedDocumentPath = '', linkedTabPath = '' }) => {
    const targetTab = linkedTabPath ? findNodeByPath(tree, linkedTabPath) : null;
    const targetDocumentPath = targetTab ? pathParent(targetTab.path) : linkedDocumentPath;
    const targetDocument = targetDocumentPath ? findNodeByPath(tree, targetDocumentPath) : null;

    if (!targetDocument || targetDocument.type !== 'container') {
      addToast(t('workspace.map_link_broken'), 'error');
      return;
    }

    setSelectedContainer(targetDocument);

    if (targetTab) {
      if (targetTab.type !== 'tab') {
        addToast(t('workspace.map_link_broken'), 'error');
        return;
      }
      await selectTab(targetTab);
      return;
    }

    const firstTab = getFirstOrderedTab(targetDocument);
    if (firstTab) {
      await selectTab(firstTab);
    } else {
      setActiveTab(null);
      setFileContent('');
      setContentLoading(false);
      setIsDirty(false);
      setSaveStatus('saved');
    }
  };

  const navigateToPageLink = async (href = '') => {
    const parsedLink = parseInternalPageLink(href);
    if (!parsedLink) return false;

    const targetTab = parsedLink.tabUid ? findNodeByUid(tree, parsedLink.tabUid) : null;
    const targetDocument = targetTab
      ? findNodeByPath(tree, pathParent(targetTab.path))
      : findNodeByUid(tree, parsedLink.documentUid);

    if (!targetDocument || targetDocument.type !== 'container') {
      addToast(t('workspace.page_link_not_found'), 'error');
      return true;
    }

    setSelectedContainer(targetDocument);

    if (parsedLink.tabUid) {
      if (!targetTab || targetTab.type !== 'tab') {
        addToast(t('workspace.page_link_not_found'), 'error');
        return true;
      }
      await selectTab(targetTab);
      return true;
    }

    const firstTab = getFirstOrderedTab(targetDocument);
    if (firstTab) {
      await selectTab(firstTab);
    } else {
      setActiveTab(null);
      setFileContent('');
      setContentLoading(false);
      setIsDirty(false);
      setSaveStatus('saved');
    }
    return true;
  };

  useEffect(() => {
    if (initialSharedSelectionRef.current || !worldDataLoaded || tree.length === 0 || selectedContainer) return;

    const queryParams = new URLSearchParams(window.location.search);
    const documentPath = queryParams.get('document');
    const tabPath = queryParams.get('tab');
    const sharedContainerPath = documentPath || pathParent(tabPath);
    const sharedContainer = sharedContainerPath ? findNodeByPath(tree, sharedContainerPath) : null;
    const homeContainer = tree.find(node => isRootContainer(node) && node.path === worldData?.homePage);
    const fallbackContainer = tree.find(node => isRootContainer(node));
    const targetContainer = sharedContainer?.type === 'container'
      ? sharedContainer
      : homeContainer || fallbackContainer;

    if (!targetContainer) return;

    initialSharedSelectionRef.current = true;
    setSelectedContainer(targetContainer);

    const sharedTab = tabPath ? findNodeByPath(tree, tabPath) : null;
    const tabToOpen = sharedContainer?.type === 'container' && sharedTab?.type === 'tab'
      ? sharedTab
      : getFirstOrderedTab(targetContainer);
    if (!tabToOpen) {
      setActiveTab(null);
      setFileContent('');
      setContentLoading(false);
      setIsDirty(false);
      setSaveStatus('saved');
      return;
    }

    const openInitialTab = async () => {
      if (tabToOpen.contentType === 'map' || tabToOpen.contentType === 'board') {
        setActiveTab(tabToOpen);
        setFileContent('');
        setContentLoading(false);
        setIsDirty(false);
        setSaveStatus('saved');
        return;
      }

      setActiveTab(tabToOpen);
      setFileContent('');
      setContentLoading(true);
      try {
        const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/documents?path=${encodeURIComponent(tabToOpen.path)}`);
        if (res.ok) {
          const data = await res.json();
          setFileContent(data.content);
          setIsDirty(false);
          setSaveStatus('saved');
        }
      } catch {
        addToast(t('common.error'), 'error');
      } finally {
        setContentLoading(false);
      }
    };

    openInitialTab();
  }, [addToast, selectedContainer, t, tree, worldData?.homePage, worldDataLoaded, worldId]);

  const getUniqueTabName = () => {
    const baseName = t('workspace.untitled_tab');
    const siblingNames = new Set(selectedTabs.map(tab => tab.name));
    if (!siblingNames.has(baseName)) return baseName;

    let suffix = 2;
    while (siblingNames.has(`${baseName} ${suffix}`)) {
      suffix += 1;
    }
    return `${baseName} ${suffix}`;
  };

  const openTabDraft = () => {
    if (isVisitor || !selectedContainer || !hasDocumentAccess(selectedContainer.metadata?.currentUserAccess, 'write')) return;
    if (selectedContainer.metadata?.locked === true) return;
    setRenamingTab({ path: '', value: '' });
    setTabDraft({ isOpen: true, name: getUniqueTabName(), isCreating: false });
  };

  const handleInitializeTabDraft = async (contentType) => {
    if (isVisitor || !selectedContainer || !hasDocumentAccess(selectedContainer.metadata?.currentUserAccess, 'write')) return;
    if (selectedContainer.metadata?.locked === true) return;
    if (!tabDraft.isOpen || tabDraft.isCreating) return;
    const tabName = tabDraft.name.trim() || getUniqueTabName();
    setTabDraft(prev => ({ ...prev, name: tabName, isCreating: true }));
    if (isDirty) {
      await new Promise(resolve => window.requestAnimationFrame(resolve));
      const saved = await saveDocument(true);
      if (!saved) {
        setTabDraft(prev => ({ ...prev, isCreating: false }));
        return;
      }
    }

    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: `${selectedContainer.path}/${tabName}`,
          content: '',
          metadata: {
            type: 'tab',
            contentType,
            name: tabName,
            ...((contentType === 'map' || contentType === 'board') ? { documentCoverHidden: true } : {})
          }
        })
      });
      if (res.ok) {
        const createdTab = await res.json();
        const nextActiveTab = {
          ...createdTab,
          icon: null,
          type: 'tab',
          contentType,
          metadata: {
            type: 'tab',
            contentType,
            name: tabName,
            ...((contentType === 'map' || contentType === 'board') ? { documentCoverHidden: true } : {})
          }
        };

        await fetchTree();

        if (contentType === 'wiki') {
          const resDoc = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/documents?path=${encodeURIComponent(createdTab.path)}`);
          if (resDoc.ok) {
            const data = await resDoc.json();
            setActiveTab(nextActiveTab);
            setFileContent(data.content || '');
            setContentLoading(false);
            setIsDirty(false);
            setSaveStatus('saved');
          } else {
            setActiveTab(nextActiveTab);
            setFileContent('');
            setContentLoading(false);
            setIsDirty(false);
            setSaveStatus('saved');
          }
        } else {
          setActiveTab(nextActiveTab);
          setFileContent('');
          setContentLoading(false);
          setIsDirty(false);
          setSaveStatus('saved');
          await fetchAssets();
        }
        setTabDraft({ isOpen: false, name: '', isCreating: false });
        addToast(t('common.created'), 'success');
      } else {
        const data = await res.json().catch(() => null);
        setTabDraft(prev => ({ ...prev, isCreating: false }));
        addToast(data?.error || t('common.error'), 'error');
      }
    } catch {
      setTabDraft(prev => ({ ...prev, isCreating: false }));
      addToast(t('common.error'), 'error');
    }
  };

  const handleRename = async (node, newName) => {
    if (!newName || newName === node.name) {
      setRenamingPath(null);
      return;
    }
    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/documents/rename`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: node.path, newName })
      });
      if (res.ok) {
        setRenamingPath(null);
        fetchTree();
        addToast(t('common.renamed'), 'success');
      }
    } catch {
      addToast(t('common.error'), 'error');
    }
  };

  const commitTabRename = async (tab) => {
    const nextName = renamingTab.value.trim();
    if (!tab || !nextName || nextName === tab.name) {
      setRenamingTab({ path: '', value: '' });
      return;
    }

    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/documents/rename`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: tab.path, newName: nextName })
      });
      if (res.ok) {
        setRenamingTab({ path: '', value: '' });
        setActiveTab(prev => prev?.path === tab.path ? { ...prev, name: nextName, metadata: { ...prev.metadata, name: nextName } } : prev);
        await fetchTree();
        addToast(t('common.renamed'), 'success');
      } else {
        addToast(t('common.error'), 'error');
      }
    } catch {
      addToast(t('common.error'), 'error');
    }
  };

  const handleDelete = async (node) => {
    if (isVisitor || !node) return;
    setDeletePrompt({ isOpen: true, node, isDeleting: false });
  };

  const closeDeletePrompt = useCallback(() => {
    if (deletePrompt.isDeleting) return;
    const deletedNode = deletePrompt.node;
    setDeletePrompt({ isOpen: false, node: null, isDeleting: false });

    if (deletedNode?.uid) {
      window.requestAnimationFrame(() => {
        if (deletedNode.type === 'tab') {
          const tabElement = Array.from(document.querySelectorAll('[data-tab-uid]'))
            .find(element => element.dataset.tabUid === deletedNode.uid);
          if (tabElement?.matches('button')) tabElement.focus();
          else tabElement?.querySelector('input')?.focus();
          return;
        }
        Array.from(document.querySelectorAll('[data-document-uid]'))
          .find(element => element.dataset.documentUid === deletedNode.uid)
          ?.focus();
      });
    }
  }, [deletePrompt.isDeleting, deletePrompt.node]);

  const updateHomePage = async (node) => {
    if (isVisitor) return;
    const nextHomePage = node ? node.path : null;

    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/homepage`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ homePage: nextHomePage })
      });
      if (res.ok) {
        const data = await res.json();
        setWorldData(data);
        addToast(nextHomePage ? t('workspace.home_page_set') : t('workspace.home_page_unset'), 'success');
      } else {
        addToast(t('workspace.home_page_failed'), 'error');
      }
    } catch {
      addToast(t('workspace.home_page_failed'), 'error');
    }
  };

  const openDocumentPermissionsPanel = async () => {
    if (!selectedContainer || !hasDocumentAccess(selectedContainer.metadata?.currentUserAccess, 'admin')) return;
    setDocumentPermissionsPanel(prev => ({ ...prev, isOpen: true, loading: true, error: '' }));
    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/documents/permissions?path=${encodeURIComponent(selectedContainer.path)}`);
      if (!res.ok) {
        setDocumentPermissionsPanel(prev => ({ ...prev, loading: false, error: t('common.error') }));
        return;
      }
      const data = await res.json();
      const permissions = data.permissions || { inherit: true, users: {} };
      setDocumentPermissionsPanel({
        isOpen: true,
        loading: false,
        members: data.members || [],
        visitorAccess: data.visitorAccess || "none",
        draft: {
          inherit: permissions.inherit !== false,
          users: permissions.users || {}
        },
        error: ''
      });
    } catch {
      setDocumentPermissionsPanel(prev => ({ ...prev, loading: false, error: t('common.error_connection') }));
    }
  };

  const setDocumentPermissionUserAccess = (userId, access) => {
    setDocumentPermissionsPanel(prev => {
      const users = { ...(prev.draft.users || {}) };
      users[userId] = access;
      return { ...prev, draft: { ...prev.draft, users } };
    });
  };

  const saveDocumentPermissions = async () => {
    if (!selectedContainer) return;
    setDocumentPermissionsPanel(prev => ({ ...prev, loading: true, error: '' }));
    const users = Object.fromEntries(Object.entries(documentPermissionsPanel.draft.users || {}).filter(([, access]) => ['none', 'read', 'write', 'admin'].includes(access)));
    const permissions = documentPermissionsPanel.draft.inherit && Object.keys(users).length === 0
      ? null
      : { inherit: documentPermissionsPanel.draft.inherit, users };
    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/documents/metadata`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: selectedContainer.path, metadata: { permissions } })
      });
      if (!res.ok) {
        setDocumentPermissionsPanel(prev => ({ ...prev, loading: false, error: t('common.error') }));
        return;
      }
      await fetchTree();
      setDocumentPermissionsPanel(prev => ({ ...prev, isOpen: false, loading: false }));
      addToast(t('common.saved'), 'success');
    } catch {
      setDocumentPermissionsPanel(prev => ({ ...prev, loading: false, error: t('common.error_connection') }));
    }
  };

  const toggleDocumentLock = async () => {
    if (!selectedContainer || !canLockDocument) return;
    const newLockedState = !selectedContainer.metadata?.locked;
    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/documents/metadata`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: selectedContainer.path, metadata: { locked: newLockedState } })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: t('common.error') }));
        addToast(err.error || t('common.error'), 'error');
        return;
      }
      await fetchTree();
      addToast(newLockedState ? t('workspace.document_locked') : t('workspace.document_unlocked'), 'success');
    } catch {
      addToast(t('common.error_connection'), 'error');
    }
  };

  const confirmDelete = async () => {
    const node = deletePrompt.node;
    if (isVisitor || !node || deletePrompt.isDeleting) return;
    const deletedHomePage = worldData?.homePage === node.path;
    setDeletePrompt(prev => ({ ...prev, isDeleting: true }));

    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/documents?path=${encodeURIComponent(node.path)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        if (node.type === 'tab') {
          if (activeTab?.path === node.path) {
            setActiveTab(null);
            setFileContent('');
            setIsDirty(false);
            setSaveStatus('saved');
          }
        } else if (
          selectedContainer?.path === node.path ||
          selectedContainer?.path?.startsWith(`${node.path}/`)
        ) {
          setSelectedContainer(null);
          setActiveTab(null);
          setFileContent('');
          initialSharedSelectionRef.current = false;
        }
        if (deletedHomePage) {
          try {
            const homeRes = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/homepage`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ homePage: null })
            });
            if (homeRes.ok) {
              const data = await homeRes.json();
              setWorldData(data);
            } else {
              setWorldData(prev => prev ? { ...prev, homePage: null } : prev);
            }
          } catch {
            setWorldData(prev => prev ? { ...prev, homePage: null } : prev);
          }
          initialSharedSelectionRef.current = false;
        }
        setDeletePrompt({ isOpen: false, node: null, isDeleting: false });
        await fetchTree();
        addToast(t('common.deleted'), 'success');
      } else {
        setDeletePrompt(prev => ({ ...prev, isDeleting: false }));
        addToast(t('common.error'), 'error');
      }
    } catch {
      setDeletePrompt(prev => ({ ...prev, isDeleting: false }));
      addToast(t('common.error'), 'error');
    }
  };

  const duplicateTab = async (tab) => {
    if (isVisitor || !tab) return;
    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/documents/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: tab.path,
          includeChildren: false,
          name: `${tab.name} ${t('workspace.copy_suffix')}`
        })
      });
      if (res.ok) {
        const result = await res.json();
        await fetchTree();
        setRenamingTab({ path: result.path, value: result.name });
        addToast(t('workspace.duplicated'), 'success');
      } else {
        const data = await res.json().catch(() => null);
        addToast(data?.error || t('common.error'), 'error');
      }
    } catch {
      addToast(t('common.error'), 'error');
    }
  };

  const openDuplicatePrompt = (node) => {
    if (isVisitor || !node) return;
    setDuplicatePrompt({ isOpen: true, node });
  };

  const handleDuplicate = async (includeChildren) => {
    const node = duplicatePrompt.node;
    if (isVisitor || !node) return;

    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/documents/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: node.path,
          includeChildren,
          name: `${node.name} ${t('workspace.copy_suffix')}`
        })
      });
      if (res.ok) {
        const result = await res.json();
        setDuplicatePrompt({ isOpen: false, node: null });
        setSearchQuery('');
        await fetchTree();
        setRenamingPath(result.path);
        addToast(t('workspace.duplicated'), 'success');
      } else {
        addToast(t('common.error'), 'error');
      }
    } catch {
      addToast(t('common.error'), 'error');
    }
  };

  const closeDocumentIconPicker = useCallback(() => {
    setDocumentIconPicker({ isOpen: false, top: 0, left: 0 });
    setIconSearchQuery('');
  }, []);

  const openDocumentIconPicker = (event) => {
    if (isVisitor || !selectedContainer || !hasDocumentAccess(selectedContainer.metadata?.currentUserAccess, 'write')) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const pickerWidth = 420;
    const pickerHeight = 520;
    const viewportPadding = 12;
    setIconSearchQuery('');
    setDocumentIconPicker({
      isOpen: true,
      top: Math.min(
        Math.max(rect.bottom + 10, viewportPadding),
        window.innerHeight - pickerHeight - viewportPadding
      ),
      left: Math.max(
        viewportPadding,
        Math.min(rect.left, window.innerWidth - pickerWidth - viewportPadding)
      )
    });
  };

  const handleDocumentIconSelect = async (icon) => {
    if (!selectedContainer) return;
    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/documents/metadata`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: selectedContainer.path, metadata: { icon } })
      });
      if (res.ok) {
        closeDocumentIconPicker();
        setSelectedContainer(prev => prev ? { ...prev, icon, metadata: { ...prev.metadata, icon } } : prev);
        await fetchTree();
      } else {
        addToast(t('common.error'), 'error');
      }
    } catch {
      addToast(t('common.error'), 'error');
    }
  };

  const displayTree = useMemo(() => {
    return orderTreeWithHome(tree, worldData?.homePage);
  }, [tree, worldData?.homePage]);

  const filteredTree = useMemo(() => {
    if (!searchQuery) return displayTree;
    const search = (nodes) => {
      return nodes.map(node => {
        const matches = node.name.toLowerCase().includes(searchQuery.toLowerCase());
        const children = node.children ? search(node.children) : [];
        if (matches || children.length > 0) {
          return { ...node, children };
        }
        return null;
      }).filter(Boolean);
    };
    return search(displayTree);
  }, [displayTree, searchQuery]);

  const filteredAssetTree = useMemo(() => {
    if (!assetSearchQuery) return assetTree;

    const query = assetSearchQuery.toLowerCase();
    const filterNodes = (nodes) => {
      return nodes.map(node => {
        const matches = node.name.toLowerCase().includes(query);
        const children = node.children ? filterNodes(node.children) : [];
        if (matches || children.length > 0) {
          return { ...node, children };
        }
        return null;
      }).filter(Boolean);
    };

    return filterNodes(assetTree);
  }, [assetSearchQuery, assetTree]);
  const filteredDocumentIconCategories = useMemo(() => {
    const query = normalizeIconSearch(iconSearchQuery);
    if (!query) return DOCUMENT_ICON_CATEGORIES;

    return DOCUMENT_ICON_CATEGORIES
      .map(category => ({
        ...category,
        icons: category.icons.filter(icon => {
          const searchableText = normalizeIconSearch([
            icon.key,
            category.id,
            ...(icon.aliases || [])
          ].join(' '));
          return searchableText.includes(query);
        })
      }))
      .filter(category => category.icons.length > 0);
  }, [iconSearchQuery]);
  const filteredDocumentIconCount = filteredDocumentIconCategories.reduce((total, category) => total + category.icons.length, 0);

  const assetMoveTargets = useMemo(() => {
    const sourceNode = assetMovePrompt.node;
    return [
      {
        name: t('workspace.assets_root_target'),
        path: '',
        depth: 0,
        disabled: isInvalidAssetMoveTarget(sourceNode, '')
      },
      ...getAssetFolders(assetTree).map(folder => ({
        ...folder,
        depth: folder.path.split('/').length,
        disabled: isInvalidAssetMoveTarget(sourceNode, folder.path)
      }))
    ];
  }, [assetMovePrompt.node, assetTree, t]);
  const documentMoveTargets = useMemo(() => {
    const sourceNode = documentMovePrompt.node;
    return [
      {
        name: t('workspace.documents_root_target'),
        path: '',
        depth: 0,
        disabled: isInvalidDocumentMoveTarget(sourceNode, '')
      },
      ...getDocumentContainers(tree).map(document => ({
        ...document,
        depth: document.path.split('/').length,
        disabled: isInvalidDocumentMoveTarget(sourceNode, document.path)
      }))
    ];
  }, [documentMovePrompt.node, tree, t]);
  const assetImages = useMemo(() => getAssetImages(assetTree), [assetTree]);
  const assetAudios = useMemo(() => {
    const items = [];
    const walk = (nodes = []) => {
      for (const node of nodes) {
        if (node.type === 'folder') walk(node.children || []);
        else if (node.mediaType === 'audio') items.push(node);
      }
    };
    walk(assetTree);
    return items;
  }, [assetTree]);

  const getUniqueDocumentName = (parentPath = '') => {
    const baseName = t('workspace.new_document_name');
    const parentNode = parentPath ? findNodeByPath(tree, parentPath) : null;
    const siblingNodes = parentNode ? (parentNode.children || []) : tree;
    const siblingNames = new Set(siblingNodes.map(node => node.name));
    if (!siblingNames.has(baseName)) return baseName;

    let suffix = 2;
    while (siblingNames.has(`${baseName} ${suffix}`)) {
      suffix += 1;
    }
    return `${baseName} ${suffix}`;
  };

  const createDocumentInline = async (parentPath = '') => {
    if (isVisitor) return;
    const name = getUniqueDocumentName(parentPath);
    const path = parentPath ? `${parentPath}/${name}` : name;

    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path,
          content: '',
          metadata: {
            type: 'container',
            contentType: null
          }
        })
      });
      if (res.ok) {
        const result = await res.json();
        setSearchQuery('');
        await fetchTree();
        setRenamingPath(result.path);
        addToast(t('common.created'), 'success');
      }
    } catch {
      addToast(t('common.error'), 'error');
    }
  };

  const getAssetUrl = (assetPath) => {
    return `/api/worlds/${encodeURIComponent(worldId)}/assets/file?path=${encodeURIComponent(assetPath)}`;
  };

  const getUniqueAssetFolderName = (parentPath = '') => {
    const baseName = t('workspace.new_asset_folder_name');
    const parentNode = parentPath ? findAssetByPath(assetTree, parentPath) : null;
    const siblingNodes = parentNode ? (parentNode.children || []) : assetTree;
    const siblingNames = new Set(siblingNodes.filter(node => node.type === 'folder').map(node => node.name));
    if (!siblingNames.has(baseName)) return baseName;

    let suffix = 2;
    while (siblingNames.has(`${baseName} ${suffix}`)) {
      suffix += 1;
    }
    return `${baseName} ${suffix}`;
  };

  const createAssetFolderInline = async (parentPath = selectedAssetFolderPath) => {
    if (isVisitor) return;
    const name = getUniqueAssetFolderName(parentPath);
    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/assets/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentPath,
          name
        })
      });
      if (res.ok) {
        const folder = await res.json();
        setAssetSearchQuery('');
        setSelectedAssetFolderPath(folder.path);
        setSelectedAsset(null);
        await fetchAssets();
        setAssetRenamingPath(folder.path);
        addToast(t('workspace.asset_folder_created'), 'success');
      } else {
        addToast(t('common.error'), 'error');
      }
    } catch {
      addToast(t('common.error'), 'error');
    }
  };

  const handleAssetRename = async (node, newName) => {
    if (!node || !newName || newName === node.name) {
      setAssetRenamingPath(null);
      return;
    }

    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/assets/rename`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: node.path, newName })
      });
      if (res.ok) {
        const renamed = await res.json();
        setAssetRenamingPath(null);
        if (selectedAsset?.path === node.path) setSelectedAsset(renamed.type === 'file' ? renamed : null);
        if (selectedAssetFolderPath === node.path) setSelectedAssetFolderPath(renamed.path);
        await fetchAssets();
        addToast(t('common.renamed'), 'success');
      } else {
        addToast(t('common.error'), 'error');
      }
    } catch {
      addToast(t('common.error'), 'error');
    }
  };

  const handleAssetDelete = (node) => {
    if (isVisitor || !node) return;
    setAssetDeletePrompt({ isOpen: true, node });
  };

  const confirmAssetDelete = async () => {
    const node = assetDeletePrompt.node;
    if (isVisitor || !node) return;

    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/assets?path=${encodeURIComponent(node.path)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        if (selectedAsset?.path === node.path || selectedAsset?.path?.startsWith(`${node.path}/`)) {
          setSelectedAsset(null);
        }
        if (selectedAssetFolderPath === node.path || selectedAssetFolderPath?.startsWith(`${node.path}/`)) {
          setSelectedAssetFolderPath('');
        }
        setAssetDeletePrompt({ isOpen: false, node: null });
        await fetchAssets();
        addToast(t('common.deleted'), 'success');
      } else {
        addToast(t('common.error'), 'error');
      }
    } catch {
      addToast(t('common.error'), 'error');
    }
  };

  const openDocumentMovePrompt = (node) => {
    if (isVisitor || !node || node.type !== 'container') return;
    setDocumentMovePrompt({ isOpen: true, node, targetPath: pathParent(node.path) });
  };

  const confirmDocumentMove = async () => {
    const node = documentMovePrompt.node;
    if (isVisitor || !node) return;

    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/documents/move`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourcePath: node.path,
          targetParentPath: documentMovePrompt.targetPath
        })
      });
      if (res.ok) {
        const moved = await res.json();
        setDocumentMovePrompt({ isOpen: false, node: null, targetPath: '' });
        setSearchQuery('');
        if (moved.homePage !== undefined) {
          setWorldData(prev => prev ? { ...prev, homePage: moved.homePage } : prev);
        }
        const nextTree = await fetchTree();
        const movedNode = nextTree ? findNodeByUid(nextTree, moved.uid) : null;
        const isInsideMovedDocument = (item) => item?.path === moved.previousPath || item?.path?.startsWith(`${moved.previousPath}/`);
        if (movedNode && isInsideMovedDocument(selectedContainer)) {
          const nextSelected = selectedContainer.uid === moved.uid
            ? movedNode
            : findNodeByUid(movedNode.children || [], selectedContainer.uid);
          if (nextSelected) setSelectedContainer(nextSelected);
        }
        if (movedNode && isInsideMovedDocument(activeTab)) {
          const nextActiveTab = findNodeByUid(movedNode.children || [], activeTab.uid);
          if (nextActiveTab) setActiveTab(nextActiveTab);
        }
        addToast(t('workspace.document_moved'), 'success');
      } else {
        addToast(t('common.error'), 'error');
      }
    } catch {
      addToast(t('common.error'), 'error');
    }
  };

  const handleAssetDuplicate = async (includeChildren) => {
    const node = assetDuplicatePrompt.node;
    if (isVisitor || !node) return;

    const extension = node.type === 'file' ? getFileExtension(node.name) : '';
    const baseName = node.type === 'file' ? getFileBaseName(node.name) : node.name;
    const copyName = extension
      ? `${baseName} ${t('workspace.copy_suffix')}.${extension}`
      : `${baseName} ${t('workspace.copy_suffix')}`;

    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/assets/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: node.path,
          includeChildren,
          name: copyName
        })
      });
      if (res.ok) {
        const duplicated = await res.json();
        setAssetDuplicatePrompt({ isOpen: false, node: null });
        setAssetSearchQuery('');
        await fetchAssets();
        setAssetRenamingPath(duplicated.path);
        if (duplicated.type === 'file') setSelectedAsset(duplicated);
        if (duplicated.type === 'folder') setSelectedAssetFolderPath(duplicated.path);
        addToast(t('workspace.duplicated'), 'success');
      } else {
        addToast(t('common.error'), 'error');
      }
    } catch {
      addToast(t('common.error'), 'error');
    }
  };

  const openAssetMovePrompt = (node) => {
    if (isVisitor || !node) return;
    const parentPath = pathParent(node.path);
    setAssetMovePrompt({ isOpen: true, node, targetPath: parentPath });
  };

  const confirmAssetMove = async () => {
    const node = assetMovePrompt.node;
    if (isVisitor || !node) return;

    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/assets/move`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourcePath: node.path,
          targetFolderPath: assetMovePrompt.targetPath
        })
      });
      if (res.ok) {
        const moved = await res.json();
        setAssetMovePrompt({ isOpen: false, node: null, targetPath: '' });
        setAssetSearchQuery('');
        await fetchAssets();
        if (moved.type === 'file') {
          setSelectedAsset(moved);
          setSelectedAssetFolderPath(pathParent(moved.path));
        } else {
          setSelectedAsset(null);
          setSelectedAssetFolderPath(moved.path);
        }
        addToast(t('workspace.asset_moved'), 'success');
      } else {
        addToast(t('common.error'), 'error');
      }
    } catch {
      addToast(t('common.error'), 'error');
    }
  };

  const handleAssetUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (files.length === 0) return;

    const uploadPath = assetUploadTargetPathRef.current || selectedAssetFolderPath;
    assetUploadTargetPathRef.current = '';
    setAssetUploading(true);
    try {
      for (const file of files) {
        const prepared = await prepareAssetUpload(file);
        const query = new URLSearchParams({
          path: uploadPath,
          filename: prepared.filename
        });
        const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/assets/upload?${query.toString()}`, {
          method: 'POST',
          headers: { 'Content-Type': prepared.contentType },
          body: prepared.blob
        });

        if (!res.ok) {
          addToast(t('workspace.asset_upload_failed', { name: file.name }), 'error');
          continue;
        }

        const uploaded = await res.json();
        setSelectedAsset(uploaded);
      }

      await fetchAssets();
      addToast(t('workspace.assets_uploaded'), 'success');
    } catch {
      addToast(t('workspace.asset_unsupported'), 'error');
    } finally {
      setAssetUploading(false);
    }
  };

  const openAssetUpload = (targetPath = selectedAssetFolderPath) => {
    assetUploadTargetPathRef.current = targetPath;
    assetFileInputRef.current?.click();
  };

  const commitPageTitleRename = async () => {
    if (!selectedContainer) return;
    if (skipTitleRenameRef.current) {
      skipTitleRenameRef.current = false;
      return;
    }
    const nextName = pageTitleEdit.value.trim();
    setPageTitleEdit({ isEditing: false, value: selectedContainer.name });

    if (!nextName || nextName === selectedContainer.name) return;

    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/documents/rename`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: selectedContainer.path, newName: nextName })
      });
      if (res.ok) {
        setSelectedContainer(prev => prev ? { ...prev, name: nextName, metadata: { ...prev.metadata, name: nextName } } : prev);
        await fetchTree();
        addToast(t('common.renamed'), 'success');
      } else {
        addToast(t('common.error'), 'error');
      }
    } catch {
      addToast(t('common.error'), 'error');
    }
  };

  const handleCoverUpload = async (event) => {
    const [file] = Array.from(event.target.files || []);
    event.target.value = '';
    if (!file || isVisitor || !selectedContainer || !canWriteSelectedContainer || isDocumentLocked) return;

    setCoverUploading(true);
    try {
      const prepared = await prepareAssetUpload(file);
      if (!prepared.contentType.startsWith('image/')) {
        addToast(t('workspace.asset_unsupported'), 'error');
        return;
      }

      const query = new URLSearchParams({
        path: '',
        filename: prepared.filename
      });
      const uploadRes = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/assets/upload?${query.toString()}`, {
        method: 'POST',
        headers: { 'Content-Type': prepared.contentType },
        body: prepared.blob
      });

      if (!uploadRes.ok) {
        addToast(t('workspace.asset_upload_failed', { name: file.name }), 'error');
        return;
      }

      const uploaded = await uploadRes.json();
      const metadataRes = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/documents/metadata`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: selectedContainer.path,
          metadata: {
            coverAssetPath: uploaded.path,
            coverPositionX: 50,
            coverPositionY: 50,
            coverCrop: null,
            coverZoom: 1,
            coverCroppedArea: null
          }
        })
      });

      if (!metadataRes.ok) {
        addToast(t('common.error'), 'error');
        return;
      }

      updateSelectedContainerMetadata({
        coverAssetPath: uploaded.path,
        coverPositionX: 50,
        coverPositionY: 50,
        coverCrop: null,
        coverZoom: 1,
        coverCroppedArea: null
      });
      await fetchTree();
      await fetchAssets();
      addToast(t('common.saved'), 'success');
    } catch {
      addToast(t('workspace.asset_unsupported'), 'error');
    } finally {
      setCoverUploading(false);
    }
  };

  const updateActiveTabMetadata = (metadata) => {
    setActiveTab(prev => prev ? { ...prev, metadata: { ...prev.metadata, ...metadata } } : prev);
  };

  const saveActiveTabMetadata = async (metadata) => {
    if (!activeTab) return false;
    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/documents/metadata`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: activeTab.path, metadata })
      });
      if (!res.ok) {
        addToast(t('common.error'), 'error');
        return false;
      }
      await fetchTree();
      return true;
    } catch {
      addToast(t('common.error'), 'error');
      return false;
    }
  };

  const updateSelectedContainerMetadata = (metadata) => {
    setSelectedContainer(prev => prev ? { ...prev, metadata: { ...prev.metadata, ...metadata } } : prev);
  };

  const saveSelectedContainerMetadata = async (metadata) => {
    if (!selectedContainer) return false;
    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/documents/metadata`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: selectedContainer.path, metadata })
      });
      if (!res.ok) {
        addToast(t('common.error'), 'error');
        return false;
      }
      await fetchTree();
      return true;
    } catch {
      addToast(t('common.error'), 'error');
      return false;
    }
  };

  const shareWorld = async () => {
    if (!worldData?.publicRead) {
      addToast(t('workspace.share_world_public_required'), 'error');
      setWorldActionsMenu(false);
      return;
    }

    const shareUrl = new URL(`/world/${encodeURIComponent(worldId)}`, window.location.origin);
    shareUrl.searchParams.set('view', 'true');
    setWorldActionsMenu(false);

    try {
      await copyTextToClipboard(shareUrl.toString());
      addToast(t('workspace.share_world_copied'), 'success');
    } catch {
      addToast(t('workspace.share_world_failed'), 'error');
    }
  };

  const shareCurrentTab = async () => {
    if (!worldData?.publicRead) {
      addToast(t('workspace.share_world_public_required'), 'error');
      setWorldActionsMenu(false);
      return;
    }
    if (!selectedContainer?.path || !activeTab?.path) return;

    const shareUrl = new URL(`/world/${encodeURIComponent(worldId)}`, window.location.origin);
    shareUrl.searchParams.set('view', 'true');
    shareUrl.searchParams.set('document', selectedContainer.path);
    shareUrl.searchParams.set('tab', activeTab.path);
    setWorldActionsMenu(false);

    try {
      await copyTextToClipboard(shareUrl.toString());
      addToast(t('workspace.share_tab_copied'), 'success');
    } catch {
      addToast(t('workspace.share_world_failed'), 'error');
    }
  };

  const removeCover = async () => {
    if (isVisitor || !selectedContainer || !documentCoverPath || !canWriteSelectedContainer || isDocumentLocked) return;
    const metadata = { coverAssetPath: null, coverPositionX: 50, coverPositionY: 50, coverCrop: null, coverZoom: 1, coverCroppedArea: null };
    updateSelectedContainerMetadata(metadata);
    setCoverReposition({ isEditing: false, x: 50, y: 50, initialX: 50, initialY: 50, isDragging: false, dragStart: null });
    const saved = await saveSelectedContainerMetadata(metadata);
    if (saved) addToast(t('common.saved'), 'success');
  };

  const getCurrentCoverPosition = () => {
    const explicitX = documentCoverMetadata?.coverPositionX;
    const explicitY = documentCoverMetadata?.coverPositionY;
    if (explicitX !== undefined || explicitY !== undefined) {
      return {
        x: clampCoverPosition(explicitX ?? 50),
        y: clampCoverPosition(explicitY ?? 50)
      };
    }

    const area = normalizeCoverArea(documentCoverMetadata?.coverCroppedArea);
    if (!area) return { x: 50, y: clampCoverPosition(documentCoverMetadata?.coverPositionY) };
    const maxX = Math.max(0, 100 - area.width);
    const maxY = Math.max(0, 100 - area.height);
    return {
      x: maxX > 0 ? clampCoverPosition((area.x / maxX) * 100) : 50,
      y: maxY > 0 ? clampCoverPosition((area.y / maxY) * 100) : 50
    };
  };

  const startCoverReposition = () => {
    if (isVisitor || !selectedContainer || !documentCoverPath || !canWriteSelectedContainer || isDocumentLocked) return;
    const position = getCurrentCoverPosition();
    setCoverReposition({
      isEditing: true,
      x: position.x,
      y: position.y,
      initialX: position.x,
      initialY: position.y,
      isDragging: false,
      dragStart: null
    });
  };

  const cancelCoverReposition = useCallback(() => {
    setCoverReposition(prev => ({
      isEditing: false,
      x: prev.initialX,
      y: prev.initialY,
      initialX: prev.initialX,
      initialY: prev.initialY,
      isDragging: false,
      dragStart: null
    }));
  }, []);

  const saveCoverReposition = async () => {
    if (isVisitor || !selectedContainer || !documentCoverPath || !canWriteSelectedContainer || isDocumentLocked) return;
    const metadata = {
      coverPositionX: coverReposition.x,
      coverPositionY: coverReposition.y,
      coverCrop: null,
      coverZoom: 1,
      coverCroppedArea: null
    };
    updateSelectedContainerMetadata(metadata);
    const saved = await saveSelectedContainerMetadata(metadata);
    if (saved) {
      setCoverReposition(prev => ({
        isEditing: false,
        x: prev.x,
        y: prev.y,
        initialX: prev.x,
        initialY: prev.y,
        isDragging: false,
        dragStart: null
      }));
      addToast(t('common.saved'), 'success');
    }
  };

  const beginCoverDrag = (event) => {
    if (!coverReposition.isEditing || !coverRef.current) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setCoverReposition(prev => ({
      ...prev,
      isDragging: true,
      dragStart: {
        clientX: event.clientX,
        clientY: event.clientY,
        x: prev.x,
        y: prev.y
      }
    }));
  };

  const updateCoverDrag = (event) => {
    if (!coverReposition.isEditing || !coverReposition.isDragging || !coverReposition.dragStart || !coverRef.current) return;
    const rect = coverRef.current.getBoundingClientRect();
    const deltaX = rect.width > 0 ? ((event.clientX - coverReposition.dragStart.clientX) / rect.width) * 100 : 0;
    const deltaY = rect.height > 0 ? ((event.clientY - coverReposition.dragStart.clientY) / rect.height) * 100 : 0;
    setCoverReposition(prev => ({
      ...prev,
      x: clampCoverPosition(coverReposition.dragStart.x - deltaX),
      y: clampCoverPosition(coverReposition.dragStart.y - deltaY)
    }));
  };

  const endCoverDrag = (event) => {
    if (!coverReposition.isEditing) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    setCoverReposition(prev => ({ ...prev, isDragging: false, dragStart: null }));
  };

  useEffect(() => {
    if (!coverReposition.isEditing) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') cancelCoverReposition();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [coverReposition.isEditing, cancelCoverReposition]);

  const handleTreeBlankContextMenu = (event) => {
    if (isVisitor) return;
    event.preventDefault();
    setContextMenu({ isOpen: true, x: event.clientX, y: event.clientY, node: null });
  };

  const handleAssetsBlankContextMenu = (event) => {
    if (isVisitor) return;
    event.preventDefault();
    event.stopPropagation();
    setAssetContextMenu({ isOpen: true, x: event.clientX, y: event.clientY, node: null });
  };

  const sidebarTabs = [
    { id: 'wiki', label: t('workspace.sidebar_tab_wiki'), icon: Book },
    { id: 'assets', label: t('workspace.sidebar_tab_assets'), icon: Image }
  ];
  const selectedTabs = getTabsForNode(selectedContainer);
  const visibleActiveTab = tabDraft.isOpen ? null : activeTab;
  const isMapTab = visibleActiveTab?.contentType === 'map';
  const isBoardTab = visibleActiveTab?.contentType === 'board';
  const isCanvasTab = isMapTab || isBoardTab;
  const hasDocumentCoverMetadata = Object.prototype.hasOwnProperty.call(selectedContainer?.metadata || {}, 'coverAssetPath');
  const legacyCoverTab = selectedTabs.find(tab => tab.metadata?.coverAssetPath);
  const documentCoverMetadata = hasDocumentCoverMetadata
    ? selectedContainer?.metadata
    : legacyCoverTab?.metadata || selectedContainer?.metadata;
  const documentCoverPath = documentCoverMetadata?.coverAssetPath || null;
  const isCoverHiddenOnActiveTab = visibleActiveTab?.metadata?.documentCoverHidden ?? isCanvasTab;
  const isWideContentOnActiveTab = visibleActiveTab?.metadata?.wideContent === true;
  const activeCoverPath = visibleActiveTab && !isCoverHiddenOnActiveTab ? documentCoverPath : null;
  const hasInlineCoverPosition = documentCoverMetadata?.coverPositionX !== undefined || documentCoverMetadata?.coverPositionY !== undefined;
  const coverPositionX = coverReposition.isEditing
    ? coverReposition.x
    : hasInlineCoverPosition ? clampCoverPosition(documentCoverMetadata?.coverPositionX) : undefined;
  const coverPositionY = coverReposition.isEditing
    ? coverReposition.y
    : hasInlineCoverPosition ? clampCoverPosition(documentCoverMetadata?.coverPositionY) : undefined;
  const coverBackgroundVars = getCoverBackgroundVars(documentCoverMetadata?.coverCroppedArea, coverPositionX, coverPositionY);
  const coverActionLabel = documentCoverPath ? t('workspace.change_cover') : t('workspace.add_cover');
  const isMarkdownTab = visibleActiveTab?.contentType === 'markdown';
  const canManageMembers = Boolean(worldData?.canManageMembers);
  const canManageDocumentPermissions = hasDocumentAccess(selectedContainer?.metadata?.currentUserAccess, 'admin');
  const isDocumentOwner = Boolean(currentUser?.userId && selectedContainer?.metadata?.ownerUserId === currentUser?.userId);
  const canLockDocument = canManageDocumentPermissions || isDocumentOwner;
  const canWriteSelectedContainer = hasDocumentAccess(selectedContainer?.metadata?.currentUserAccess, 'write');
  const isDocumentLocked = selectedContainer?.metadata?.locked === true;
  const canWriteActiveTab = hasDocumentAccess(activeTab?.metadata?.currentUserAccess, 'write') && !isDocumentLocked;
  const isDocumentUnlocked = !isVisitor && viewMode === 'edit' && canWriteActiveTab;
  const workspaceTheme = getWorldTheme(worldData?.theme || cachedWorldTheme).id;
  const workspaceThemeStyle = getWorldThemeStyle(workspaceTheme, worldData?.customTheme);
  const workspaceShellThemeStyle = getWorldThemeShellStyle(workspaceTheme, worldData?.customTheme);
  const isWorkspaceBooting = !worldDataLoaded || !treeLoaded;
  const saveStatusLabel = saveStatus === 'saving'
    ? t('workspace.save_status_saving')
    : saveStatus === 'offline'
      ? t('workspace.save_status_offline')
      : saveStatus === 'readonly'
        ? t('workspace.save_status_readonly')
    : saveStatus === 'error'
      ? t('workspace.save_status_error')
      : isDirty
        ? t('workspace.save_status_pending')
        : t('workspace.save_status_saved');
  const documentBreadcrumbs = useMemo(
    () => getDocumentBreadcrumb(tree, selectedContainer?.path),
    [selectedContainer?.path, tree]
  );

  const toggleActiveTabCoverVisibility = async () => {
    if (!activeTab || !documentCoverPath || !canWriteActiveTab) return;
    const wasHidden = isCoverHiddenOnActiveTab;
    const metadata = { documentCoverHidden: !wasHidden };
    updateActiveTabMetadata(metadata);
    const saved = await saveActiveTabMetadata(metadata);
    if (!saved) updateActiveTabMetadata({ documentCoverHidden: wasHidden });
  };

  const toggleActiveTabContentWidth = async () => {
    if (!activeTab || isCanvasTab || !canWriteActiveTab) return;
    const wasWide = isWideContentOnActiveTab;
    const metadata = { wideContent: !wasWide };
    updateActiveTabMetadata(metadata);
    const saved = await saveActiveTabMetadata(metadata);
    if (!saved) updateActiveTabMetadata({ wideContent: wasWide });
  };

  if (isWorkspaceBooting) {
    return (
      <WorkspaceBootScreen
        theme={workspaceTheme}
        themeStyle={workspaceThemeStyle}
        title={worldData?.displayName || worldId}
        label={t('workspace.loading_world')}
      />
    );
  }

  const editorControls = !isVisitor ? (
    <div className="editor-cover-controls">
      {visibleActiveTab && activeTabVisitorCount > 0 && (
        <span className="editor-visitor-count" title={t('workspace.visitors_viewing_file')}>
          <Users size={14} />
          <span>
            {activeTabVisitorCount} {activeTabVisitorCount === 1 ? t('workspace.visitor_count_singular') : t('workspace.visitor_count_plural')}
          </span>
        </span>
      )}
      {visibleActiveTab && isMarkdownTab && canWriteActiveTab && (
        <button
          type="button"
          className={`editor-preview-toggle ${viewMode === 'edit' ? 'active' : ''}`}
          onClick={() => setViewMode(prev => (prev === 'edit' ? 'view' : 'edit'))}
          title={viewMode === 'edit' ? t('workspace.markdown_preview_mode') : t('workspace.markdown_edit_mode')}
        >
          {viewMode === 'edit' ? <Eye size={16} /> : <Edit2 size={16} />}
        </button>
      )}
      {selectedContainer && (
        <div className="editor-world-actions" onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            className={`editor-more-toggle ${worldActionsMenu ? 'active' : ''}`}
            onClick={() => setWorldActionsMenu(prev => !prev)}
            title={t('workspace.document_actions')}
            aria-label={t('workspace.document_actions')}
          >
            <MoreVertical size={16} />
          </button>
          {worldActionsMenu && (
            <div className="editor-world-actions-menu glass-panel">
              {canManageDocumentPermissions && (
                <button type="button" onClick={() => { setWorldActionsMenu(false); openDocumentPermissionsPanel(); }}>
                  <Shield size={14} />
                  <span>{t('workspace.document_permissions')}</span>
                </button>
              )}
              {canLockDocument && (
                <button
                  type="button"
                  onClick={() => {
                    setWorldActionsMenu(false);
                    toggleDocumentLock();
                  }}
                >
                  {selectedContainer.metadata?.locked ? <LockOpen size={14} /> : <Lock size={14} />}
                  <span>{selectedContainer.metadata?.locked ? t('workspace.document_unlock') : t('workspace.document_lock')}</span>
                </button>
              )}
              {visibleActiveTab && (
                <button type="button" onClick={shareCurrentTab}>
                  <Copy size={14} />
                  <span>{t('workspace.share_tab')}</span>
                </button>
              )}
              {visibleActiveTab && !isCanvasTab && canWriteActiveTab && (
                <button
                  type="button"
                  onClick={() => {
                    setWorldActionsMenu(false);
                    toggleActiveTabContentWidth();
                  }}
                >
                  {isWideContentOnActiveTab ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                  <span>{isWideContentOnActiveTab ? t('workspace.use_compact_content') : t('workspace.use_wide_content')}</span>
                </button>
              )}
              {canWriteSelectedContainer && !isDocumentLocked && (
                <>
                  {visibleActiveTab && documentCoverPath && (
                    <button
                      type="button"
                      onClick={() => {
                        setWorldActionsMenu(false);
                        toggleActiveTabCoverVisibility();
                      }}
                    >
                      {isCoverHiddenOnActiveTab ? <Eye size={14} /> : <EyeOff size={14} />}
                      <span>{isCoverHiddenOnActiveTab ? t('workspace.show_cover_on_tab') : t('workspace.hide_cover_on_tab')}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setWorldActionsMenu(false);
                      coverFileInputRef.current?.click();
                    }}
                    disabled={coverUploading}
                  >
                    <Image size={14} />
                    <span>{coverUploading ? t('common.uploading') : coverActionLabel}</span>
                  </button>
                  {documentCoverPath && (
                    <>
                      {activeCoverPath && (
                        <button
                          type="button"
                          onClick={() => {
                            setWorldActionsMenu(false);
                            startCoverReposition();
                          }}
                        >
                          <MoveVertical size={14} />
                          <span>{t('workspace.reposition_cover')}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        className="danger"
                        onClick={() => {
                          setWorldActionsMenu(false);
                          removeCover();
                        }}
                      >
                        <Trash2 size={14} />
                        <span>{t('workspace.remove_cover')}</span>
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  ) : null;
  const pageTitleBlock = (
    <div className="editor-page-title-row">
      <button
        type="button"
          className={`editor-page-icon ${selectedContainer && canWriteSelectedContainer ? 'is-editable' : ''}`}
          onClick={openDocumentIconPicker}
          disabled={!selectedContainer || !canWriteSelectedContainer}
          title={selectedContainer && canWriteSelectedContainer ? t('workspace.change_icon') : undefined}
      >
        {React.createElement(getDocumentIcon(selectedContainer?.icon), { size: 20 })}
      </button>
      <div className="editor-title-copy">
        {pageTitleEdit.isEditing ? (
          <input
            className="editor-title-input"
            value={pageTitleEdit.value}
            onChange={event => setPageTitleEdit(prev => ({ ...prev, value: event.target.value }))}
            onBlur={commitPageTitleRename}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.preventDefault();
                event.currentTarget.blur();
              }
              if (event.key === 'Escape') {
                skipTitleRenameRef.current = true;
                setPageTitleEdit({ isEditing: false, value: selectedContainer?.name || '' });
              }
            }}
            autoFocus
            onFocus={event => event.target.select()}
          />
        ) : (
          <h1
            onDoubleClick={() => {
              if (canWriteSelectedContainer) setPageTitleEdit({ isEditing: true, value: selectedContainer.name });
            }}
            title={canWriteSelectedContainer ? t('workspace.rename_title_hint') : undefined}
          >
            {selectedContainer?.name || t('workspace.select_document')}
          </h1>
        )}
      </div>
    </div>
  );
  const tabRow = (
    <WorkspaceTabRow
      tabs={selectedTabs}
      activeTab={tabDraft.isOpen ? null : activeTab}
      renamingTab={renamingTab}
      draftTab={tabDraft.isOpen ? tabDraft : null}
      draftRenameLabel={t('workspace.rename_draft_tab')}
      scrollBackLabel={t('workspace.scroll_tabs_back')}
      scrollForwardLabel={t('workspace.scroll_tabs_forward')}
      canCreate={!tabDraft.isOpen && !isVisitor && canWriteSelectedContainer && !isDocumentLocked}
      createLabel={t('workspace.create_tab')}
      getTabIcon={getTabTypeIcon}
      onSelect={selectTab}
      onContextMenu={(event, tab) => {
        if (isVisitor || !hasDocumentAccess(tab.metadata?.currentUserAccess, 'write')) return;
        event.preventDefault();
        event.stopPropagation();
        setTabContextMenu({ isOpen: true, x: event.clientX, y: event.clientY, node: tab });
      }}
      onRenameChange={value => setRenamingTab(prev => ({ ...prev, value }))}
      onRenameCommit={commitTabRename}
      onRenameCancel={() => setRenamingTab({ path: '', value: '' })}
      onDraftNameChange={name => setTabDraft(prev => ({ ...prev, name }))}
      onDraftRenameCommit={() => firstTabTypeRef.current?.focus()}
      onCreate={openTabDraft}
    />
  );

  return (
    <div className="workspace-container workspace-studio-shell" style={workspaceShellThemeStyle}>
      <WorkspaceTopbar
        worldName={worldData?.displayName || worldId}
        breadcrumbs={documentBreadcrumbs}
        navigatorOpen={isSidebarMobile ? isSidebarDrawerOpen : !isSidebarCollapsed}
        canManageWorld={canManageMembers}
        saveStatus={saveStatus}
        saveStatusLabel={visibleActiveTab && !isVisitor ? saveStatusLabel : ''}
        presenceUsers={worldPresenceUsers}
        navigatorLabel={isSidebarMobile ? t('workspace.expand_sidebar') : isSidebarCollapsed ? t('workspace.expand_sidebar') : t('workspace.collapse_sidebar')}
        backLabel={t('common.back')}
        settingsLabel={t('workspace.world_settings')}
        worldMenuLabel={t('workspace.world_actions')}
        shareLabel={t('workspace.share_world')}
        onToggleNavigator={toggleSidebar}
        onBack={() => setLocation('/')}
        onSelectBreadcrumb={selectContainer}
        onOpenSettings={() => setWorldSettingsOpen(true)}
        onShareWorld={shareWorld}
        languageSwitcher={languageSwitcher}
      />
      <WorkspaceBody>
      <WorkspaceSidebar
        isVisitor={isVisitor}
        tabs={sidebarTabs}
        activeTab={activeSidebarTab}
        tabsLabel={t('workspace.sidebar_tabs_label')}
        onTabChange={setActiveSidebarTab}
        isCollapsed={isSidebarCollapsed}
        isDrawerOpen={isSidebarDrawerOpen}
        isMobile={isSidebarMobile}
        collapseLabel={t('workspace.collapse_sidebar')}
        onClose={closeSidebarDrawer}
      >

        {activeSidebarTab === 'wiki' ? (
          <>
            <nav
              className={`sidebar-tree sidebar-nexus-tree ${tree.length === 0 ? 'is-empty' : ''}`}
              onContextMenu={handleTreeBlankContextMenu}
            >
              {tree.length === 0 ? (
                <div className="sidebar-empty-state">
                  <div className="sidebar-empty-icon">
                    <Castle size={30} />
                  </div>
                  <h2>{t('workspace.empty_sidebar_title')}</h2>
                  <p>{t('workspace.empty_sidebar_hint')}</p>
                  {!isVisitor && (
                    <button className="btn-primary sidebar-empty-cta" onClick={() => createDocumentInline()}>
                      <Plus size={16} /> {t('workspace.create_first_document')}
                    </button>
                  )}
                </div>
              ) : filteredTree.length === 0 ? (
                <div className="sidebar-empty-state compact">
                  <div className="sidebar-empty-icon">
                    <Search size={26} />
                  </div>
                  <h2>{t('workspace.no_search_results')}</h2>
                  <p>{t('workspace.no_search_results_hint')}</p>
                </div>
              ) : (
                <FileTree 
                  nodes={filteredTree} 
                  onFileSelect={selectContainer}
                  selectedFile={selectedContainer}
                  onCreateChild={createDocumentInline}
                  onContextMenu={(e, node) => setContextMenu({ isOpen: true, x: e.clientX, y: e.clientY, node })}
                  renamingPath={renamingPath}
                  onRename={handleRename}
                  onRequestRename={(node) => setRenamingPath(node.path)}
                  onDelete={handleDelete}
                  isSearching={!!searchQuery}
                  isVisitor={isVisitor}
                  worldData={worldData}
                />
              )}
            </nav>

            <div className="sidebar-search-dock">
              <div className="sidebar-context-bar">
                <div className="sidebar-search-bar">
                  <Search size={14} />
                  <input
                    aria-label={t('workspace.search_tree')}
                    placeholder={t('workspace.search_tree')}
                    value={searchQuery}
                    onChange={event => setSearchQuery(event.target.value)}
                    onKeyDown={event => {
                      if (event.key === 'Escape') setSearchQuery('');
                    }}
                  />
                  {searchQuery && (
                    <button type="button" onClick={() => setSearchQuery('')} title={t('common.cancel')} aria-label={t('common.cancel')}>
                      <X size={13} />
                    </button>
                  )}
                </div>
                {!isVisitor && (
                  <button type="button" className="sidebar-context-action" onClick={() => createDocumentInline()} title={t('workspace.create_root_document')} aria-label={t('workspace.create_root_document')}>
                    <Plus size={15} />
                  </button>
                )}
              </div>
            </div>
          </>
        ) : activeSidebarTab === 'assets' ? (
          <div className="sidebar-assets-panel">
            <div
              className="assets-tree-panel"
              onContextMenu={(event) => {
                handleAssetsBlankContextMenu(event);
              }}
              onClick={(event) => {
                if (event.target === event.currentTarget) {
                  setSelectedAssetFolderPath('');
                }
              }}
            >
              {assetLoading ? (
                <div className="sidebar-local-loading">
                  <div className="sidebar-local-loading-lines" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </div>
                  <strong>{t('workspace.loading_assets')}</strong>
                </div>
              ) : assetTree.length === 0 ? (
                <div className="sidebar-empty-state compact">
                  <div className="sidebar-empty-icon">
                    <Image size={26} />
                  </div>
                  <h2>{t('workspace.assets_empty_title')}</h2>
                  <p>{t('workspace.assets_empty_hint')}</p>
                </div>
              ) : filteredAssetTree.length === 0 ? (
                <div className="sidebar-empty-state compact">
                  <div className="sidebar-empty-icon">
                    <Search size={26} />
                  </div>
                  <h2>{t('workspace.no_search_results')}</h2>
                  <p>{t('workspace.no_search_results_hint')}</p>
                </div>
              ) : (
                <AssetTree
                  nodes={filteredAssetTree}
                  selectedAsset={selectedAsset}
                  selectedFolderPath={selectedAssetFolderPath}
                  onSelectAsset={setSelectedAsset}
                  onSelectFolder={setSelectedAssetFolderPath}
                  onCreateFolder={createAssetFolderInline}
                  onContextMenu={(event, node) => setAssetContextMenu({ isOpen: true, x: event.clientX, y: event.clientY, node })}
                  renamingPath={assetRenamingPath}
                  onRename={handleAssetRename}
                  onRequestRename={(node) => setAssetRenamingPath(node.path)}
                  onDelete={handleAssetDelete}
                  isVisitor={isVisitor}
                />
              )}
            </div>

            <div className="assets-bottom-dock">
              <input ref={assetFileInputRef} type="file" multiple accept="image/*,.gif,audio/*" onChange={handleAssetUpload} hidden />
              <div className="sidebar-context-bar">
                <div className="sidebar-search-bar">
                  <Search size={14} />
                  <input
                    aria-label={t('workspace.assets_search')}
                    placeholder={t('workspace.assets_search')}
                    value={assetSearchQuery}
                    onChange={event => setAssetSearchQuery(event.target.value)}
                    onKeyDown={event => {
                      if (event.key === 'Escape') setAssetSearchQuery('');
                    }}
                  />
                  {assetSearchQuery && (
                    <button type="button" onClick={() => setAssetSearchQuery('')} title={t('common.cancel')} aria-label={t('common.cancel')}>
                      <X size={13} />
                    </button>
                  )}
                </div>
                {!isVisitor && (
                  <>
                    <button type="button" className="sidebar-context-action" onClick={() => openAssetUpload()} disabled={assetUploading} title={assetUploading ? t('common.uploading') : t('workspace.assets_upload')} aria-label={assetUploading ? t('common.uploading') : t('workspace.assets_upload')}>
                      <Upload size={15} />
                    </button>
                    <button type="button" className="sidebar-context-action" onClick={() => createAssetFolderInline()} title={t('workspace.assets_new_folder')} aria-label={t('workspace.assets_new_folder')}>
                      <FolderPlus size={15} />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="sidebar-panel-placeholder">
            <div className="sidebar-empty-state compact">
              <div className="sidebar-empty-icon">
                <FileText size={28} />
              </div>
              <h2>{t('workspace.templates_empty_title')}</h2>
              <p>{t('workspace.templates_empty_hint')}</p>
            </div>
          </div>
        )}
      </WorkspaceSidebar>

      {/* Área Principal */}
      <main
        className="workspace-main workspace-editor-main workspace-content-theme"
        data-world-theme={workspaceTheme}
      >
        {selectedContainer ? (
          <div className="document-workspace editor-page-shell">
            <div className="document-content editor-page-scroll">
              <article className={`editor-page ${isCanvasTab ? 'is-map-page' : 'is-wiki-page'} ${isWideContentOnActiveTab ? 'is-wide-content' : ''} ${activeCoverPath ? 'has-cover' : ''} ${coverReposition.isEditing ? 'is-cover-repositioning' : ''}`}>
                {!isVisitor && selectedContainer && canWriteSelectedContainer && !isDocumentLocked && (
                  <input
                    ref={coverFileInputRef}
                    type="file"
                    accept="image/*,.gif"
                    onChange={handleCoverUpload}
                    hidden
                  />
                )}
                {activeCoverPath && (
                  <div
                    ref={coverRef}
                    className={`editor-page-cover has-image ${coverReposition.isEditing ? 'is-repositioning' : ''} ${coverReposition.isDragging ? 'is-dragging' : ''}`}
                    style={{
                      '--editor-cover-image': `url("${getAssetUrl(activeCoverPath)}")`,
                      ...coverBackgroundVars
                    }}
                    onPointerDown={beginCoverDrag}
                    onPointerMove={updateCoverDrag}
                    onPointerUp={endCoverDrag}
                    onPointerCancel={endCoverDrag}
                  >
                    <div className="editor-page-cover-shade" aria-hidden="true" />
                    {coverReposition.isEditing && (
                      <>
                        <div className="editor-cover-reposition-hint">
                          <MoveVertical size={14} />
                          <span>{t('workspace.cover_crop_hint', 'Arraste a imagem para escolher a faixa visível da capa.')}</span>
                        </div>
                        <div className="editor-cover-reposition-actions" onPointerDown={(event) => event.stopPropagation()}>
                          <button type="button" className="btn-secondary" onClick={cancelCoverReposition}>
                            {t('common.cancel')}
                          </button>
                          <button type="button" className="btn-primary" onClick={saveCoverReposition}>
                            {t('common.save')}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
                <DocumentChrome title={pageTitleBlock} tabs={tabRow} controls={editorControls} />

                <section className="editor-page-body document-content-frame">
                  {tabDraft.isOpen ? (
                    <TabTypeSelector
                      ref={firstTabTypeRef}
                      creating={tabDraft.isCreating}
                      onSelect={handleInitializeTabDraft}
                      labels={{
                        title: t('workspace.tab_type_selector_title'),
                        description: t('workspace.tab_type_selector_hint'),
                        stableGroup: t('workspace.tab_type_stable_group'),
                        experimentalGroup: t('workspace.tab_type_experimental_group'),
                        experimental: t('workspace.experimental'),
                        notion: t('workspace.tab_type_notion'),
                        notionHint: t('workspace.tab_type_notion_hint'),
                        tiptap: t('workspace.tab_type_tiptap'),
                        tiptapHint: t('workspace.tab_type_tiptap_hint'),
                        markdown: t('workspace.tab_type_markdown'),
                        markdownHint: t('workspace.tab_type_markdown_hint'),
                        map: t('workspace.tab_type_map'),
                        mapHint: t('workspace.tab_type_map_hint'),
                        board: t('workspace.tab_type_board'),
                        boardHint: t('workspace.tab_type_board_hint'),
                        creating: t('workspace.creating_tab')
                      }}
                    />
                  ) : contentLoading ? (
                    <div className="editor-local-loading">
                      <div className="editor-local-loading-mark" aria-hidden="true" />
                      <strong>{t('workspace.loading_content')}</strong>
                      <span>{t('workspace.loading_content_hint')}</span>
                    </div>
                  ) : activeTab ? (
                    <>
                      {activeTab.contentType === 'map' ? (
                      <MapEditor
                        key={activeTab.path}
                        worldId={worldId}
                        collaborationRoom={(currentUser || isVisitor) && activeTab.uid ? `world:${worldId}:tab:${activeTab.uid}` : ''}
                        currentUser={currentUser}
                        isVisitor={isVisitor}
                        locked={!canWriteActiveTab}
                        initialMapAssetPath={activeTab.metadata?.mapBackgroundAssetPath}
                        themeBackground={workspaceThemeStyle['--bg-color']}
                        themeAccent={workspaceThemeStyle['--accent-color']}
                        documentTree={tree}
                        assetImages={assetImages}
                        getAssetUrl={getAssetUrl}
                        onRequestAssets={fetchAssets}
                        onNavigateToLink={navigateToMapLink}
                        onCollaborationSaveState={handleCollaborationSaveState}
                        labels={{
                          toolbar: t('workspace.map_toolbar'),
                          selectTool: t('workspace.map_tool_select'),
                          panTool: t('workspace.map_tool_pan'),
                          markerTool: t('workspace.map_tool_marker'),
                          textTool: t('workspace.map_tool_text'),
                          imageTool: t('workspace.map_tool_image'),
                          markerDefault: t('workspace.map_marker_default'),
                          editMarker: t('workspace.map_edit_marker'),
                          markerEditorTitle: t('workspace.map_marker_editor_title'),
                          markerLabel: t('workspace.map_marker_label'),
                          markerDescription: t('workspace.map_marker_description'),
                          markerIcon: t('workspace.map_marker_icon'),
                          markerColor: t('workspace.map_marker_color'),
                          markerLinkedDocument: t('workspace.map_marker_linked_document'),
                          markerLinkedTab: t('workspace.map_marker_linked_tab'),
                          markerNoLink: t('workspace.map_marker_no_link'),
                          markerRemoveLink: t('workspace.map_marker_remove_link'),
                          markerDocumentDefaultTab: t('workspace.map_marker_document_default_tab'),
                          linkedDocument: t('workspace.map_marker_linked_document_state'),
                          linkedTab: t('workspace.map_marker_linked_tab_state'),
                          notLinked: t('workspace.map_marker_not_linked_state'),
                          textDefault: t('workspace.map_text_default'),
                          editText: t('workspace.map_edit_text'),
                          gridMode: t('workspace.map_grid_mode'),
                          zoomIn: t('workspace.map_zoom_in'),
                          zoomOut: t('workspace.map_zoom_out'),
                          resetView: t('workspace.map_reset_view'),
                          deleteSelected: t('workspace.map_delete_selected'),
                          changeBaseMap: t('workspace.map_change_base_image'),
                          insertImage: t('workspace.insert_image'),
                          uploadImage: t('workspace.map_upload_image'),
                          uploading: t('common.uploading'),
                          noAssetImages: t('workspace.no_asset_images'),
                          onlineUsers: t('workspace.online_users'),
                          status: {
                            connecting: t('workspace.collaboration_connecting'),
                            connected: t('workspace.collaboration_connected'),
                            readonly: t('workspace.collaboration_readonly'),
                            disconnected: t('workspace.collaboration_disconnected'),
                            error: t('workspace.collaboration_error')
                          }
                        }}
                      />
                      ) : activeTab.contentType === 'board' ? (
                      <BoardEditor
                        key={activeTab.path}
                        worldId={worldId}
                        collaborationRoom={(currentUser || isVisitor) && activeTab.uid ? `world:${worldId}:tab:${activeTab.uid}` : ''}
                        currentUser={currentUser}
                        isVisitor={isVisitor}
                        locked={!canWriteActiveTab}
                        themeBackground={workspaceThemeStyle['--bg-color']}
                        themeAccent={workspaceThemeStyle['--accent-color']}
                        themeGlow={workspaceThemeStyle['--accent-glow']}
                        assetImages={assetImages}
                        assetTree={assetTree}
                        getAssetUrl={getAssetUrl}
                        onRequestAssets={fetchAssets}
                        documentTree={tree}
                        onNavigateToLink={navigateToMapLink}
                        onCollaborationSaveState={handleCollaborationSaveState}
                        labels={{
                          toolbar: t('workspace.board_toolbar'),
                          selectTool: t('workspace.map_tool_select'),
                          panTool: t('workspace.map_tool_pan'),
                          noteTool: t('workspace.board_tool_note'),
                          textTool: t('workspace.map_tool_text'),
                          rectTool: t('workspace.board_tool_rect'),
                          circleTool: t('workspace.board_tool_circle'),
                          imageTool: t('workspace.map_tool_image'),
                          noteDefault: t('workspace.board_note_default'),
                          textDefault: t('workspace.map_text_default'),
                          itemEditorTitle: t('workspace.board_item_editor_title'),
                          itemText: t('workspace.board_item_text'),
                          itemColor: t('workspace.map_marker_color'),
                          shapeBorderColor: t('workspace.board_shape_border_color'),
                          pageLink: t('workspace.page_link'),
                          linkConfigured: t('workspace.board_link_configured'),
                          searchPageLink: t('workspace.board_search_page_link'),
                          noPageLinked: t('workspace.board_no_page_linked'),
                          linkedDocument: t('workspace.map_marker_linked_document'),
                          linkedTab: t('workspace.map_marker_linked_tab'),
                          markerNoLink: t('workspace.map_marker_no_link'),
                          markerDocumentDefaultTab: t('workspace.map_marker_document_default_tab'),
                          markerRemoveLink: t('workspace.map_marker_remove_link'),
                          gridMode: t('workspace.map_grid_mode'),
                          zoomIn: t('workspace.map_zoom_in'),
                          zoomOut: t('workspace.map_zoom_out'),
                          resetView: t('workspace.map_reset_view'),
                          deleteSelected: t('workspace.map_delete_selected'),
                          connectItems: t('workspace.board_connect_items'),
                          insertImage: t('workspace.insert_image'),
                          uploadImage: t('workspace.map_upload_image'),
                          uploading: t('common.uploading'),
                          noAssetImages: t('workspace.no_asset_images'),
                          assetsSearch: t('workspace.assets_search'),
                          assetsRootTarget: t('workspace.assets_root_target'),
                          assetsNewFolder: t('workspace.assets_new_folder'),
                          newAssetFolderName: t('workspace.new_asset_folder_name'),
                          noSearchResults: t('workspace.no_search_results'),
                          onlineUsers: t('workspace.online_users')
                        }}
                      />
                      ) : activeTab.contentType === 'tiptap' ? (
                      <TiptapEditor
                        key={`${activeTab.path}:${canWriteActiveTab ? 'unlocked' : 'locked'}`}
                        content={fileContent}
                        editable={isDocumentUnlocked && !isVisitor}
                        locked={!canWriteActiveTab}
                        collaborationRoom={(currentUser || isVisitor) && activeTab.uid ? `world:${worldId}:tab:${activeTab.uid}` : ''}
                        currentUser={currentUser}
                        isVisitor={isVisitor}
                        onCollaborationSaveState={handleCollaborationSaveState}
                      />
                      ) : activeTab.contentType === 'markdown' ? (
                      <MarkdownHtmlEditor
                        key={`${activeTab.path}:${canWriteActiveTab ? 'unlocked' : 'locked'}`}
                        content={fileContent}
                        editable={isDocumentUnlocked && !isVisitor}
                        locked={!canWriteActiveTab}
                        worldId={worldId}
                        mode={viewMode === 'edit' ? 'edit' : 'preview'}
                        collaborationRoom={(currentUser || isVisitor) && activeTab.uid ? `world:${worldId}:tab:${activeTab.uid}` : ''}
                        currentUser={currentUser}
                        isVisitor={isVisitor}
                        assetImages={assetImages}
                        assetAudios={assetAudios}
                        assetTree={assetTree}
                        getAssetUrl={getAssetUrl}
                        onRequestAssets={fetchAssets}
                        documentTree={tree}
                        onNavigateToPageLink={navigateToPageLink}
                        labels={{
                          sourceLabel: t('workspace.markdown_source_label'),
                          sourcePlaceholder: t('workspace.markdown_source_placeholder'),
                          previewTitle: t('workspace.markdown_preview_title'),
                          insertImage: t('workspace.insert_image'),
                          insertAudio: t('workspace.insert_audio'),
                          noAssetImages: t('workspace.no_asset_images'),
                          noAssetAudios: t('workspace.no_asset_audios'),
                          pageLink: t('workspace.page_link'),
                          insertPageLink: t('workspace.insert_page_link'),
                          pageLinkHint: t('workspace.page_link_hint'),
                          linkedDocument: t('workspace.linked_document'),
                          linkedTab: t('workspace.linked_tab'),
                          defaultDocumentTab: t('workspace.default_document_tab'),
                          insertLink: t('workspace.insert_link'),
                          searchTabsAssetsPlaceholder: t('workspace.search_tabs_assets_placeholder'),
                          noSearchResults: t('workspace.no_search_results'),
                          resultTypeTab: t('workspace.result_type_tab'),
                          resultTypeImage: t('workspace.result_type_image'),
                          resultTypeAudio: t('workspace.result_type_audio'),
                          previewPath: t('workspace.preview_path'),
                          tabTypeNotion: t('workspace.tab_type_notion'),
                          tabTypeTiptap: t('workspace.tab_type_tiptap'),
                          tabTypeMarkdown: t('workspace.tab_type_markdown'),
                          tabTypeMap: t('workspace.tab_type_map'),
                          tabTypeBoard: t('workspace.tab_type_board'),
                          cancel: t('common.cancel')
                        }}
                        onCollaborationSaveState={handleCollaborationSaveState}
                      />
                      ) : (
                      <NotionEditor
                        key={`${activeTab.path}:${canWriteActiveTab ? 'unlocked' : 'locked'}`}
                        contentKey={activeTab.path}
                        content={fileContent}
                        editable={isDocumentUnlocked && !isVisitor}
                        locked={!canWriteActiveTab}
                        worldId={worldId}
                        collaborationRoom={(currentUser || isVisitor) && activeTab.uid ? `world:${worldId}:tab:${activeTab.uid}` : ''}
                        currentUser={currentUser}
                        isVisitor={isVisitor}
                        assetImages={assetImages}
                        assetTree={assetTree}
                        getAssetUrl={getAssetUrl}
                        onRequestAssets={fetchAssets}
                        documentTree={tree}
                        onNavigateToPageLink={navigateToPageLink}
                        labels={{
                          emptyPlaceholder: t('workspace.notion_empty_placeholder'),
                          blockPlaceholder: t('workspace.notion_block_placeholder'),
                          commandGroupText: t('workspace.notion_command_group_text'),
                          commandGroupLists: t('workspace.notion_command_group_lists'),
                          commandGroupStructure: t('workspace.notion_command_group_structure'),
                          commandGroupMedia: t('workspace.notion_command_group_media'),
                          insertImage: t('workspace.insert_image'),
                          noAssetImages: t('workspace.no_asset_images'),
                          pageLink: t('workspace.page_link'),
                          insertPageLink: t('workspace.insert_page_link'),
                          pageLinkHint: t('workspace.page_link_hint'),
                          linkedDocument: t('workspace.linked_document'),
                          linkedTab: t('workspace.linked_tab'),
                          defaultDocumentTab: t('workspace.default_document_tab'),
                          insertLink: t('workspace.insert_link'),
                          searchTabsAssetsPlaceholder: t('workspace.search_tabs_assets_placeholder'),
                          noSearchResults: t('workspace.no_search_results'),
                          resultTypeTab: t('workspace.result_type_tab'),
                          resultTypeImage: t('workspace.result_type_image'),
                          resultTypeAudio: t('workspace.result_type_audio'),
                          previewPath: t('workspace.preview_path'),
                          tabTypeNotion: t('workspace.tab_type_notion'),
                          tabTypeTiptap: t('workspace.tab_type_tiptap'),
                          tabTypeMarkdown: t('workspace.tab_type_markdown'),
                          tabTypeMap: t('workspace.tab_type_map'),
                          tabTypeBoard: t('workspace.tab_type_board'),
                          cancel: t('common.cancel'),
                          collaboration: {
                            connecting: t('workspace.collaboration_connecting'),
                            connected: t('workspace.collaboration_connected'),
                            readonly: t('workspace.collaboration_readonly'),
                            disconnected: t('workspace.collaboration_disconnected'),
                            error: t('workspace.collaboration_error')
                          }
                        }}
                        onVisitorCountChange={setActiveTabVisitorCount}
                        onCollaborationSaveState={handleCollaborationSaveState}
                        onChange={handleWikiContentChange}
                      />
                      )}
                    </>
                  ) : (
                    <div className="editor-placeholder muted">
                      <Book size={48} />
                      <p>Esta página não possui abas de conteúdo.</p>
                      {!isVisitor && canWriteSelectedContainer && !isDocumentLocked && (
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={openTabDraft}
                        >
                          {t('workspace.create_first_tab')}
                        </button>
                      )}
                    </div>
                  )}
                </section>
              </article>
            </div>
          </div>
        ) : (
          <div className="empty-state editor-empty-state">
            <Castle size={80} />
            <h2>{t('workspace.select_document')}</h2>
            <p>{t('workspace.select_document_hint')}</p>
          </div>
        )}
      </main>
      </WorkspaceBody>

      {/* Modals & Overlays */}
      {documentIconPicker.isOpen && (
        <>
          <div className="icon-picker-backdrop" onClick={closeDocumentIconPicker} />
          <div
            className="icon-selector-dropdown glass-panel"
            style={{ top: documentIconPicker.top, left: documentIconPicker.left }}
            onClick={event => event.stopPropagation()}
          >
            <div className="icon-selector-header">
              <span>{t('workspace.change_icon')}</span>
              <strong>{selectedContainer?.name}</strong>
            </div>
            <div className="icon-selector-search">
              <Search size={15} />
              <input
                value={iconSearchQuery}
                onChange={event => setIconSearchQuery(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Escape') {
                    if (iconSearchQuery) setIconSearchQuery('');
                    else closeDocumentIconPicker();
                  }
                }}
                placeholder={t('workspace.icon_search_placeholder')}
                autoFocus
              />
              {iconSearchQuery && (
                <button
                  type="button"
                  onClick={() => setIconSearchQuery('')}
                  title={t('common.clear')}
                >
                  <X size={13} />
                </button>
              )}
            </div>
            <div className="icon-selector-body">
              {filteredDocumentIconCount === 0 ? (
                <div className="icon-selector-empty">
                  <Search size={20} />
                  <strong>{t('workspace.icon_search_empty')}</strong>
                  <span>{t('workspace.icon_search_empty_hint')}</span>
                </div>
              ) : (
                filteredDocumentIconCategories.map(category => (
                  <section key={category.id} className="icon-selector-category">
                    <div className="icon-selector-category-title">
                      <span>{t(category.labelKey)}</span>
                    </div>
                    <div className="icon-selector-grid">
                      {category.icons.map(({ key, icon: Icon }) => (
                        <button
                          key={key}
                          type="button"
                          className={`icon-option ${selectedContainer?.icon === key ? 'active' : ''}`}
                          onClick={() => handleDocumentIconSelect(key)}
                          title={key}
                        >
                          <Icon size={19} />
                        </button>
                      ))}
                    </div>
                  </section>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {duplicatePrompt.isOpen && (
        <div className="duplicate-modal-overlay" onClick={() => setDuplicatePrompt({ isOpen: false, node: null })}>
          <div className="modal-content glass-panel duplicate-modal" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              className="duplicate-modal-close"
              onClick={() => setDuplicatePrompt({ isOpen: false, node: null })}
              title={t('common.cancel')}
            >
              <X size={16} />
            </button>
            <div className="duplicate-modal-header">
              <div className="duplicate-modal-icon">
                <Copy size={20} />
              </div>
              <div>
                <h3>{t('workspace.duplicate_document')}</h3>
                <p>{t('workspace.duplicate_document_hint', { name: duplicatePrompt.node?.name })}</p>
              </div>
            </div>

            <div className="duplicate-scope-grid">
              <button type="button" onClick={() => handleDuplicate(false)}>
                <FileText size={18} />
                <span>{t('workspace.duplicate_single')}</span>
              </button>
              <button type="button" onClick={() => handleDuplicate(true)}>
                <Folder size={18} />
                <span>{t('workspace.duplicate_with_children')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {deletePrompt.isOpen && deletePrompt.node && (
        <DeleteItemDialog
          item={deletePrompt.node}
          icon={React.createElement(
            deletePrompt.node.type === 'tab'
              ? getTabTypeIcon(deletePrompt.node.contentType)
              : getDocumentIcon(deletePrompt.node.icon),
            { size: 14 }
          )}
          deleting={deletePrompt.isDeleting}
          onCancel={closeDeletePrompt}
          onConfirm={confirmDelete}
          labels={deletePrompt.node.type === 'tab' ? {
            title: t('workspace.delete_tab_title'),
            description: t('workspace.delete_tab_hint'),
            warning: t('workspace.delete_tab_warning'),
            close: t('common.close'),
            cancel: t('common.cancel'),
            confirm: t('workspace.delete_tab_confirm'),
            deleting: t('common.deleting')
          } : {
            title: t('workspace.delete_document_title'),
            description: t('workspace.delete_document_compact_hint'),
            warning: t('workspace.delete_document_warning'),
            close: t('common.close'),
            cancel: t('common.cancel'),
            confirm: t('workspace.delete_document_confirm'),
            deleting: t('common.deleting')
          }}
        />
      )}

      {documentMovePrompt.isOpen && (
        <div className="duplicate-modal-overlay" onClick={() => setDocumentMovePrompt({ isOpen: false, node: null, targetPath: '' })}>
          <div className="modal-content glass-panel duplicate-modal" onClick={event => event.stopPropagation()}>
            <button
              type="button"
              className="duplicate-modal-close"
              onClick={() => setDocumentMovePrompt({ isOpen: false, node: null, targetPath: '' })}
              title={t('common.cancel')}
            >
              <X size={16} />
            </button>
            <div className="duplicate-modal-header">
              <div className="duplicate-modal-icon">
                <MoveRight size={20} />
              </div>
              <div>
                <h3>{t('workspace.move_document')}</h3>
                <p>{t('workspace.move_document_hint', { name: documentMovePrompt.node?.name })}</p>
              </div>
            </div>

            <div className="asset-move-target-list">
              {documentMoveTargets.map(target => (
                <button
                  key={target.path || '__root__'}
                  type="button"
                  className={`asset-move-target ${documentMovePrompt.targetPath === target.path ? 'selected' : ''}`}
                  disabled={target.disabled}
                  onClick={() => setDocumentMovePrompt(prev => ({ ...prev, targetPath: target.path }))}
                  style={{ paddingLeft: 12 + target.depth * 16 }}
                >
                  <Folder size={15} />
                  <span>{target.name}</span>
                </button>
              ))}
            </div>

            <div className="delete-modal-actions">
              <button
                type="button"
                className="asset-folder-create-button"
                onClick={confirmDocumentMove}
                disabled={documentMoveTargets.find(target => target.path === documentMovePrompt.targetPath)?.disabled}
              >
                <MoveRight size={16} />
                <span>{t('workspace.move_document_confirm')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {assetDuplicatePrompt.isOpen && (
        <div className="duplicate-modal-overlay" onClick={() => setAssetDuplicatePrompt({ isOpen: false, node: null })}>
          <div className="modal-content glass-panel duplicate-modal" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              className="duplicate-modal-close"
              onClick={() => setAssetDuplicatePrompt({ isOpen: false, node: null })}
              title={t('common.cancel')}
            >
              <X size={16} />
            </button>
            <div className="duplicate-modal-header">
              <div className="duplicate-modal-icon">
                <Copy size={20} />
              </div>
              <div>
                <h3>{t('workspace.duplicate_asset')}</h3>
                <p>{t('workspace.duplicate_asset_hint', { name: assetDuplicatePrompt.node?.name })}</p>
              </div>
            </div>

            {assetDuplicatePrompt.node?.type === 'folder' ? (
              <div className="duplicate-scope-grid">
                <button type="button" onClick={() => handleAssetDuplicate(false)}>
                  <Folder size={18} />
                  <span>{t('workspace.duplicate_asset_single')}</span>
                </button>
                <button type="button" onClick={() => handleAssetDuplicate(true)}>
                  <FolderPlus size={18} />
                  <span>{t('workspace.duplicate_asset_with_children')}</span>
                </button>
              </div>
            ) : (
              <div className="delete-modal-actions">
                <button type="button" className="asset-folder-create-button" onClick={() => handleAssetDuplicate(false)}>
                  <Copy size={16} />
                  <span>{t('workspace.duplicate_asset_single')}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {assetDeletePrompt.isOpen && (
        <div className="duplicate-modal-overlay" onClick={() => setAssetDeletePrompt({ isOpen: false, node: null })}>
          <div className="modal-content glass-panel duplicate-modal delete-modal" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              className="duplicate-modal-close"
              onClick={() => setAssetDeletePrompt({ isOpen: false, node: null })}
              title={t('common.cancel')}
            >
              <X size={16} />
            </button>
            <div className="duplicate-modal-header">
              <div className="duplicate-modal-icon delete-modal-icon">
                <Trash2 size={20} />
              </div>
              <div>
                <h3>{t('workspace.delete_asset')}</h3>
                <p>{t('workspace.delete_asset_hint', { name: assetDeletePrompt.node?.name })}</p>
              </div>
            </div>

            <div className="delete-modal-actions">
              <button type="button" className="delete-confirm-button" onClick={confirmAssetDelete}>
                <Trash2 size={16} />
                <span>{t('workspace.delete_asset_confirm')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {assetMovePrompt.isOpen && (
        <div className="duplicate-modal-overlay" onClick={() => setAssetMovePrompt({ isOpen: false, node: null, targetPath: '' })}>
          <div className="modal-content glass-panel duplicate-modal" onClick={event => event.stopPropagation()}>
            <button
              type="button"
              className="duplicate-modal-close"
              onClick={() => setAssetMovePrompt({ isOpen: false, node: null, targetPath: '' })}
              title={t('common.cancel')}
            >
              <X size={16} />
            </button>
            <div className="duplicate-modal-header">
              <div className="duplicate-modal-icon">
                <MoveRight size={20} />
              </div>
              <div>
                <h3>{t('workspace.move_asset')}</h3>
                <p>{t('workspace.move_asset_hint', { name: assetMovePrompt.node?.name })}</p>
              </div>
            </div>

            <div className="asset-move-target-list">
              {assetMoveTargets.map(target => (
                <button
                  key={target.path || '__root__'}
                  type="button"
                  className={`asset-move-target ${assetMovePrompt.targetPath === target.path ? 'selected' : ''}`}
                  disabled={target.disabled}
                  onClick={() => setAssetMovePrompt(prev => ({ ...prev, targetPath: target.path }))}
                  style={{ paddingLeft: 12 + target.depth * 16 }}
                >
                  <Folder size={15} />
                  <span>{target.name}</span>
                </button>
              ))}
            </div>

            <div className="delete-modal-actions">
              <button
                type="button"
                className="asset-folder-create-button"
                onClick={confirmAssetMove}
                disabled={assetMoveTargets.find(target => target.path === assetMovePrompt.targetPath)?.disabled}
              >
                <MoveRight size={16} />
                <span>{t('workspace.move_asset_confirm')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {worldSettingsOpen && worldData && (
        <WorldSettingsDialog
          mode="edit"
          world={{ ...worldData, id: worldId }}
          currentUser={currentUser}
          onClose={() => setWorldSettingsOpen(false)}
          onSaved={updatedWorld => {
            const nextTheme = getWorldTheme(updatedWorld.theme).id;
            setWorldData(previous => ({
              ...previous,
              ...updatedWorld,
              canManageMembers: previous?.canManageMembers,
              currentUserRole: previous?.currentUserRole
            }));
            setCachedWorldThemeState(nextTheme);
            setCachedWorldTheme(worldId, nextTheme);
            setWorldSettingsOpen(false);
          }}
        />
      )}
      <DocumentPermissionsDialog
        t={t}
        panel={documentPermissionsPanel}
        setPanel={setDocumentPermissionsPanel}
        document={selectedContainer}
        savePermissions={saveDocumentPermissions}
        setUserAccess={setDocumentPermissionUserAccess}
      />

      {contextMenu.isOpen && (
        <div className="context-menu-overlay" onClick={() => setContextMenu(prev => ({ ...prev, isOpen: false }))}>
          <div 
            className="context-menu glass-panel"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={(event) => event.stopPropagation()}
          >
            {contextMenu.node ? (
              <>
                <button
                  onClick={async () => {
                    await copyTextToClipboard(createInternalPageLink({ documentUid: contextMenu.node.uid }));
                    addToast(t('workspace.page_link_copied'), 'success');
                    setContextMenu(prev => ({ ...prev, isOpen: false }));
                  }}
                >
                  <Copy size={14} /> {t('workspace.copy_page_link')}
                </button>
                {hasDocumentAccess(contextMenu.node.metadata?.currentUserAccess, 'write') && (
                  <button onClick={() => { createDocumentInline(contextMenu.node.path); setContextMenu(prev => ({ ...prev, isOpen: false })); }}>
                    <Plus size={14} /> {t('workspace.create_document')}
                  </button>
                )}
                {canManageMembers && isRootContainer(contextMenu.node) && worldData?.homePage !== contextMenu.node.path && (
                  <button onClick={() => { updateHomePage(contextMenu.node); setContextMenu(prev => ({ ...prev, isOpen: false })); }}>
                    <Home size={14} /> {t('workspace.set_home_page')}
                  </button>
                )}
                {canManageMembers && isRootContainer(contextMenu.node) && worldData?.homePage === contextMenu.node.path && (
                  <button onClick={() => { updateHomePage(null); setContextMenu(prev => ({ ...prev, isOpen: false })); }}>
                    <Home size={14} /> {t('workspace.unset_home_page')}
                  </button>
                )}
                {hasDocumentAccess(contextMenu.node.metadata?.currentUserAccess, 'write') && (
                  <>
                    <button onClick={() => { openDuplicatePrompt(contextMenu.node); setContextMenu(prev => ({ ...prev, isOpen: false })); }}>
                      <Copy size={14} /> {t('workspace.duplicate_document')}
                    </button>
                    <button onClick={() => { openDocumentMovePrompt(contextMenu.node); setContextMenu(prev => ({ ...prev, isOpen: false })); }}>
                      <MoveRight size={14} /> {t('workspace.move_document')}
                    </button>
                    <button onClick={() => { setRenamingPath(contextMenu.node.path); setContextMenu(prev => ({ ...prev, isOpen: false })); }}>
                      <Edit2 size={14} /> {t('common.rename')}
                    </button>
                  </>
                )}
                {hasDocumentAccess(contextMenu.node.metadata?.currentUserAccess, 'admin') && (
                  <button className="danger" onClick={() => { handleDelete(contextMenu.node); setContextMenu(prev => ({ ...prev, isOpen: false })); }}>
                    <Trash2 size={14} /> {t('common.delete')}
                  </button>
                )}
              </>
            ) : (
              <button onClick={() => { setContextMenu(prev => ({ ...prev, isOpen: false })); createDocumentInline(); }}>
                <Plus size={14} /> {t('workspace.create_root_document')}
              </button>
            )}
          </div>
        </div>
      )}

      {tabContextMenu.isOpen && (
        <div className="context-menu-overlay" onClick={() => setTabContextMenu(prev => ({ ...prev, isOpen: false }))}>
          <div
            className="context-menu glass-panel"
            style={{ top: tabContextMenu.y, left: tabContextMenu.x }}
            onClick={(event) => event.stopPropagation()}
          >
            {hasDocumentAccess(tabContextMenu.node.metadata?.currentUserAccess, 'write') && (
              <>
                <button
                  onClick={() => {
                    setRenamingTab({ path: tabContextMenu.node.path, value: tabContextMenu.node.name });
                    setTabContextMenu(prev => ({ ...prev, isOpen: false }));
                  }}
                >
                  <Edit2 size={14} /> {t('common.rename')}
                </button>
                <button
                  onClick={() => {
                    duplicateTab(tabContextMenu.node);
                    setTabContextMenu(prev => ({ ...prev, isOpen: false }));
                  }}
                >
                  <Copy size={14} /> {t('workspace.duplicate_tab')}
                </button>
              </>
            )}
            {hasDocumentAccess(tabContextMenu.node.metadata?.currentUserAccess, 'admin') && (
              <button
                className="danger"
                onClick={() => {
                  handleDelete(tabContextMenu.node);
                  setTabContextMenu(prev => ({ ...prev, isOpen: false }));
                }}
              >
                <Trash2 size={14} /> {t('workspace.delete_tab')}
              </button>
            )}
          </div>
        </div>
      )}

      {assetContextMenu.isOpen && (
        <div className="context-menu-overlay" onClick={() => setAssetContextMenu(prev => ({ ...prev, isOpen: false }))}>
          <div
            className="context-menu glass-panel"
            style={{ top: assetContextMenu.y, left: assetContextMenu.x }}
            onClick={(event) => event.stopPropagation()}
          >
            <AssetContextMenu
              node={assetContextMenu.node}
              isVisitor={isVisitor}
              labels={{
                preview: t('workspace.preview_asset'),
                copyReference: t('workspace.copy_asset_reference'),
                uploadHere: t('workspace.assets_upload_here'),
                newFolder: t('workspace.assets_new_folder'),
                duplicate: t('workspace.duplicate_asset'),
                move: t('workspace.move_asset'),
                rename: t('common.rename'),
                delete: t('common.delete')
              }}
              onPreview={node => { setPreviewAsset(node); setAssetContextMenu(prev => ({ ...prev, isOpen: false })); }}
              onCopyReference={async node => {
                await copyTextToClipboard(`{{asset:${node.path}}}`);
                addToast(t('workspace.asset_reference_copied'), 'success');
                setAssetContextMenu(prev => ({ ...prev, isOpen: false }));
              }}
              onUpload={path => { openAssetUpload(path); setAssetContextMenu(prev => ({ ...prev, isOpen: false })); }}
              onCreateFolder={path => { createAssetFolderInline(path); setAssetContextMenu(prev => ({ ...prev, isOpen: false })); }}
              onDuplicate={node => { setAssetDuplicatePrompt({ isOpen: true, node }); setAssetContextMenu(prev => ({ ...prev, isOpen: false })); }}
              onMove={node => { openAssetMovePrompt(node); setAssetContextMenu(prev => ({ ...prev, isOpen: false })); }}
              onRename={node => { setAssetRenamingPath(node.path); setAssetContextMenu(prev => ({ ...prev, isOpen: false })); }}
              onDelete={node => { handleAssetDelete(node); setAssetContextMenu(prev => ({ ...prev, isOpen: false })); }}
            />
          </div>
        </div>
      )}

      <AssetPreviewDialog
        asset={previewAsset}
        source={previewAsset ? getAssetUrl(previewAsset.path) : ''}
        sizeLabel={previewAsset ? formatAssetSize(previewAsset.size) : ''}
        typeLabel={previewAsset?.mediaType === 'audio' ? t('workspace.asset_preview_audio') : t('workspace.asset_preview_image')}
        labels={{
          close: t('workspace.close_asset_preview'),
          path: t('workspace.asset_preview_path'),
          size: t('workspace.asset_preview_size'),
          loading: t('workspace.asset_preview_loading'),
          error: t('workspace.asset_preview_error')
        }}
        onClose={closeAssetPreview}
      />

      {/* Toasts */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast toast-${toast.type} glass-panel`}>
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
