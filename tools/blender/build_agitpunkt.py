# АГИТПУНКТ (2×2, III эпоха): сатирическая пропаганда Абсолюта Дрона — трибуна с кумачовыми стягами,
# высокий столб с раструбами-громкоговорителями, щит-плакат с глазом Дрона, скамьи для слушателей,
# стопки листовок, прожектор.
# F:\blender.exe -b --factory-startup --python tools\blender\build_agitpunkt.py -- <out.glb> <эпоха 2>
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import goyda_kit as K

out, ERA = K.cli()
random.seed(221)
K.reset_scene()

K.lathe('ploshad', [(0.9, 0), (0.88, 0.012), (0.0, 0.015)], (0, 0, 0), 'M_cobble', segs=24)
# трибуна
TY = 0.4
K.box('tribuna', (0.8, 0.45, 0.32), (0, TY, 0.16), 'M_brick', bevel=0.01)
K.box('tribuna_verh', (0.86, 0.5, 0.03), (0, TY, 0.335), 'M_plaster', bevel=0.004)
K.box('tribuna_front', (0.5, 0.02, 0.2), (0, TY - 0.235, 0.18), 'M_paint_red', bevel=0.004)
K.box('tribuna_zv', (0.1, 0.022, 0.1), (0, TY - 0.245, 0.2), 'M_gold', rot=(0, math.pi / 4, 0), bevel=0.006)
for i in range(4):
    K.box(f'tr_st{i}', (0.3, 0.07, 0.03), (0.55, TY - 0.08 - i * 0.0 + 0.0, 0.3 - i * 0.075), 'M_stone', rot=(0, 0, math.pi / 2), bevel=0.004)
K.box('kafedra', (0.14, 0.1, 0.16), (0, TY - 0.1, 0.43), 'M_plank', bevel=0.006)
# стяги
for s in (-1, 1):
    K.log(f'styag_st{s}', 0.9, 0.012, (s * 0.38, TY + 0.2, 0.75), 'z', material='M_gold', segs=6, jitter=0)
    K.box(f'styag{s}', (0.2, 0.012, 0.36), (s * 0.28, TY + 0.2, 0.95), 'M_paint_red', bevel=0.002)
# плакат с глазом Дрона
K.box('plakat', (0.7, 0.03, 0.42), (0, TY + 0.25, 0.72), 'M_plaster', bevel=0.006)
K.box('plakat_ramka', (0.74, 0.02, 0.46), (0, TY + 0.265, 0.72), 'M_paint_red', bevel=0.004)
K.log('plakat_glaz', 0.02, 0.14, (0, TY + 0.225, 0.74), 'y', material='M_gold', segs=16, jitter=0)
K.log('plakat_zrachok', 0.024, 0.06, (0, TY + 0.22, 0.74), 'y', material='M_glow', segs=12, jitter=0)
for s in (-1, 1):   # лучи
    for k in range(3):
        K.box(f'luch{s}{k}', (0.12, 0.02, 0.015), (s * (0.2 + k * 0.02), TY + 0.225, 0.74 + (k - 1) * 0.1), 'M_gold',
              rot=(0, (k - 1) * s * 0.4, 0), bevel=0)
# столб громкоговорителей
GX, GY = -0.62, -0.3
K.log('gr_st', 1.35, 0.025, (GX, GY, 0.675), 'z', material='M_iron', segs=8, jitter=0)
for i, a in enumerate((0.3, 2.4, 4.4)):
    horn = K.lathe(f'rupor{i}', [(0.015, 0), (0.05, 0.12), (0.09, 0.2)], (0, 0, 0), 'M_iron', segs=10)
    horn.location = (GX + math.cos(a) * 0.05, GY + math.sin(a) * 0.05, 1.25)
    horn.rotation_euler = (math.pi / 2 - 0.3, 0, a + math.pi / 2)
K.box('prozhektor', (0.08, 0.1, 0.06), (GX, GY, 1.05), 'M_iron', bevel=0.01)
K.box('prozhektor_s', (0.06, 0.01, 0.04), (GX, GY - 0.055, 1.05), 'M_window', bevel=0)
# скамьи для слушателей
for i in range(3):
    y = -0.2 - i * 0.2
    K.box(f'skam{i}', (0.7, 0.07, 0.025), (0.1, y, 0.12), 'M_plank', bevel=0.003)
    for s in (-1, 1):
        K.box(f'skam_n{i}{s}', (0.03, 0.06, 0.11), (0.1 + s * 0.3, y, 0.055), 'M_plank', bevel=0.002)
# листовки
for i in range(3):
    K.box(f'listovki{i}', (0.1, 0.07, 0.03 + i * 0.01), (0.7, -0.6 + i * 0.1, 0.02), 'M_paint_white', bevel=0.002)

tris, dims = K.finish('agitpunkt', out, ao_distance=0.22)
print('AGIT_OK era=%d tris=%d size=%s out=%s' % (ERA, tris, dims, out))
