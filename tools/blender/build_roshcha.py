# ЛЕСОПОСАДКА (2×2): питомник — пять молодых деревьев на приствольных кругах с колышками и подвязкой
# (кроны-шары качает BuildingActivity._saplings в точках (±0.5, ±0.5) и (0, 0) на высоте 0.5 —
# здесь под ними стволики), грядки с сеянцами, изгородь, избушка лесника, кадка, заступ.
# F:\blender.exe -b --factory-startup --python tools\blender\build_roshcha.py -- <out.glb> <эпоха>
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import goyda_kit as K

out, ERA = K.cli()
random.seed(151)
K.reset_scene()

for i, (x, y) in enumerate(((-0.5, -0.5), (0.5, -0.5), (-0.5, 0.5), (0.5, 0.5), (0.0, 0.0))):
    K.lathe(f'krug{i}', [(0.2, 0), (0.18, 0.025), (0.0, 0.03)], (x, y, 0), 'M_soil', segs=12)
    K.log(f'stvol{i}', 0.42, 0.022, (x, y, 0.21), 'z', segs=7, jitter=0.1)
    K.log(f'kol{i}', 0.36, 0.01, (x + 0.06, y, 0.18), 'z', material='M_plank', segs=5, jitter=0)
    K.box(f'podvyaz{i}', (0.07, 0.02, 0.012), (x + 0.03, y, 0.26), 'M_cloth', bevel=0)
# грядки с сеянцами между деревьями
for j, (x, y) in enumerate(((0.0, -0.55), (-0.55, 0.0), (0.55, 0.0))):
    K.box(f'gryada{j}', (0.34 if j == 0 else 0.16, 0.16 if j == 0 else 0.34, 0.04), (x, y, 0.02), 'M_soil', bevel=0.01)
    for k in range(6):
        dx = (k - 2.5) * 0.05 if j == 0 else 0
        dy = 0 if j == 0 else (k - 2.5) * 0.05
        K.tent(f'seyanec{j}{k}', (x + dx, y + dy, 0.04), 0.05, 0.08, 0, top_mat='M_crop')
# изгородь по краю (жерди)
H = 0.9
for side, (a, b) in enumerate((((-H, -H), (H, -H)), ((-H, H), (H, H)), ((-H, -H), (-H, H)), ((H, -H), (H, H)))):
    for i in range(6):
        t = i / 5
        K.log(f'zst{side}{i}', 0.22, 0.012, (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, 0.11), 'z', segs=5, jitter=0.1)
    ax = 'x' if a[1] == b[1] else 'y'
    K.log(f'zzh{side}', 2 * H, 0.009, ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0.17), ax, segs=5, jitter=0.05)
# избушка лесника у задней изгороди, между деревьями (кроны ±0.5 её не задевают)
EAVE = K.srub('iz', 0.0, 0.75, 0.36, 0.26, 0.03, 4, R=0.028, ovh=0.03)
K.gable_roof('izr', (0.0, 0.75, 0), 0.36, 0.26, EAVE, ERA, ridge_axis='x', rov=0.06, R=0.028)
K.box('iz_dver', (0.08, 0.015, 0.14), (0.0, 0.75 - 0.13 - 0.03, 0.1), 'M_dark', bevel=0.003)
# кадка с водой, лейка, заступ
K.log('kadka', 0.1, 0.06, (0.3, 0.7, 0.05), 'z', material='M_plank', segs=10, jitter=0.02)
K.log('kadka_v', 0.005, 0.054, (0.3, 0.7, 0.098), 'z', material='M_window', segs=10, jitter=0)
K.log('zastup_r', 0.3, 0.008, (0.38, 0.7, 0.15), 'z', material='M_plank', segs=5, jitter=0)
K.box('zastup', (0.05, 0.01, 0.07), (0.38, 0.7, 0.02), 'M_iron', bevel=0)

tris, dims = K.finish('roshcha', out, ao_distance=0.18)
print('ROSHCHA_OK era=%d tris=%d size=%s out=%s' % (ERA, tris, dims, out))
