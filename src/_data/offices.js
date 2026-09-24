/* The firm's offices, for the map. One copy, read from content/offices.json.

   An office with a public business address is pinned at the building; any
   other office follows the rule for projects and is pinned at the town. "pinned" records what each coordinate actually marks, so nobody later
   mistakes a landmark for a street address. */
const fs = require('node:fs');
const path = require('node:path');

module.exports = () => JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '..', 'content', 'offices.json'), 'utf8'));
