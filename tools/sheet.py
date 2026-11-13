# contact sheet of review shots: python tools/sheet.py b resort cape ...
import sys, os
from PIL import Image
pre, names = sys.argv[1], sys.argv[2:]
cols = 2 if len(names) > 1 else 1; rows = (len(names) + cols - 1) // cols; W, H = 960, 540
sh = Image.new('RGB', (W * cols, H * rows))
for i, n in enumerate(names):
    sh.paste(Image.open(f'shots/{pre}_{n}.jpg').resize((W, H), Image.LANCZOS), ((i % cols) * W, (i // cols) * H))
sh.save(f'shots/{pre}_sheet.jpg', quality=88)
