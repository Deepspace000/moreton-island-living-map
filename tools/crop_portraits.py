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
    x0, x1, y0, y1 = np.percentile(xs, 0.1), np.percentile(xs, 99.9), np.percentile(ys, 0.1), np.percentile(ys, 99.9)
    cx, cy, bw, bh = (x0 + x1) / 2, (y0 + y1) / 2, x1 - x0, y1 - y0
    if bw > 4 * bh: fill = 0.9          # a snake or a long fish: fill the width
    cw = max(bw / fill, bh / fill * W / H, 140); ch = cw * H / W
    box = (int(round(cx - cw / 2)), int(round(cy - ch / 2)), int(round(cx + cw / 2)), int(round(cy + ch / 2)))
    pad = Image.new('RGB', (w + 2 * int(cw), h + 2 * int(cw)))
    # the backdrop beyond the frame is its edge colour, so a crop that runs over the edge stays plain
    pad.paste(im, (int(cw), int(cw)))
    for y in range(h + 2 * int(cw)):
        yy = min(max(y - int(cw), 0), h - 1); c = tuple(int(v) for v in a[yy, 0]); pad.paste(c, (0, y, int(cw), y + 1)); pad.paste(c, (int(cw) + w, y, w + 2 * int(cw), y + 1))
    for x in range(int(cw), int(cw) + w):
        pad.paste(tuple(int(v) for v in a[0, x - int(cw)]), (x, 0, x + 1, int(cw))); pad.paste(tuple(int(v) for v in a[h - 1, x - int(cw)]), (x, int(cw) + h, x + 1, h + 2 * int(cw)))
    out = pad.crop((box[0] + int(cw), box[1] + int(cw), box[2] + int(cw), box[3] + int(cw))).resize((W, H), Image.LANCZOS)
    os.makedirs(OUT, exist_ok=True); out.save(os.path.join(OUT, name + '.jpg'), quality=84, optimize=True)
    return box
if __name__ == '__main__':
    for arg in sys.argv[1:]:
        s, n = arg.split(':'); print(n, portrait(s, n))
