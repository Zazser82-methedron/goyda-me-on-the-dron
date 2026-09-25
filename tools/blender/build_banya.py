# БАНЯ (1×1): низкий сруб-парная, открытый предбанник под навесом, каменка с трубой
# (пар BuildingActivity._steam поднимается из x=0.18, z=-0.08 на высоте 0.97 — там верх трубы),
# кадка с водой, ушат, веники на стене, поленница, лавка.
# F:\blender.exe -b --factory-startup --python tools\blender\build_banya.py -- <out.glb> <эпоха>
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import goyda_kit as K

out, ERA = K.cli()
random.seed(81)
K.reset_scene()

W, D, CY = 0.62, 0.5, 0.12
R = 0.036
K.box('cokol', (W + 0.12, D + 0.12, 0.06), (0, CY, 0.03), 'M_stone', bevel=0.01)
EAVE = K.srub('s', 0, CY, W, D, 0.06, 5, R=R, ovh=0.05)
RIDGE = K.gable_roof('r', (0, CY, 0), W, D, EAVE, ERA, ridge_axis='x', rov=0.1, R=R)

# труба каменки: верх ровно под паром (Blender x=0.18, y=0.08, z≈0.97)
K.box('truba', (0.1, 0.1, 0.97 - RIDGE + 0.3), (0.18, 0.08, (0.97 + RIDGE - 0.3) / 2), 'M_brick' if ERA else 'M_stone', bevel=0.008)
K.box('truba_c', (0.13, 0.13, 0.02), (0.18, 0.08, 0.96), 'M_stone', bevel=0.004)

# предбанник: навес на двух столбах перед дверью, лавка
FY = CY - D / 2 - R
K.box('naves', (0.6, 0.32, 0.02), (0, FY - 0.14, EAVE - 0.02), 'M_paint_green' if ERA == 2 else 'M_plank', rot=(-0.3, 0, 0), bevel=0.003)
for s in (-1, 1):
    K.log(f'nst{s}', EAVE - 0.03, 0.016, (s * 0.27, FY - 0.28, (EAVE - 0.03) / 2), 'z', segs=6, jitter=0.03)
K.box('pol', (0.58, 0.3, 0.02), (0, FY - 0.14, 0.03), 'M_plank', bevel=0.003)
K.box('dver', (0.14, 0.02, 0.26), (-0.1, FY - 0.004, 0.19), 'M_dark', bevel=0.004)
K.box('lavka', (0.3, 0.08, 0.02), (0.13, FY - 0.08, 0.13), 'M_plank', bevel=0.003)
for s in (-1, 1):
    K.box(f'lavka_n{s}', (0.02, 0.07, 0.1), (0.13 + s * 0.12, FY - 0.08, 0.07), 'M_plank', bevel=0.002)
# веники на стене
for i in range(3):
    K.log(f'venik_r{i}', 0.08, 0.008, (0.12 + i * 0.06, FY - 0.01, 0.4), 'z', segs=5, jitter=0)
    K.lathe(f'venik{i}', [(0.004, 0), (0.025, 0.05), (0.03, 0.1), (0.0, 0.13)], (0.12 + i * 0.06, FY - 0.02, 0.23), 'M_crop', segs=8)
# маленькое окошко парной
K.window('okno', (W / 2 + R + 0.004, CY + 0.05, 0.3), '+x', ERA, ww=0.08, wh=0.07, shutters=False)
# кадка с водой, ушат, поленница у задней стены
K.log('kadka', 0.12, 0.07, (-0.42, FY - 0.05, 0.06), 'z', material='M_plank', segs=10, jitter=0.02)
K.log('kadka_v', 0.005, 0.063, (-0.42, FY - 0.05, 0.118), 'z', material='M_window', segs=10, jitter=0)
K.log('ushat', 0.05, 0.05, (-0.3, FY - 0.2, 0.025), 'z', material='M_plank', segs=10, jitter=0.02)
for row in range(2):
    for j in range(5 - row):
        K.log(f'drova{row}{j}', 0.16, 0.02, (-0.2 + j * 0.042 + row * 0.02, CY + D / 2 + R + 0.1, 0.022 + row * 0.038), 'y', segs=6, jitter=0.1)

tris, dims = K.finish('banya', out, ao_distance=0.18)
print('BANYA_OK era=%d tris=%d size=%s ridge=%.2f out=%s' % (ERA, tris, dims, RIDGE, out))
