# Turns raw/ (tiles + OSM) into the assets the map loads:
#   assets/height.png   16-bit height in R,G  (metres = v/65535*340-40), land + estimated seabed
#   assets/albedo.jpg   satellite colour on land, beach colour bled out under the water
#   assets/mask.png     R land (antialiased)  G sand  B shore distance (0..255 = -1.5km..+1.5km)
#   assets/features.json  buildings, tracks, wrecks, peaks, places ... in world metres
import os, json, math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage as ndi
Image.MAX_IMAGE_PIXELS = None
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
X0, Y0, Z = 7584, 4734, 13
W, H = 1280, 2640                      # crop of the z13 pixel grid (stops north of Stradbroke)
LAT0 = -27.19
MPP = 156543.03392 * math.cos(math.radians(LAT0)) / 2 ** Z
HMIN, HRANGE = -40.0, 340.0

def ll2px(lat, lon):
    n = 2 ** Z
    x = (lon + 180) / 360 * n
    y = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n
    return (x - X0) * 256, (y - Y0) * 256
def px2w(px, py):
    return round((px - W / 2) * MPP, 1), round((py - H / 2) * MPP, 1)
def ll2w(lat, lon):
    return px2w(*ll2px(lat, lon))

osm = json.load(open(f'{R}/raw/osm.json', encoding='utf8'))['elements']

# ---------- land mask from the OSM coastline (supersampled x4) ----------
SS = 4
ways = [e for e in osm if e['type'] == 'way' and e.get('tags', {}).get('natural') == 'coastline']
chains = [(w['nodes'][:], [(g['lat'], g['lon']) for g in w['geometry']]) for w in ways]
merged = True
while merged:
    merged = False
    for i in range(len(chains)):
        for j in range(len(chains)):
            if i != j and chains[i][0][-1] == chains[j][0][0]:
                chains[i] = (chains[i][0] + chains[j][0][1:], chains[i][1] + chains[j][1][1:])
                chains.pop(j); merged = True; break
        if merged: break
mimg = Image.new('L', (W * SS, H * SS), 0)
dr = ImageDraw.Draw(mimg)
for ids, pts in chains:
    pp = [ll2px(a, b) for a, b in pts]
    cy = sum(p[1] for p in pp) / len(pp)
    closed = ids[0] == ids[-1]
    print('coast ring', len(pp), 'closed' if closed else 'open', 'centre y', round(cy))
    if not closed and cy > H: continue           # Stradbroke
    dr.polygon([(x * SS, y * SS) for x, y in pp], fill=255)
land_hi = np.asarray(mimg, np.float32) / 255
# keep only blobs that touch the crop and are not Stradbroke (bottom edge)
lab, n = ndi.label(land_hi > 0.5)
for k in range(1, n + 1):
    ys = np.where(lab == k)[0]
    if ys.max() >= H * SS - 2: land_hi[lab == k] = 0
land = land_hi.reshape(H, SS, W, SS).mean((1, 3))
landb = land > 0.5
print('land frac', landb.mean())

# signed distance to the shore in metres (+ on land)
din = ndi.distance_transform_edt(land_hi > 0.5) / SS * MPP
dout = ndi.distance_transform_edt(land_hi <= 0.5) / SS * MPP
sd_hi = din - dout
sd = sd_hi.reshape(H, SS, W, SS).mean((1, 3))

# ---------- satellite ----------
sat = Image.open(f'{R}/raw/sat.png').crop((0, 0, W * 2, H * 2))
sat_s = np.asarray(sat.resize((W, H), Image.LANCZOS), np.float32) / 255

# ---------- seabed depth estimated from water colour ----------
g = ndi.gaussian_filter(sat_s[..., 1], 1.2)
b = ndi.gaussian_filter(sat_s[..., 2], 1.2)
r = ndi.gaussian_filter(sat_s[..., 0], 1.2)
wat = sd < -60
sig = g * 0.75 + r * 0.6 + b * 0.1               # green+red carry the bottom signal
# wrecks, jetties and moored boats show dark in the imagery and would read as deep holes: patch them from their surroundings
wm = Image.new('L', (W, H), 0); wd = ImageDraw.Draw(wm)
for e_ in osm:
    t_ = e_.get('tags', {})
    if t_.get('historic') == 'wreck' or t_.get('seamark:type') == 'wreck' or t_.get('man_made') == 'pier':
        if e_['type'] == 'node': x_, y_ = ll2px(e_['lat'], e_['lon']); wd.ellipse((x_ - 3, y_ - 3, x_ + 3, y_ + 3), fill=255)
        elif 'geometry' in e_: wd.line([ll2px(g_['lat'], g_['lon']) for g_ in e_['geometry']], fill=255, width=7)
wmk = ndi.binary_dilation(np.asarray(wm) > 0, iterations=2)
ix = ndi.distance_transform_edt(wmk, return_distances=False, return_indices=True)
sig = np.where(wmk, ndi.gaussian_filter(sig, 3)[ix[0], ix[1]], sig)
lo, hi = np.percentile(sig[wat], 3), np.percentile(sig[wat], 99.7)
s = np.clip((sig - lo) / (hi - lo), 0.004, 1)
depth = -np.log(s) * 4.6                         # metres, 0 = bank at the surface
depth = np.clip(depth, 0.25, 32)
depth = ndi.gaussian_filter(depth, 1.0)
big = ndi.gaussian_filter(depth, 9.0)             # deep water: keep only the broad shape (no speckle)
wdeep = np.clip((ndi.gaussian_filter(depth, 4.0) - 5.0) / 7.0, 0, 1)
depth = depth * (1 - wdeep) + big * wdeep
depth = 24 * (1 - np.exp(-depth / 24)) * 1.25      # soft knee
dk = np.clip((ndi.gaussian_filter(depth, 5.0) - 6.0) / 9.0, 0, 1); dk = dk * dk * (3 - 2 * dk)
depth = depth * (1 - dk) + 26.0 * dk               # beyond ~12 m the bottom is out of sight: one even deep floor (hides imagery tile seams)
# open ocean far from any bank keeps getting deeper
shore = np.clip(-sd, 0, None)
depth = np.minimum(depth, 0.12 + shore * 0.045)   # beach slope near the land
print('depth pct', np.percentile(depth[wat], [5, 25, 50, 75, 95]))

# ---------- land height ----------
el = np.load(f'{R}/raw/el.npy')[:H, :W]
el = ndi.gaussian_filter(np.clip(el, 0, None), 0.7)
dl = np.clip(sd, 0, None)
hl = np.maximum(el, np.minimum(0.5 + dl * 0.03, 2.5))
hl = np.minimum(hl, 0.35 + dl * 0.8)
t = np.clip(sd / 12 + 0.5, 0, 1)                 # blend across the shoreline
h = hl * t - depth * (1 - t)
# fade the seabed to an even -20 m at the edges of the data so it meets the open sea cleanly
yy, xx = np.mgrid[0:H, 0:W]
edge = np.minimum(np.minimum(xx, W - 1 - xx), np.minimum(yy, H - 1 - yy)) / 90.0
ef = np.clip(edge, 0, 1); ef = ef * ef * (3 - 2 * ef)
h = np.where(sd < 0, h * ef + (-26.0) * (1 - ef), h)
h = np.clip(h, HMIN + 0.1, HMIN + HRANGE - 0.1)
print('height', h.min(), h.max())
# ---------- albedo: land colour bled outward under the water ----------
sat_f = np.asarray(sat, np.float32) / 255
m2 = np.asarray(Image.fromarray((np.clip(sd / 20 + 0.2, 0, 1) * 255).astype(np.uint8)).resize((W * 2, H * 2), Image.BILINEAR), np.float32) / 255
solid = m2 > 0.9
idx = ndi.distance_transform_edt(~solid, return_distances=False, return_indices=True)
bled = sat_f[idx[0], idx[1]]
bled = ndi.gaussian_filter(bled, (3, 3, 0))
alb = sat_f * m2[..., None] + bled * (1 - m2[..., None])
TW, TH = 1984, 4096
Image.fromarray((alb * 255).astype(np.uint8)).resize((TW, TH), Image.LANCZOS).save(f'{R}/assets/albedo.jpg', quality=90)

# ---------- sand mask ----------
lum = sat_s @ np.array([0.3, 0.55, 0.15], np.float32)
sat_c = sat_s.max(-1) - sat_s.min(-1)
sand = np.clip((lum - 0.56) / 0.2, 0, 1) * np.clip(1.5 - sat_c * 4, 0, 1)
sand = np.maximum(sand, np.clip(1 - dl / 45, 0, 1) * (sd > 0))    # beaches ring the island
sand = ndi.gaussian_filter(sand, 0.6) * (land > 0.02)
# ocean exposure: 1 on the open Pacific side, low inside Moreton Bay
xc = np.full(H, np.nan)
for y in range(H):
    xs = np.where(landb[y])[0]
    if len(xs) > 8: xc[y] = xs.max() - 6
top = np.where(~np.isnan(xc))[0].min(); bot = np.where(~np.isnan(xc))[0].max()
for y in range(top - 1, -1, -1): xc[y] = xc[y + 1] - 1.6
for y in range(bot + 1, H): xc[y] = xc[y - 1] - 0.4
expo = 1 / (1 + np.exp(-(xx - xc[:, None]) / 10.0))
expo = ndi.gaussian_filter(0.22 + 0.78 * expo, 6)
far = np.clip((-sd - 250) / 2500, 0, 1)[..., None] if False else np.clip((-sd - 250) / 2500, 0, 1)
expo = expo * (1 - far) + ndi.gaussian_filter(expo, 70) * far
hv = np.clip(h, 0, None) * 1.7
relief = sum(k_ * (ndi.gaussian_filter(hv, s_) - hv) for s_, k_ in ((1.5, 0.07), (4, 0.035), (11, 0.016), (28, 0.007)))
ao = np.clip(1 - relief, 0.35, 1.6) * (land > 0.3) + (land <= 0.3)
mk = np.zeros((H, W, 4), np.uint8)
mk[..., 3] = np.clip(ao * 128, 40, 255)
mk[..., 0] = np.clip(land * 255, 0, 255)
mk[..., 1] = np.clip(sand * 255, 0, 255)
mk[..., 2] = np.clip(sd / 1500 * 127.5 + 127.5, 0, 255)
v = np.round((h - HMIN) / HRANGE * 65535).astype(np.uint32)
out = np.zeros((H, W, 3), np.uint8)
out[..., 0] = v >> 8; out[..., 1] = v & 255; out[..., 2] = np.clip(expo * 255, 1, 255)
Image.fromarray(out).save(f'{R}/assets/height.png', optimize=True)

Image.fromarray(mk).save(f'{R}/assets/mask.png', optimize=True)
Image.fromarray(mk[..., [3, 1, 3]]).resize((W // 2, H // 2)).save(f'{R}/raw/mask_prev.png')
dp = np.clip(-h / 25, 0, 1)
Image.fromarray((np.stack([np.clip(h / 250, 0, 1), 1 - dp, 1 - dp * 0.5], -1) * 255).astype(np.uint8)).resize((W // 2, H // 2)).save(f'{R}/raw/h_prev.png')

# ---------- features ----------
def inside(px, py, pad=0): return -pad <= px < W + pad and -pad <= py < H + pad
def on_island(px, py):
    xi, yi = int(px), int(py)
    return 0 <= xi < W and 0 <= yi < H and sd[yi, xi] > -400
def geom(e):
    return [ll2px(g_['lat'], g_['lon']) for g_ in e.get('geometry', [])]
def wpts(pp): return [list(px2w(x, y)) for x, y in pp]
def cen(pp): return sum(p[0] for p in pp) / len(pp), sum(p[1] for p in pp) / len(pp)

F = dict(mpp=MPP, w=W, h=H, hmin=HMIN, hrange=HRANGE, buildings=[], roads=[], wrecks=[], peaks=[], places=[], camps=[],
         views=[], lakes=[], seanames=[], sandnames=[], lights=[], piers=[], ferries=[], marks=[], anchor=[], helipads=[],
         runways=[], streams=[], pools=[], misc=[])
names_seen = set()
for e in osm:
    t = e.get('tags', {})
    if not t: continue
    name = t.get('name')
    if e['type'] == 'node':
        px, py = ll2px(e['lat'], e['lon'])
        if not inside(px, py): continue
        w = list(px2w(px, py))
        if t.get('natural') == 'peak': F['peaks'].append(dict(p=w, n=name, e=float(t.get('ele', 0) or 0)))
        elif t.get('place') in ('hamlet', 'village', 'locality') and name not in ('Moreton Island', 'Amity', 'Amity Point'):
            F['places'].append(dict(p=w, n=name, k=t['place']))
        elif t.get('tourism') == 'camp_site': F['camps'].append(dict(p=w, n=name))
        elif t.get('tourism') in ('viewpoint', 'attraction', 'picnic_site') and name: F['views'].append(dict(p=w, n=name, k=t['tourism']))
        elif t.get('seamark:type') == 'wreck' or t.get('historic') == 'wreck':
            F['wrecks'].append(dict(c=w, n=name, k=t.get('seamark:wreck:category', '')))
        elif t.get('historic') in ('ruins', 'fort', 'monument'): F['misc'].append(dict(p=w, n=name, k=t['historic']))
        elif t.get('seamark:type', '').startswith(('beacon', 'buoy')):
            cat = t.get('seamark:beacon_lateral:category') or t.get('seamark:buoy_lateral:category') or ''
            col = t.get('seamark:beacon_lateral:colour') or t.get('seamark:buoy_lateral:colour') or t.get('seamark:buoy_special_purpose:colour') or t.get('seamark:beacon_special_purpose:colour') or t.get('seamark:beacon_cardinal:colour') or ''
            F['marks'].append(dict(p=w, k=t['seamark:type'], c=col or cat, l=t.get('seamark:light:colour', '')))
        elif t.get('seamark:type') == 'anchorage': F['anchor'].append(dict(p=w, n=name))
        elif t.get('aeroway') == 'helipad': F['helipads'].append(dict(p=w))
        elif t.get('man_made') == 'tower': F['misc'].append(dict(p=w, n=name, k='tower'))
        continue
    pp = geom(e) if e['type'] == 'way' else None
    if e['type'] == 'relation':
        # use outer members
        outers = [m for m in e.get('members', []) if m['type'] == 'way' and m.get('role') in ('outer', '') and 'geometry' in m]
        if not outers: continue
        pp = max(([ll2px(g_['lat'], g_['lon']) for g_ in m['geometry']] for m in outers), key=len)
        allp = [ll2px(g_['lat'], g_['lon']) for m in outers for g_ in m['geometry']]
    else:
        allp = pp
    if not pp or len(pp) < 2: continue
    cx, cy = cen(allp)
    if 'building' in t:
        if not inside(cx, cy) or not on_island(cx, cy): continue
        F['buildings'].append(dict(p=wpts(pp[:-1] if pp[0] == pp[-1] else pp), k=t['building'], n=name,
                                   lv=float(t.get('building:levels', 0) or 0), ht=float(t.get('height', 0) or 0),
                                   lh=1 if t.get('man_made') == 'lighthouse' else 0, a=t.get('amenity') or t.get('tourism') or ''))
        if t.get('man_made') == 'lighthouse': F['lights'].append(dict(p=list(px2w(cx, cy)), n=name))
    elif t.get('man_made') == 'lighthouse':
        if inside(cx, cy): F['lights'].append(dict(p=list(px2w(cx, cy)), n=name))
    elif t.get('historic') == 'wreck' or t.get('seamark:type') == 'wreck':
        if inside(cx, cy): F['wrecks'].append(dict(c=list(px2w(cx, cy)), p=wpts(pp), n=name, k=t.get('seamark:wreck:category', '')))
    elif 'highway' in t and e['type'] == 'way':
        hw = t['highway']
        if hw in ('bus_stop', 'turning_circle', 'turning_loop'): continue
        if not any(on_island(x, y) for x, y in pp): continue
        c = 2 if hw in ('path', 'footway', 'steps', 'pedestrian') else (1 if hw == 'track' else 0)
        F['roads'].append(dict(p=wpts(pp), c=c, n=name, s=t.get('surface', '')))
    elif t.get('man_made') == 'pier': F['piers'].append(dict(p=wpts(pp), n=name))
    elif t.get('route') == 'ferry': F['ferries'].append(dict(p=wpts(pp), n=name))
    elif t.get('aeroway') == 'runway' and on_island(cx, cy): F['runways'].append(dict(p=wpts(pp)))
    elif t.get('aeroway') == 'helipad' and on_island(cx, cy): F['helipads'].append(dict(p=list(px2w(cx, cy))))
    elif t.get('waterway') == 'stream' and on_island(cx, cy): F['streams'].append(dict(p=wpts(pp), n=name))
    elif t.get('leisure') == 'swimming_pool' and on_island(cx, cy): F['pools'].append(dict(p=wpts(pp)))
    elif t.get('natural') == 'water' and inside(cx, cy) and on_island(cx, cy) and sd[int(cy), int(cx)] > 0:
        F['lakes'].append(dict(p=wpts(pp), n=name, c=list(px2w(cx, cy))))
    elif t.get('natural') in ('strait', 'sand', 'beach', 'bay') and name and inside(cx, cy, -40):
        key = (name, round(cx / 200), round(cy / 200))
        if name in names_seen: continue
        names_seen.add(name)
        if 'Amity' in name or 'Wanga' in name or 'Flinders' in name: continue
        (F['sandnames'] if (on_island(cx, cy) and sd[int(cy), int(cx)] > 0) else F['seanames']).append(dict(p=list(px2w(cx, cy)), n=name.split(' (')[0], k=t['natural']))
for k, v_ in F.items():
    if isinstance(v_, list): print(k, len(v_))
json.dump(F, open(f'{R}/assets/features.json', 'w'), separators=(',', ':'))
print('features bytes', os.path.getsize(f'{R}/assets/features.json'))
for f in ('height.png', 'albedo.jpg', 'mask.png'): print(f, os.path.getsize(f'{R}/assets/{f}'))
