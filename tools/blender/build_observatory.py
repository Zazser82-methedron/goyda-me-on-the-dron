# ОБСЕРВАТОРИЯ (2×2): «звездочётная палата» — восьмигранный столп в два яруса, наружная лестница,
# открытая площадка с перилами и большая подзорная труба на треноге. Над площадкой BuildingActivity._orrery
# вращает планетарий (высоту берёт из ORRERY_Y в BuildingActivity).
# F:\blender.exe -b --factory-startup --python tools\blender\build_observatory.py -- <out.glb> <эпоха>
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import goyda_kit as K

out, ERA = K.cli()
random.seed(141)
K.reset_scene()
WALL = 'M_plaster' if ERA == 2 else 'M_stone'

K.octagon('osn', (0, 0, 0), 0.62, 0.12, 'M_brick' if ERA == 2 else 'M_stone')
Z1 = K.octagon('yarus1', (0, 0, 0.12), 0.5, 0.62, WALL)
K.octagon('poyas1', (0, 0, Z1), 0.55, 0.05, 'M_brick' if ERA else 'M_plank')
Z2 = K.octagon('yarus2', (0, 0, Z1 + 0.05), 0.4, 0.45, WALL)
K.octagon('ploshad', (0, 0, Z2), 0.52, 0.05, 'M_plank')
PZ = Z2 + 0.05
# перила площадки
for i in range(8):
    a = i * math.pi / 4 + math.pi / 8
    K.log(f'stolbik{i}', 0.16, 0.012, (math.cos(a) * 0.47, math.sin(a) * 0.47, PZ + 0.08), 'z', material='M_paint_white' if ERA else 'M_plank', segs=5, jitter=0)
K.lathe('perila', [(0.47, 0), (0.49, 0), (0.49, 0.02), (0.47, 0.02)], (0, 0, PZ + 0.15), 'M_paint_white' if ERA else 'M_plank', segs=16)
# подзорная труба на треноге
for i in range(3):
    a = i * math.tau / 3
    K.box(f'trenoga{i}', (0.015, 0.015, 0.26), (0.12 + math.cos(a) * 0.05, 0.05 + math.sin(a) * 0.05, PZ + 0.12), 'M_plank',
          rot=(math.sin(a) * 0.3, -math.cos(a) * 0.3, 0), bevel=0)
tube = K.log('truba', 0.46, 0.035, (0.12, 0.05, PZ + 0.3), 'x', material='M_gold', segs=10, jitter=0)
tube.rotation_euler = (0, math.pi / 2 - 0.55, 0.4)
K.log('truba_okulyar', 0.08, 0.02, (0.12 - 0.19, 0.05 - 0.08, PZ + 0.18), 'x', material='M_iron', segs=8, jitter=0)
# окна ярусов
for i in range(4):
    a = i * math.pi / 2
    K.box(f'okno1_{i}', (0.02, 0.1, 0.2), (math.cos(a) * 0.47, math.sin(a) * 0.47, 0.45), 'M_window', rot=(0, 0, a), bevel=0)
    K.box(f'okno2_{i}', (0.02, 0.08, 0.16), (math.cos(a + math.pi / 4) * 0.38, math.sin(a + math.pi / 4) * 0.38, Z1 + 0.28),
          'M_window', rot=(0, 0, a + math.pi / 4), bevel=0)
# дверь и наружная лестница
K.box('dver', (0.18, 0.03, 0.3), (0, -0.5, 0.27), 'M_dark', bevel=0.004)
for i in range(4):
    K.box(f'st{i}', (0.3, 0.09, 0.04), (0, -0.58 - i * 0.08, 0.1 - i * 0.03), 'M_stone', bevel=0.006)
# звёздные карты-свитки и глобус у входа
K.lathe('globus_n', [(0.04, 0), (0.015, 0.12)], (0.45, -0.55, 0), 'M_plank', segs=8)
K.lathe('globus', [(0.0, 0), (0.05, 0.02), (0.07, 0.07), (0.05, 0.12), (0.0, 0.14)], (0.45, -0.55, 0.12), 'M_paint_blue', segs=12)
K.add_marker('orrery_anchor', (0, 0, PZ + 0.55))

tris, dims = K.finish('observatory', out, ao_distance=0.22)
print('OBSERVATORY_OK era=%d tris=%d size=%s orrery_y=%.2f out=%s' % (ERA, tris, dims, PZ + 0.55, out))
