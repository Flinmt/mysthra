const entities = require("./entities");
const linkResolver = require("./link-resolver");
const pages = require("./pages");
const relations = require("./relations");
const rendering = require("./rendering");
const themes = require("./themes");
const wikilinks = require("./wikilinks");

module.exports = {
  ...entities,
  ...linkResolver,
  ...pages,
  ...relations,
  ...rendering,
  ...themes,
  ...wikilinks
};
