# ТРАКТИР (2×2): двухэтажный сруб с гульбищем-балконом на втором этаже, пивные бочки штабелем,
# уличные столы с лавками, кружки, погреб-лаз. Передний правый угол (+X, -Y) свободен — вывеска
# и фонарь из BuildingActivity._sign.
# F:\blender.exe -b --factory-startup --python tools\blender\build_traktir.py -- <out.glb> <эпоха>
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import goyda_kit as K

out, ERA = K.cli()
random.seed(91)
K.reset_scene()

W, D, CY = 1.3, 0.85, 0.35
R = 0.045
BASE = 0.08
K.box('cokol', (W + 0.12, D + 0.12, BASE), (-0.1, CY, BASE / 2), 'M_brick' if ERA == 2 else 'M_stone', bevel=0.012)
EAVE = K.srub('s', -0.1, CY, W, D, BASE, 12, R=R, ovh=0.08)
RIDGE = K.gable_roof('r', (-0.1, CY, 0), W, D, EAVE, ERA, ridge_axis='x', rov=0.15, R=R)

FY = CY - D / 2 - R
# первый этаж: широкая дверь и окна; второй этаж: окна за балконом
K.box('dver', (0.22, 0.02, 0.32), (-0.1, FY - 0.005, BASE + 0.17), 'M_dark', bevel=0.004)
K.box('dver_n', (0.28, 0.025, 0.38), (-0.1, FY, BASE + 0.19), 'M_paint_white' if ERA else 'M_plank', bevel=0.004)
for x in (-0.55, 0.32):
    K.window(f'w1{x}', (x, FY - 0.004, BASE + 0.25), '-y', ERA, ww=0.16, wh=0.18)
for x in (-0.5, -0.1, 0.3):
    K.window(f'w2{x}', (x, FY - 0.004, BASE + 0.72), '-y', ERA, ww=0.14, wh=0.18, shutters=False)
# гульбище: балкон на консолях с резными перилами
BZ = BASE + 0.54
K.box('balkon', (1.2, 0.24, 0.035), (-0.1, FY - 0.12, BZ), 'M_plank', bevel=0.004)
for x in (-0.6, -0.1, 0.4):
    K.box(f'konsol{x}', (0.04, 0.22, 0.05), (x, FY - 0.1, BZ - 0.04), 'M_log', bevel=0.005)
K.box('perila', (1.2, 0.02, 0.02), (-0.1, FY - 0.23, BZ + 0.16), 'M_paint_white' if ERA else 'M_plank', bevel=0.002)
for k in range(13):
    K.box(f'bal{k}', (0.018, 0.018, 0.14), (-0.68 + k * 0.097, FY - 0.23, BZ + 0.08), 'M_paint_white' if ERA else 'M_plank', bevel=0.002)
# навес над дверью
K.box('kozyrek', (0.44, 0.2, 0.02), (-0.1, FY - 0.1, BASE + 0.44), 'M_roof_iron' if ERA == 2 else 'M_roof', rot=(-0.3, 0, 0), bevel=0.003)

# бочки штабелем у левой стены (3 + 2)
for i in range(3):
    K.log(f'boch_n{i}', 0.18, 0.06, (-0.9, -0.1 + i * 0.13, 0.06), 'y', material='M_plank', segs=10, jitter=0.02)
for i in range(2):
    K.log(f'boch_v{i}', 0.18, 0.06, (-0.9, -0.035 + i * 0.13, 0.17), 'y', material='M_plank', segs=10, jitter=0.02)
# уличные столы с лавками и кружками
for t, (x, y) in enumerate(((-0.55, -0.55), (0.05, -0.62))):
    K.box(f'stol{t}', (0.36, 0.18, 0.025), (x, y, 0.2), 'M_plank', bevel=0.004)
    for s in (-1, 1):
        K.box(f'stol_n{t}{s}', (0.03, 0.14, 0.19), (x + s * 0.14, y, 0.095), 'M_plank', bevel=0.003)
        K.box(f'lavka{t}{s}', (0.36, 0.07, 0.02), (x, y + s * 0.16, 0.12), 'M_plank', bevel=0.003)
    for k in range(3):
        K.log(f'kruzhka{t}{k}', 0.035, 0.014, (x - 0.1 + k * 0.1, y + random.uniform(-0.04, 0.04), 0.23), 'z',
              material='M_plank' if k % 2 else 'M_iron', segs=8, jitter=0)
# погреб-лаз
K.box('pogreb', (0.26, 0.2, 0.06), (0.45, CY + D / 2 + 0.15, 0.03), 'M_plank', rot=(0.25, 0, 0), bevel=0.005)

tris, dims = K.finish('traktir', out, ao_distance=0.25)
print('TRAKTIR_OK era=%d tris=%d size=%s out=%s' % (ERA, tris, dims, out))
