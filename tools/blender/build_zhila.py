# САМОЦВЕТНАЯ ЖИЛА (2×2). Главный силуэт — крупные светящиеся друзы, растущие прямо из расколотой
# слоистой скалы (видны сверху и ночью). Вокруг — деревянные мостки с лестницей на уступ, палатка
# старателей, лоток сортировки, ящики с сияющими камнями, фонари. Передний правый угол
# (+X, -Y ≈ 0.48, -0.56) свободен — там анимированная друза BuildingActivity._gemVein.
# F:\blender.exe -b --factory-startup --python tools\blender\build_zhila.py -- <out.glb> <эпоха>
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import goyda_kit as K

out, ERA = K.cli()
random.seed(132)
K.reset_scene()

# ---- две половины расколотой скалы с тёмной трещиной между ними
T1 = K.cliff('skalaL', (-0.42, 0.42, 0), 0.8, 0.8, 0.85, layers=4)
T2 = K.cliff('skalaR', (0.38, 0.5, 0), 0.62, 0.62, 0.7, layers=3)
K.box('treshina', (0.12, 0.7, 0.6), (-0.02, 0.45, 0.3), 'M_dark', bevel=0)

# ---- друзы: в трещине самая крупная, по уступам меньше
K.druza('dr_glav', (-0.02, 0.4, 0.05), size=1.5)
K.druza('dr_L', (-0.55, 0.3, T1 - 0.05), size=0.9)
K.druza('dr_R', (0.45, 0.52, T2 - 0.05), size=0.8)
K.druza('dr_niz', (-0.35, -0.05, 0.0), size=0.7)
for i in range(6):   # мелкие жилки на гранях скалы
    K.crystal(f'zhilka{i}', (random.uniform(-0.8, 0.7), random.uniform(0.1, 0.25), random.uniform(0.1, 0.5)),
              random.uniform(0.08, 0.14), random.uniform(0.02, 0.03), tilt=(-0.9, random.uniform(-0.4, 0.4)))

# ---- мостки вдоль скалы и лестница на левый уступ
MY = 0.0
K.box('mostki', (1.0, 0.18, 0.025), (-0.15, MY, 0.3), 'M_plank', bevel=0.004)
for x in (-0.6, -0.15, 0.3):
    K.log(f'most_st{x}', 0.32, 0.018, (x, MY - 0.07, 0.15), 'z', segs=6, jitter=0.03)
K.box('most_peril', (1.0, 0.015, 0.015), (-0.15, MY - 0.085, 0.44), 'M_plank', bevel=0)
for x in (-0.6, -0.15, 0.3):
    K.log(f'most_pst{x}', 0.15, 0.01, (x, MY - 0.085, 0.37), 'z', segs=5, jitter=0)
for i in range(5):
    K.box(f'lest{i}', (0.16, 0.06, 0.02), (0.2, MY - 0.2 - i * 0.07, 0.27 - i * 0.055), 'M_plank', bevel=0.003)
K.box('lest_kos', (0.02, 0.4, 0.03), (0.28, MY - 0.33, 0.16), 'M_plank', rot=(0.65, 0, 0), bevel=0)

# ---- палатка старателей слева спереди
PX, PY = -0.66, -0.5
for s in (-1, 1):
    K.box(f'palatka{s}', (0.34, 0.3, 0.012), (PX, PY + s * 0.1, 0.16), 'M_cloth', rot=(s * 0.75, 0, 0), bevel=0)
K.log('palatka_konek', 0.4, 0.01, (PX, PY, 0.28), 'x', segs=5, jitter=0)
K.box('kostrishche', (0.12, 0.12, 0.02), (PX + 0.3, PY + 0.05, 0.01), 'M_dark', bevel=0.01)
K.box('ugli', (0.06, 0.06, 0.02), (PX + 0.3, PY + 0.05, 0.025), 'M_fire', bevel=0.008)

# ---- лоток сортировки и ящики с камнями
TX, TY = -0.05, -0.55
K.box('lotok', (0.36, 0.18, 0.03), (TX, TY, 0.2), 'M_plank', rot=(0, 0.12, 0), bevel=0.004)
for sx in (-1, 1):
    K.box(f'lotok_n{sx}', (0.03, 0.15, 0.19), (TX + sx * 0.15, TY, 0.095), 'M_plank', bevel=0.003)
for i in range(5):
    K.crystal(f'na_lotke{i}', (TX + random.uniform(-0.14, 0.14), TY + random.uniform(-0.05, 0.05), 0.215), 0.05, 0.014, tilt=(1.3, 0))
for i, (x, y) in enumerate(((0.12, -0.8), (0.26, -0.82))):
    K.box(f'yashik{i}', (0.13, 0.11, 0.08), (x, y, 0.04), 'M_plank', rot=(0, 0, random.uniform(-0.3, 0.3)), bevel=0.006)
    for k in range(3):
        K.crystal(f'yashik_k{i}{k}', (x + random.uniform(-0.04, 0.04), y + random.uniform(-0.03, 0.03), 0.07), 0.07, 0.018,
                  tilt=(random.uniform(-0.4, 0.4), random.uniform(-0.4, 0.4)))

# ---- фонари на мостках
for i, x in enumerate((-0.6, 0.3)):
    K.log(f'fonar_st{i}', 0.2, 0.008, (x, MY - 0.085, 0.53), 'z', material='M_iron', segs=5, jitter=0)
    K.box(f'fonar{i}', (0.045, 0.045, 0.06), (x, MY - 0.085, 0.66), 'M_fire', bevel=0.006)

tris, dims = K.finish('zhila', out, ao_distance=0.22)
print('ZHILA_OK era=%d tris=%d size=%s out=%s' % (ERA, tris, dims, out))
