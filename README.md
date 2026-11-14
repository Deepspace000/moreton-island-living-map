# Moreton Island · Living Map

A living 3D map of Moreton Island (Mulgumpin), Queensland. Drag to move, right-drag or two fingers to turn, scroll or pinch to zoom.

- Real relief from the Queensland Government laser survey (bare ground), draped with aerial photography; sharp photo tiles stream in near the view
- The real surveyed seabed under see-through water, with chart-style depth lines, swell, foam, sun glitter and cloud reflections
- 550 real building outlines, the 4WD tracks and walking paths, the Tangalooma and Bulwer wrecks, Cape Moreton lighthouse, the resort jetty, beacons and buoys
- Yachts and cruisers at anchor that swing to the wind, yachts under sail, and the island ferries on their charted routes
- Drifting clouds with shadows, sun, moon (true phase) and stars for the real time of day
- Live weather, swell and tide from Open-Meteo, or set your own with sliders (sunshine, cloud cover and type, wind, rain, fog, swell, tide, lightning)
- Walk mode: press Walk (or double-click a spot) to explore on foot with keyboard and mouse, touch or a gamepad. On a touch screen, a finger on the view walks forward for as long as it is down; slide it sideways to steer or far up to run, and put two fingers down to stand still and look around
- The real plants of the island: scribbly gum and bloodwood forest, coastal she-oak (casuarina) and banksia behind the beaches, paperbark on the swampy flats, mangroves at the tide line, pandanus on the foredunes and coconut palms at the resort and villages
- Life: shells, sea stars and driftwood on the sand, 4WDs and their wheel ruts on the beach highways, snorkelers at the wrecks, schools of fish around every wreck, green turtles and stingrays under the water; gulls, crested terns, pelicans and cormorants (afloat by the resort jetty too), whistling and brahminy kites, sea eagles and ospreys, pied oystercatchers; blue tiger, common crow, common brown and grass-blue butterflies, and dragonflies over the low wet country
- Surf: on the open beaches the swell stands up into breakers that roll in to the sand, trailing lines and lace of foam
- Sound (the Sound button): wind and leaves, ocean surf and bay ripples, rain and thunder, cicadas by day, crickets by night, and the calls of local birds, all made in the browser and following where you are, the weather and the hour
- The ground is one smooth surface: a coarse mesh covers the island and finer grids follow the view, so dunes stay rounded up close and trees stand on the ground
- Every panel can be minimised to a small named chip with its – button, and opened again with +
- Download: the Download button (or `?download` added to the address) saves the whole map as one HTML file of about 37 MB that opens on its own, even offline

Run locally: serve this folder with any static web server (for example `python -m http.server`) and open it in a browser.

## Data and credits

- Aerial photography and elevation (LiDAR terrain and bathymetry): © State of Queensland (Department of Natural Resources and Mines, Manufacturing and Regional and Rural Development), from the Queensland spatial imagery services, made available for public use
- Water colour detail: [Sentinel-2 cloudless](https://s2maps.eu) by EOX IT Services GmbH (contains modified Copernicus Sentinel data 2016), CC BY 4.0
- Map data: © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, ODbL
- Weather and marine data: [Open-Meteo](https://open-meteo.com)
- Rendering: [three.js](https://threejs.org) (MIT)

Relief is exaggerated 1.7 times and the seabed comes from a 30 m survey grid refined with water colour, so this is a picture of the island, not a navigation chart.

`tools/fetch.py` and `tools/fetch_qld.py` download the source data, `tools/build_data.py` and `tools/gen_textures.py` turn it into the files in `assets/`.
