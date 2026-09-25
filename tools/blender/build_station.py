# СТАНЦИЯ (2×2): вокзал державы — станционный дом с часами и башенкой, перрон вдоль фасада с навесом
# на чугунных столбах, колокол отправления, фонари, лавка; сзади слева — водокачка на сваях (силуэт сверху).
# Передний правый угол (+X, -Y ≈ 0.72, -0.66) свободен — там семафор BuildingActivity._semaphore.
# Рельсы подходят спереди (railPort dx1 dy2).
# F:\blender.exe -b --factory-startup --python tools\blender\build_station.py -- <out.glb> <эпоха 1|2>
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import goyda_kit as K

out, ERA = K.cli()
random.seed(241)
K.reset_scene()
STONE = ERA == 2

W, D, CX, CY = 1.1, 0.55, 0.1, 0.35
if STONE:
    K.box('dom', (W, D, 0.55), (CX, CY, 0.33), 'M_brick', bevel=0.01)
    EAVE = 0.6
else:
    K.box('cokol', (W + 0.1, D + 0.1, 0.06), (CX, CY, 0.03), 'M_stone', bevel=0.01)
    EAVE = K.srub('s', CX, CY, W - 0.08, D - 0.08, 0.06, 6, R=0.042, ovh=0.06)
K.gable_roof('r', (CX, CY, 0), W - 0.08, D - 0.08, EAVE, ERA, ridge_axis='x', rov=0.12, R=0.042,
             gable_mat='M_brick' if STONE else None)
FY = CY - D / 2
for x in (-0.25, 0.1, 0.45):
    K.window(f'w{x}', (CX + x - 0.1, FY - 0.03, 0.34), '-y', ERA, ww=0.13, wh=0.2, shutters=False)
K.box('dver', (0.16, 0.02, 0.3), (CX + 0.35, FY - 0.035, 0.2), 'M_dark', bevel=0.004)
# башенка с часами над серединой
K.box('bashenka', (0.22, 0.22, 0.28), (CX, CY - 0.05, EAVE + 0.25), 'M_brick' if STONE else 'M_plank', bevel=0.006)
K.log('chasy', 0.02, 0.075, (CX, CY - 0.165, EAVE + 0.27), 'y', material='M_paint_white', segs=16, jitter=0)
K.log('chasy_ob', 0.022, 0.085, (CX, CY - 0.16, EAVE + 0.27), 'y', material='M_gold', segs=16, jitter=0)
for a, l in ((0.3, 0.05), (1.9, 0.035)):
    K.box(f'strelka{a}', (0.008, 0.005, l), (CX + math.sin(a) * l / 2, CY - 0.178, EAVE + 0.27 + math.cos(a) * l / 2), 'M_dark', rot=(0, a, 0), bevel=0)
K.tent('bashenka_sh', (CX, CY - 0.05, EAVE + 0.39), 0.3, 0.28, ERA, top_mat='M_roof' if ERA == 1 else 'M_roof_iron')
K.log('shpil', 0.12, 0.008, (CX, CY - 0.05, EAVE + 0.72), 'z', material='M_gold', segs=5, jitter=0)
# перрон и навес
PY = FY - 0.28
K.box('perron', (1.6, 0.42, 0.08), (0, PY, 0.04), 'M_stone', bevel=0.01)
K.box('perron_kray', (1.6, 0.04, 0.085), (0, PY - 0.2, 0.045), 'M_paint_white', bevel=0.004)
for x in (-0.6, -0.15, 0.3):
    K.log(f'n_st{x}', 0.5, 0.016, (x, PY - 0.12, 0.33), 'z', material='M_iron', segs=8, jitter=0)
    K.lathe(f'n_kap{x}', [(0.016, 0), (0.035, 0.03)], (x, PY - 0.12, 0.55), 'M_iron', segs=8)
K.box('naves', (1.2, 0.46, 0.02), (-0.15, PY + 0.02, 0.6), 'M_roof_iron' if STONE else 'M_roof', rot=(-0.15, 0, 0), bevel=0.003)
K.box('naves_kruzh', (1.2, 0.01, 0.04), (-0.15, PY - 0.21, 0.56), 'M_paint_white', bevel=0)
# колокол, фонари, лавка
K.lathe('kolokol', [(0.0, 0.07), (0.02, 0.07), (0.035, 0.03), (0.045, 0.0)], (-0.4, FY - 0.03, 0.42), 'M_gold', segs=10)
K.box('kolokol_kr', (0.06, 0.04, 0.02), (-0.4, FY - 0.02, 0.5), 'M_iron', bevel=0)
for x in (-0.75, 0.5):
    K.log(f'fonar_st{x}', 0.5, 0.01, (x, PY - 0.16, 0.33), 'z', material='M_iron', segs=5, jitter=0)
    K.box(f'fonar{x}', (0.05, 0.05, 0.07), (x, PY - 0.16, 0.6), 'M_fire', bevel=0.006)
K.box('lavka', (0.3, 0.07, 0.02), (0.05, PY + 0.05, 0.16), 'M_plank', bevel=0.003)
for s in (-1, 1):
    K.box(f'lavka_n{s}', (0.02, 0.06, 0.08), (0.05 + s * 0.12, PY + 0.05, 0.12), 'M_iron', bevel=0)
# водокачка на сваях сзади слева
WX, WY = -0.62, 0.55
for sx in (-1, 1):
    for sy in (-1, 1):
        K.log(f'vk_sv{sx}{sy}', 0.62, 0.02, (WX + sx * 0.12, WY + sy * 0.12, 0.31), 'z', segs=6, jitter=0.02)
K.log('vk_bak', 0.28, 0.2, (WX, WY, 0.76), 'z', material='M_plank', segs=14, jitter=0.02)
for z in (0.66, 0.86):
    K.log(f'vk_obr{z}', 0.02, 0.205, (WX, WY, z), 'z', material='M_iron', segs=14, jitter=0)
K.lathe('vk_kr', [(0.23, 0), (0.0, 0.14)], (WX, WY, 0.9), 'M_roof' if ERA == 1 else 'M_roof_iron', segs=14)
K.box('vk_hobot', (0.03, 0.2, 0.03), (WX + 0.18, WY - 0.12, 0.66), 'M_iron', rot=(0.5, 0, 0), bevel=0)

tris, dims = K.finish('station', out, ao_distance=0.22)
print('STATION_OK era=%d tris=%d size=%s out=%s' % (ERA, tris, dims, out))
