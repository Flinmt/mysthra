const pages = require("./pages");
const relations = require("./relations");
const rendering = require("./rendering");
const wikilinks = require("./wikilinks");

module.exports = {
  ...pages,
  ...relations,
  ...rendering,
  ...wikilinks
};
