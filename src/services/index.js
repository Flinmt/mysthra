const worlds = require("./worlds");
const indexer = require("./indexer");
const assets = require("./assets");
const users = require("./users");
const collaboration = require("./collaboration");
const themePresets = require("./themePresets");
const {
  getFileTree,
  getVisibleFileTree,
  getDocumentAccess,
  assertDocumentAccess,
  hasDocumentAccessLevel,
  createDocument,
  createDocumentPlaceholder,
  readDocument,
  updateDocumentContent,
  updateDocumentMetadata,
  deleteDocument,
  renameDocument,
  moveDocument,
  duplicateDocument
} = require("./tree");
const soundtracks = require("./soundtracks");

module.exports = {
  ...worlds,
  ...indexer,
  ...assets,
  ...users,
  ...collaboration,
  ...themePresets,
  ...soundtracks,
  getFileTree,
  getVisibleFileTree,
  getDocumentAccess,
  assertDocumentAccess,
  hasDocumentAccessLevel,
  createDocument,
  createDocumentPlaceholder,
  readDocument,
  updateDocumentContent,
  updateDocumentMetadata,
  deleteDocument,
  renameDocument,
  moveDocument,
  duplicateDocument
};
