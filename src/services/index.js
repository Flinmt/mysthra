const pages = require("./pages");
const rendering = require("./rendering");
const wikilinks = require("./wikilinks");

module.exports = {
  ...pages,
  ...rendering,
  ...wikilinks
};
