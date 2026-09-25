# ВЕЧЕ (2×2): площадь народного собрания — деревянный помост-«степень» с перилами и лестницей,
# вечевой колокол на звоннице-перекладине, скамьи полукругом, стяги сословий по краям.
# Над звонницей BuildingActivity._orrery (veche) вращает золотое кольцо — высота ORRERY_Y.
# F:\blender.exe -b --factory-startup --python tools\blender\build_veche.py -- <out.glb> <эпоха>
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import goyda_kit as K

out, ERA = K.cli()
random.seed(171)
K.reset_scene()
TRIM = 'M_paint_white' if ERA else 'M_plank'

# утоптанная площадь (мощёная в III эпохе)
K.lathe('ploshad', [(0.92, 0), (0.9, 0.012), (0.0, 0.015)], (0, 0, 0), 'M_stone' if ERA == 2 else 'M_soil', segs=24)
# степень-помост у задней части
PY, PZ = 0.45, 0.28
K.box('stepen', (0.9, 0.5, 0.04), (0, PY, PZ), 'M_plank', bevel=0.006)
for sx in (-1, 1):
    for sy in (-1, 1):
        K.log(f'svaya{sx}{sy}', PZ, 0.03, (sx * 0.4, PY + sy * 0.2, PZ / 2), 'z', segs=7, jitter=0.05)
for sx in (-1, 1):
    K.box(f'peril_x{sx}', (0.02, 0.5, 0.02), (sx * 0.44, PY, PZ + 0.18), TRIM, bevel=0.002)
K.box('peril_z', (0.9, 0.02, 0.02), (0, PY + 0.24, PZ + 0.18), TRIM, bevel=0.002)
for k in range(9):
    K.box(f'bal{k}', (0.016, 0.016, 0.16), (-0.4 + k * 0.1, PY + 0.24, PZ + 0.1), TRIM, bevel=0.002)
for i in range(4):
    K.box(f'lestn{i}', (0.3, 0.08, 0.03), (0, PY - 0.3 - i * 0.07, PZ - 0.06 - i * 0.065), 'M_plank', bevel=0.004)
# звонница: два столба, перекладина, двускатный козырёк, колокол
for sx in (-1, 1):
    K.log(f'zv_st{sx}', 0.95, 0.035, (sx * 0.2, PY + 0.12, PZ + 0.47), 'z', segs=8, jitter=0.04)
K.log('zv_perekl', 0.55, 0.03, (0, PY + 0.12, PZ + 0.9), 'x', segs=8, jitter=0.03)
kz = K.capture(lambda: K.gable_roof('zvr', (0, 0, 0), 0.2, 0.62, PZ + 0.95, ERA, ridge_axis='x', rov=0.04, R=0.02))
K.place(kz, (0, PY + 0.12, 0))
K.lathe('kolokol', [(0.0, 0.2), (0.04, 0.2), (0.07, 0.14), (0.1, 0.03), (0.115, 0.0), (0.105, -0.01)],
        (0, PY + 0.12, PZ + 0.63), 'M_gold', segs=14)
K.log('yazyk', 0.1, 0.008, (0, PY + 0.12, PZ + 0.62), 'z', material='M_iron', segs=5, jitter=0)
# скамьи полукругом перед степенью
for i in range(5):
    a = math.pi + (i - 2) * 0.42 + math.pi / 2
    r = 0.62
    x, y = math.cos(a) * r, math.sin(a) * r * 0.8 - 0.05
    K.box(f'skamya{i}', (0.3, 0.07, 0.025), (x, y, 0.12), 'M_plank', rot=(0, 0, a + math.pi / 2), bevel=0.003)
    for s in (-1, 1):
        dx, dy = math.cos(a + math.pi / 2) * 0.12 * s, math.sin(a + math.pi / 2) * 0.12 * s
        K.box(f'skamya_n{i}{s}', (0.03, 0.06, 0.11), (x + dx, y + dy, 0.055), 'M_plank', rot=(0, 0, a + math.pi / 2), bevel=0.002)
# стяги четырёх сословий по краям площади
for i, (x, y, m) in enumerate(((-0.85, -0.2, 'M_paint_red'), (-0.8, 0.5, 'M_paint_blue'), (0.85, -0.2, 'M_gold'), (0.8, 0.5, 'M_paint_green'))):
    K.log(f'styag_st{i}', 0.8, 0.012, (x, y, 0.4), 'z', material='M_plank', segs=5, jitter=0)
    K.box(f'styag{i}', (0.012, 0.16, 0.22), (x, y + 0.08, 0.66), m, bevel=0.002)
K.add_marker('orrery_anchor', (0, PY + 0.12, PZ + 1.35))

tris, dims = K.finish('veche', out, ao_distance=0.22)
print('VECHE_OK era=%d tris=%d size=%s orrery_y=%.2f out=%s' % (ERA, tris, dims, PZ + 1.35, out))
