# КУМИРНЯ ДРОНА (2×2): сатира на храм — четверик-сруб, восьмерик, луковичная главка,
# на маковке вместо креста — золотое кольцо с глазом Дрона; притвор с крыльцом, светящийся алтарь.
# I: лемех из тёса, деревянная главка; II: тёс, серебристая главка; III: белёный камень, золотая главка.
# Над маковкой BuildingActivity._halo вращает золотое сияние (высота — HALO_Y в BuildingActivity).
# F:\blender.exe -b --factory-startup --python tools\blender\build_church.py -- <out.glb> <эпоха>
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import goyda_kit as K

out, ERA = K.cli()
random.seed(61)
K.reset_scene()
STONE = ERA == 2

S, CY = 0.9, 0.18                   # четверик: сторона по осям стен и центр по Y
R = 0.045
BASE = 0.1
K.box('cokol', (S + 0.2, S + 0.2, BASE), (0, CY, BASE / 2), 'M_brick' if STONE else 'M_stone', bevel=0.015)

# четверик
if STONE:
    TOP4 = BASE + 0.95
    K.box('chetverik', (S + 2 * R, S + 2 * R, TOP4 - BASE), (0, CY, (TOP4 + BASE) / 2), 'M_plaster', bevel=0.01)
    for sx in (-1, 1):
        for sy in (-1, 1):
            K.box(f'lop{sx}{sy}', (0.1, 0.1, TOP4 - BASE), (sx * (S / 2 + R), CY + sy * (S / 2 + R), (TOP4 + BASE) / 2), 'M_plaster', bevel=0.008)
else:
    TOP4 = K.srub('c', 0, CY, S, S, BASE, 10, R=R, ovh=0.06)

# четырёхскатная кровля-«крещатая» упрощённо: низкий шатёр-подкладка под восьмерик
roof_mat = 'M_paint_green' if STONE else ('M_thatch' if ERA == 0 else 'M_plank')
K.tent('podsh', (0, CY, TOP4 - 0.02), S + 0.34, 0.32, ERA, top_mat=roof_mat)

# восьмерик и шейка
O_R = 0.36
TOP8 = K.octagon('vosmerik', (0, CY, TOP4 + 0.12), O_R, 0.5, 'M_plaster' if STONE else 'M_log')
for i in range(8):                  # окошки восьмерика
    a = i * math.pi / 4 + math.pi / 8 * 0
    if i % 2 == 0:
        x, y = math.cos(a) * (O_R * 0.93), CY + math.sin(a) * (O_R * 0.93)
        K.box(f'o8w{i}', (0.012, 0.08, 0.16), (x, y, TOP4 + 0.4), 'M_window', rot=(0, 0, a), bevel=0)
K.octagon('karniz8', (0, CY, TOP8), O_R + 0.05, 0.05, 'M_paint_white' if ERA else 'M_plank')
K.tent('shater8', (0, CY, TOP8 + 0.05), O_R * 1.6, 0.34, ERA, top_mat=roof_mat)
BARABAN = TOP8 + 0.3
K.octagon('baraban', (0, CY, BARABAN), 0.11, 0.2, 'M_plaster' if STONE else 'M_plank')
dome_mat = 'M_gold' if STONE else ('M_plank' if ERA == 0 else 'M_iron')
TOPD = K.onion('glava', (0, CY, BARABAN + 0.18), 0.14, dome_mat)

# навершие: кольцо с глазом Дрона
K.log('shpil', 0.12, 0.012, (0, CY, TOPD + 0.06), 'z', material='M_gold', segs=6, jitter=0)
K.log('kolco', 0.02, 0.1, (0, CY, TOPD + 0.2), 'y', material='M_gold', segs=16, jitter=0)
K.log('kolco_in', 0.024, 0.07, (0, CY, TOPD + 0.2), 'y', material='M_dark', segs=16, jitter=0)
K.log('glaz', 0.028, 0.035, (0, CY, TOPD + 0.2), 'y', material='M_glow', segs=12, jitter=0)
K.add_marker('halo_anchor', (0, CY, TOPD + 0.45))

# притвор (сени) перед фасадом с двускатной крышей и крыльцом
PY = CY - S / 2 - 0.3
if STONE:
    K.box('pritvor', (0.5, 0.45, 0.55), (0, PY, BASE + 0.275), 'M_plaster', bevel=0.008)
    PEAVE = BASE + 0.55
else:
    PEAVE = K.srub('p', 0, PY, 0.42, 0.4, BASE, 6, R=0.04, ovh=0.04)
K.gable_roof('pr', (0, PY, 0), 0.42, 0.44, PEAVE, ERA, ridge_axis='y', rov=0.08, R=0.04,
             gable_mat='M_plaster' if STONE else None)
K.box('dver', (0.16, 0.02, 0.3), (0, PY - 0.24, BASE + 0.16), 'M_dark', bevel=0.004)
K.box('dver_n', (0.22, 0.025, 0.36), (0, PY - 0.235, BASE + 0.18), 'M_gold' if STONE else 'M_paint_white', bevel=0.004)
K.prism('dver_kok', [(-0.11, 0), (0.11, 0), (0, 0.1)], 0.02, 'y', (0, PY - 0.24, BASE + 0.36), 'M_paint_white')
for i in range(2):
    K.box(f'st{i}', (0.36, 0.1, 0.035), (0, PY - 0.3 - i * 0.09, BASE - 0.02 - i * 0.035), 'M_stone', bevel=0.006)

# окна четверика по бокам
for sx, fac in ((-1, '-x'), (1, '+x')):
    K.window(f'wc{sx}', (sx * (S / 2 + R + 0.004), CY, BASE + 0.5), fac, ERA, ww=0.14, wh=0.24, shutters=False)

# алтарь Дрона перед кумирней: каменная чаша с бирюзовым светом и два столбика-лампады
AX, AY = 0.62, PY - 0.2
K.lathe('altar', [(0.1, 0), (0.1, 0.12), (0.07, 0.16), (0.12, 0.22), (0.13, 0.25), (0.1, 0.24)], (AX, AY, 0), 'M_stone', segs=12)
K.lathe('altar_ogon', [(0.095, 0), (0.06, 0.05), (0.0, 0.08)], (AX, AY, 0.235), 'M_glow', segs=12)
for s in (-1, 1):
    K.log(f'lampada{s}', 0.4, 0.02, (-0.62, PY - 0.1 + s * 0.22, 0.2), 'z', material='M_iron' if ERA else 'M_log', segs=6, jitter=0)
    K.box(f'lampada_s{s}', (0.06, 0.06, 0.07), (-0.62, PY - 0.1 + s * 0.22, 0.43), 'M_glow', bevel=0.01)

tris, dims = K.finish('church', out, ao_distance=0.25)
print('CHURCH_OK era=%d tris=%d size=%s top=%.2f out=%s' % (ERA, tris, dims, TOPD + 0.45, out))
