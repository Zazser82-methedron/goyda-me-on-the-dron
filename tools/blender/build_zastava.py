# ОСТРОЖНАЯ ЗАСТАВА (1×1, II эпоха): маленький острог — квадрат из заострённых кольев, внутри рубленая
# вышка с шатриком; флаг вешает BuildingActivity._flag (древко x=0.28, z=-0.12 в игре → здесь (0.28, 0.12),
# от 1.14 до 2.06) — верх вышки подведён под древко. Костёр дозорных, щиты и копья у стены.
# F:\blender.exe -b --factory-startup --python tools\blender\build_zastava.py -- <out.glb> <эпоха 1|2>
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import goyda_kit as K

out, ERA = K.cli()
random.seed(191)
K.reset_scene()

# частокол по периметру (разрыв-вход спереди)
H = 0.44
for side in range(4):
    for i in range(9):
        t = -H + i * (2 * H / 8)
        if side == 0 and abs(t) < 0.12:
            continue
        x, y = [(t, -H), (H, t), (t, H), (-H, t)][side]
        h = random.uniform(0.42, 0.5)
        K.log(f'kol{side}{i}', h, 0.035, (x, y, h / 2), 'z', segs=6, jitter=0.1)
        K.lathe(f'ostr{side}{i}', [(0.035, 0), (0.0, 0.08)], (x, y, h), 'M_log', segs=6)
# вышка: четыре столба, сруб-будка наверху, шатрик
TX, TY = 0.2, 0.12
for sx in (-1, 1):
    for sy in (-1, 1):
        K.log(f'v_st{sx}{sy}', 0.8, 0.022, (TX + sx * 0.1, TY + sy * 0.1, 0.4), 'z', segs=6, jitter=0.03)
K.box('v_pol', (0.3, 0.3, 0.03), (TX, TY, 0.8), 'M_plank', bevel=0.004)
TOP = K.srub('v', TX, TY, 0.24, 0.24, 0.81, 2, R=0.028, ovh=0.03)
K.tent('v_sh', (TX, TY, TOP + 0.08), 0.38, 0.28, ERA, top_mat='M_roof' if ERA == 1 else 'M_roof_iron')
for sx in (-1, 1):
    for sy in (-1, 1):
        K.log(f'v_s2{sx}{sy}', 0.1, 0.012, (TX + sx * 0.13, TY + sy * 0.13, TOP + 0.04), 'z', segs=5, jitter=0)
for i in range(4):   # лестница
    K.box(f'lest{i}', (0.12, 0.012, 0.012), (TX - 0.17, TY - 0.05 + i * 0.0, 0.12 + i * 0.18), 'M_plank', bevel=0)
for s in (-1, 1):
    K.box(f'lest_k{s}', (0.012, 0.012, 0.8), (TX - 0.17 + s * 0.05, TY - 0.05, 0.4), 'M_plank', bevel=0)
# костёр дозорных, щиты и копья
K.lathe('koster', [(0.07, 0), (0.05, 0.02), (0.0, 0.025)], (-0.2, -0.15, 0), 'M_stone', segs=8)
K.lathe('ogon', [(0.04, 0), (0.0, 0.1)], (-0.2, -0.15, 0.02), 'M_fire', segs=6)
for i, y in enumerate((0.1, 0.25)):
    K.log(f'shit{i}', 0.015, 0.07, (-0.38, y, 0.18), 'x', material='M_paint_red', segs=10, jitter=0)
    K.log(f'shit_u{i}', 0.018, 0.02, (-0.37, y, 0.18), 'x', material='M_gold', segs=8, jitter=0)
for i in range(3):
    K.log(f'kopyo{i}', 0.6, 0.007, (-0.3 + i * 0.05, 0.36, 0.3), 'z', segs=5, jitter=0)

tris, dims = K.finish('zastava', out, ao_distance=0.18)
print('ZASTAVA_OK era=%d tris=%d size=%s top=%.2f out=%s' % (ERA, tris, dims, TOP, out))
