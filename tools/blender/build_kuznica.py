# КУЗНИЦА (1×1): каменный низ, рубленый верх, мощная труба горна со светящимися углями,
# навес над рабочим двором, стойка с инструментом, чан для закалки, куча угля, прутки железа.
# Двор перед фасадом (-Y, ~0.46) свободен — там наковальня и молот из BuildingActivity (_forge).
# F:\blender.exe -b --factory-startup --python tools\blender\build_kuznica.py -- <out.glb> <эпоха>
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import goyda_kit as K

out, ERA = K.cli()
random.seed(41)
K.reset_scene()

W, D, CY = 0.78, 0.5, 0.2
R = 0.038
STONE_H = 0.26

K.box('niz', (W + 2 * R, D + 2 * R, STONE_H), (0, CY, STONE_H / 2), 'M_brick' if ERA == 2 else 'M_stone', bevel=0.012)
EAVE = K.srub('s', 0, CY, W, D, STONE_H, 4, R=R, ovh=0.05)
RIDGE = K.gable_roof('r', (0, CY, 0), W, D, EAVE, ERA, ridge_axis='x', rov=0.12, R=R)

# ворота-проём с тёмным нутром и отсветом горна
FY = CY - D / 2 - R
K.box('proem', (0.3, 0.02, 0.36), (0.08, FY - 0.004, 0.2), 'M_dark', bevel=0)
K.box('otsvet', (0.16, 0.012, 0.09), (0.08, FY - 0.012, 0.11), 'M_fire', bevel=0)
K.box('proem_n', (0.36, 0.025, 0.04), (0.08, FY - 0.01, 0.39), 'M_plank', bevel=0.004)

# труба горна у левого угла: широкая кладка, сужение, колпак, угли в устье
CX = -(W / 2 + R + 0.1)      # горн пристроен снаружи к левой стене — угли видны с камеры
K.box('gorn', (0.22, 0.3, 0.5), (CX, CY - 0.02, 0.25), 'M_brick' if ERA else 'M_stone', bevel=0.015)
K.box('gorn_ustye', (0.12, 0.02, 0.09), (CX, CY - 0.02 - 0.155, 0.17), 'M_fire', bevel=0)
K.box('truba', (0.16, 0.16, 0.62), (CX, CY + 0.05, RIDGE - 0.1), 'M_brick' if ERA else 'M_stone', bevel=0.01)
K.box('truba_cap', (0.21, 0.21, 0.03), (CX, CY + 0.05, RIDGE + 0.22), 'M_iron' if ERA == 2 else 'M_stone', bevel=0.005)
K.add_marker('chimney_top', (CX, CY + 0.05, RIDGE + 0.25))

# навес над двором на двух столбах
NZ = EAVE - 0.03
K.box('naves', (0.86, 0.36, 0.025), (0.02, FY - 0.17, NZ), 'M_paint_green' if ERA == 2 else 'M_plank', rot=(-0.3, 0, 0), bevel=0.004)
for s in (-1, 1):
    K.log(f'nst{s}', NZ, 0.02, (0.02 + s * 0.38, FY - 0.32, NZ / 2), 'z', segs=6, jitter=0.03)

# правая стена: стойка с инструментом (клещи, молоты), прутки
SX = W / 2 + R + 0.02
K.box('stoyka', (0.02, 0.36, 0.22), (SX, CY, 0.32), 'M_plank', bevel=0.003)
for i, y in enumerate((-0.1, 0.0, 0.1)):
    K.box(f'instr{i}', (0.015, 0.02, 0.16), (SX + 0.015, CY + y, 0.3), 'M_iron', bevel=0)
    K.box(f'instr_h{i}', (0.02, 0.06, 0.03), (SX + 0.02, CY + y, 0.39), 'M_iron', bevel=0.003)
for i in range(4):
    K.box(f'prut{i}', (0.02, 0.02, 0.36), (SX + 0.05, CY + 0.2 + i * 0.025, 0.18), 'M_iron', rot=(0.18, 0, 0), bevel=0)

# чан для закалки, куча угля, заготовки
K.log('chan', 0.1, 0.075, (0.42, FY - 0.08, 0.05), 'z', material='M_plank', segs=10, jitter=0.02)
K.log('chan_voda', 0.005, 0.066, (0.42, FY - 0.08, 0.098), 'z', material='M_window', segs=10, jitter=0)
for i in range(6):
    K.box(f'ugol{i}', (0.07, 0.07, 0.05), (-0.36 + random.uniform(-0.06, 0.06), FY - 0.12 + random.uniform(-0.05, 0.05), 0.02 + (0.03 if i > 3 else 0)),
          'M_dark', rot=(random.uniform(0, 1), random.uniform(0, 1), random.uniform(0, 1)), bevel=0.015)

# наковальня на чурбаке — молот и заготовку анимирует игра (BuildingActivity._forge)
AX, AY = -0.2, -0.48
K.log('churbak', 0.14, 0.055, (AX, AY, 0.07), 'z', segs=10, jitter=0.08)
K.box('nakov', (0.1, 0.05, 0.045), (AX, AY, 0.178), 'M_iron', bevel=0.006)
K.box('nakov_nog', (0.05, 0.035, 0.03), (AX, AY, 0.15), 'M_iron', bevel=0.004)
K.prism('nakov_rog', [(0, 0.16), (0, 0.2), (0.07, 0.195)], 0.03, 'y', (AX + 0.05, AY, 0), 'M_iron')

tris, dims = K.finish('kuznica', out, ao_distance=0.2)
print('KUZNICA_OK era=%d tris=%d size=%s out=%s' % (ERA, tris, dims, out))
