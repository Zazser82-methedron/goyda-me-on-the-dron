# ИДОЛЫ-РЕЛИКВИИ (1×1): у всех общая основа — резной столб-кумир с лицом на каменном основании,
# у каждого свой узнаваемый сверху признак. Лубочно: крашеные пояса, золото, светящиеся знаки.
# F:\blender.exe -b --factory-startup --python tools\blender\build_idols.py -- <папка models> [имя]
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import goyda_kit as K

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUTDIR = args[0] if args else os.path.abspath('.')
ONLY = args[1] if len(args) > 1 else None


def base(stone='M_stone'):
    K.octagon('osn', (0, 0, 0), 0.34, 0.08, stone)
    K.octagon('osn2', (0, 0, 0.08), 0.26, 0.06, stone)
    for i in range(8):
        a = i / 8 * math.tau + 0.2
        K.rock(f'kamen{i}', (math.cos(a) * 0.36, math.sin(a) * 0.36, 0.03), (0.05, 0.05, 0.035), stone)
    return 0.14


def kumir(z0, h=0.9, r=0.1, wood='M_log', band='M_paint_red', eyes='M_dark', cap='M_log'):
    """Резной столб с лицом (лицо в -Y). Возвращает высоту макушки."""
    K.lathe('stolb', [(r, 0), (r * 1.05, h * 0.3), (r * 0.95, h * 0.55), (r * 1.1, h * 0.72), (r * 0.9, h)], (0, 0, z0), wood, segs=10)
    for k, zz in enumerate((0.18, 0.46)):
        K.log(f'poyas{k}', 0.035, r * 1.12, (0, 0, z0 + h * zz), 'z', material=band, segs=10, jitter=0)
    fz = z0 + h * 0.8
    for s in (-1, 1):
        K.box(f'brov{s}', (0.05, 0.03, 0.018), (s * 0.035, -r - 0.005, fz + 0.04), wood, rot=(0, s * 0.25, 0), bevel=0.004)
        K.box(f'glaz{s}', (0.028, 0.02, 0.022), (s * 0.035, -r - 0.004, fz + 0.012), eyes, bevel=0.004)
    K.prism('nos', [(-0.018, 0), (0.018, 0), (0, 0.06)], 0.03, 'y', (0, -r - 0.01, fz - 0.05), wood)
    K.box('rot', (0.06, 0.02, 0.014), (0, -r - 0.004, fz - 0.07), 'M_dark', bevel=0.003)
    K.lathe('shapka', [(r * 1.15, 0), (r * 1.05, 0.05), (r * 0.6, 0.1), (0.0, 0.13)], (0, 0, z0 + h), cap, segs=10)
    return z0 + h + 0.13


def krio():
    z = base()
    top = kumir(z, band='M_paint_blue', eyes='M_glow', cap='M_iron')
    for i in range(7):   # ледяная корона и наросты у основания
        a = i / 7 * math.tau
        K.crystal(f'led_v{i}', (math.cos(a) * 0.07, math.sin(a) * 0.07, top - 0.06), 0.18, 0.025, material='M_glow',
                  tilt=(math.sin(a) * -0.5, math.cos(a) * 0.5))
    for i in range(6):
        a = i / 6 * math.tau + 0.4
        K.crystal(f'led_n{i}', (math.cos(a) * 0.22, math.sin(a) * 0.22, z - 0.02), 0.2, 0.035, material='M_glow',
                  tilt=(math.sin(a) * -0.4, math.cos(a) * 0.4))


def giper():
    z = base()
    top = kumir(z, h=1.0, band='M_gold', eyes='M_glow', cap='M_iron')
    K.log('shpil', 0.3, 0.012, (0, 0, top + 0.15), 'z', material='M_iron', segs=6, jitter=0)
    K.lathe('shar', [(0.0, 0), (0.06, 0.02), (0.08, 0.08), (0.06, 0.14), (0.0, 0.16)], (0, 0, top + 0.28), 'M_glow', segs=12)
    for s in (-1, 1):   # золотые молнии по бокам
        K.prism(f'molniya{s}', [(0, 0), (0.07, 0.12), (0.03, 0.12), (0.09, 0.26), (-0.01, 0.1), (0.03, 0.1)], 0.02, 'x',
                (s * 0.12, 0, z + 0.4), 'M_gold')


def shipo():
    z = base()
    kumir(z, h=0.75, band='M_paint_red', eyes='M_fire')
    for i in range(10):
        a = i / 10 * math.tau
        h = random.uniform(0.35, 0.5)
        k = K.log(f'kol{i}', h, 0.022, (math.cos(a) * 0.28, math.sin(a) * 0.28, h / 2), 'z', segs=6, jitter=0.05)
        k.rotation_euler = (math.sin(a) * 0.35, -math.cos(a) * 0.35, 0)
        K.lathe(f'ostr{i}', [(0.022, 0), (0.0, 0.08)], (math.cos(a) * (0.28 + h * 0.17), math.sin(a) * (0.28 + h * 0.17), h * 0.94), 'M_iron', segs=5)


def obereg():
    z = base()
    top = kumir(z, band='M_paint_red', cap='M_log')
    for s in (-1, 1):   # рушник с красной вышивкой
        K.box(f'rushnik{s}', (0.05, 0.012, 0.36), (s * 0.13, -0.08, z + 0.5), 'M_paint_white', rot=(0, s * 0.2, 0), bevel=0.003)
        for k in range(3):
            K.box(f'vyshivka{s}{k}', (0.05, 0.014, 0.02), (s * 0.13, -0.08, z + 0.36 + k * 0.08), 'M_paint_red', rot=(0, s * 0.2, 0), bevel=0)
    K.lathe('podkova', [(0.07, 0), (0.07, 0.015), (0.05, 0.015), (0.05, 0)], (0, 0, 0), 'M_iron', segs=12)
    pk = K.bpy.data.objects['podkova']
    pk.location = (0, -0.11, z + 0.62); pk.rotation_euler = (math.pi / 2, 0, 0)


def goydushka():
    z = base()
    kumir(z, h=0.7, r=0.15, band='M_wheat', cap='M_thatch')   # пузатый весёлый кумир
    for i in range(3):
        a = i / 3 * math.tau + 0.5
        x, y = math.cos(a) * 0.25, math.sin(a) * 0.25
        K.lathe(f'snop{i}', [(0.05, 0), (0.035, 0.12), (0.07, 0.3), (0.0, 0.32)], (x, y, 0.02), 'M_wheat', segs=8)
        K.log(f'snop_p{i}', 0.02, 0.04, (x, y, 0.12), 'z', material='M_paint_red', segs=8, jitter=0)
    K.lathe('karavay', [(0.0, 0), (0.09, 0.01), (0.1, 0.04), (0.07, 0.07), (0.0, 0.08)], (0, -0.2, z - 0.02), 'M_wheat', segs=12)


def zlato():
    z = base()
    kumir(z, band='M_gold', eyes='M_gold', cap='M_gold', wood='M_gold')
    for i in range(12):
        a = random.uniform(0, math.tau); r = random.uniform(0.12, 0.3)
        K.log(f'moneta{i}', 0.012, 0.035, (math.cos(a) * r, math.sin(a) * r, z + 0.006 * (i % 3)), 'z', material='M_gold', segs=10, jitter=0)
    K.box('sunduk', (0.16, 0.1, 0.09), (0.18, -0.18, z + 0.04), 'M_paint_red', rot=(0, 0, 0.4), bevel=0.01)


def fonk():
    z = base()
    top = kumir(z, h=0.8, band='M_paint_blue', eyes='M_glow', cap='M_paint_red')
    # балалайка на поясе
    K.prism('balalayka', [(0, 0), (0.1, 0), (0.05, 0.1)], 0.02, 'y', (-0.05, -0.12, z + 0.3), 'M_wheat')
    K.box('grif', (0.018, 0.015, 0.2), (0, -0.12, z + 0.5), 'M_plank', bevel=0)
    for i, m in enumerate(('M_paint_red', 'M_paint_blue', 'M_wheat', 'M_crop', 'M_paint_white')):   # ленты с макушки
        a = i / 5 * math.tau
        K.box(f'lenta{i}', (0.025, 0.006, 0.5), (math.cos(a) * 0.1, math.sin(a) * 0.1, top - 0.27), m,
              rot=(math.sin(a) * -0.25, math.cos(a) * 0.25, a), bevel=0)


def vera():
    z = base()
    top = kumir(z, h=1.05, band='M_gold', eyes='M_glow', cap='M_gold')
    K.log('kolco', 0.02, 0.1, (0, 0, top + 0.12), 'y', material='M_gold', segs=16, jitter=0)
    K.log('kolco_g', 0.024, 0.04, (0, 0, top + 0.12), 'y', material='M_glow', segs=10, jitter=0)
    for i in range(5):   # свечи у основания
        a = i / 5 * math.tau
        K.log(f'svecha{i}', 0.08, 0.012, (math.cos(a) * 0.2, math.sin(a) * 0.2, z + 0.02), 'z', material='M_paint_white', segs=6, jitter=0)
        K.lathe(f'ogon{i}', [(0.01, 0), (0.0, 0.03)], (math.cos(a) * 0.2, math.sin(a) * 0.2, z + 0.06), 'M_fire', segs=5)


def samotsvet():
    z = base()
    kumir(z, band='M_gem', eyes='M_gem', cap='M_iron', wood='M_stone')
    for i, a in enumerate((0.3, 2.4, 4.3)):
        K.druza(f'druza{i}', (math.cos(a) * 0.22, math.sin(a) * 0.22, 0.02), size=0.55)


IDOLS = {'idol_krio': krio, 'idol_giper': giper, 'idol_shipo': shipo, 'idol_obereg': obereg, 'idol_food': goydushka,
         'idol_gold': zlato, 'idol_fonk': fonk, 'idol_vera': vera, 'idol_samotsvet': samotsvet}
for name, fn in IDOLS.items():
    if ONLY and name != ONLY:
        continue
    random.seed(sum(map(ord, name)))
    K.reset_scene()
    fn()
    tris, dims = K.finish(name, os.path.join(OUTDIR, name + '.glb'), ao_distance=0.15)
    print('IDOL_OK %s tris=%d size=%s' % (name, tris, dims))
