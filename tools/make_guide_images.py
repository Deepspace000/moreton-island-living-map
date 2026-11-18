# Cuts the glossary pictures out of the studio renders in shots/ (see tools/test/studio.mjs): id -> the renders it is made from
# (the first becomes assets/guide/<id>.jpg, the rest <id>_2.jpg, <id>_3.jpg).  python tools/make_guide_images.py [id ...]
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from crop_portraits import portrait
SH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'shots') + os.sep
MAP = {
  # waders and water birds
  'curlew': ['bird_curlew_side', 'bird_curlew_front'], 'godwit': ['bird_godwit_side', 'bird_godwit_front'], 'stonecurlew': ['bird_stonecurlew_side', 'bird_stonecurlew_front'],
  'oystercatcher': ['bird_oystercatcher_side', 'bird_oystercatcher_front'], 'swan': ['bird_swan_side', 'bird_swan_front'],
  'greatcormorant': ['bird_cormorant_stand_side', 'bird_cormorant_dry_front', 'bird_cormorant_swim_side'],
  # raptors
  'osprey': ['bird_osprey_under', 'bird_osprey_plan'], 'brahminy': ['bird_brahminy_under', 'bird_brahminy_plan'], 'whistling': ['bird_whistling_under', 'bird_whistling_plan'],
  'wedgetail': ['bird_wedgetail_under', 'bird_wedgetail_plan'], 'peregrine': ['bird_peregrine_under', 'bird_peregrine_plan'],
}
# the animals that were in the map before (oldsea.mjs, oldland.mjs)
for n in ['bream', 'baitfish', 'sergeant', 'neon', 'humbug', 'hardyhead', 'whiting', 'flathead', 'greenturtle', 'maskray', 'shovelnose', 'whaler', 'tigershark', 'dolphin', 'dugong', 'humpback']: MAP[n] = ['sea_' + n]
for n in ['pelican', 'seaeagle', 'cormorant', 'silvergull', 'wallaby', 'goanna', 'bluetongue', 'sandcrab', 'bluecrab', 'rockcrab', 'octopus', 'jellyfish']: MAP[n] = ['old_' + n]
MAP['pelican'] = ['old_pelican', 'old_pelicanfly_under', 'old_pelicanfly_plan', 'old_pelicanafloat']
MAP['seaeagle'] = ['old_seaeagle', 'old_seaeaglefly_under', 'old_seaeaglefly_plan']
MAP['silvergull'] = ['old_silvergull', 'old_silvergullfly_under']
MAP['cresttern'] = ['old_cresttern_under', 'old_cresttern_plan']
MAP['flyingfox'] = ['old_flyingfox_under', 'old_flyingfox_plan']
MAP['microbat'] = ['old_microbat_under', 'old_microbat_plan']
for n in ['bluetiger', 'crow', 'brown', 'grassblue', 'darner', 'aussietiger', 'hawker']: MAP[n] = ['old_' + n + '_plan']
# trees and wildflowers (treerow.mjs)
for n in ['eucalypt', 'sheoak', 'banksia', 'paperbark', 'mangrove', 'grasstree', 'coconutpalm', 'pandanus']: MAP[n] = ['tree_' + n]
for i, n in enumerate(['wallumbanksia', 'sawbanksia', 'heathyparrotpea', 'beakedparrotpea', 'weddingbush', 'devilsrice', 'guineaflower', 'sarsaparilla', 'geebung', 'matrush', 'blueflaxlily', 'cottontree', 'asparagusfern']): MAP[n] = ['plant_' + str(i)]
for n in ['tailor', 'dart', 'trevally', 'jewfish', 'longtom', 'tarwhine', 'snapper', 'squire', 'sweetlip', 'cod', 'moses', 'tusk', 'morwong', 'moray']: MAP[n + 'fish' if n in () else n] = ['fish_' + n]
for n in ['waterdragon', 'majorskink', 'landmullet', 'gardenskink', 'legless', 'python', 'treesnake', 'blacksnake', 'whipsnake', 'turtle', 'bandicoot', 'longnose', 'brushtail', 'ringtail', 'waterrat']: MAP[n] = ['crit_' + n]
if __name__ == '__main__':
    only = sys.argv[1:]
    for k, srcs in MAP.items():
        if only and k not in only: continue
        for i, s in enumerate(srcs):
            p = SH + s + '.jpg'
            if os.path.exists(p):
                try: portrait(p, k if i == 0 else f'{k}_{i + 1}')
                except SystemExit as e: print(e)
            else: print('missing', p)
