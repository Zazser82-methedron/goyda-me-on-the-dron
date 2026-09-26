# ОРДА: ЛАГЕРЬ (enemy_camp, 2×2) и ЛОГОВО ГОЙДА-БАТИ (enemy_lair, 3×3).
# Кочевой стан: юрты из шкур, частокол из заострённых кольев, лиловые стяги (цвет Орды — M_gem светится),
# костёр, тотем с черепом. Логово — шатёр-дворец с золотой короной, шипастая ограда, трон самозванца,
# чаши лилового огня. Силуэт читается сверху как «чужое», тёмное, в отличие от лубочной державы.
# F:\blender.exe -b --factory-startup --python tools\blender\build_horde.py -- <папка models> [имя]
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import goyda_kit as K

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUTDIR = args[0] if args else os.path.abspath('.')
ONLY = args[1] if len(args) > 1 else None


def yurta(p, loc, r, h):
    """Юрта из шкур: цилиндрическая стенка, купол, тёмный вход, дымник."""
    x, y, z = loc
    K.lathe(p + 'stena', [(r, 0), (r * 1.02, h * 0.45), (r * 0.98, h * 0.5)], (x, y, z), 'M_fur', segs=12)
    K.lathe(p + 'kupol', [(r * 1.05, 0), (r * 0.8, h * 0.28), (r * 0.3, h * 0.48), (0.0, h * 0.52)], (x, y, z + h * 0.5), 'M_leather', segs=12)
    for i in range(3):   # верёвки-обвязки
        K.log(f'{p}verevka{i}', 0.012, r * 1.03, (x, y, z + h * (0.12 + i * 0.13)), 'z', material='M_cloth', segs=12, jitter=0)
    K.box(p + 'vhod', (r * 0.5, 0.02, h * 0.38), (x, y - r, z + h * 0.19), 'M_dark', bevel=0)
    K.box(p + 'vhod_ob', (r * 0.6, 0.025, 0.03), (x, y - r - 0.004, z + h * 0.39), 'M_gem', bevel=0)
    K.log(p + 'dymnik', 0.08, r * 0.14, (x, y, z + h * 1.02), 'z', material='M_log', segs=8, jitter=0)


def palisade(p, cx, cy, half, gap_front=0.28, h=(0.36, 0.5), step=0.14):
    for side in range(4):
        n = int(2 * half / step)
        for i in range(n + 1):
            t = -half + i * (2 * half / n)
            if side == 0 and abs(t - cx * 0) < gap_front:
                continue
            x, y = [(t, -half), (half, t), (t, half), (-half, t)][side]
            hh = random.uniform(*h)
            k = K.log(f'{p}kol{side}{i}', hh, 0.03, (cx + x, cy + y, hh / 2), 'z', segs=6, jitter=0.12)
            k.rotation_euler = (random.uniform(-0.1, 0.1), random.uniform(-0.1, 0.1), 0)
            K.lathe(f'{p}ostr{side}{i}', [(0.03, 0), (0.0, 0.08)], (cx + x, cy + y, hh), 'M_log', segs=5)


def styag(p, loc, h=0.8):
    x, y, z = loc
    K.log(p + 'st', h, 0.012, (x, y, z + h / 2), 'z', material='M_log', segs=5, jitter=0)
    K.box(p + 'polotno', (0.012, 0.14, 0.26), (x, y + 0.07, z + h - 0.16), 'M_gem', bevel=0.002)
    for s in (-1, 1):   # «хвосты» полотнища
        K.box(f'{p}hvost{s}', (0.01, 0.04, 0.1), (x, y + 0.07 + s * 0.04, z + h - 0.34), 'M_gem', bevel=0)
    K.lathe(p + 'rog', [(0.012, 0), (0.0, 0.07)], (x, y, z + h), 'M_paint_white', segs=5)


def koster(p, loc, fire='M_fire'):
    x, y, z = loc
    for i in range(6):
        a = i / 6 * math.tau
        K.rock(f'{p}k{i}', (x + math.cos(a) * 0.1, y + math.sin(a) * 0.1, z + 0.02), (0.035, 0.035, 0.025))
    for i in range(3):
        b = K.log(f'{p}drova{i}', 0.18, 0.015, (x, y, z + 0.04), 'x', segs=6, jitter=0.1)
        b.rotation_euler = (0, math.pi / 2 - 0.4, i * math.tau / 3)
    K.lathe(p + 'ogon', [(0.07, 0), (0.03, 0.1), (0.0, 0.18)], (x, y, z + 0.03), fire, segs=7)


def totem(p, loc, h=0.7):
    x, y, z = loc
    K.log(p + 'st', h, 0.03, (x, y, z + h / 2), 'z', material='M_log', segs=7, jitter=0.08)
    K.lathe(p + 'cherep', [(0.0, 0), (0.045, 0.01), (0.055, 0.05), (0.045, 0.09), (0.0, 0.1)], (x, y, z + h), 'M_paint_white', segs=8)
    for s in (-1, 1):
        K.box(f'{p}glaz{s}', (0.015, 0.01, 0.015), (x + s * 0.018, y - 0.05, z + h + 0.055), 'M_gem', bevel=0)
        r = K.lathe(f'{p}rog{s}', [(0.012, 0), (0.0, 0.1)], (0, 0, 0), 'M_paint_white', segs=5)
        r.location = (x + s * 0.05, y, z + h + 0.07); r.rotation_euler = (0, s * 1.0, 0)


def camp():
    K.lathe('zemlya', [(0.95, 0), (0.93, 0.012), (0.0, 0.015)], (0, 0, 0), 'M_soil', segs=20)
    yurta('y1', (-0.3, 0.25, 0), 0.28, 0.5)
    yurta('y2', (0.35, 0.3, 0), 0.22, 0.42)
    palisade('pal', 0, 0, 0.88)
    koster('kost', (0.05, -0.25, 0))
    totem('totem', (-0.55, -0.45, 0))
    styag('st1', (0.62, -0.5, 0))
    styag('st2', (-0.7, 0.62, 0))
    for i in range(3):   # тюки награбленного
        b = K.box(f'tyuk{i}', (0.12, 0.1, 0.09), (0.45 + i * 0.1, -0.05, 0.045), 'M_cloth', rot=(0, 0, random.uniform(-0.4, 0.4)), bevel=0.03)
        b['vary'] = 1


def lair():
    K.lathe('zemlya', [(1.45, 0), (1.42, 0.015), (0.0, 0.018)], (0, 0, 0), 'M_soil', segs=24)
    # шатёр-дворец: высокий тёмный шатёр на шестигранном основании, корона-навершие
    K.octagon('osnova', (0, 0.15, 0), 0.62, 0.12, 'M_stone')
    K.lathe('shatyor', [(0.58, 0.12), (0.6, 0.6), (0.5, 0.75), (0.25, 1.35), (0.06, 1.75), (0.0, 1.8)], (0, 0.15, 0), 'M_dark', segs=12)   # тёмный шатёр — злодейский силуэт
    for i in range(12):   # полосы по шатру — лиловые
        if i % 2:
            continue
        a = i / 12 * math.tau
        K.box(f'polosa{i}', (0.05, 0.02, 0.6), (math.cos(a) * 0.58, 0.15 + math.sin(a) * 0.58, 0.42), 'M_gem', rot=(0, 0, a + math.pi / 2), bevel=0)
    K.box('vhod', (0.3, 0.03, 0.45), (0, 0.15 - 0.6, 0.35), 'M_dark', bevel=0)
    K.box('vhod_ob', (0.36, 0.035, 0.04), (0, 0.15 - 0.605, 0.6), 'M_gold', bevel=0.005)
    # корона самозванца
    K.log('korona_o', 0.06, 0.13, (0, 0.15, 1.82), 'z', material='M_gold', segs=12, jitter=0)
    for i in range(6):
        a = i / 6 * math.tau
        K.lathe(f'korona_z{i}', [(0.025, 0), (0.0, 0.12)], (math.cos(a) * 0.12, 0.15 + math.sin(a) * 0.12, 1.84), 'M_gold', segs=5)
        K.box(f'korona_k{i}', (0.025, 0.025, 0.025), (math.cos(a) * 0.13, 0.15 + math.sin(a) * 0.13, 1.85), 'M_gem', rot=(0.7, 0.7, 0), bevel=0)
    # трон перед входом
    K.box('tron_s', (0.3, 0.26, 0.2), (0, -0.7, 0.1), 'M_gold', bevel=0.02)
    K.box('tron_sp', (0.32, 0.06, 0.45), (0, -0.58, 0.3), 'M_gold', bevel=0.02)
    K.box('tron_pod', (0.24, 0.2, 0.03), (0, -0.72, 0.215), 'M_gem', bevel=0.01)
    # малые юрты свиты, ограда, чаши лилового огня, стяги
    for i, (x, y) in enumerate(((-0.95, 0.55), (0.95, 0.55), (-1.0, -0.3), (1.0, -0.3))):
        yurta(f'yv{i}', (x, y, 0), 0.22, 0.4)
    palisade('pal', 0, 0, 1.38, gap_front=0.35, h=(0.45, 0.65), step=0.16)
    for s in (-1, 1):
        x, y = s * 0.45, -0.95
        K.lathe(f'chasha_n{s}', [(0.04, 0), (0.03, 0.3), (0.07, 0.34)], (x, y, 0), 'M_iron', segs=8)
        K.lathe(f'chasha{s}', [(0.07, 0), (0.14, 0.06), (0.15, 0.08)], (x, y, 0.34), 'M_iron', segs=10)
        K.lathe(f'ogon_l{s}', [(0.12, 0), (0.05, 0.12), (0.0, 0.22)], (x, y, 0.4), 'M_gem', segs=8)
        styag(f'st{s}', (s * 1.2, -1.2, 0), h=1.1)
    totem('totem1', (-0.55, 0.9, 0), h=0.9)
    totem('totem2', (0.55, 0.9, 0), h=0.9)
    koster('kost', (0.6, -0.4, 0), fire='M_gem')


BUILDS = {'enemy_camp': camp, 'enemy_lair': lair}
for name, fn in BUILDS.items():
    if ONLY and name != ONLY:
        continue
    random.seed(sum(map(ord, name)))
    K.reset_scene()
    fn()
    tris, dims = K.finish(name, os.path.join(OUTDIR, name + '.glb'), ao_distance=0.22)
    print('HORDE_OK %s tris=%d size=%s' % (name, tris, dims))
