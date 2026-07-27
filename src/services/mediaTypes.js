const path = require("node:path");

function matchesOggOpus(buffer) {
  return buffer.length >= 36
    && buffer.subarray(0, 4).toString("ascii") === "OggS"
    && buffer.indexOf("OpusHead", 27, "ascii") !== -1;
}

const MEDIA_FORMATS = Object.freeze({
  ".gif": {
    mediaType: "image",
    contentType: "image/gif",
    acceptedContentTypes: ["image/gif"],
    matches: (buffer) => buffer.subarray(0, 6).toString("ascii") === "GIF87a"
      || buffer.subarray(0, 6).toString("ascii") === "GIF89a"
  },
  ".jpg": {
    mediaType: "image",
    contentType: "image/jpeg",
    acceptedContentTypes: ["image/jpeg", "image/jpg"],
    matches: (buffer) => buffer.length >= 3
      && buffer[0] === 0xff
      && buffer[1] === 0xd8
      && buffer[2] === 0xff
  },
  ".jpeg": {
    mediaType: "image",
    contentType: "image/jpeg",
    acceptedContentTypes: ["image/jpeg", "image/jpg"],
    matches: (buffer) => buffer.length >= 3
      && buffer[0] === 0xff
      && buffer[1] === 0xd8
      && buffer[2] === 0xff
  },
  ".m4a": {
    mediaType: "audio",
    contentType: "audio/mp4",
    acceptedContentTypes: ["audio/mp4", "audio/m4a", "audio/x-m4a"],
    matches: (buffer) => buffer.length >= 12 && buffer.subarray(4, 8).toString("ascii") === "ftyp"
  },
  ".mp3": {
    mediaType: "audio",
    contentType: "audio/mpeg",
    acceptedContentTypes: ["audio/mpeg", "audio/mp3"],
    matches: (buffer) => buffer.subarray(0, 3).toString("ascii") === "ID3"
      || (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)
  },
  ".mp4": {
    mediaType: "audio",
    contentType: "audio/mp4",
    acceptedContentTypes: ["audio/mp4", "audio/m4a", "audio/x-m4a"],
    matches: (buffer) => buffer.length >= 12 && buffer.subarray(4, 8).toString("ascii") === "ftyp"
  },
  ".ogg": {
    mediaType: "audio",
    contentType: "audio/ogg",
    acceptedContentTypes: ["audio/ogg", "application/ogg"],
    matches: (buffer) => buffer.subarray(0, 4).toString("ascii") === "OggS"
  },
  ".opus": {
    mediaType: "audio",
    contentType: "audio/ogg",
    acceptedContentTypes: ["audio/ogg", "audio/opus", "application/ogg"],
    matches: matchesOggOpus
  },
  ".png": {
    mediaType: "image",
    contentType: "image/png",
    acceptedContentTypes: ["image/png"],
    matches: (buffer) => buffer.length >= 8
      && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  },
  ".wav": {
    mediaType: "audio",
    contentType: "audio/wav",
    acceptedContentTypes: ["audio/wav", "audio/wave", "audio/x-wav"],
    matches: (buffer) => buffer.length >= 12
      && buffer.subarray(0, 4).toString("ascii") === "RIFF"
      && buffer.subarray(8, 12).toString("ascii") === "WAVE"
  },
  ".webp": {
    mediaType: "image",
    contentType: "image/webp",
    acceptedContentTypes: ["image/webp"],
    matches: (buffer) => buffer.length >= 12
      && buffer.subarray(0, 4).toString("ascii") === "RIFF"
      && buffer.subarray(8, 12).toString("ascii") === "WEBP"
  }
});

function createUnsupportedMediaTypeError(message, value) {
  const error = new Error(message);
  error.code = "UNSUPPORTED_MEDIA_TYPE";
  error.value = value;
  return error;
}

function getAssetFormat(filename) {
  return MEDIA_FORMATS[path.extname(filename || "").toLowerCase()] || null;
}

function getAssetKind(filename) {
  return getAssetFormat(filename)?.mediaType || "file";
}

function getAssetContentType(filename) {
  return getAssetFormat(filename)?.contentType || "application/octet-stream";
}

function normalizeContentType(contentType) {
  return String(contentType || "").split(";", 1)[0].trim().toLowerCase();
}

function validateAssetMedia(filename, contentType, header) {
  const format = getAssetFormat(filename);
  if (!format) {
    throw createUnsupportedMediaTypeError("Unsupported asset file type", filename);
  }

  const normalizedContentType = normalizeContentType(contentType);
  if (!normalizedContentType || !format.acceptedContentTypes.includes(normalizedContentType)) {
    throw createUnsupportedMediaTypeError("Asset Content-Type does not match its file extension", contentType);
  }

  if (!Buffer.isBuffer(header) || !format.matches(header)) {
    throw createUnsupportedMediaTypeError("Asset contents do not match its declared media type", filename);
  }

  return format;
}

function getMediaCapabilities(maxUploadBytes) {
  const types = { image: [], audio: [] };
  for (const [extension, format] of Object.entries(MEDIA_FORMATS)) {
    types[format.mediaType].push({
      extension: extension.slice(1),
      contentType: format.contentType,
      acceptedContentTypes: [...format.acceptedContentTypes]
    });
  }

  return {
    maxUploadBytes,
    types
  };
}

module.exports = {
  MEDIA_FORMATS,
  createUnsupportedMediaTypeError,
  getAssetContentType,
  getAssetFormat,
  getAssetKind,
  getMediaCapabilities,
  normalizeContentType,
  validateAssetMedia
};
