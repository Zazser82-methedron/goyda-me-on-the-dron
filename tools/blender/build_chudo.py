# ЧУДО — КАПИЩЕ ИДОЛА ДРОНА (3×3): постройка победы «пробуди Дрона».
# Трёхступенчатая каменная платформа с парадной лестницей, кольцо резных столбов-кумиров с золотыми маковками,
# в центре белый столп в кумачовых поясах, на вершине — золотой Дрон-квадрокоптер (сатира на дрона-божество):
# четыре луча с винтами и огромный бирюзовый глаз. Светящиеся руны на столпе и чаши огня на углах.
# (idol_dron.glb не трогаем — это персонаж лобби.)
# F:\blender.exe -b --factory-startup --python tools\blender\build_chudo.py -- <out.glb> [эпоха]
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import goyda_kit as K

out, ERA = K.cli()
random.seed(301)
K.reset_scene()

# ---- ступенчатая платформа
for i, (s, h) in enumerate(((2.9, 0.14), (2.4, 0.14), (1.9, 0.14))):
    K.box(f'stupen{i}', (s, s, h), (0, 0, 0.07 + i * 0.14), 'M_stone', bevel=0.02)
    K.box(f'kaima{i}', (s + 0.02, s + 0.02, 0.025), (0, 0, 0.14 + i * 0.14), 'M_paint_white', bevel=0.004)
TOPZ = 0.42
# парадная лестница спереди (-Y)
for i in range(6):
    K.box(f'lest{i}', (0.7, 0.12, 0.07), (0, -1.45 + i * 0.1, 0.035 + i * 0.07), 'M_stone', bevel=0.01)
for s in (-1, 1):
    K.box(f'lest_parapet{s}', (0.08, 0.62, 0.12), (s * 0.4, -1.2, 0.26), 'M_stone', rot=(-0.55, 0, 0), bevel=0.01)

# ---- кольцо столбов-кумиров
for i in range(8):
    a = i / 8 * math.tau + math.pi / 8
    x, y = math.cos(a) * 0.8, math.sin(a) * 0.8
    if y < -0.5 and abs(x) < 0.4:
        continue   # проход к лестнице
    K.lathe(f'kumir{i}', [(0.07, 0), (0.075, 0.3), (0.065, 0.55), (0.08, 0.7), (0.06, 0.82)], (x, y, TOPZ), 'M_log', segs=8)
    K.log(f'kumir_p{i}', 0.03, 0.082, (x, y, TOPZ + 0.3), 'z', material='M_paint_red', segs=8, jitter=0)
    K.lathe(f'kumir_m{i}', [(0.075, 0), (0.06, 0.05), (0.0, 0.14)], (x, y, TOPZ + 0.82), 'M_gold', segs=8)
    K.box(f'kumir_g{i}', (0.03, 0.02, 0.025), (x - math.cos(a) * 0.066, y - math.sin(a) * 0.066, TOPZ + 0.66), 'M_glow',
          rot=(0, 0, a + math.pi / 2), bevel=0)

# ---- центральный столп
K.octagon('stolp_osn', (0, 0, TOPZ), 0.42, 0.18, 'M_stone')
PZ = K.octagon('stolp', (0, 0, TOPZ + 0.18), 0.28, 1.6, 'M_plaster')
for z in (0.5, 1.0, 1.45):
    K.octagon(f'poyas{z}', (0, 0, TOPZ + 0.18 + z), 0.3, 0.07, 'M_paint_red')
for i in range(8):   # руны — светящиеся полосы по граням
    a = i / 8 * math.tau + math.pi / 8
    K.box(f'runa{i}', (0.02, 0.05, 0.28), (math.cos(a) * 0.275, math.sin(a) * 0.275, TOPZ + 0.95), 'M_glow', rot=(0, 0, a), bevel=0)
K.octagon('kapitel', (0, 0, PZ), 0.36, 0.08, 'M_gold')
K.lathe('chasha', [(0.2, 0), (0.3, 0.08), (0.34, 0.14), (0.3, 0.16)], (0, 0, PZ + 0.08), 'M_gold', segs=16)

# ---- Дрон-квадрокоптер над чашей
DZ = PZ + 0.62
K.lathe('dron_telo', [(0.0, -0.1), (0.2, -0.07), (0.26, 0.0), (0.22, 0.07), (0.1, 0.13), (0.0, 0.15)], (0, 0, DZ), 'M_gold', segs=16)
K.log('dron_glaz_o', 0.06, 0.14, (0, -0.2, DZ + 0.01), 'y', material='M_gold', segs=16, jitter=0)
K.log('dron_glaz', 0.07, 0.1, (0, -0.21, DZ + 0.01), 'y', material='M_dark', segs=16, jitter=0)
K.log('dron_zrachok', 0.075, 0.06, (0, -0.215, DZ + 0.01), 'y', material='M_glow', segs=14, jitter=0)
for i in range(4):
    a = i / 4 * math.tau + math.pi / 4
    x, y = math.cos(a) * 0.46, math.sin(a) * 0.46
    K.box(f'dron_luch{i}', (0.46, 0.05, 0.035), (math.cos(a) * 0.24, math.sin(a) * 0.24, DZ + 0.02), 'M_iron', rot=(0, 0, a), bevel=0.008)
    K.log(f'dron_motor{i}', 0.07, 0.04, (x, y, DZ + 0.05), 'z', material='M_iron', segs=10, jitter=0)
    K.log(f'dron_vint{i}', 0.008, 0.2, (x, y, DZ + 0.095), 'z', material='M_gold', segs=16, jitter=0)
    K.box(f'dron_lopast{i}', (0.38, 0.03, 0.006), (x, y, DZ + 0.1), 'M_paint_red', rot=(0, 0, a + 0.6), bevel=0)
    K.log(f'dron_nozhka{i}', 0.16, 0.012, (math.cos(a) * 0.16, math.sin(a) * 0.16, DZ - 0.15), 'z', material='M_iron', segs=6, jitter=0)
K.log('dron_antenna', 0.2, 0.01, (0, 0.05, DZ + 0.24), 'z', material='M_iron', segs=6, jitter=0)
K.lathe('dron_antenna_s', [(0.0, 0), (0.03, 0.02), (0.0, 0.05)], (0, 0.05, DZ + 0.33), 'M_glow', segs=8)
K.add_marker('dron_anchor', (0, 0, DZ))

# ---- чаши огня на углах верхней ступени и стяги
for sx in (-1, 1):
    for sy in (-1, 1):
        x, y = sx * 0.82, sy * 0.82
        K.lathe(f'ogn_nozhka{sx}{sy}', [(0.04, 0), (0.03, 0.2), (0.06, 0.24)], (x, y, TOPZ), 'M_iron', segs=8)
        K.lathe(f'ogn_chasha{sx}{sy}', [(0.06, 0), (0.12, 0.06), (0.13, 0.08)], (x, y, TOPZ + 0.24), 'M_iron', segs=10)
        K.lathe(f'ogon{sx}{sy}', [(0.1, 0), (0.05, 0.1), (0.0, 0.18)], (x, y, TOPZ + 0.3), 'M_fire', segs=8)
for s in (-1, 1):
    K.log(f'styag_st{s}', 1.2, 0.015, (s * 1.25, -1.25, 0.6), 'z', material='M_gold', segs=6, jitter=0)
    K.box(f'styag{s}', (0.015, 0.3, 0.45), (s * 1.25, -1.1, 0.95), 'M_paint_red', bevel=0.003)
    K.box(f'styag_z{s}', (0.018, 0.1, 0.1), (s * 1.25, -1.1, 1.0), 'M_gold', rot=(math.pi / 4, 0, 0), bevel=0.005)

tris, dims = K.finish('chudo', out, ao_distance=0.3)
print('CHUDO_OK tris=%d size=%s out=%s' % (tris, dims, out))
