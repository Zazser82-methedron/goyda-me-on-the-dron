# ФЕРМА (2×2): пашня с грядами (всходы + спелая рожь), сенник-навес на столбах, стога,
# жердяная изгородь, пугало. Угол (+X, -Y) свободен — там ветрячок из BuildingActivity (_farm).
# F:\blender.exe -b --factory-startup --python tools\blender\build_ferma.py -- <out.glb> <эпоха>
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import goyda_kit as K

out, ERA = K.cli()
random.seed(31)
K.reset_scene()

H = 0.92                              # полуразмер участка

# пашня: две полосы гряд — слева всходы, справа рожь
K.box('pashnya', (1.25, 1.35, 0.03), (-0.28, 0.05, 0.015), 'M_soil', bevel=0.01)
for i in range(7):
    y = -0.55 + i * 0.18
    for j, (x0, mat_) in enumerate(((-0.62, 'M_crop'), (0.05, 'M_wheat'))):
        n = 5
        for k in range(n):
            x = x0 + k * 0.11 - 0.2
            h = random.uniform(0.05, 0.08) if mat_ == 'M_crop' else random.uniform(0.12, 0.16)
            b = K.box(f'gr{i}{j}{k}', (0.1, 0.07, h), (x, y, 0.03 + h / 2), mat_, bevel=0.012)
            b['vary'] = 1

# сенник: крыша на четырёх столбах над стогом
SX, SY = 0.62, 0.45
for sx in (-1, 1):
    for sy in (-1, 1):
        K.log(f'sst{sx}{sy}', 0.62, 0.025, (SX + sx * 0.2, SY + sy * 0.22, 0.31), 'z', segs=6, jitter=0.03)
K.box('seno_pod', (0.42, 0.46, 0.34), (SX, SY, 0.17), 'M_thatch', bevel=0.08)
roof = K.capture(lambda: K.gable_roof('sr', (0, 0, 0), 0.4, 0.44, 0.62, ERA, ridge_axis='y', rov=0.1, R=0.02))
K.place(roof, (SX, SY, 0))

# стога на шестах
for i, (x, y) in enumerate(((0.45, -0.1), (0.78, 0.0))):
    K.log(f'stog{i}', 0.3, 0.14, (x, y, 0.15), 'z', material='M_thatch', segs=10, jitter=0.25)
    K.tent(f'stogv{i}', (x, y, 0.29), 0.26, 0.14, 0, top_mat='M_thatch')
    K.log(f'shest{i}', 0.62, 0.01, (x, y, 0.31), 'z', segs=5, jitter=0)

# жердяная изгородь по трём сторонам (передний правый угол свободен)
def pole_line(p, a, b, n):
    for i in range(n + 1):
        t = i / n
        K.log(f'{p}k{i}', 0.26, 0.016, (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, 0.13), 'z', segs=5, jitter=0.1)
    L = math.hypot(b[0] - a[0], b[1] - a[1])
    ax = 'x' if abs(b[0] - a[0]) > abs(b[1] - a[1]) else 'y'
    for z in (0.1, 0.2):
        K.log(f'{p}zh{z}', L, 0.012, ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z), ax, segs=5, jitter=0.1)

pole_line('zl', (-H, -H), (-H, H), 6)
pole_line('zb', (-H, H), (H, H), 6)
pole_line('zf', (-H, -H), (0.15, -H), 4)

# пугало
K.log('pug_st', 0.5, 0.012, (-0.28, -0.02, 0.28), 'z', segs=5, jitter=0)
K.log('pug_ruki', 0.3, 0.01, (-0.28, -0.02, 0.4), 'x', segs=5, jitter=0)
K.box('pug_rubaha', (0.14, 0.06, 0.16), (-0.28, -0.02, 0.36), 'M_paint_red', bevel=0.02)
K.box('pug_golova', (0.07, 0.07, 0.07), (-0.28, -0.02, 0.49), 'M_cloth', bevel=0.02)
K.tent('pug_shlyapa', (-0.28, -0.02, 0.52), 0.11, 0.06, 0, top_mat='M_thatch')

# инвентарь: борона у изгороди и мешки с зерном
K.box('borona', (0.26, 0.22, 0.02), (-0.72, 0.8, 0.02), 'M_plank', rot=(0, 0, 0.3), bevel=0.003)
K.sacks('zerno', (0.35, 0.72, 0), 3)

tris, dims = K.finish('ferma', out, ao_distance=0.2)
print('FERMA_OK era=%d tris=%d size=%s out=%s' % (ERA, tris, dims, out))
