# Постройки производственных цепочек (GDD §3.6): МЕЛЬНИЦА (2×2), ЛЕСОПИЛКА (1×1), ПАСЕКА (1×1).
# У мельницы крылья — отдельный узел 'melnica_kryla' (separate_group) с осью в ступице: игра вращает его по имени.
# F:\blender.exe -b --factory-startup --python tools\blender\build_chain.py -- <папка models> <эпоха> [имя]
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import goyda_kit as K

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUTDIR = args[0] if args else os.path.abspath('.')
ERA = int(args[1]) if len(args) > 1 else 0
ONLY = args[2] if len(args) > 2 else None
ROOF = {0: 'M_thatch', 1: 'M_roof', 2: 'M_roof_iron'}[ERA]


def melnica():
    # восьмигранный сруб-«восьмерик» и шатровое тулово, крылья спереди (-Y)
    K.octagon('osn', (0, 0.1, 0), 0.62, 0.1, 'M_stone')
    Z1 = K.octagon('vosmerik', (0, 0.1, 0.1), 0.52, 0.55, 'M_log')
    K.octagon('poyas', (0, 0.1, Z1), 0.56, 0.05, 'M_paint_white' if ERA else 'M_plank')
    K.lathe('tulovo', [(0.5, 0), (0.4, 0.45), (0.32, 0.62)], (0, 0.1, Z1 + 0.05), 'M_plank', segs=8)
    TOP = K.tent('shater', (0, 0.1, Z1 + 0.67), 0.62, 0.34, ERA, top_mat=ROOF)
    K.log('flag_st', 0.3, 0.01, (0, 0.1, TOP + 0.14), 'z', material='M_iron', segs=5, jitter=0)
    K.box('flag', (0.012, 0.16, 0.1), (0, 0.18, TOP + 0.24), 'M_paint_red', bevel=0.002)
    K.box('dver', (0.2, 0.02, 0.32), (0, 0.1 - 0.5, 0.26), 'M_dark', bevel=0.004)
    K.box('dver_n', (0.26, 0.025, 0.38), (0, 0.1 - 0.495, 0.28), 'M_paint_white' if ERA else 'M_plank', bevel=0.004)
    HUB = (0, 0.1 - 0.42, Z1 + 0.5)
    K.log('val', 0.3, 0.05, (0, 0.1 - 0.3, Z1 + 0.5), 'y', segs=10, jitter=0)
    # крылья: 4 махи с решёткой и парусиной, строятся вокруг начала координат в плоскости XZ
    parts = K.capture(lambda: [
        K.log('stupica', 0.08, 0.07, (0, 0, 0), 'y', material='M_iron', segs=10, jitter=0),
        *[x for i in range(4) for x in (
            K.box(f'maha{i}', (0.05, 0.03, 0.78), (0, -0.03, 0.42), 'M_log', bevel=0.004),
            K.box(f'parus{i}', (0.2, 0.012, 0.56), (0.12, -0.05, 0.5), 'M_cloth', bevel=0),
            *[K.box(f'reshetka{i}{k}', (0.24, 0.015, 0.012), (0.1, -0.045, 0.24 + k * 0.1), 'M_plank', bevel=0) for k in range(6)],
        )]])
    # развернуть четыре махи на 90°: у каждой четвёрки деталей свой поворот вокруг оси Y (ось ступицы)
    from mathutils import Matrix
    K.bpy.context.view_layer.update()
    for o in parts:
        n = o.name
        for i in range(4):
            if n.startswith(f'maha{i}') or n.startswith(f'parus{i}') or n.startswith(f'reshetka{i}'):
                o.matrix_world = Matrix.Rotation(i * math.pi / 2 + 0.3, 4, 'Y') @ o.matrix_world
    K.separate_group('melnica_kryla', parts, HUB)
    # двор: мешки муки, телега, изгородь
    K.sacks('muka', (0.55, -0.55, 0), 4)
    K.telega('tel', (-0.6, -0.6, 0), angle=0.5, load='sacks')
    for i in range(7):
        x = -0.85 + i * 0.28
        K.log(f'zabor{i}', 0.24, 0.012, (x, 0.85, 0.12), 'z', segs=5, jitter=0.1)
    K.log('zabor_zh', 1.75, 0.009, (0, 0.85, 0.18), 'x', segs=5, jitter=0.05)


def lesopilka():
    # навес на четырёх столбах, рамная пила с бревном, штабели брёвен и досок, опилки
    for sx in (-1, 1):
        for sy in (-1, 1):
            K.log(f'st{sx}{sy}', 0.62, 0.025, (sx * 0.3, 0.1 + sy * 0.24, 0.31), 'z', segs=7, jitter=0.03)
    roof = K.capture(lambda: K.gable_roof('kr', (0, 0, 0), 0.6, 0.5, 0.62, ERA, ridge_axis='x', rov=0.08, R=0.025))
    K.place(roof, (0, 0.1, 0))
    K.box('rama_niz', (0.44, 0.08, 0.04), (0, 0.1, 0.2), 'M_log', bevel=0.005)
    for s in (-1, 1):
        K.box(f'rama_st{s}', (0.04, 0.05, 0.42), (s * 0.2, 0.1, 0.41), 'M_log', bevel=0.004)
    K.box('rama_verh', (0.44, 0.05, 0.04), (0, 0.1, 0.6), 'M_log', bevel=0.004)
    for k in range(3):
        K.box(f'pila{k}', (0.006, 0.04, 0.36), (-0.06 + k * 0.06, 0.1, 0.42), 'M_iron', bevel=0)
    K.log('brevno_pil', 0.8, 0.07, (0, 0.1, 0.27), 'y', segs=10, jitter=0.08)
    for row in range(2):   # штабель брёвен сзади слева
        for j in range(3 - row):
            K.log(f'shtab{row}{j}', 0.5, 0.05, (-0.34 + j * 0.1 + row * 0.05, -0.32, 0.05 + row * 0.09), 'x', segs=8, jitter=0.1)
    for i in range(4):   # тёс
        b = K.box(f'tes{i}', (0.08, 0.46, 0.015), (0.35, -0.2, 0.01 + i * 0.017), 'M_plank', bevel=0)
        b['vary'] = 1
    K.lathe('opilki', [(0.16, 0), (0.08, 0.04), (0.0, 0.05)], (0.12, -0.3, 0), 'M_wheat', segs=10)


def paseka():
    # ульи-колоды с крышками, тын по краю, лавка пасечника, цветущие кусты
    for i, (x, y) in enumerate(((-0.25, -0.2), (0.05, -0.28), (0.3, -0.12), (-0.15, 0.15), (0.2, 0.2))):
        K.log(f'kolodа{i}', 0.3, 0.07, (x, y, 0.15), 'z', segs=10, jitter=0.08)
        K.lathe(f'kryshka{i}', [(0.09, 0), (0.06, 0.04), (0.0, 0.06)], (x, y, 0.3), ROOF if ERA else 'M_thatch', segs=10)
        K.box(f'letok{i}', (0.03, 0.01, 0.015), (x, y - 0.07, 0.12), 'M_dark', bevel=0)
        K.box(f'podstavka{i}', (0.16, 0.16, 0.02), (x, y, 0.01), 'M_plank', bevel=0.003)
    H = 0.44
    for side in range(4):   # плетёный тын
        for i in range(7):
            t = -H + i * (2 * H / 6)
            if side == 0 and abs(t) < 0.1:
                continue
            x, y = [(t, -H), (H, t), (t, H), (-H, t)][side]
            K.log(f'tyn{side}{i}', 0.2, 0.012, (x, y, 0.1), 'z', segs=5, jitter=0.1)
    for side, (a, b) in enumerate((((-H, H), (H, H)), ((-H, -H), (-H, H)), ((H, -H), (H, H)))):
        ax = 'x' if a[1] == b[1] else 'y'
        K.log(f'tyn_zh{side}', 2 * H, 0.01, ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0.15), ax, segs=5, jitter=0.05)
    K.box('lavka', (0.3, 0.07, 0.02), (-0.2, 0.36, 0.11), 'M_plank', bevel=0.003)
    for i in range(6):   # цветы — жёлтые и красные шапочки
        K.lathe(f'cvet{i}', [(0.0, 0), (0.03, 0.02), (0.0, 0.03)], (random.uniform(-0.35, 0.35), random.uniform(-0.38, -0.3), 0.04),
                'M_wheat' if i % 2 else 'M_paint_red', segs=6)


BUILDS = {'bld_melnica': melnica, 'bld_lesopilka': lesopilka, 'bld_paseka': paseka}
for name, fn in BUILDS.items():
    if ONLY and name != ONLY:
        continue
    random.seed(sum(map(ord, name)) + ERA)
    K.reset_scene()
    fn()
    fname = name + ('' if ERA == 0 else f'_e{ERA}')
    tris, dims = K.finish(name[4:], os.path.join(OUTDIR, fname + '.glb'), ao_distance=0.2)
    print('CHAIN_OK %s tris=%d size=%s' % (fname, tris, dims))
