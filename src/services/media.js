const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');
const formidable = require('formidable');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const {
  assertPathInsideRoot,
  getWorldPaths,
  validateRelativePath
} = require('../data/filesystem');

ffmpeg.setFfmpegPath(ffmpegPath);

const MAX_FILE_SIZE = Number.MAX_SAFE_INTEGER;

function resolveMediaPath(worldId, relativePath, options = {}) {
  const worldPaths = getWorldPaths(worldId);
  const mediaRoot = worldPaths.media;
  const allowEmpty = options.allowEmpty === true;
  const normalizedPath = typeof relativePath === 'string' ? relativePath.trim() : '';
  const safePath = allowEmpty && normalizedPath === '' ? '' : validateRelativePath(normalizedPath);
  const targetPath = path.resolve(mediaRoot, safePath);

  return {
    mediaRoot,
    worldPaths,
    safePath,
    targetPath: assertPathInsideRoot(mediaRoot, targetPath)
  };
}

async function handleMediaUpload(worldId, request) {
  const worldPaths = getWorldPaths(worldId);
  const tempDir = path.join(worldPaths.worldRoot, 'temp');
  
  try {
    await fs.mkdir(tempDir, { recursive: true });
  } catch (e) {}

  const form = formidable.formidable({
    multiples: false,
    maxFileSize: MAX_FILE_SIZE,
    uploadDir: tempDir,
    keepExtensions: true,
  });

  return new Promise((resolve, reject) => {
    form.parse(request, async (err, fields, files) => {
      if (err) return reject(err);

      const targetSubFolder = fields.folder ? (Array.isArray(fields.folder) ? fields.folder[0] : fields.folder) : "";
      let safeSubFolder;
      let finalMediaDir;
      
      try {
        const resolvedMediaPath = resolveMediaPath(worldId, targetSubFolder, { allowEmpty: true });
        safeSubFolder = resolvedMediaPath.safePath;
        finalMediaDir = resolvedMediaPath.targetPath;
        await fs.mkdir(finalMediaDir, { recursive: true });
      } catch (e) {
        return reject(e);
      }

      const file = files.file ? (Array.isArray(files.file) ? files.file[0] : files.file) : null;
      if (!file) {
        // Cleanup temp folder if no file
        try { await fs.rm(tempDir, { recursive: true, force: true }); } catch(e) {}
        return reject(new Error('No file uploaded'));
      }

      const originalName = file.originalFilename;
      const extension = path.extname(originalName).toLowerCase();
      const isImage = ['.jpg', '.jpeg', '.png', '.webp'].includes(extension);
      const isGif = extension === '.gif';
      const isAudio = ['.mp3', '.wav', '.ogg', '.m4a'].includes(extension);

      let finalFilename = file.newFilename;
      let type = 'file';

      try {
        if (isImage && !isGif) {
          const webpName = `${path.parse(file.newFilename).name}.webp`;
          const webpPath = path.join(finalMediaDir, webpName);
          
          await sharp(file.filepath)
            .webp({ quality: 80 })
            .toFile(webpPath);
          
          await fs.unlink(file.filepath);
          finalFilename = webpName;
          type = 'image';
        } else if (isAudio) {
          const opusName = `${path.parse(file.newFilename).name}.opus`;
          const opusPath = path.join(finalMediaDir, opusName);
          
          await new Promise((resolve, reject) => {
            ffmpeg(file.filepath)
              .toFormat('opus')
              .on('end', resolve)
              .on('error', reject)
              .save(opusPath);
          });
          
          await fs.unlink(file.filepath);
          finalFilename = opusName;
          type = 'audio';
        } else {
          // Move non-converted files to final destination (GIFs and others)
          const finalPath = path.join(finalMediaDir, file.newFilename);
          await fs.rename(file.filepath, finalPath);
          
          if (isGif) type = 'image';
        }

        const relativePath = safeSubFolder ? `${safeSubFolder}/${finalFilename}` : finalFilename;

        resolve({
          url: `/api/worlds/${encodeURIComponent(worldId)}/media/${encodeURIComponent(relativePath)}`,
          filename: finalFilename,
          path: relativePath,
          type
        });
      } catch (error) {
        reject(error);
      }
    });
  });
}

async function getMediaFile(worldId, filename) {
  const { targetPath: filePath } = resolveMediaPath(worldId, filename);
  try {
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) throw new Error('Not a file');
    
    const content = await fs.readFile(filePath);
    const ext = path.extname(filename).toLowerCase();
    
    let contentType = 'application/octet-stream';
    if (ext === '.webp') contentType = 'image/webp';
    if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    if (ext === '.png') contentType = 'image/png';
    if (ext === '.gif') contentType = 'image/gif';
    if (ext === '.opus') contentType = 'audio/opus';
    if (ext === '.mp3') contentType = 'audio/mpeg';
    if (ext === '.wav') contentType = 'audio/wav';
    if (ext === '.ogg') contentType = 'audio/ogg';
    if (ext === '.ogg') contentType = 'audio/ogg';
    
    return { content, contentType };
  } catch (e) {
    throw new Error('File not found');
  }
}

async function listMedia(worldId) {
  const worldPaths = getWorldPaths(worldId);
  const mediaDir = worldPaths.media;
  
  async function walk(dirPath, relativePath = "") {
    let entries;
    try {
      entries = await fs.readdir(dirPath, { withFileTypes: true });
    } catch (e) {
      return [];
    }
    
    const nodes = [];
    for (const entry of entries) {
      if (entry.name.startsWith('thumbnail.')) continue;
      const currentRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
      
      if (entry.isDirectory()) {
        const children = await walk(path.join(dirPath, entry.name), currentRelativePath);
        nodes.push({
          name: entry.name,
          path: currentRelativePath,
          type: "folder",
          children
        });
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        let type = 'file';
        if (['.webp', '.jpg', '.jpeg', '.png', '.gif'].includes(ext)) type = 'image';
        else if (['.mp3', '.wav', '.ogg', '.m4a'].includes(ext)) type = 'audio';
        
        nodes.push({
          name: entry.name,
          path: currentRelativePath,
          url: `/api/worlds/${encodeURIComponent(worldId)}/media/${encodeURIComponent(currentRelativePath)}`,
          type
        });
      }
    }
    
    nodes.sort((a, b) => {
      // Folders first, then by name
      if (a.type === 'folder' && b.type !== 'folder') return -1;
      if (a.type !== 'folder' && b.type === 'folder') return 1;
      return a.name.localeCompare(b.name);
    });
    
    return nodes;
  }

  try {
    await fs.mkdir(mediaDir, { recursive: true });
    return await walk(mediaDir);
  } catch (e) {
    return [];
  }
}

async function createMediaFolder(worldId, folderPath) {
  const { targetPath: fullPath } = resolveMediaPath(worldId, folderPath);
  try {
    await fs.mkdir(fullPath, { recursive: true });
    return { success: true };
  } catch (e) {
    throw new Error('Failed to create folder');
  }
}

async function moveMedia(worldId, sourcePath, targetPath) {
  const { targetPath: fullSourcePath } = resolveMediaPath(worldId, sourcePath);
  const { targetPath: fullTargetPath } = resolveMediaPath(worldId, targetPath);
  
  try {
    // Ensure target parent directory exists
    await fs.mkdir(path.dirname(fullTargetPath), { recursive: true });
    await fs.rename(fullSourcePath, fullTargetPath);
    return { success: true };
  } catch (e) {
    throw new Error('Failed to move media');
  }
}

async function deleteMedia(worldId, mediaPath) {
  const { targetPath: filePath } = resolveMediaPath(worldId, mediaPath);
  try {
    const stats = await fs.stat(filePath);
    if (stats.isDirectory()) {
      await fs.rm(filePath, { recursive: true, force: true });
    } else {
      await fs.unlink(filePath);
    }
    return { success: true };
  } catch (e) {
    throw new Error('Failed to delete media');
  }
}

module.exports = {
  handleMediaUpload,
  getMediaFile,
  listMedia,
  createMediaFolder,
  moveMedia,
  deleteMedia,
  resolveMediaPath
};
