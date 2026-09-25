# ПУТЕВОЙ ПАКГАУЗ (2×2, III эпоха): длинный кирпичный склад у путей с погрузочной рампой вдоль фасада,
# широкие ворота, навес над рампой, ящики, мешки, бочки, ручной кран, весы-платформа.
# Порт дороги — спереди (roadPort dx1 dy2).
# F:\blender.exe -b --factory-startup --python tools\blender\build_sklad.py -- <out.glb> <эпоха 2>
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import goyda_kit as K

out, ERA = K.cli()
random.seed(231)
K.reset_scene()

W, D, CY, H = 1.6, 0.8, 0.4, 0.62
K.box('steny', (W, D, H), (0, CY, H / 2 + 0.05), 'M_brick', bevel=0.01)
K.box('cokol', (W + 0.06, D + 0.06, 0.08), (0, CY, 0.04), 'M_stone', bevel=0.01)
for x in (-0.8, -0.4, 0, 0.4, 0.8):   # пилястры
    K.box(f'pil{x}', (0.06, D + 0.04, H), (x, CY, H / 2 + 0.05), 'M_plaster', bevel=0.004)
K.gable_roof('r', (0, CY, 0), W - 0.04, D - 0.04, H + 0.05, ERA, ridge_axis='x', rov=0.1, R=0.04, gable_mat='M_brick')
FY = CY - D / 2
for x in (-0.55, 0.0, 0.55):
    K.box(f'vorota{x}', (0.26, 0.02, 0.36), (x, FY - 0.005, 0.28), 'M_dark', bevel=0.004)
    K.box(f'vorota_n{x}', (0.3, 0.025, 0.03), (x, FY - 0.01, 0.47), 'M_plaster', bevel=0.003)
# рампа и навес
RY = FY - 0.18
K.box('rampa', (1.7, 0.36, 0.1), (0, RY, 0.05), 'M_stone', bevel=0.01)
K.box('rampa_pol', (1.7, 0.36, 0.02), (0, RY, 0.11), 'M_plank', bevel=0.003)
for x in (-0.75, -0.25, 0.25, 0.75):
    K.log(f'n_st{x}', 0.5, 0.018, (x, RY - 0.15, 0.36), 'z', material='M_iron', segs=6, jitter=0)
K.box('naves', (1.75, 0.42, 0.02), (0, RY - 0.02, 0.62), 'M_roof_iron', rot=(-0.18, 0, 0), bevel=0.003)
# грузы на рампе
for i in range(5):
    b = K.box(f'yashik{i}', (0.12, 0.12, 0.1), (-0.7 + i * 0.15 + random.uniform(-0.02, 0.02), RY + random.uniform(-0.05, 0.05), 0.17),
              'M_plank', rot=(0, 0, random.uniform(-0.3, 0.3)), bevel=0.008)
    b['vary'] = 1
K.sacks('meshki', (0.35, RY, 0.12), 4)
K.barrel('b1', (0.65, RY - 0.05, 0.12))
K.barrel('b2', (0.75, RY + 0.06, 0.12))
# ручной кран у края рампы
K.log('kran', 0.7, 0.02, (-0.9, RY - 0.1, 0.35), 'z', material='M_iron', segs=6, jitter=0)
K.box('kran_str', (0.3, 0.02, 0.02), (-0.78, RY - 0.1, 0.68), 'M_iron', bevel=0)
K.log('kran_tros', 0.25, 0.004, (-0.65, RY - 0.1, 0.55), 'z', material='M_cloth', segs=4, jitter=0)
K.box('kran_gruz', (0.08, 0.08, 0.07), (-0.65, RY - 0.1, 0.4), 'M_plank', bevel=0.006)

tris, dims = K.finish('sklad', out, ao_distance=0.22)
print('SKLAD_OK era=%d tris=%d size=%s out=%s' % (ERA, tris, dims, out))
