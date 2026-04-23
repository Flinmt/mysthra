const entities = require("./entities");
const linkResolver = require("./link-resolver");
const pageOutput = require("./page-output");
const pages = require("./pages");
const relations = require("./relations");
const rendering = require("./rendering");
const templates = require("./templates");
const themes = require("./themes");
const wikilinks = require("./wikilinks");

module.exports = {
  ...entities,
  ...linkResolver,
  ...pageOutput,
  ...pages,
  ...relations,
  ...rendering,
  ...templates,
  ...themes,
  ...wikilinks
};
