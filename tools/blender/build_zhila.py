# САМОЦВЕТНАЯ ЖИЛА (2×2): скальный выход с уступами разработки и светящимися жилами самоцветов,
# журавль-подъёмник, стол сортировки, корзины. Передний правый угол (+X, -Y ≈ 0.48, -0.56) свободен —
# там большая друза из BuildingActivity._gemVein.
# F:\blender.exe -b --factory-startup --python tools\blender\build_zhila.py -- <out.glb> <эпоха>
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import goyda_kit as K

out, ERA = K.cli()
random.seed(131)
K.reset_scene()

# скальный выход с тремя уступами
K.rock('skala', (-0.15, 0.4, 0.22), (0.75, 0.5, 0.55))
K.rock('skala2', (0.5, 0.55, 0.14), (0.4, 0.35, 0.35))
for i, (z, y) in enumerate(((0.06, -0.05), (0.16, 0.08), (0.28, 0.2))):
    K.box(f'ustup{i}', (0.7 - i * 0.12, 0.22, z * 2), (-0.2, y, z), 'M_stone', bevel=0.02)
# жилы: кристаллы, торчащие из скалы
for i in range(9):
    x = random.uniform(-0.7, 0.4)
    y = random.uniform(0.15, 0.6)
    z = random.uniform(0.15, 0.55)
    K.crystal(f'kr{i}', (x, y, z), random.uniform(0.1, 0.2), random.uniform(0.025, 0.04),
              tilt=(random.uniform(-0.5, 0.5), random.uniform(-0.5, 0.5)))
# журавль-подъёмник (слева)
JX, JY = -0.7, -0.35
K.log('zh_stoyka', 0.6, 0.025, (JX, JY, 0.3), 'z', segs=6, jitter=0.03)
K.log('zh_strela', 0.8, 0.018, (JX + 0.22, JY + 0.1, 0.62), 'x', segs=6, jitter=0.02)
K.log('zh_ver', 0.35, 0.004, (JX + 0.55, JY + 0.1, 0.44), 'z', material='M_cloth', segs=4, jitter=0)
K.lathe('zh_korzina', [(0.03, 0), (0.06, 0.07), (0.065, 0.08)], (JX + 0.55, JY + 0.1, 0.2), 'M_thatch', segs=8)
# стол сортировки с горстью самоцветов
TX, TY = -0.1, -0.55
K.box('stol', (0.4, 0.2, 0.025), (TX, TY, 0.2), 'M_plank', bevel=0.004)
for sx in (-1, 1):
    K.box(f'stol_n{sx}', (0.03, 0.16, 0.19), (TX + sx * 0.16, TY, 0.095), 'M_plank', bevel=0.003)
for i in range(6):
    K.crystal(f'na_stole{i}', (TX + random.uniform(-0.15, 0.15), TY + random.uniform(-0.06, 0.06), 0.212),
              0.035, 0.012, tilt=(1.4, 0))
# корзины с добычей
for i, x in enumerate((-0.45, -0.34)):
    K.lathe(f'korz{i}', [(0.04, 0), (0.07, 0.09), (0.075, 0.1)], (x, -0.75, 0), 'M_thatch', segs=10)
    for k in range(3):
        K.crystal(f'korz_k{i}{k}', (x + random.uniform(-0.03, 0.03), -0.75 + random.uniform(-0.03, 0.03), 0.07),
                  0.06, 0.018, tilt=(random.uniform(-0.4, 0.4), 0))
# фонарь
K.log('fonar_st', 0.4, 0.01, (0.15, -0.2, 0.2), 'z', material='M_iron', segs=5, jitter=0)
K.box('fonar', (0.05, 0.05, 0.07), (0.15, -0.2, 0.42), 'M_fire', bevel=0.008)

tris, dims = K.finish('zhila', out, ao_distance=0.2)
print('ZHILA_OK era=%d tris=%d size=%s out=%s' % (ERA, tris, dims, out))
