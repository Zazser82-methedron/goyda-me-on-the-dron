# ТАМОЖЕННЫЕ ВОРОТА (1×1, II эпоха, проходимые): въезд с двумя столбами и кровелькой над проездом,
# полосатый поднятый шлагбаум с противовесом, полосатая будка мытника сбоку, сундук пошлины и весы.
# Середина клетки (проезд) свободна.
# F:\blender.exe -b --factory-startup --python tools\blender\build_tamozhnya.py -- <out.glb> <эпоха 1|2>
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import goyda_kit as K

out, ERA = K.cli()
random.seed(201)
K.reset_scene()

# столбы въезда и кровелька
for sx in (-1, 1):
    K.log(f'stolb{sx}', 0.9, 0.05, (sx * 0.34, 0, 0.45), 'z', segs=8, jitter=0.04)
    K.lathe(f'stolb_v{sx}', [(0.055, 0), (0.0, 0.1)], (sx * 0.34, 0, 0.9), 'M_log', segs=8)
K.log('perekl', 0.78, 0.035, (0, 0, 0.82), 'x', segs=8, jitter=0.03)
kr = K.capture(lambda: K.gable_roof('kr', (0, 0, 0), 0.24, 0.84, 0.86, ERA, ridge_axis='x', rov=0.05, R=0.02))
K.place(kr, (0, 0, 0))
K.box('doska', (0.36, 0.02, 0.08), (0, -0.04, 0.7), 'M_paint_red', bevel=0.004)
K.box('doska_z', (0.08, 0.022, 0.05), (0, -0.05, 0.7), 'M_gold', rot=(0, math.pi / 4, 0), bevel=0.004)
# шлагбаум: поднят, чёрно-белые полосы, противовес
PX = 0.34
K.log('sh_opora', 0.3, 0.03, (PX, -0.3, 0.15), 'z', segs=6, jitter=0.02)
bar = []
for i in range(6):
    b = K.box(f'sh{i}', (0.1, 0.03, 0.03), (PX - 0.05 - i * 0.1, -0.3, 0.3), 'M_paint_white' if i % 2 == 0 else 'M_dark', bevel=0.003)
    bar.append(b)
K.box('sh_gruz', (0.07, 0.05, 0.05), (PX + 0.08, -0.3, 0.3), 'M_stone', bevel=0.01)
bpy_objs = bar + [K.bpy.data.objects['sh_gruz']]
K.bpy.context.view_layer.update()
from mathutils import Matrix, Vector
pivot = Vector((PX, -0.3, 0.3))
M = Matrix.Translation(pivot) @ Matrix.Rotation(1.1, 4, 'Y') @ Matrix.Translation(-pivot)   # шлагбаум поднят
for o in bpy_objs:
    o.matrix_world = M @ o.matrix_world
# будка мытника (полосатая) слева от проезда
BX, BY = -0.36, -0.3
for i in range(4):
    K.box(f'budka{i}', (0.2, 0.2, 0.1), (BX, BY, 0.05 + i * 0.1), 'M_paint_white' if i % 2 == 0 else 'M_paint_red', bevel=0.004)
K.box('budka_okno', (0.1, 0.01, 0.08), (BX, BY - 0.1, 0.3), 'M_window', bevel=0)
K.tent('budka_kr', (BX, BY, 0.4), 0.26, 0.14, ERA, top_mat='M_roof' if ERA == 1 else 'M_roof_iron')
# сундук пошлины и весы
K.box('sunduk', (0.13, 0.09, 0.08), (0.3, 0.3, 0.04), 'M_paint_red', bevel=0.008)
K.box('sunduk_ok', (0.135, 0.095, 0.015), (0.3, 0.3, 0.06), 'M_iron', bevel=0)
K.log('vesy_st', 0.26, 0.01, (-0.3, 0.3, 0.13), 'z', material='M_iron', segs=5, jitter=0)
K.box('vesy_k', (0.2, 0.01, 0.01), (-0.3, 0.3, 0.26), 'M_iron', bevel=0)
for s in (-1, 1):
    K.lathe(f'vesy_c{s}', [(0.0, 0), (0.035, 0.01), (0.04, 0.02)], (-0.3 + s * 0.09, 0.3, 0.19), 'M_gold', segs=8)

tris, dims = K.finish('tamozhnya', out, ao_distance=0.18)
print('TAMOZHNYA_OK era=%d tris=%d size=%s out=%s' % (ERA, tris, dims, out))
