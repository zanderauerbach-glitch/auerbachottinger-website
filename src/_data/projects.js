/* Every project, in portfolio order, read from content/projects/*.json.
   These files are the source of truth for the project pages, the home-page
   grid and data/projects.js — the three places a project used to be written
   out by hand and kept in step by memory. */
const fs = require('node:fs');
const path = require('node:path');

module.exports = function () {
  const dir = path.join(__dirname, '..', '..', 'content', 'projects');
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')))
    .sort((a, b) => a.order - b.order);
};
