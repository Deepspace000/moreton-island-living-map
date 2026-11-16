import sys
from PIL import Image, ImageDraw
out, cols, *files = sys.argv[1:]; cols = int(cols)
ims = [Image.open(f) for f in files]; w, h = ims[0].size; rows = (len(ims) + cols - 1) // cols
S = Image.new('RGB', (w * cols, h * rows))
for i, im in enumerate(ims):
    S.paste(im, ((i % cols) * w, (i // cols) * h)); ImageDraw.Draw(S).text(((i % cols) * w + 6, (i // cols) * h + 4), files[i].split('_', 1)[1][:-4], fill=(255, 255, 0))
S.save(out, quality=88)
