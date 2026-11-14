# Queensland Government open data for the island (State of Queensland, made available for public use):
#   raw/qdem.npy        bare-ground LiDAR terrain + surveyed bathymetry, on the map grid (1920 x 3960)
#   raw/qimg.png        aerial photography mosaic, 3968 x 8184 (about 5.5 m per pixel)
#   tiles/15/x/y.jpg    aerial photography at about 2.1 m per pixel, 512 px tiles, land only
import os, io, math, json, urllib.request, urllib.parse, concurrent.futures as cf
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
Image.MAX_IMAGE_PIXELS = None
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
UA = {'User-Agent': 'map-builder/1.0'}
BASE = 'https://spatial-img.information.qld.gov.au/arcgis/rest/services/'
X0, Y0, Z = 7584, 4734, 13
W13, H13 = 1280, 2640
GW, GH = 1920, 3960
RE = 6378137.0; FULL = 2 * math.pi * RE; RES13 = FULL / 256 / 2 ** Z
xmin = -FULL / 2 + X0 * 256 * RES13; ymax = FULL / 2 - Y0 * 256 * RES13
xmax = xmin + W13 * RES13; ymin = ymax - H13 * RES13

def export(service, w, h, y_top, y_bot, **kw):
    q = {'bbox': f'{xmin},{y_bot},{xmax},{y_top}', 'bboxSR': 3857, 'imageSR': 3857, 'size': f'{w},{h}', 'f': 'image', **kw}
    for i in range(4):
        try:
            return urllib.request.urlopen(urllib.request.Request(BASE + service + '/ImageServer/exportImage?' + urllib.parse.urlencode(q), headers=UA), timeout=300).read()
        except Exception as e:
            err = e
    raise err

if not os.path.exists(f'{ROOT}/raw/qdem.npy'):
    parts = []
    for i in range(2):
        yt = ymax - (ymax - ymin) * i / 2; yb = ymax - (ymax - ymin) * (i + 1) / 2
        d = export('Elevation/QldDem', GW, GH // 2, yt, yb, format='tiff', pixelType='F32', interpolation='RSP_BilinearInterpolation')
        parts.append(np.asarray(Image.open(io.BytesIO(d))).astype(np.float32))
    dem = np.concatenate(parts, 0); np.save(f'{ROOT}/raw/qdem.npy', dem)
    print('dem', dem.shape, dem.min(), dem.max())
dem = np.load(f'{ROOT}/raw/qdem.npy')

if not os.path.exists(f'{ROOT}/raw/qimg.png'):
    IW, N = 3968, 4; IH = 2046 * N
    im = Image.new('RGB', (IW, IH))
    for i in range(N):
        yt = ymax - (ymax - ymin) * i / N; yb = ymax - (ymax - ymin) * (i + 1) / N
        d = export('Basemaps/LatestStateProgram_AllUsers', IW, IH // N, yt, yb, format='png', interpolation='RSP_BilinearInterpolation')
        im.paste(Image.open(io.BytesIO(d)).convert('RGB'), (0, i * (IH // N)))
    im.save(f'{ROOT}/raw/qimg.png'); print('img', im.size)

# detail tiles: z15 addressing, built from four z16 cache tiles each, wherever there is land
land = ndi.binary_dilation(dem > 0.4, iterations=50)
tx0, ty0 = X0 * 4, Y0 * 4
jobs = []
for ty in range(ty0, ty0 + math.ceil(H13 / 64)):
    for tx in range(tx0, tx0 + W13 // 64):
        gx0 = int((tx - tx0) * 64 * GW / W13); gy0 = int((ty - ty0) * 64 * GH / H13)
        if land[gy0:gy0 + 96, gx0:gx0 + 96].any(): jobs.append((tx, ty))
print('detail tiles', len(jobs))
def tile(j):
    tx, ty = j; out = f'{ROOT}/tiles/15/{tx}/{ty}.jpg'
    if os.path.exists(out): return 1
    im = Image.new('RGB', (512, 512))
    for dy in range(2):
        for dx in range(2):
            u = BASE + f'Basemaps/LatestStateProgram_AllUsers/ImageServer/tile/16/{ty * 2 + dy}/{tx * 2 + dx}'
            for i in range(4):
                try:
                    d = urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60).read()
                    im.paste(Image.open(io.BytesIO(d)).convert('RGB'), (dx * 256, dy * 256)); break
                except Exception as e:
                    if i == 3: print('fail', u, e); return 0
    os.makedirs(os.path.dirname(out), exist_ok=True)
    im.save(out, quality=82, optimize=True)
    return 1
with cf.ThreadPoolExecutor(6) as ex: ok = sum(ex.map(tile, jobs))
print('tiles ok', ok)
json.dump(sorted(f'{tx},{ty}' for tx, ty in jobs), open(f'{ROOT}/raw/tilelist.json', 'w'))
tot = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(f'{ROOT}/tiles') for f in fs)
print('tiles MB', round(tot / 1e6, 1))
