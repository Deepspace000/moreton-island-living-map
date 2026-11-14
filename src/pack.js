// Packs the whole app into one HTML file that runs on its own (no server, works offline):
// the page, the styles, every script module and every image are read from where the app is
// served and written into a single file. Scripts go into an import map as data: URLs; images
// go into a table that small wrappers around fetch() and <img> loading answer from.
const SPEC = /(\bfrom\s*|\bimport\s*)(['"])([^'"\n]+)\2/g;
const text = async (url) => { const r = await fetch(url); if (!r.ok) throw new Error(url + ' ' + r.status); return r.text(); };
const dataURL = (blob) => new Promise((ok, no) => { const f = new FileReader(); f.onload = () => ok(f.result); f.onerror = () => no(f.error); f.readAsDataURL(blob); });
const b64 = (s) => dataURL(new Blob([s])).then(u => u.slice(u.indexOf(',') + 1));

export async function packApp(progress = () => {}) {
  const base = new URL('.', location.href).href, rel = (url) => url.slice(base.length).split('?')[0];
  let html = await text(base + 'index.html');
  const map = JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports;
  // where a module specifier points, as a full URL (through the page's import map for bare names)
  const resolve = (spec, from) => {
    if (spec[0] === '.') return new URL(spec, from).href;
    const key = Object.keys(map).filter(k => spec === k || (k.endsWith('/') && spec.startsWith(k))).sort((a, b) => b.length - a.length)[0];
    return key ? new URL(map[key] + spec.slice(key.length), base).href : null;
  };

  // 1. script modules: follow the imports from the entry script, rename every import to "app/<path>"
  const entry = new URL(html.match(/<script type="module" src="([^"]+)"/)[1], base).href;
  const mods = new Map(), todo = [entry.split('?')[0]], src = [];
  while (todo.length) {
    const url = todo.pop(); if (mods.has(url)) continue;
    const code = (await text(url)).replace(SPEC, (all, pre, q, spec) => {
      const to = resolve(spec, url); if (!to) return all;
      todo.push(to); return pre + q + 'app/' + rel(to) + q;
    });
    mods.set(url, code); src.push(code);
  }
  const imports = {};
  for (const [url, code] of mods) imports['app/' + rel(url)] = 'data:text/javascript;base64,' + await b64(code);

  // 2. files the app downloads while it runs: everything under assets/ that a script names, and the photo tiles
  const files = new Set(src.join('\n').match(/assets\/[\w./-]+\.\w+/g) || []);
  const F = JSON.parse(await text(base + 'assets/features.json'));
  for (const t of F.tiles || []) files.add(`tiles/15/${t.replace(',', '/')}.jpg`);
  const list = [...files], table = [];
  let done = 0;
  const next = async () => {
    while (list.length) {
      const f = list.pop(), r = await fetch(base + f);
      if (r.ok) table.push(JSON.stringify(f) + ':"' + await dataURL(await r.blob()) + '"');
      progress(++done / files.size);
    }
  };
  await Promise.all([next(), next(), next(), next(), next(), next()]);

  // 3. the page itself
  const css = await text(new URL(html.match(/<link rel="stylesheet" href="([^"]+)"/)[1], base).href);
  const icon = html.match(/<link rel="icon"[^>]*href="([^"]+)"/);
  const iconURL = icon ? await dataURL(await (await fetch(base + icon[1])).blob()) : '';
  html = html
    .replace(/<link rel="(manifest|apple-touch-icon)"[^>]*>\n?/g, '')
    .replace(/<link rel="icon"[^>]*>/, () => `<link rel="icon" href="${iconURL}">`)
    .replace(/<link rel="stylesheet"[^>]*>/, () => '<style>\n' + css + '</style>')
    .replace(/<script type="importmap">[\s\S]*?<\/script>/, () => '<script type="importmap">' + JSON.stringify({ imports }) + '</script>\n<!--PACK-->')
    .replace(/<script type="module" src="[^"]+"><\/script>/, () => `<script type="module">import 'app/${rel(entry)}';</script>`);
  const [head, tail] = html.split('<!--PACK-->');
  const parts = [head, '<script>window.PACKED = {', table.join(',\n'), '};\n',
    '{ const P = window.PACKED, f = window.fetch, d = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");\n',
    '  window.fetch = (u, o) => f(typeof u === "string" && P[u] || u, o);\n',
    '  Object.defineProperty(HTMLImageElement.prototype, "src", { ...d, set(v) { d.set.call(this, P[v] || v); } }); }</script>', tail];
  return new Blob(parts, { type: 'text/html' });
}

export async function downloadApp(progress) {
  const blob = await packApp(progress), a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'Moreton-Island-Living-Map.html';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  return blob.size;
}
