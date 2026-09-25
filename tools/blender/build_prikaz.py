# ПРИКАЗ СБОРА (2×2, II эпоха): приказная изба сборщиков податей — сруб на подклете с высоким
# крыльцом, вывеска «ПРИКАЗЪ», стол дьяка под навесом с сундуком монет, колодки для недоимщиков (сатира),
# очередь из мешков-подати, коновязь.
# F:\blender.exe -b --factory-startup --python tools\blender\build_prikaz.py -- <out.glb> <эпоха 1|2>
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import goyda_kit as K

out, ERA = K.cli()
random.seed(181)
K.reset_scene()

W, D, CY = 1.3, 0.8, 0.35
R = 0.045
POD = 0.22
K.box('podklet', (W + 0.14, D + 0.14, POD), (0, CY, POD / 2), 'M_brick' if ERA == 2 else 'M_stone', bevel=0.012)
EAVE = K.srub('s', 0, CY, W, D, POD, 9, R=R, ovh=0.08)
RIDGE = K.gable_roof('r', (0, CY, 0), W, D, EAVE, ERA, ridge_axis='x', rov=0.15, R=R)
FY = CY - D / 2 - R
for x in (-0.45, -0.18, 0.45):
    K.window(f'w{x}', (x, FY - 0.004, POD + 0.34), '-y', ERA, ww=0.14, wh=0.19)
# высокое крыльцо к двери справа
DX = 0.18
K.box('dver', (0.18, 0.02, 0.3), (DX, FY - 0.005, POD + 0.17), 'M_dark', bevel=0.004)
K.box('kr_pl', (0.34, 0.26, 0.03), (DX, FY - 0.14, POD - 0.01), 'M_plank', bevel=0.004)
for i in range(3):
    K.box(f'kr_st{i}', (0.3, 0.07, 0.025), (DX, FY - 0.3 - i * 0.07, POD - 0.07 - i * 0.065), 'M_plank', bevel=0.003)
for s in (-1, 1):
    K.log(f'kr_stolb{s}', 0.52, 0.018, (DX + s * 0.15, FY - 0.25, POD + 0.25), 'z', segs=6, jitter=0.02)
K.box('kr_kozyrek', (0.4, 0.3, 0.02), (DX, FY - 0.15, POD + 0.52), 'M_roof_iron' if ERA == 2 else 'M_roof', rot=(-0.3, 0, 0), bevel=0.003)
# вывеска
K.box('vyveska', (0.5, 0.025, 0.12), (-0.3, FY - 0.02, EAVE + 0.12), 'M_paint_red', bevel=0.006)
for i in range(6):
    K.box(f'bukva{i}', (0.035, 0.028, 0.06), (-0.49 + i * 0.075, FY - 0.03, EAVE + 0.12), 'M_gold', bevel=0.004)
# стол дьяка под навесом: бумаги, чернильница, сундук с монетами
TX, TY = -0.35, -0.45
for sx in (-1, 1):
    for sy in (-1, 1):
        K.log(f'n_st{sx}{sy}', 0.46, 0.014, (TX + sx * 0.2, TY + sy * 0.14, 0.23), 'z', segs=5, jitter=0.02)
K.box('n_kr', (0.48, 0.36, 0.02), (TX, TY, 0.47), 'M_roof_iron' if ERA == 2 else 'M_roof', rot=(-0.2, 0, 0), bevel=0.003)
K.box('stol', (0.32, 0.16, 0.025), (TX, TY, 0.18), 'M_plank', bevel=0.003)
for sx in (-1, 1):
    K.box(f'stol_n{sx}', (0.025, 0.14, 0.17), (TX + sx * 0.13, TY, 0.085), 'M_plank', bevel=0.002)
K.box('bumaga', (0.1, 0.07, 0.004), (TX - 0.05, TY, 0.195), 'M_paint_white', rot=(0, 0, 0.2), bevel=0)
K.box('sunduk', (0.14, 0.09, 0.08), (TX + 0.25, TY - 0.05, 0.04), 'M_paint_red', bevel=0.008)
K.box('sunduk_ok', (0.145, 0.095, 0.015), (TX + 0.25, TY - 0.05, 0.06), 'M_iron', bevel=0)
for i in range(4):
    K.log(f'moneta{i}', 0.006, 0.018, (TX + 0.22 + i * 0.02, TY - 0.05 + random.uniform(-0.02, 0.02), 0.085), 'z', material='M_gold', segs=8, jitter=0)
# колодки для недоимщиков
KX, KY = 0.55, -0.55
for s in (-1, 1):
    K.log(f'kol_st{s}', 0.3, 0.02, (KX + s * 0.14, KY, 0.15), 'z', segs=6, jitter=0.03)
K.box('kolodka', (0.34, 0.05, 0.07), (KX, KY, 0.24), 'M_plank', bevel=0.006)
for i, x in enumerate((-0.07, 0.07)):
    K.log(f'dyra{i}', 0.055, 0.02, (KX + x, KY, 0.24), 'y', material='M_dark', segs=8, jitter=0)
# мешки-подать в очереди у крыльца
K.sacks('podat', (DX + 0.35, FY - 0.35, 0), 4)
K.barrel('b', (-0.8, FY - 0.2, 0))

tris, dims = K.finish('prikaz', out, ao_distance=0.22)
print('PRIKAZ_OK era=%d tris=%d size=%s out=%s' % (ERA, tris, dims, out))
