# РУДНИК (2×2): скальный холм со штольней в бревенчатом крепе, рельсы вдоль фасада (по ним катается
# вагонетка из BuildingActivity._mineCart: x ±0.46 при y=-0.62), ворот с бадьёй над шурфом,
# навес с кайлами, куча руды, фонарь у входа.
# F:\blender.exe -b --factory-startup --python tools\blender\build_rudnik.py -- <out.glb> <эпоха>
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import goyda_kit as K

out, ERA = K.cli()
random.seed(121)
K.reset_scene()

# скальный холм
K.rock('holm', (0.0, 0.35, 0.18), (0.85, 0.55, 0.5))
K.rock('holm2', (-0.55, 0.45, 0.12), (0.4, 0.4, 0.35))
K.rock('holm3', (0.55, 0.5, 0.1), (0.35, 0.35, 0.3))
for i in range(6):
    K.rock(f'kamni{i}', (random.uniform(-0.8, 0.8), random.uniform(-0.1, 0.8), 0.03), (0.07, 0.07, 0.05))

# штольня: тёмный проём и крепь (стойки + верхняк)
K.box('proem', (0.34, 0.2, 0.36), (0, -0.1, 0.18), 'M_dark', bevel=0)
for s in (-1, 1):
    K.log(f'stoyka{s}', 0.42, 0.035, (s * 0.2, -0.2, 0.21), 'z', segs=8, jitter=0.05)
K.log('verhnyak', 0.52, 0.04, (0, -0.2, 0.43), 'x', segs=8, jitter=0.05)
K.box('kozyrek', (0.6, 0.25, 0.025), (0, -0.28, 0.5), 'M_paint_green' if ERA == 2 else 'M_plank', rot=(-0.3, 0, 0), bevel=0.004)

# рельсы вдоль фасада: шпалы + две нитки, плюс ответвление в штольню
RY = -0.62
for i in range(11):
    K.box(f'shpala{i}', (0.05, 0.3, 0.02), (-0.7 + i * 0.14, RY, 0.01), 'M_plank', bevel=0.003)
for s in (-1, 1):
    K.box(f'relsa{s}', (1.5, 0.02, 0.02), (0, RY + s * 0.1, 0.03), 'M_iron', bevel=0)
for i in range(3):
    K.box(f'shpala_v{i}', (0.26, 0.05, 0.02), (0, -0.25 - i * 0.12, 0.01), 'M_plank', bevel=0.003)
for s in (-1, 1):
    K.box(f'relsa_v{s}', (0.02, 0.4, 0.02), (s * 0.08, -0.35, 0.03), 'M_iron', bevel=0)

# ворот с бадьёй над шурфом (справа)
WX, WY = 0.6, -0.15
K.box('shurf', (0.26, 0.26, 0.04), (WX, WY, 0.02), 'M_dark', bevel=0)
for s in (-1, 1):
    K.box(f'srub_sh{s}', (0.3, 0.04, 0.08), (WX, WY + s * 0.14, 0.05), 'M_log', bevel=0.006)
    K.box(f'stoyka_v{s}', (0.03, 0.03, 0.34), (WX + s * 0.15, WY, 0.17), 'M_log', bevel=0.004)
K.log('val', 0.34, 0.025, (WX, WY, 0.34), 'x', segs=8, jitter=0)
K.box('ruchka', (0.02, 0.02, 0.1), (WX + 0.18, WY, 0.3), 'M_iron', bevel=0)
K.log('verevka', 0.2, 0.004, (WX, WY, 0.23), 'z', material='M_cloth', segs=4, jitter=0)
K.barrel('badya', (WX, WY, 0.07), r=0.04, h=0.06)

# навес с кайлами (слева) и куча руды
NX = -0.62
for sx in (-1, 1):
    K.log(f'n_st{sx}', 0.4, 0.018, (NX + sx * 0.14, -0.2, 0.2), 'z', segs=6, jitter=0.03)
K.box('n_krysha', (0.36, 0.3, 0.02), (NX, -0.12, 0.42), 'M_paint_green' if ERA == 2 else 'M_plank', rot=(0.3, 0, 0), bevel=0.003)
for i in range(3):
    K.box(f'kaylo_r{i}', (0.012, 0.012, 0.26), (NX - 0.08 + i * 0.07, -0.02, 0.15), 'M_plank', rot=(0.2, 0, 0), bevel=0)
    K.box(f'kaylo_g{i}', (0.012, 0.09, 0.02), (NX - 0.08 + i * 0.07, 0.0, 0.27), 'M_iron', rot=(0.2, 0, 0), bevel=0)
for i in range(7):
    K.rock(f'ruda{i}', (0.35 + random.uniform(-0.12, 0.12), -0.95 + random.uniform(-0.06, 0.06) + 0.1, 0.03 + (0.04 if i > 4 else 0)),
           (0.06, 0.06, 0.05), 'M_iron')
# фонарь у штольни
K.log('fonar_st', 0.36, 0.01, (-0.25, -0.3, 0.18), 'z', material='M_iron', segs=5, jitter=0)
K.box('fonar', (0.05, 0.05, 0.07), (-0.25, -0.3, 0.38), 'M_fire', bevel=0.008)

tris, dims = K.finish('rudnik', out, ao_distance=0.2)
print('RUDNIK_OK era=%d tris=%d size=%s out=%s' % (ERA, tris, dims, out))
