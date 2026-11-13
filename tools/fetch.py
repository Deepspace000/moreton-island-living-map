# Fetches the raw real-world data for the Moreton Island map into raw/.
#   elevation : AWS Terrain Tiles (terrarium), z13
#   imagery   : Sentinel-2 cloudless 2016 by EOX (CC BY 4.0), z14
#   map data  : OpenStreetMap via Overpass (ODbL)
import os, sys, json, math, urllib.request, urllib.parse, concurrent.futures as cf
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'raw')
os.makedirs(ROOT, exist_ok=True)
UA = {'User-Agent': 'map-builder/1.0'}
X0, X1, Y0, Y1 = 7584, 7588, 4734, 4744          # z13 tile range (inclusive)

def get(url, path, tries=4):
    if os.path.exists(path) and os.path.getsize(path) > 200:
        return True
    for i in range(tries):
        try:
            d = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40).read()
            open(path, 'wb').write(d)
            return True
        except Exception as e:
            err = e
    print('FAIL', url, err)
    return False

jobs = []
for x in range(X0, X1 + 1):
    for y in range(Y0, Y1 + 1):
        jobs.append((f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/13/{x}/{y}.png', f'{ROOT}/e_{x}_{y}.png'))
for x in range(X0 * 2, X1 * 2 + 2):
    for y in range(Y0 * 2, Y1 * 2 + 2):
        jobs.append((f'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/GoogleMapsCompatible/14/{y}/{x}.jpg', f'{ROOT}/s_{x}_{y}.jpg'))
with cf.ThreadPoolExecutor(8) as ex:
    ok = list(ex.map(lambda j: get(*j), jobs))
print('tiles', sum(ok), '/', len(jobs))

def lon(x, z): return x / 2 ** z * 360 - 180
def lat(y, z): return math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / 2 ** z))))
bbox = (lat(Y1 + 1, 13), lon(X0, 13), lat(Y0, 13), lon(X1 + 1, 13))
print('bbox', bbox)
osm = f'{ROOT}/osm.json'
if not os.path.exists(osm):
    q = f'[out:json][timeout:120][bbox:{bbox[0]},{bbox[1]},{bbox[2]},{bbox[3]}];(way;node[~"."~"."];relation;);out body geom;'
    for ep in ('https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'):
        try:
            d = urllib.request.urlopen(urllib.request.Request(ep, data=urllib.parse.urlencode({'data': q}).encode(), headers=UA), timeout=180).read()
            json.loads(d)
            open(osm, 'wb').write(d)
            print('osm bytes', len(d))
            break
        except Exception as e:
            print('overpass fail', ep, e)
