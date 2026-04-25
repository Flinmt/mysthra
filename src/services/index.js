const entities = require("./entities");
const linkResolver = require("./link-resolver");
const pages = require("./pages");
const pageOutput = require("./page-output");
const relations = require("./relations");
const rendering = require("./rendering");
const templates = require("./templates");
const themes = require("./themes");
const wikilinks = require("./wikilinks");
const worlds = require("./worlds");
const media = require("./media");
const {
  getFileTree,
  createDocument,
  readDocument,
  updateDocumentMetadata,
  deleteDocument,
  renameDocument,
  moveDocument
} = require("./tree");

module.exports = {
  ...entities,
  ...linkResolver,
  ...pages,
  ...pageOutput,
  ...relations,
  ...rendering,
  ...templates,
  ...themes,
  ...wikilinks,
  ...worlds,
  getFileTree,
  createDocument,
  readDocument,
  updateDocumentMetadata,
  deleteDocument,
  renameDocument,
  moveDocument,
  ...media
};
