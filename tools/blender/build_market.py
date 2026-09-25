# ТОРГ (2×2): торговые ряды — три лавки под общей кровлей, полосатые пологи, прилавки с товаром
# (бочки, мешки, горшки, штуки ткани), весы, амбарчик-лабаз за рядами.
# Передний правый угол (+X, -Y) свободен — там вывеска и фонарь из BuildingActivity._sign.
# F:\blender.exe -b --factory-startup --python tools\blender\build_market.py -- <out.glb> <эпоха>
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import goyda_kit as K

out, ERA = K.cli()
random.seed(71)
K.reset_scene()

# лабаз (склад) у задней границы
LEAVE = K.srub('lab', 0, 0.62, 1.5, 0.45, 0.06, 5, R=0.04, ovh=0.06)
K.box('lab_c', (1.62, 0.56, 0.06), (0, 0.62, 0.03), 'M_brick' if ERA == 2 else 'M_stone', bevel=0.01)
K.gable_roof('lr', (0, 0.62, 0), 1.5, 0.45, LEAVE, ERA, ridge_axis='x', rov=0.1, R=0.04)
for x in (-0.4, 0.4):
    K.box(f'lab_d{x}', (0.16, 0.02, 0.26), (x, 0.62 - 0.225 - 0.04, 0.2), 'M_dark', bevel=0.004)

# ряды: три лавки вдоль X, общая односкатная кровля на столбах
ROW_Y = 0.05
PAL = [('M_paint_red', 'M_paint_white'), ('M_paint_blue', 'M_paint_white'), ('M_paint_green', 'M_wheat')]
for i, x in enumerate((-0.62, -0.05, 0.52)):
    # прилавок
    K.box(f'pril{i}', (0.46, 0.16, 0.2), (x, ROW_Y - 0.12, 0.1), 'M_plank', bevel=0.006)
    K.box(f'pril_t{i}', (0.5, 0.2, 0.025), (x, ROW_Y - 0.12, 0.21), 'M_plank', bevel=0.004)
    # стойки и полосатый полог
    for s in (-1, 1):
        K.log(f'st{i}{s}', 0.62, 0.016, (x + s * 0.23, ROW_Y - 0.22, 0.31), 'z', segs=6, jitter=0.02)
        K.log(f'stz{i}{s}', 0.7, 0.016, (x + s * 0.23, ROW_Y + 0.18, 0.35), 'z', segs=6, jitter=0.02)
    for k in range(5):
        K.box(f'polog{i}{k}', (0.1, 0.5, 0.012), (x - 0.2 + k * 0.1, ROW_Y - 0.03, 0.66), PAL[i][k % 2],
              rot=(-0.28, 0, 0), bevel=0)
    K.box(f'bahroma{i}', (0.5, 0.012, 0.04), (x, ROW_Y - 0.275, 0.58), PAL[i][0], bevel=0)
# товар на прилавках
K.barrel('t_b1', (-0.75, ROW_Y - 0.12, 0.22), r=0.04, h=0.09)
K.barrel('t_b2', (-0.62, ROW_Y - 0.1, 0.22), r=0.04, h=0.09)
K.sacks('t_m', (-0.48, ROW_Y - 0.12, 0.22), 2)
for k in range(4):                  # горшки
    K.lathe(f'gorsh{k}', [(0.02, 0), (0.035, 0.02), (0.03, 0.05), (0.02, 0.06), (0.024, 0.07)],
            (-0.18 + k * 0.08, ROW_Y - 0.12, 0.225), 'M_brick', segs=10)
for k, m in enumerate(('M_paint_red', 'M_paint_blue', 'M_wheat', 'M_paint_white')):   # штуки ткани
    K.log(f'tkan{k}', 0.16, 0.025, (0.4 + k * 0.07, ROW_Y - 0.12, 0.25), 'y', material=m, segs=8, jitter=0)
# весы посреди площади
K.log('vesy_st', 0.34, 0.015, (-0.3, -0.62, 0.17), 'z', material='M_iron', segs=6, jitter=0)
K.box('vesy_k', (0.3, 0.015, 0.015), (-0.3, -0.62, 0.34), 'M_iron', bevel=0)
for s in (-1, 1):
    K.lathe(f'vesy_c{s}', [(0.0, 0), (0.05, 0.015), (0.055, 0.025)], (-0.3 + s * 0.14, -0.62, 0.24), 'M_gold', segs=10)
# ящики и бочки у площади
K.barrel('b1', (-0.8, -0.5, 0))
K.barrel('b2', (-0.72, -0.62, 0))
for k in range(3):
    b = K.box(f'yashik{k}', (0.12, 0.12, 0.1), (-0.05 + k * 0.13, -0.7, 0.05 + (0.1 if k == 1 else 0) * 0), 'M_plank', rot=(0, 0, random.uniform(-0.3, 0.3)), bevel=0.008)
    b['vary'] = 1
K.box('mostki', (1.7, 0.4, 0.015), (0, ROW_Y - 0.25, 0.008), 'M_plank', bevel=0)

tris, dims = K.finish('market', out, ao_distance=0.22)
print('MARKET_OK era=%d tris=%d size=%s out=%s' % (ERA, tris, dims, out))
