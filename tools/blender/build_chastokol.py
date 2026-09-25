# ЧАСТОКОЛ — узловой столб (1×1): пучок из четырёх заострённых кольев разной высоты.
# Пролёты между узлами достраивает игра (Placeholders.wallConnSegment по маске соседей),
# поэтому узел симметричен и одинаково смотрится при любом направлении стены.
# F:\blender.exe -b --factory-startup --python tools\blender\build_chastokol.py -- <out.glb>
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import goyda_kit as K

out, _ = K.cli()
random.seed(101)
K.reset_scene()

for i, (x, y) in enumerate(((-0.1, -0.1), (0.1, -0.1), (-0.1, 0.1), (0.1, 0.1))):
    h = random.uniform(0.78, 0.9)
    r = random.uniform(0.07, 0.08)
    K.log(f'kol{i}', h, r, (x, y, h / 2), 'z', segs=8, jitter=0.12)
    K.lathe(f'ostr{i}', [(r, 0), (r * 0.5, 0.08), (0.0, 0.17)], (x, y, h), 'M_log', segs=8)
# стяжка-обвязка вокруг пучка и подсыпка камнями у основания
for z in (0.32, 0.6):
    K.log(f'obvyaz{z}', 0.03, 0.2, (0, 0, z), 'z', material='M_plank', segs=10, jitter=0.02)
for i in range(5):
    a = i / 5 * math.tau
    K.box(f'kamen{i}', (0.09, 0.08, 0.06), (math.cos(a) * 0.22, math.sin(a) * 0.22, 0.03), 'M_stone',
          rot=(0, 0, a), bevel=0.02)

tris, dims = K.finish('chastokol', out, ao_distance=0.15)
print('CHASTOKOL_OK tris=%d size=%s out=%s' % (tris, dims, out))
