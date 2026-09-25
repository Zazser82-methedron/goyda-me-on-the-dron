# РУДНИК (2×2). Главный силуэт — деревянный копёр со шкивом над шахтой (читается сверху издалека).
# Сзади слоистый утёс со штольней в бревенчатой крепи и подпорной стенкой; рыжие отвалы руды;
# дробильный навес; рельсы вдоль фасада — по ним катается вагонетка BuildingActivity._mineCart
# (x ±0.46 при y=-0.62) и уходят в штольню.
# F:\blender.exe -b --factory-startup --python tools\blender\build_rudnik.py -- <out.glb> <эпоха>
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import goyda_kit as K

out, ERA = K.cli()
random.seed(122)
K.reset_scene()
ROOF = 'M_paint_green' if ERA == 2 else 'M_plank'

# ---- утёс у задней границы
TOP = K.cliff('utyos', (-0.25, 0.5, 0), 1.35, 0.7, 0.9, layers=4)
K.cliff('utyos2', (0.62, 0.62, 0), 0.6, 0.5, 0.55, layers=3)

# ---- штольня: подпорная стенка из брёвен, крепь, тёмный зев
AX = -0.35
for i in range(5):
    K.log(f'podp{i}', 0.9, 0.035, (AX, 0.14, 0.035 + i * 0.07), 'x', segs=8, jitter=0.1)
K.box('zev', (0.32, 0.12, 0.36), (AX, 0.1, 0.19), 'M_dark', bevel=0)
for s in (-1, 1):
    K.log(f'krep{s}', 0.42, 0.04, (AX + s * 0.19, 0.06, 0.21), 'z', segs=8, jitter=0.05)
K.log('krep_v', 0.52, 0.045, (AX, 0.06, 0.43), 'x', segs=8, jitter=0.05)
K.box('krep_kozyrek', (0.62, 0.3, 0.025), (AX, -0.03, 0.52), ROOF, rot=(-0.35, 0, 0), bevel=0.004)
K.log('fonar_st', 0.22, 0.01, (AX + 0.26, 0.02, 0.4), 'z', material='M_iron', segs=5, jitter=0)
K.box('fonar', (0.05, 0.05, 0.07), (AX + 0.26, 0.02, 0.53), 'M_fire', bevel=0.008)

# ---- копёр: четыре наклонные ноги, площадка, шкив, раскосы
KX, KY = 0.5, -0.02
HK = 1.25
for sx in (-1, 1):
    for sy in (-1, 1):
        leg = K.log(f'kop_n{sx}{sy}', HK + 0.05, 0.03, (KX + sx * 0.14, KY + sy * 0.14, HK / 2), 'z', segs=7, jitter=0.03)
        leg.rotation_euler = (sy * 0.1, -sx * 0.1, 0)   # верх ног сходится к оси копра
for z in (0.35, 0.75):
    for s in (-1, 1):
        K.box(f'kop_px{z}{s}', (0.34 - z * 0.12, 0.03, 0.03), (KX, KY + s * (0.18 - z * 0.06), z), 'M_log', bevel=0.004)
        K.box(f'kop_py{z}{s}', (0.03, 0.34 - z * 0.12, 0.03), (KX + s * (0.18 - z * 0.06), KY, z), 'M_log', bevel=0.004)
    K.box(f'raskos{z}', (0.42, 0.025, 0.025), (KX, KY - 0.15, z + 0.18), 'M_log', rot=(0, 0.8, 0), bevel=0.003)
K.box('kop_ploshad', (0.3, 0.3, 0.03), (KX, KY, HK), 'M_plank', bevel=0.004)
K.box('kop_krysha', (0.36, 0.36, 0.02), (KX, KY, HK + 0.3), ROOF, bevel=0.004)
for sx in (-1, 1):
    K.log(f'kop_st{sx}', 0.3, 0.012, (KX + sx * 0.12, KY, HK + 0.15), 'z', segs=5, jitter=0)
# шкив (колесо) и канат вниз в ствол
wheel = K.wheel('shkiv', (KX, KY, HK + 0.14), r=0.13, axis='y', spokes=6)
K.log('kanat', HK, 0.005, (KX + 0.12, KY, HK / 2 + 0.07), 'z', material='M_cloth', segs=4, jitter=0)
K.box('stvol', (0.22, 0.22, 0.04), (KX, KY, 0.02), 'M_dark', bevel=0)
for s in (-1, 1):
    K.box(f'stvol_r{s}', (0.28, 0.04, 0.08), (KX, KY + s * 0.13, 0.04), 'M_log', bevel=0.005)
K.barrel('badya', (KX + 0.12, KY, 0.12), r=0.04, h=0.07)
K.add_marker('flag_top', (KX, KY, HK + 0.35))

# ---- рельсы вдоль фасада и отвод в штольню
RY = -0.62
for i in range(11):
    K.box(f'shpala{i}', (0.05, 0.3, 0.02), (-0.7 + i * 0.14, RY, 0.01), 'M_plank', bevel=0.003)
for s in (-1, 1):
    K.box(f'relsa{s}', (1.5, 0.02, 0.02), (0, RY + s * 0.1, 0.03), 'M_iron', bevel=0)
for i in range(5):
    K.box(f'shpala_v{i}', (0.26, 0.05, 0.02), (AX, -0.02 - i * 0.12, 0.01), 'M_plank', bevel=0.003)
for s in (-1, 1):
    K.box(f'relsa_v{s}', (0.02, 0.56, 0.02), (AX + s * 0.08, -0.25, 0.03), 'M_iron', bevel=0)

# ---- отвалы руды (рыжие, с блеском железа)
for n, (x, y) in enumerate(((0.12, -0.3), (0.82, -0.35))):
    K.lathe(f'otval{n}', [(0.2, 0), (0.15, 0.08), (0.06, 0.15), (0.0, 0.17)], (x, y, 0), 'M_brick', segs=9)
    for i in range(5):
        K.rock(f'ruda{n}{i}', (x + random.uniform(-0.12, 0.12), y + random.uniform(-0.1, 0.1), 0.04 + random.uniform(0, 0.06)),
               (0.035, 0.035, 0.03), 'M_iron')

# ---- дробильный навес слева спереди
NX, NY = -0.75, -0.3
for sx in (-1, 1):
    for sy in (-1, 1):
        K.log(f'dn_st{sx}{sy}', 0.46, 0.018, (NX + sx * 0.14, NY + sy * 0.12, 0.23), 'z', segs=6, jitter=0.03)
K.box('dn_krysha', (0.38, 0.34, 0.02), (NX, NY, 0.48), ROOF, rot=(0.25, 0, 0), bevel=0.003)
K.box('dn_stol', (0.24, 0.16, 0.03), (NX, NY, 0.16), 'M_plank', bevel=0.003)
K.box('dn_nakov', (0.07, 0.07, 0.07), (NX - 0.05, NY, 0.21), 'M_stone', bevel=0.01)
for i in range(3):
    K.box(f'kaylo_r{i}', (0.012, 0.012, 0.28), (NX + 0.2, NY - 0.1 + i * 0.07, 0.15), 'M_plank', rot=(0, -0.2, 0), bevel=0)
    K.box(f'kaylo_g{i}', (0.09, 0.012, 0.02), (NX + 0.23, NY - 0.1 + i * 0.07, 0.28), 'M_iron', rot=(0, -0.2, 0), bevel=0)

tris, dims = K.finish('rudnik', out, ao_distance=0.22)
print('RUDNIK_OK era=%d tris=%d size=%s out=%s' % (ERA, tris, dims, out))
