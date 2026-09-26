# Уникальные здания фракций (GDD §3.10): КАПИЩЕ ДРОНА (Гойда, 2×2), ОПРИЧНЫЙ ДВОР (Опричнина, 2×2),
# ЮРТА-СТАВКА (Кочевники, 1×1), ЛЕДЯНОЙ ЧЕРТОГ (Культ Хлада, 2×2). Каждое — со своим узнаваемым сверху силуэтом.
# F:\blender.exe -b --factory-startup --python tools\blender\build_faction.py -- <папка models> [эпоха] [имя]
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import goyda_kit as K

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUTDIR = args[0] if args else os.path.abspath('.')
ERA = int(args[1]) if len(args) > 1 else 1
ONLY = args[2] if len(args) > 2 else None


def kapishe():
    K.lathe('ploshad', [(0.9, 0), (0.88, 0.02), (0.0, 0.025)], (0, 0, 0), 'M_stone', segs=24)
    for i in range(10):   # круг священных камней-менгиров
        a = i / 10 * math.tau
        h = random.uniform(0.35, 0.55)
        m = K.box(f'mengir{i}', (0.1, 0.08, h), (math.cos(a) * 0.74, math.sin(a) * 0.74, h / 2), 'M_stone',
                  rot=(0, 0, a + random.uniform(-0.2, 0.2)), bevel=0.02)
        K.box(f'runa{i}', (0.04, 0.012, 0.1), (math.cos(a) * 0.69, math.sin(a) * 0.69, h * 0.6), 'M_glow', rot=(0, 0, a + math.pi / 2), bevel=0)
    # идол Дрона в центре: столп, чаша, глаз
    K.octagon('osn', (0, 0, 0.02), 0.26, 0.12, 'M_stone')
    top = K.octagon('stolp', (0, 0, 0.14), 0.12, 0.8, 'M_log')
    for z in (0.35, 0.6):
        K.octagon(f'poyas{z}', (0, 0, z), 0.135, 0.04, 'M_gold')
    K.log('glaz_o', 0.04, 0.16, (0, -0.02, top + 0.16), 'y', material='M_gold', segs=16, jitter=0)
    K.log('glaz', 0.05, 0.1, (0, -0.03, top + 0.16), 'y', material='M_dark', segs=16, jitter=0)
    K.log('zrachok', 0.055, 0.055, (0, -0.035, top + 0.16), 'y', material='M_glow', segs=12, jitter=0)
    for i in range(6):   # кольцо огня
        a = i / 6 * math.tau + 0.3
        K.lathe(f'ogon{i}', [(0.05, 0), (0.02, 0.07), (0.0, 0.13)], (math.cos(a) * 0.42, math.sin(a) * 0.42, 0.025), 'M_fire', segs=6)


def oprichny_dvor():
    # чёрный острог: частокол, ворота с пёсьей головой, дозорная башня, изба-приказ
    H = 0.88
    for side in range(4):
        n = 12
        for i in range(n + 1):
            t = -H + i * (2 * H / n)
            if side == 0 and abs(t) < 0.2:
                continue
            x, y = [(t, -H), (H, t), (t, H), (-H, t)][side]
            h = random.uniform(0.5, 0.58)
            K.log(f'kol{side}{i}', h, 0.035, (x, y, h / 2), 'z', material='M_dark', segs=6, jitter=0.1)
            K.lathe(f'ostr{side}{i}', [(0.035, 0), (0.0, 0.09)], (x, y, h), 'M_dark', segs=5)
    for s in (-1, 1):
        K.log(f'vorota_st{s}', 0.8, 0.05, (s * 0.22, -H, 0.4), 'z', material='M_dark', segs=8, jitter=0.03)
    K.log('vorota_p', 0.5, 0.04, (0, -H, 0.76), 'x', material='M_dark', segs=8, jitter=0)
    K.box('pes_golova', (0.12, 0.16, 0.12), (0, -H - 0.04, 0.9), 'M_dark', bevel=0.03)   # пёсья голова над воротами
    for s in (-1, 1):
        K.box(f'pes_uho{s}', (0.03, 0.03, 0.07), (s * 0.04, -H - 0.02, 0.99), 'M_dark', bevel=0)
    K.box('pes_glaza', (0.08, 0.01, 0.02), (0, -H - 0.125, 0.92), 'M_fire', bevel=0)
    K.lathe('metla', [(0.02, 0), (0.06, 0.08), (0.05, 0.16), (0.0, 0.18)], (0.3, -H - 0.02, 0.6), 'M_thatch', segs=8)
    # дозорная башня
    TOP = K.srub('b', 0.5, 0.45, 0.3, 0.3, 0.0, 12, R=0.035, ovh=0.04)
    K.tent('b_sh', (0.5, 0.45, TOP), 0.46, 0.4, ERA, top_mat='M_dark')
    K.box('b_flag', (0.012, 0.18, 0.12), (0.5, 0.54, TOP + 0.55), 'M_paint_red', bevel=0.002)
    K.log('b_flag_st', 0.3, 0.008, (0.5, 0.45, TOP + 0.48), 'z', material='M_iron', segs=5, jitter=0)
    # изба-приказ
    EAVE = K.srub('i', -0.3, 0.3, 0.6, 0.5, 0.0, 6, R=0.04, ovh=0.05)
    K.gable_roof('ir', (-0.3, 0.3, 0), 0.6, 0.5, EAVE, ERA, ridge_axis='x', rov=0.1, R=0.04, gable_mat='M_dark')
    K.box('i_dver', (0.14, 0.02, 0.26), (-0.3, 0.3 - 0.29, 0.13), 'M_paint_red', bevel=0.004)


def yurta_stavka():
    # большая ханская юрта с золотым навершием, бунчуки, коновязь, тюки
    r, h = 0.36, 0.62
    K.lathe('stena', [(r, 0), (r * 1.02, h * 0.45), (r * 0.98, h * 0.5)], (0, 0.05, 0), 'M_paint_white', segs=14)
    K.lathe('kupol', [(r * 1.05, 0), (r * 0.8, h * 0.28), (r * 0.3, h * 0.48), (0.0, h * 0.52)], (0, 0.05, h * 0.5), 'M_paint_red', segs=14)
    for i in range(3):
        K.log(f'poyas{i}', 0.015, r * 1.03, (0, 0.05, h * (0.12 + i * 0.13)), 'z', material='M_gold', segs=14, jitter=0)
    K.box('vhod', (0.18, 0.02, 0.24), (0, 0.05 - r, 0.12), 'M_paint_blue', bevel=0.004)
    K.lathe('naversh', [(0.04, 0), (0.05, 0.04), (0.0, 0.12)], (0, 0.05, h * 1.02), 'M_gold', segs=8)
    for s in (-1, 1):   # бунчуки — шесты с конскими хвостами
        K.log(f'bunchuk{s}', 0.8, 0.012, (s * 0.38, -0.36, 0.4), 'z', material='M_gold', segs=5, jitter=0)
        K.lathe(f'hvost{s}', [(0.0, 0), (0.04, 0.06), (0.03, 0.2), (0.0, 0.24)], (s * 0.38, -0.36, 0.52), 'M_fur', segs=8)
    K.log('konovyaz', 0.5, 0.015, (-0.3, 0.38, 0.28), 'x', segs=6, jitter=0.05)
    for s in (-1, 1):
        K.log(f'konovyaz_st{s}', 0.3, 0.02, (-0.3 + s * 0.22, 0.38, 0.15), 'z', segs=6, jitter=0.05)
    K.sacks('tyuki', (0.3, 0.35, 0), 3)


def ledyanoy_chertog():
    # палаты изо льда: ступень, стены-плиты полупрозрачного льда, кристаллические башни, снежный наст
    K.lathe('nast', [(0.9, 0), (0.88, 0.02), (0.0, 0.025)], (0, 0, 0), 'M_paint_white', segs=24)
    K.box('stupen', (1.2, 0.9, 0.1), (0, 0.1, 0.05), 'M_paint_white', bevel=0.02)
    K.box('steny', (1.0, 0.7, 0.55), (0, 0.1, 0.375), 'M_paint_blue', bevel=0.02)   # синий лёд (не M_window: окна ночью зажигаются)
    for x in (-0.5, 0, 0.5):
        for y in (0.1 - 0.35, 0.1 + 0.35):
            K.box(f'rebro{x}{y}', (0.05, 0.05, 0.56), (x, y, 0.38), 'M_glow', bevel=0.01)
    K.tent('krysha', (0, 0.1, 0.65), 1.05, 0.35, ERA, top_mat='M_paint_white')
    for i, (x, y, h) in enumerate(((-0.62, -0.5, 0.9), (0.62, -0.5, 0.9), (-0.62, 0.62, 0.7), (0.62, 0.62, 0.7), (0, 0.1, 1.0))):
        K.crystal(f'bashnya{i}', (x, y, 0.1 if i < 4 else 0.95), h if i < 4 else 0.5, 0.09 if i < 4 else 0.07, material='M_glow')
    K.box('vhod', (0.24, 0.02, 0.34), (0, 0.1 - 0.36, 0.27), 'M_paint_white', bevel=0.004)
    for i in range(6):
        a = random.uniform(0, math.tau); r = random.uniform(0.7, 0.85)
        K.crystal(f'led{i}', (math.cos(a) * r, math.sin(a) * r, 0.02), random.uniform(0.12, 0.22), 0.03, material='M_glow',
                  tilt=(random.uniform(-0.4, 0.4), random.uniform(-0.4, 0.4)))


BUILDS = {'bld_kapishe': kapishe, 'bld_oprichny_dvor': oprichny_dvor, 'bld_yurta_stavka': yurta_stavka,
          'bld_ledyanoy_chertog': ledyanoy_chertog}
for name, fn in BUILDS.items():
    if ONLY and name != ONLY:
        continue
    random.seed(sum(map(ord, name)))
    K.reset_scene()
    fn()
    tris, dims = K.finish(name[4:], os.path.join(OUTDIR, name + '.glb'), ao_distance=0.22)
    print('FACTION_OK %s tris=%d size=%s' % (name, tris, dims))
