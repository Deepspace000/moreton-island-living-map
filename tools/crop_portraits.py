# Studio renders (a subject on a plain graded backdrop) -> glossary portraits: find the subject (what differs from its row's backdrop
# colour), crop around it with a margin to 4:3, save 640x480 JPEG in assets/guide/.  usage: python tools/crop_portraits.py shots/a.jpg:out_name ...
import sys, os, numpy as np
from PIL import Image
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'guide')
def portrait(src, name, W=640, H=480, fill=0.62, thr=38):
    im = Image.open(src).convert('RGB'); a = np.asarray(im).astype(np.int16); h, w, _ = a.shape
    bg = np.median(a, axis=1, keepdims=True)                      # the backdrop only changes from top to bottom
    d = np.abs(a - bg).sum(axis=2) > thr
    from scipy import ndimage as ndi
    d = ndi.binary_closing(d, iterations=9)                        # join the parts of one animal (a bird's legs, a fish's fins)
    lab, n = ndi.label(d)                                          # the biggest piece is the subject; specks are the other animals of the row, far off
    if n > 1:
        sizes = ndi.sum(d, lab, range(1, n + 1)); d = lab == (1 + int(np.argmax(sizes)))
    ys, xs = np.nonzero(d)
    if len(xs) < 30: raise SystemExit('nothing found in ' + src)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()          # (the biggest piece only, so specks do not count)
    cx, cy, bw, bh = (x0 + x1) / 2, (y0 + y1) / 2, x1 - x0, y1 - y0
    if bw > 4 * bh: fill = 0.9          # a snake or a long fish: fill the width
    cw = max(bw / fill, bh / fill * W / H, 140); ch = cw * H / W
    box = (int(round(cx - cw / 2)), int(round(cy - ch / 2)), int(round(cx + cw / 2)), int(round(cy + ch / 2)))
    # keep the box inside the picture: slide it back in (the subject is never at the very edge)
    bx0, by0, bx1, by1 = box
    if bx1 - bx0 > w or by1 - by0 > h: k = min(w / (bx1 - bx0), h / (by1 - by0)); cw2, ch2 = int((bx1 - bx0) * k), int((by1 - by0) * k); bx0, by0 = int(cx - cw2 / 2), int(cy - ch2 / 2); bx1, by1 = bx0 + cw2, by0 + ch2
    dx = -bx0 if bx0 < 0 else (w - bx1 if bx1 > w else 0); dy = -by0 if by0 < 0 else (h - by1 if by1 > h else 0)
    box = (bx0 + dx, by0 + dy, bx1 + dx, by1 + dy)
    out = im.crop(box).resize((W, H), Image.LANCZOS)
    os.makedirs(OUT, exist_ok=True); out.save(os.path.join(OUT, name + '.jpg'), quality=84, optimize=True)
    return box
if __name__ == '__main__':
    for arg in sys.argv[1:]:
        s, n = arg.split(':'); print(n, portrait(s, n))
