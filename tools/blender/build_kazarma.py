# КАЗАРМА (2×2): длинная стрелецкая изба, плац с чучелами для рубки, стойка с копьями,
# знамя, мишень для лучников, кусок частокола за спиной. Крыша по эпохам.
# F:\blender.exe -b --factory-startup --python tools\blender\build_kazarma.py -- <out.glb> <эпоха>
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import goyda_kit as K

out, ERA = K.cli()
random.seed(51)
K.reset_scene()

W, D, CY = 1.7, 0.8, 0.42          # изба вытянута вдоль X, стоит у задней границы; плац — перед ней (-Y)
R = 0.045
BASE = 0.08

K.box('cokol', (W + 0.12, D + 0.12, BASE), (0, CY, BASE / 2), 'M_brick' if ERA == 2 else 'M_stone', bevel=0.012)
EAVE = K.srub('s', 0, CY, W, D, BASE, 7, R=R, ovh=0.08)
RIDGE = K.gable_roof('r', (0, CY, 0), W, D, EAVE, ERA, ridge_axis='x', rov=0.15, R=R)

FY = CY - D / 2 - R
# дверь по центру, окна по бокам
K.box('dver', (0.2, 0.025, 0.34), (0, FY - 0.005, BASE + 0.19), 'M_dark', bevel=0.004)
K.box('dver_n', (0.26, 0.03, 0.4), (0, FY, BASE + 0.21), 'M_paint_white' if ERA else 'M_plank', bevel=0.004)
K.box('kozyrek', (0.36, 0.2, 0.02), (0, FY - 0.09, BASE + 0.46), 'M_paint_green' if ERA == 2 else 'M_plank', rot=(-0.35, 0, 0), bevel=0.003)
for x in (-0.6, -0.32, 0.32, 0.6):
    K.window(f'w{x}', (x, FY - 0.004, BASE + 0.34), '-y', ERA, ww=0.14, wh=0.18, shutters=ERA < 2)
# над дверью — щит с гербом (красный с золотом)
K.box('gerb', (0.16, 0.02, 0.18), (0, FY - 0.02, EAVE + 0.14), 'M_paint_red', bevel=0.01)
K.box('gerb_z', (0.07, 0.022, 0.07), (0, FY - 0.03, EAVE + 0.15), 'M_gold', rot=(0, math.pi / 4, 0), bevel=0.005)

# частокол за избой
for i in range(15):
    x = -0.95 + i * 0.136
    h = random.uniform(0.5, 0.6)
    K.log(f'kol{i}', h, 0.05, (x, 0.95, h / 2), 'z', segs=7, jitter=0.1)
    K.tent(f'kol_ostr{i}', (x, 0.95, h), 0.08, 0.08, 0, top_mat='M_log')

# плац: утоптанная площадка, чучела, стойка с копьями, знамя, мишень
K.box('plac', (1.7, 0.85, 0.012), (0, -0.48, 0.006), 'M_soil', bevel=0)
for i, x in enumerate((-0.55, -0.2)):
    K.log(f'chuch_st{i}', 0.42, 0.014, (x, -0.55, 0.21), 'z', segs=5, jitter=0)
    K.log(f'chuch_t{i}', 0.2, 0.06, (x, -0.55, 0.3), 'z', material='M_thatch', segs=8, jitter=0.2)
    K.log(f'chuch_r{i}', 0.26, 0.012, (x, -0.55, 0.36), 'x', segs=5, jitter=0)
    K.box(f'chuch_g{i}', (0.08, 0.08, 0.08), (x, -0.55, 0.44), 'M_cloth', bevel=0.025)
# стойка с копьями
K.box('stoyka', (0.4, 0.03, 0.03), (0.35, -0.25, 0.28), 'M_plank', bevel=0.003)
for s in (-1, 1):
    K.log(f'stoyka_n{s}', 0.3, 0.015, (0.35 + s * 0.18, -0.25, 0.15), 'z', segs=5, jitter=0)
for i in range(5):
    x = 0.2 + i * 0.075
    K.log(f'kopyo{i}', 0.62, 0.008, (x, -0.22, 0.31), 'z', segs=5, jitter=0)
    K.tent(f'kopyo_n{i}', (x, -0.22, 0.62), 0.025, 0.07, 0, top_mat='M_iron')
# знамя
K.log('znamya_st', 1.1, 0.014, (0.78, -0.45, 0.55), 'z', segs=6, jitter=0)
K.box('znamya', (0.02, 0.32, 0.22), (0.78, -0.3, 0.94), 'M_paint_red', bevel=0.003)
K.box('znamya_z', (0.024, 0.08, 0.08), (0.78, -0.3, 0.94), 'M_gold', rot=(math.pi / 4, 0, 0), bevel=0.005)
K.add_marker('flag_top', (0.78, -0.45, 1.1))
# мишень для лучников
K.log('mishen', 0.03, 0.12, (-0.82, -0.7, 0.22), 'y', material='M_thatch', segs=12, jitter=0.05)
K.log('mishen_c', 0.035, 0.05, (-0.82, -0.7, 0.22), 'y', material='M_paint_red', segs=10, jitter=0)
for s in (-1, 1):
    K.log(f'mishen_n{s}', 0.3, 0.012, (-0.82 + s * 0.09, -0.68, 0.12), 'z', segs=5, jitter=0)

tris, dims = K.finish('kazarma', out, ao_distance=0.22)
print('KAZARMA_OK era=%d tris=%d size=%s out=%s' % (ERA, tris, dims, out))
