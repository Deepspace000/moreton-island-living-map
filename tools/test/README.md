# Test and render scripts

These are the scripts used to check the map while it was being built. They are not needed to run the map.

## What you need
- Node.js with Playwright (`npm i playwright`, then `npx playwright install chromium`)
- Python 3 with Pillow (`pip install pillow`) for the picture sheets
- The map served on port 8931, from the repository root:

```
python3 -m http.server 8931
```

Run the scripts from a scratch folder, not from inside the repository: they write `.jpg` and `.log` files into the current folder.

## The main ones
| Script | What it does |
|---|---|
| `shot.js` | Renders named views to JPEG. `node shot.js 8931 <prefix> 1 900 560 <view> <view> ...`. Views are defined inside the script (for example `tangaAir`, `jettyPhoto`, `micat`, `blows`, `walkforest`, `kooLow`, `tyre`). `view@0.8` holds the tide at +0.8 m. On Linux without a screen, run it under `xvfb-run -a`. The first view takes several minutes while shaders compile. |
| `sheet.py` | Joins renders into one contact sheet: `python3 sheet.py out.jpg 3 a.jpg b.jpg ...` (3 = columns). |
| `boot.js` | Loads the page without drawing and checks for errors and that touch walking works. |
| `prof.js` | Measures the beach profile, tide edges and distance to the nearest building at several beaches. |
| `routes.js` | Lists the beach driving routes, the vehicle barriers and the bypasses. |
| `tidecars.js` | Simulates driving at high, mid and low tide and reports where the 4WDs are and what the Tides & travel panel says. |
| `uishot.js` | Full-page screenshot with the panels showing. |
| `yardstat.js` | Counts yard items, garden-tree spots and people. |
| `dl.js` | Builds the one-file `Moreton-Island-Living-Map.html`. `open.js` checks that file opens. |
| `townmap.py` | Plots the mapped house outlines and streets of the townships. |

The rest (`jitter.js`, `looktest.js`, `treetest.js`, `drivetest.js`, `boattest.js`, `ridetest.js`, `menutest.js`, `camptest.js`, `pinch.js`, `handland.js`, `spread.js`, `beach.js`, `tideui.js` and others) are one-off checks written for a single feature. They may need small edits to run again.

Several scripts launch Chromium with software rendering flags meant for a cloud machine. On a desktop with a graphics card you can remove the `--use-angle=swiftshader` flags to render faster.
