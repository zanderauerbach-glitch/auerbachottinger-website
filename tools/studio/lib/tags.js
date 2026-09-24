/* Finder tags.
 *
 * Arlin and Zander mark selects with a coloured tag in Finder. Those tags do
 * not sync through Dropbox — they live in an extended attribute on the file on
 * the machine that set them — so until now the only way they reached the site
 * was somebody screenshotting a Finder window and Claude reading the filenames
 * out of the picture. Caleb's Pond shows what that costs: five red frames in
 * the Drone folder alone that never got starred, because nobody sent a
 * screenshot of that folder.
 *
 * A tool running on the machine can just read them. This does.
 *
 * macOS only, which is the point — it reads what Finder wrote. On anything
 * else it says so and finds nothing rather than pretending.
 */
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const path = require('node:path');

const run = promisify(execFile);

/* What a colour is worth. Red is a select; yellow is a maybe. Anything not
   listed is still recorded, at one star, rather than silently dropped. */
const STARS = {
  red: 5, orange: 4, yellow: 3, green: 3, blue: 2, purple: 2, grey: 1, gray: 1,
};

const supported = () => process.platform === 'darwin';

/* One shell pass over the folder. xattr holds what Finder actually wrote, so
   it does not depend on Spotlight having indexed a Dropbox folder; plutil
   turns the binary plist into JSON we can read. */
/* The `exit 0` at the end is load-bearing. A while loop's exit status is its
   last command's, so when the last file in the folder has no tag — which is
   the normal case — the loop ends on a false test and the whole pipeline
   reports failure despite having printed everything correctly. `if` rather
   than `&&` for the same reason. */
const SCRIPT = `
find "$1" -type f \\( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' \\) -print0 |
while IFS= read -r -d '' f; do
  t=$(xattr -px com.apple.metadata:_kMDItemUserTags "$f" 2>/dev/null \\
      | xxd -r -p 2>/dev/null | plutil -convert json -o - - 2>/dev/null)
  if [ -n "$t" ]; then printf '%s\\t%s\\n' "$f" "$t"; fi
done
exit 0
`;

/* Finder writes a tag as "Red\\n6" — the name, a newline, the colour index. */
function colourOf(tag) {
  return String(tag).split('\n')[0].trim().toLowerCase();
}

function parse(stdout) {
  const out = [];
  for (const line of stdout.split('\n')) {
    const tab = line.indexOf('\t');
    if (tab === -1) continue;
    const file = line.slice(0, tab);
    let tags;
    try { tags = JSON.parse(line.slice(tab + 1)); } catch { continue; }
    if (!Array.isArray(tags) || !tags.length) continue;
    const colours = tags.map(colourOf).filter(Boolean);
    const stars = Math.max(...colours.map((c) => STARS[c] || 1));
    out.push({ file, colours, stars });
  }
  return out;
}

async function read(dir) {
  if (!supported()) {
    return { supported: false, tagged: [], why: `Finder tags are a macOS thing; this is ${process.platform}.` };
  }
  let stdout;
  try {
    ({ stdout } = await run('bash', ['-c', SCRIPT, 'tags', dir], {
      maxBuffer: 1 << 26, timeout: 300000,
    }));
  } catch (e) {
    // Say what went wrong, not what the script was.
    throw new Error(`reading tags under ${dir} failed: ` +
      (e.stderr || e.message).toString().split('\n').filter(Boolean).pop());
  }
  return { supported: true, tagged: parse(stdout) };
}

/* A tagged file's id in the library: <Folder>_<name>, the same key the marks
   already use. */
function idFor(dir, file) {
  const rel = path.relative(dir, file);
  const parts = rel.split(path.sep);
  const name = parts.pop().replace(/\.[^.]+$/, '');
  const folder = (parts.pop() || '').replace(/\s+/g, '-');
  return folder ? `${folder}_${name}` : name;
}

module.exports = { read, parse, idFor, colourOf, STARS, supported, SCRIPT };
