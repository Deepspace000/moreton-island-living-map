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
