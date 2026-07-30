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
const documentCovers = require("./documentCovers");

module.exports = {
  ...worlds,
  ...indexer,
  ...assets,
  ...users,
  ...collaboration,
  ...themePresets,
  ...soundtracks,
  ...documentCovers,
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
