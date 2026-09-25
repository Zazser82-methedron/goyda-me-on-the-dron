# СТОРОЖЕВАЯ БАШНЯ (1×1): рубленая шатровая башня острога — каменное основание, сруб-четверик,
# нависающий верхний ярус-«облам» с бойницами, смотровая площадка под шатром, сигнальный колокол, флаг.
# F:\blender.exe -b --factory-startup --python tools\blender\build_tower.py -- <out.glb> <эпоха>
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import goyda_kit as K

out, ERA = K.cli()
random.seed(111)
K.reset_scene()

S = 0.56
K.box('osn', (S + 0.2, S + 0.2, 0.14), (0, 0, 0.07), 'M_brick' if ERA == 2 else 'M_stone', bevel=0.02)
TOP = K.srub('t', 0, 0, S, S, 0.14, 12, R=0.04, ovh=0.05)
# облам: верхний ярус шире нижнего, на консолях
OB = 0.78
for sx in (-1, 1):
    for sy in (-1, 1):
        K.box(f'konsol{sx}{sy}', (0.08, 0.08, 0.16), (sx * S / 2, sy * S / 2, TOP + 0.02), 'M_log', rot=(0, 0, math.pi / 4), bevel=0.008)
K.box('oblam_pol', (OB, OB, 0.04), (0, 0, TOP + 0.1), 'M_plank', bevel=0.005)
OTOP = K.srub('o', 0, 0, OB - 0.08, OB - 0.08, TOP + 0.12, 3, R=0.035, ovh=0.03)
# бойницы — тёмные прорези в обламе
H = OB / 2 - 0.02
for d in (-0.16, 0.16):
    for sy in (-1, 1):   # на гранях фасада и тыла
        K.box(f'boy_y{sy}{d}', (0.05, 0.02, 0.1), (d, sy * H, TOP + 0.24), 'M_dark', bevel=0)
    for sx in (-1, 1):   # на боковых гранях
        K.box(f'boy_x{sx}{d}', (0.02, 0.05, 0.1), (sx * H, d, TOP + 0.24), 'M_dark', bevel=0)
# площадка со столбами и шатёр
PZ = OTOP + 0.02
for sx in (-1, 1):
    for sy in (-1, 1):
        K.log(f'st{sx}{sy}', 0.34, 0.02, (sx * (OB / 2 - 0.06), sy * (OB / 2 - 0.06), PZ + 0.17), 'z', segs=6, jitter=0.02)
for s in (-1, 1):
    K.box(f'perx{s}', (OB - 0.1, 0.02, 0.02), (0, s * (OB / 2 - 0.06), PZ + 0.1), 'M_paint_white' if ERA else 'M_plank', bevel=0.002)
    K.box(f'pery{s}', (0.02, OB - 0.1, 0.02), (s * (OB / 2 - 0.06), 0, PZ + 0.1), 'M_paint_white' if ERA else 'M_plank', bevel=0.002)
roof = 'M_thatch' if ERA == 0 else ('M_plank' if ERA == 1 else 'M_paint_green')
SH = K.tent('sh', (0, 0, PZ + 0.34), OB + 0.12, 0.62, ERA, top_mat=roof)
# сигнальный колокол под шатром
K.lathe('kolokol', [(0.0, 0.1), (0.03, 0.1), (0.045, 0.06), (0.06, 0.0), (0.065, -0.005)], (0, 0, PZ + 0.16), 'M_gold', segs=10)
# флаг на маковке
K.log('flagshtok', 0.4, 0.01, (0, 0, SH + 0.18), 'z', material='M_iron', segs=6, jitter=0)
K.box('flag', (0.015, 0.22, 0.13), (0, 0.11, SH + 0.3), 'M_paint_red', bevel=0.003)
# дверь и лестница-приставка
K.box('dver', (0.16, 0.02, 0.28), (0, -S / 2 - 0.045, 0.28), 'M_dark', bevel=0.004)
for s in (-1, 1):
    K.box(f'lest{s}', (0.02, 0.02, 0.9), (0.26 + s * 0.06, -S / 2 - 0.14, 0.45), 'M_plank', rot=(0.25, 0, 0), bevel=0)
for i in range(6):
    K.box(f'stup{i}', (0.13, 0.015, 0.015), (0.26, -S / 2 - 0.25 + i * 0.037, 0.08 + i * 0.14), 'M_plank', bevel=0)

tris, dims = K.finish('tower', out, ao_distance=0.2)
print('TOWER_OK era=%d tris=%d size=%s out=%s' % (ERA, tris, dims, out))
