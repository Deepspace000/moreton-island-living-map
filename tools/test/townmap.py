import json, sys, math, os
from PIL import Image, ImageDraw
F = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'assets', 'features.json')))
print({k: (len(v) if hasattr(v,'__len__') else v) for k, v in F.items()})
print('road sample', {k: (v if k != 'p' else len(v)) for k, v in F['roads'][0].items()}, 'classes', sorted(set(r.get('c') for r in F['roads'])))
print('building sample', {k: (v if k != 'p' else len(v)) for k, v in F['buildings'][0].items()})
print('building keys', sorted(set(k for b in F['buildings'] for k in b)))
towns = {}
for pl in F['places']:
    if any(s in (pl.get('n') or '') for s in ['Kooringal', 'Bulwer', 'Cowan', 'Tangalooma']): towns[pl['n']] = pl['p']
print(towns)
def draw(name, c, R, out):
    S = 1600; im = Image.new('RGB', (S, S), (235, 225, 190)); d = ImageDraw.Draw(im)
    X = lambda x: (x - c[0] + R) / (2 * R) * S; Z = lambda z: (z - c[1] + R) / (2 * R) * S
    for r in F['roads']:
        pts = [(X(p[0]), Z(p[1])) for p in r['p']]
        if not any(0 <= x <= S and 0 <= y <= S for x, y in pts): continue
        col = {0: (120, 120, 120), 1: (170, 130, 80), 2: (200, 90, 90), 3: (120, 170, 220)}.get(r.get('c'), (0, 0, 0)); w = {0: 6.4, 1: 4.8, 2: 2.5, 3: 3}.get(r.get('c'), 2) / (2 * R) * S
        d.line(pts, fill=col, width=max(1, int(w)))
    n = 0
    for b in F['buildings']:
        pts = [(X(p[0]), Z(p[1])) for p in b['p']]
        if not any(0 <= x <= S and 0 <= y <= S for x, y in pts): continue
        n += 1; d.polygon(pts, fill=(200, 60, 60) if len(b['p']) == 4 else (60, 60, 200), outline=(0, 0, 0))
    # scale bar 50 m
    d.line([(30, S - 30), (30 + 50 / (2 * R) * S, S - 30)], fill=(0, 0, 0), width=4); d.text((30, S - 55), '50 m   ' + name + '  buildings ' + str(n), fill=(0, 0, 0))
    im.save(out, quality=90)
for name, c in towns.items():
    if 'Kooringal' in name: draw(name, c, 260, 'town_kooringal.jpg')
    if 'Bulwer' in name: draw(name, c, 260, 'town_bulwer.jpg')
    if 'Cowan' in name: draw(name, c, 220, 'town_cowan.jpg')
