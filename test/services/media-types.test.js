const assert = require("node:assert/strict");
const test = require("node:test");

const {
  getAssetContentType,
  getAssetKind,
  getMediaCapabilities,
  validateAssetMedia
} = require("../../src/services/mediaTypes");

const samples = [
  ["image.gif", "image/gif", Buffer.from("GIF89a"), "image"],
  ["image.jpg", "image/jpeg", Buffer.from([0xff, 0xd8, 0xff]), "image"],
  ["image.jpeg", "image/jpeg", Buffer.from([0xff, 0xd8, 0xff]), "image"],
  ["image.png", "image/png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "image"],
  ["image.webp", "image/webp", Buffer.from("RIFF0000WEBP"), "image"],
  ["audio.mp3", "audio/mpeg", Buffer.from("ID3"), "audio"],
  ["audio.ogg", "audio/ogg", Buffer.from("OggS"), "audio"],
  ["audio.opus", "audio/ogg", Buffer.concat([Buffer.from("OggS"), Buffer.alloc(24), Buffer.from("OpusHead")]), "audio"],
  ["audio.wav", "audio/wav", Buffer.from("RIFF0000WAVE"), "audio"],
  ["audio.m4a", "audio/mp4", Buffer.from("0000ftyp0000"), "audio"],
  ["audio.mp4", "audio/mp4", Buffer.from("0000ftyp0000"), "audio"]
];

test("media registry validates every supported extension and canonical MIME type", () => {
  for (const [filename, contentType, bytes, mediaType] of samples) {
    assert.equal(validateAssetMedia(filename, contentType, bytes).mediaType, mediaType);
    assert.equal(getAssetContentType(filename), contentType);
    assert.equal(getAssetKind(filename), mediaType);
  }
});

test("media registry rejects unsupported, mismatched, and malformed files", () => {
  assert.throws(
    () => validateAssetMedia("video.webm", "video/webm", Buffer.from("webm")),
    { code: "UNSUPPORTED_MEDIA_TYPE" }
  );
  assert.throws(
    () => validateAssetMedia("image.png", "image/jpeg", samples[3][2]),
    { code: "UNSUPPORTED_MEDIA_TYPE" }
  );
  assert.throws(
    () => validateAssetMedia("image.png", "image/png", Buffer.from("not-png")),
    { code: "UNSUPPORTED_MEDIA_TYPE" }
  );
  assert.throws(
    () => validateAssetMedia("audio.opus", "audio/opus", Buffer.from("OggS without an Opus identification header")),
    { code: "UNSUPPORTED_MEDIA_TYPE" }
  );
});

test("Opus accepts its dedicated MIME type and is served as Ogg audio", () => {
  const bytes = Buffer.concat([Buffer.from("OggS"), Buffer.alloc(24), Buffer.from("OpusHead")]);
  assert.equal(validateAssetMedia("voice.opus", "audio/opus", bytes).mediaType, "audio");
  assert.equal(getAssetContentType("voice.opus"), "audio/ogg");
});

test("media capabilities expose grouped formats and the configured upload limit", () => {
  const capabilities = getMediaCapabilities(1234);
  assert.equal(capabilities.maxUploadBytes, 1234);
  assert.deepEqual(
    capabilities.types.image.map((format) => format.extension).sort(),
    ["gif", "jpeg", "jpg", "png", "webp"]
  );
  assert.deepEqual(
    capabilities.types.audio.map((format) => format.extension).sort(),
    ["m4a", "mp3", "mp4", "ogg", "opus", "wav"]
  );
});
