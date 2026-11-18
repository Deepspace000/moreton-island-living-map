// Run by electron-builder once the program's folder is put together, before the installer is made from it: gives the .exe the
// map's icon and its name, release and author (what Windows shows in the taskbar, in Explorer and under Properties).
// electron-builder's own step for this is switched off ("signAndEditExecutable": false), because on Windows it first unpacks
// signing tools that need a right an ordinary account does not have.
const path = require('path');
const rcedit = require('rcedit');
exports.default = async function afterPack(ctx) {
  if (ctx.electronPlatformName !== 'win32') return;
  const info = ctx.packager.appInfo, exe = path.join(ctx.appOutDir, info.productFilename + '.exe');
  await rcedit(exe, {
    icon: path.join(__dirname, 'build', 'icon.ico'),
    'file-version': info.version, 'product-version': info.version,
    'version-string': { ProductName: info.productName, FileDescription: info.productName, CompanyName: info.companyName || '', LegalCopyright: info.copyright || '', OriginalFilename: info.productFilename + '.exe', InternalName: info.productFilename },
  });
  console.log('  • icon and details written to', path.basename(exe));
};
