/* The type, status and region vocabularies. One copy, read from
   content/taxonomy.json — the home-page grid and data/projects.js both need
   it, and they used to disagree about nothing only by luck. */
const fs = require('node:fs');
const path = require('node:path');

module.exports = () => JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '..', 'content', 'taxonomy.json'), 'utf8'));
