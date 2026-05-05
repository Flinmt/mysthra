const worlds = require("./worlds");
const indexer = require("./indexer");
const assets = require("./assets");
const users = require("./users");
const {
  getFileTree,
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

module.exports = {
  ...worlds,
  ...indexer,
  ...assets,
  ...users,
  getFileTree,
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
