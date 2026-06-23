const AUDIO_EXTENSIONS = new Set(['mp3', 'ogg', 'wav', 'm4a', 'mp4']);
const INTERNAL_PAGE_LINK_PREFIX = 'mysthra://document/';

export function getTreeChildren(node) {
  return (node.children || []).filter(child => child.type === 'container');
}

export function getTabsForNode(node) {
  return (node?.children || []).filter(child => child.type === 'tab');
}

export function getFirstOrderedTab(node) {
  return [...getTabsForNode(node)].sort((left, right) => {
    const leftOrder = left.metadata?.order ?? 999;
    const rightOrder = right.metadata?.order ?? 999;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return left.name.localeCompare(right.name);
  })[0] || null;
}

export function isCollaborativeContentType(contentType) {
  return contentType === 'wiki' || contentType === 'map' || contentType === 'markdown' || contentType === 'board';
}

export function isRootContainer(node) {
  return node?.type === 'container' && !String(node.path || '').includes('/');
}

export function orderTreeWithHome(nodes = [], homePagePath = '') {
  if (!homePagePath) return nodes;
  const homeIndex = nodes.findIndex(node => isRootContainer(node) && node.path === homePagePath);
  if (homeIndex <= 0) return nodes;
  const nextNodes = [...nodes];
  const [homeNode] = nextNodes.splice(homeIndex, 1);
  return [homeNode, ...nextNodes];
}

export function findNodeByPath(nodes = [], targetPath = '') {
  for (const node of nodes) {
    if (node.path === targetPath) return node;
    const childMatch = findNodeByPath(node.children || [], targetPath);
    if (childMatch) return childMatch;
  }
  return null;
}

export function findNodeByUid(nodes = [], targetUid = '') {
  for (const node of nodes) {
    if (node.uid === targetUid) return node;
    const childMatch = findNodeByUid(node.children || [], targetUid);
    if (childMatch) return childMatch;
  }
  return null;
}

export function createInternalPageLink({ documentUid = '', tabUid = '' } = {}) {
  const normalizedDocumentUid = String(documentUid || '').trim();
  const normalizedTabUid = String(tabUid || '').trim();
  if (!normalizedDocumentUid) return '';
  const query = normalizedTabUid ? `?tab=${encodeURIComponent(normalizedTabUid)}` : '';
  return `${INTERNAL_PAGE_LINK_PREFIX}${encodeURIComponent(normalizedDocumentUid)}${query}`;
}

export function parseInternalPageLink(href = '') {
  const value = String(href || '').trim();
  if (!value.startsWith(INTERNAL_PAGE_LINK_PREFIX)) return null;
  const [rawDocumentUid, rawQuery = ''] = value.slice(INTERNAL_PAGE_LINK_PREFIX.length).split('?');
  try {
    const documentUid = decodeURIComponent(rawDocumentUid || '').trim();
    if (!documentUid) return null;
    const params = new URLSearchParams(rawQuery);
    return {
      documentUid,
      tabUid: (params.get('tab') || '').trim()
    };
  } catch {
    return null;
  }
}

export function isInternalPageLink(href = '') {
  return Boolean(parseInternalPageLink(href));
}

export function getDocumentLinkOptions(nodes = []) {
  const documents = [];
  const walk = (items, depth = 0) => {
    for (const item of items) {
      if (item.type !== 'container') continue;
      documents.push({ ...item, depth });
      walk(item.children || [], depth + 1);
    }
  };
  walk(nodes);
  return documents;
}

export function getTabsForDocumentUid(nodes = [], documentUid = '') {
  const documentNode = findNodeByUid(nodes, documentUid);
  return getTabsForNode(documentNode);
}

export function findAssetByPath(nodes = [], targetPath = '') {
  for (const node of nodes) {
    if (node.path === targetPath) return node;
    const childMatch = findAssetByPath(node.children || [], targetPath);
    if (childMatch) return childMatch;
  }
  return null;
}

export function getAssetFolders(nodes = []) {
  const folders = [];
  const walk = (items) => {
    for (const item of items) {
      if (item.type !== 'folder') continue;
      folders.push(item);
      walk(item.children || []);
    }
  };
  walk(nodes);
  return folders;
}

export function getDocumentContainers(nodes = []) {
  const containers = [];
  const walk = (items) => {
    for (const item of items) {
      if (item.type !== 'container') continue;
      containers.push(item);
      walk(item.children || []);
    }
  };
  walk(nodes);
  return containers;
}

export function getAssetImages(nodes = []) {
  const images = [];
  const walk = (items) => {
    for (const item of items) {
      if (item.type === 'folder') {
        walk(item.children || []);
        continue;
      }
      if (item.mediaType === 'image') images.push(item);
    }
  };
  walk(nodes);
  return images;
}

export function isInvalidAssetMoveTarget(sourceNode, targetPath) {
  if (!sourceNode || sourceNode.type !== 'folder') return false;
  return targetPath === sourceNode.path || targetPath.startsWith(`${sourceNode.path}/`);
}

export function isInvalidDocumentMoveTarget(sourceNode, targetPath) {
  if (!sourceNode || sourceNode.type !== 'container') return true;
  const currentParent = pathParent(sourceNode.path);
  return (
    targetPath === currentParent ||
    targetPath === sourceNode.path ||
    targetPath.startsWith(`${sourceNode.path}/`)
  );
}

export function getFileExtension(filename = '') {
  return filename.includes('.') ? filename.split('.').pop().toLowerCase() : '';
}

export function getFileBaseName(filename = '') {
  const dotIndex = filename.lastIndexOf('.');
  return dotIndex > 0 ? filename.slice(0, dotIndex) : filename;
}

export function pathParent(assetPath = '') {
  const normalized = String(assetPath || '').replace(/\\/g, '/');
  const index = normalized.lastIndexOf('/');
  return index > 0 ? normalized.slice(0, index) : '';
}

export function formatAssetSize(size = 0) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function clampCoverPosition(value) {
  const position = Number(value);
  if (!Number.isFinite(position)) return 50;
  return Math.min(100, Math.max(0, position));
}

export function normalizeCoverArea(area) {
  if (!area || typeof area !== 'object') return null;
  const x = Number(area.x);
  const y = Number(area.y);
  const width = Number(area.width);
  const height = Number(area.height);
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
  return {
    x: Math.min(100, Math.max(0, x)),
    y: Math.min(100, Math.max(0, y)),
    width: Math.min(100, Math.max(1, width)),
    height: Math.min(100, Math.max(1, height))
  };
}

export function getCoverBackgroundVars(area, fallbackPositionX, fallbackPositionY) {
  const hasExplicitPosition = fallbackPositionX !== undefined || fallbackPositionY !== undefined;
  const positionX = clampCoverPosition(fallbackPositionX ?? 50);
  const positionY = clampCoverPosition(fallbackPositionY ?? 50);
  if (hasExplicitPosition) {
    return {
      '--editor-cover-bg-position': `${positionX}% ${positionY}%`,
      '--editor-cover-bg-size': 'cover'
    };
  }

  const normalized = normalizeCoverArea(area);
  if (!normalized) {
    return {
      '--editor-cover-bg-position': `center ${positionY}%`,
      '--editor-cover-bg-size': 'cover'
    };
  }
  const maxX = Math.max(0, 100 - normalized.width);
  const maxY = Math.max(0, 100 - normalized.height);
  const cropPositionX = maxX > 0 ? (normalized.x / maxX) * 100 : 50;
  const cropPositionY = maxY > 0 ? (normalized.y / maxY) * 100 : 50;
  return {
    '--editor-cover-bg-position': `${Math.min(100, Math.max(0, cropPositionX))}% ${Math.min(100, Math.max(0, cropPositionY))}%`,
    '--editor-cover-bg-size': `${10000 / normalized.width}% ${10000 / normalized.height}%`
  };
}

export function updateTreeNodeMetadata(nodes = [], targetPath = '', metadata = {}) {
  return nodes.map(node => {
    const nextChildren = node.children ? updateTreeNodeMetadata(node.children, targetPath, metadata) : node.children;
    if (node.path !== targetPath) {
      return nextChildren === node.children ? node : { ...node, children: nextChildren };
    }
    return {
      ...node,
      metadata: { ...node.metadata, ...metadata },
      children: nextChildren
    };
  });
}

export async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);
  if (!copied) throw new Error('Copy failed');
}

function convertImageToWebp(file) {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(objectUrl);
        if (!blob) {
          reject(new Error('Could not convert image'));
          return;
        }
        resolve(blob);
      }, 'image/webp', 0.86);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not read image'));
    };
    image.src = objectUrl;
  });
}

export async function prepareAssetUpload(file) {
  const extension = getFileExtension(file.name);
  const isGif = extension === 'gif' || file.type === 'image/gif';

  if (file.type.startsWith('image/') && !isGif) {
    const blob = await convertImageToWebp(file);
    return {
      blob,
      filename: `${getFileBaseName(file.name)}.webp`,
      contentType: 'image/webp'
    };
  }

  if (isGif) {
    return { blob: file, filename: file.name, contentType: file.type || 'image/gif' };
  }

  if (file.type.startsWith('audio/') && AUDIO_EXTENSIONS.has(extension)) {
    return { blob: file, filename: file.name, contentType: file.type || 'application/octet-stream' };
  }

  throw new Error('Unsupported asset type');
}
