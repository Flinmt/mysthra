const worlds = require("./worlds");
const indexer = require("./indexer");
const assets = require("./assets");
const users = require("./users");
const collaboration = require("./collaboration");
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
  duplicateDocument,
  MAX_TABS_PER_DOCUMENT
} = require("./tree");

module.exports = {
  ...worlds,
  ...indexer,
  ...assets,
  ...users,
  ...collaboration,
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
  duplicateDocument,
  MAX_TABS_PER_DOCUMENT
};
