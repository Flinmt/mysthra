const entities = require("./entities");
const pages = require("./pages");
const relations = require("./relations");
const rendering = require("./rendering");
const wikilinks = require("./wikilinks");

module.exports = {
  ...entities,
  ...pages,
  ...relations,
  ...rendering,
  ...wikilinks
};
