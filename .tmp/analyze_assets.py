from PIL import Image
import os
files=[r'C:\Users\Haidong Yan\Documents\GitHub\JoyJoin_app_v0.1\apps\mini-program\src\assets\illustrations\lovart-blind-box-body.webp',r'C:\Users\Haidong Yan\Documents\GitHub\JoyJoin_app_v0.1\apps\mini-program\src\assets\illustrations\lovart-blind-box-lid.webp',r'C:\Users\Haidong Yan\Documents\GitHub\JoyJoin_app_v0.1\apps\mini-program\src\assets\illustrations\lovart-blind-box-interior.webp']
for f in files:
    im=Image.open(f)
    if im.mode in ('RGBA','LA'):
        alpha=im.split()[-1]
        bbox=alpha.getbbox()
        print(os.path.basename(f), im.size, im.mode, 'alpha bbox', bbox)
    else:
        print(os.path.basename(f), im.size, im.mode, 'no alpha')
