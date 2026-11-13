# Moreton Island · Living Map

A living 3D map of Moreton Island (Mulgumpin), Queensland. Drag to move, right-drag or two fingers to turn, scroll or pinch to zoom.

- Real relief (SRTM elevation) with satellite colour, a dense forest that grows in around the view, sand blows and beaches
- See-through water over the real sandbanks, with swell, foam, sun glitter and cloud reflections
- 550 real building outlines, the 4WD tracks and walking paths, the Tangalooma and Bulwer wrecks, Cape Moreton lighthouse, the resort jetty, beacons and buoys
- Yachts and cruisers at anchor that swing to the wind, yachts under sail, and the island ferries on their charted routes
- Drifting clouds with shadows, sun, moon (true phase) and stars for the real time of day
- Live weather, swell and tide from Open-Meteo drive the sky, wind, sea state, rain and water level

Run locally: serve this folder with any static web server (for example `python -m http.server`) and open it in a browser.

## Data and credits

- Imagery: [Sentinel-2 cloudless](https://s2maps.eu) by EOX IT Services GmbH (contains modified Copernicus Sentinel data 2016), CC BY 4.0
- Map data: © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, ODbL
- Elevation: SRTM via [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/)
- Weather and marine data: [Open-Meteo](https://open-meteo.com)
- Rendering: [three.js](https://threejs.org) (MIT)

The seabed depth is estimated from water colour in the imagery, and relief is exaggerated 1.7 times, so this is a picture of the island, not a navigation chart.

`tools/fetch.py` downloads the source data, `tools/build_data.py` and `tools/gen_textures.py` turn it into the files in `assets/`.
