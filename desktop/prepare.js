// Copies only what the map needs into desktop/map, ready to be packed: the page, the styles, the icons, the scripts, the
// libraries, the data and the photo tiles. The tools, the notes and the one-file download copy stay behind.
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const out = path.join(__dirname, 'map');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const f of ['index.html', 'style.css', 'manifest.webmanifest', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png']) fs.copyFileSync(path.join(root, f), path.join(out, f));
for (const d of ['src', 'lib', 'assets', 'tiles']) fs.cpSync(path.join(root, d), path.join(out, d), { recursive: true });
let n = 0, bytes = 0;
const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else { n++; bytes += fs.statSync(p).size; } } };
walk(out);
const release = (fs.readFileSync(path.join(out, 'index.html'), 'utf8').match(/main\.js\?v=(\d+)/) || [])[1];
console.log(`map release ${release} copied to ${out}: ${n} files, ${(bytes / 1e6).toFixed(1)} MB`);

// update.json: every file with its size and a short hash, plus the release number. The program reads the copy on the web (the
// map's own address, next to index.html) to see whether a newer map exists and which files differ; the same file also sits in
// the built program, as the record of what it holds. It lists exactly what the program needs, nothing else.
const crypto = require('crypto');
const files = {};
const list = (d, base = '') => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const rel = base + e.name; if (e.isDirectory()) list(path.join(d, e.name), rel + '/'); else if (rel !== 'update.json') { const buf = fs.readFileSync(path.join(d, e.name)); files[rel] = [buf.length, crypto.createHash('sha1').update(buf).digest('hex').slice(0, 16)]; } } };
list(out);
const manifest = JSON.stringify({ release: Number(release), files });
fs.writeFileSync(path.join(out, 'update.json'), manifest);
fs.writeFileSync(path.join(root, 'update.json'), manifest);          // publish this one with the web version (commit it with every release)
console.log(`update.json written: release ${release}, ${Object.keys(files).length} files`);
