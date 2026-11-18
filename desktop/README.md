# Moreton Island Living Map: Windows wrapper

The map itself is the web page in the folder above. This folder only wraps it so it can run as a normal Windows program, in its own window, with no browser and no server. Everything but the live weather works offline.

- `npm install` once.
- `npm start` runs the map in a window straight from the folder above, so every change you make shows up.
- `npm run dist` copies the map into `map/` and builds into `dist/`:
  - `Moreton-Island-Living-Map-1.0.0.exe`: the portable program. One file, nothing to install; double-click it.
  - `Moreton-Island-Living-Map-Setup-1.0.0.exe`: the installer (Start menu and desktop shortcuts, an uninstaller).
  - `win-unpacked/`: the program as a plain folder.
- `MORETON_SMOKETEST=1 npm start` opens the map, waits until it is drawn, prints a short report (release, level of detail, graphics chip, errors) and quits. With `MORETON_SMOKE_OUT=<file>` the report is also written to that file, which is how the portable .exe is checked (its launcher prints nothing).

F11 switches full screen on and off, F5 loads the map again. The links in the credits open in the usual browser. Settings (level of detail, resolution, sound, where the panels are) are remembered between runs, in the program's own data folder.

## How it works

- `main.js` serves the map's files through a private `app://map/` address, so script modules, `fetch` and images work exactly as on the web. Nothing outside the map's own folder is served.
- On a laptop with two graphics chips the program asks for the fast one.
- `prepare.js` copies only what the map needs (the page, styles, icons, `src`, `lib`, `assets`, `tiles`): about 29 MB.
- `afterPack.js` gives the .exe the map's icon (`build/icon.ico`) and its name and version. electron-builder's own step for that is switched off, because on Windows it first unpacks signing tools that need a right an ordinary account does not have.

## Things to know

- The programs are not signed, so the first time one is started Windows SmartScreen may say it does not know the publisher: choose "More info", then "Run anyway".
- A built program holds the map as it was when it was built. After changing the map, run `npm run dist` again. (To use a newer map without building: `MORETON_MAP_DIR=<folder of the map>`.)
- The version of the program is the `version` in `package.json`; the map's own release number is shown under its title.
