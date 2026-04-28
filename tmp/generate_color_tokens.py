import colorsys

def hex_to_rgb(hex_color):
    hex_color = hex_color.lstrip('#')
    return (int(hex_color[0:2], 16), int(hex_color[2:4], 16), int(hex_color[4:6], 16))

def rgb_to_hex(r, g, b):
    return f'#{int(r):02X}{int(g):02X}{int(b):02X}'

def hex_to_hsl(hex_color):
    r, g, b = hex_to_rgb(hex_color)
    h, l, s = colorsys.rgb_to_hls(r/255.0, g/255.0, b/255.0)
    return h * 360, s * 100, l * 100

def hsl_to_hex(h, s, l):
    r, g, b = colorsys.hls_to_rgb(h/360.0, l/100.0, s/100.0)
    return rgb_to_hex(r*255, g*255, b*255)

primary_colors = {
    'corgi': '#CB9268',
    'fox': '#C68E61',
    'rooster': '#FEFDBB',
    'octopus': '#CB8783',
    'dolphin_calm': '#B8DFEF',
    'spider': '#62526A',
    'koala': '#ADABBC',
    'owl': '#714C42',
    'cat': '#D8D6C7',
    'hamster_praise': '#D8C6B7',
    'elephant': '#BCCADE',
    'turtle': '#4D613A',
}

name_map = {
    'corgi': '气氛组柯基',
    'fox': '探宝雷达狐',
    'rooster': '情绪稳定鸡',
    'octopus': '脑洞喷泉章鱼',
    'dolphin_calm': '读空气海豚',
    'spider': '社交裁缝蛛',
    'koala': '情绪树洞考拉',
    'owl': '追问猫头鹰',
    'cat': '静音模式猫',
    'hamster_praise': '捧场王仓鼠',
    'elephant': '定海神针大象',
    'turtle': '慢半拍龟',
}

print('Extracted primary colors with generated palette variants:')
print('=' * 80)

for key, primary in primary_colors.items():
    h, s, l = hex_to_hsl(primary)
    
    # Light: increase lightness, keep some saturation
    light_l = min(95, l + 25)
    light_s = max(10, s * 0.6)
    light = hsl_to_hex(h, light_s, light_l)
    
    # Dark: decrease lightness, increase saturation slightly
    dark_l = max(15, l - 25)
    dark_s = min(100, s * 1.3) if s > 0 else 0
    dark = hsl_to_hex(h, dark_s, dark_l)
    
    # Background: very light tint
    bg_l = min(98, l + 35)
    bg_s = max(5, s * 0.3)
    bg = hsl_to_hex(h, bg_s, bg_l)
    
    # Surface: light tint
    surface_l = min(95, l + 20)
    surface_s = max(10, s * 0.5)
    surface = hsl_to_hex(h, surface_s, surface_l)
    
    print(f"\n{name_map[key]} ({key})")
    print(f"  Primary (主色): {primary}  [HSL: h={int(h)} s={int(s)}% l={int(l)}%]")
    print(f"  Light   (浅色): {light}")
    print(f"  Dark    (深色): {dark}")
    print(f"  BG      (背景): {bg}")
    print(f"  Surface (表面): {surface}")
