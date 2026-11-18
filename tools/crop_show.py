# Crops each test render (taken at 2400x1350 with the subject at the middle) to a fixed window around the middle and saves it 900x562.
import glob, os
from PIL import Image
SNAKES = ('python', 'blacksnake', 'treesnake', 'whipsnake', 'legless')
FLY = ('osprey', 'brahminy', 'whistling', 'wedgetail', 'peregrine')
def width(name):          # crop width in pixels: the flyers fill more of the picture than the rest
    if name.startswith('bird_'): return (1250 if name.split('_')[1] in ('peregrine', 'brahminy') else 1700) if name.split('_')[1] in FLY else 1000
    if name[5:-4] in SNAKES: return 1500
    return 720 if name.startswith('fish_') else 1000
MAMMAL = ('bandicoot', 'longnose', 'brushtail', 'ringtail', 'waterrat')
def crop(src, dst, cw, W=900):
    im = Image.open(src).convert('RGB'); w, h = im.size; ch = cw * 9 // 16; b = os.path.basename(src)
    dy = 40 if b.startswith('fish_') else ((330 if b[5:-4] in SNAKES else 235) if b.startswith('crit_') and b[5:-4] not in MAMMAL else 0)          # fish sit a little high, snakes and lizards well up (they are low in the picture)
    im.crop((w // 2 - cw // 2, h // 2 - ch // 2 - dy, w // 2 + cw // 2, h // 2 + ch // 2 - dy)).resize((W, W * 9 // 16), Image.LANCZOS).save(dst, quality=88)
if __name__ == '__main__':
    os.makedirs('shots/show', exist_ok=True)
    for f in sorted(glob.glob('shots/bird_*.jpg') + glob.glob('shots/fish_*.jpg') + glob.glob('shots/crit_*.jpg')): crop(f, 'shots/show/' + os.path.basename(f), width(os.path.basename(f)))
