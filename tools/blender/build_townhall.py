# ПАЛАТЫ ГОЙДЫ (ратуша, 3×3 клетки) по стандарту GDD_2026.md §2.5, три облика по эпохам:
#   0 — деревянные хоромы на каменном подклете, соломенные крыши, рубленая башня;
#   1 — терем: тёсовые крыши, шатёр-смотрильня с галереей, красное крыльцо;
#   2 — каменные палаты: белёные стены, кирпичные наличники и углы, зелёное железо, золотое навершие с глазом Дрона.
# F:\blender.exe -b --factory-startup --python tools\blender\build_townhall.py -- <out.glb> <эпоха 0|1|2>
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import goyda_kit as K

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
out = args[0] if args else os.path.abspath('bld_townhall.glb')
ERA = int(args[1]) if len(args) > 1 else 0
random.seed(11)
K.reset_scene()
STONE = ERA == 2

R = 0.05
PODKLET = 0.3
MW, MD, MCY = 2.2, 1.5, 0.3          # главный сруб: ширина по X, глубина по Y, центр по Y (фасад в -Y)
FRONT = MCY - MD / 2                  # плоскость фасада главного сруба
TW, TCY = 0.72, FRONT - 0.2           # башня: сторона и центр по Y (выдвинута вперёд)

# ---- подклет
K.box('podklet', (MW + 0.3, MD + 0.3, PODKLET), (0, MCY, PODKLET / 2), 'M_brick' if STONE else 'M_stone', bevel=0.015)
K.box('podklet_t', (TW + 0.25, TW + 0.25, PODKLET), (0, TCY, PODKLET / 2), 'M_brick' if STONE else 'M_stone', bevel=0.015)

# ---- главный объём
if not STONE:
    EAVE = K.srub('m', 0, MCY, MW, MD, PODKLET, 12, R=R, ovh=0.09)
else:
    EAVE = PODKLET + 1.25
    hh = EAVE - PODKLET
    K.box('steny', (MW + 2 * R, MD + 2 * R, hh), (0, MCY, PODKLET + hh / 2), 'M_plaster', bevel=0.01)
    for sx in (-1, 1):                # кирпичные лопатки по углам
        for sy in (-1, 1):
            K.box(f'lop{sx}{sy}', (0.12, 0.12, hh), (sx * (MW / 2 + R), MCY + sy * (MD / 2 + R), PODKLET + hh / 2), 'M_brick', bevel=0.006)
    for sy in (-1, 1):                # межэтажный пояс и карниз
        for zz in (PODKLET + hh * 0.5, EAVE - 0.03):
            K.box(f'poyas{sy}{zz:.2f}', (MW + 2 * R + 0.06, 0.05, 0.05), (0, MCY + sy * (MD / 2 + R + 0.02), zz), 'M_brick', bevel=0.005)
RIDGE = K.gable_roof('mr', (0, MCY, 0), MW, MD, EAVE, ERA, ridge_axis='x', rov=0.16, R=R,
                     gable_mat='M_plaster' if STONE else None)

# ---- окна главного объёма: два этажа по фасаду, по бокам — второй этаж
fz1, fz2 = PODKLET + 0.3, PODKLET + 0.88
wall = FRONT - R - (0.0 if STONE else 0.004)
for x in (-0.9, -0.62, 0.62, 0.9):
    for z in (fz1, fz2):
        K.window(f'wf{x}{z:.1f}', (x, wall, z), '-y', ERA, ww=0.16, wh=0.22, shutters=not STONE)
for sx in (-1, 1):
    for y in (MCY - 0.3, MCY + 0.3):
        K.window(f'ws{sx}{y:.1f}', (sx * (MW / 2 + R + 0.004), y, fz2), '+x' if sx > 0 else '-x', ERA, ww=0.16, wh=0.22, shutters=not STONE)

# ---- башня-терем: сруб выше крыши, галерея-смотрильня, шатёр
TZ0 = PODKLET
if not STONE:
    TTOP = K.srub('t', 0, TCY, TW, TW, TZ0, 17, R=0.042, ovh=0.06)
else:
    TTOP = RIDGE - 0.15
    K.box('bashnya', (TW + 0.09, TW + 0.09, TTOP - TZ0), (0, TCY, (TTOP + TZ0) / 2), 'M_plaster', bevel=0.008)
    for sx in (-1, 1):
        for sy in (-1, 1):
            K.box(f'tlop{sx}{sy}', (0.08, 0.08, TTOP - TZ0), (sx * (TW / 2 + 0.04), TCY + sy * (TW / 2 + 0.04), (TTOP + TZ0) / 2), 'M_brick', bevel=0.005)
K.window('wt1', (0, TCY - TW / 2 - 0.045, TZ0 + 0.35), '-y', ERA, ww=0.2, wh=0.28, shutters=False)   # парадное окно над входом
K.window('wt2', (0, TCY - TW / 2 - 0.045, RIDGE - 0.5), '-y', ERA, ww=0.14, wh=0.2, shutters=not STONE)

# галерея: пол, столбики, перила
GZ = TTOP + 0.02
GS = TW + 0.34
K.box('gal_pol', (GS, GS, 0.05), (0, TCY, GZ), 'M_plank', bevel=0.006)
for sx in (-1, 1):
    for sy in (-1, 1):
        K.log(f'gal_st{sx}{sy}', 0.42, 0.022, (sx * (GS / 2 - 0.04), TCY + sy * (GS / 2 - 0.04), GZ + 0.23), 'z', segs=6, jitter=0.02)
for s in (-1, 1):
    K.box(f'gal_px{s}', (GS, 0.02, 0.02), (0, TCY + s * (GS / 2 - 0.04), GZ + 0.16), 'M_paint_white' if ERA else 'M_plank', bevel=0.002)
    K.box(f'gal_py{s}', (0.02, GS, 0.02), (s * (GS / 2 - 0.04), TCY, GZ + 0.16), 'M_paint_white' if ERA else 'M_plank', bevel=0.002)
    for k in range(5):
        t = -GS / 2 + 0.1 + k * (GS - 0.2) / 4
        K.box(f'bal_x{s}{k}', (0.016, 0.016, 0.12), (t, TCY + s * (GS / 2 - 0.04), GZ + 0.09), 'M_paint_white' if ERA else 'M_plank', bevel=0.002)
        K.box(f'bal_y{s}{k}', (0.016, 0.016, 0.12), (s * (GS / 2 - 0.04), TCY + t, GZ + 0.09), 'M_paint_white' if ERA else 'M_plank', bevel=0.002)

# шатёр
SZ = GZ + 0.45
K.box('shater_osn', (GS + 0.1, GS + 0.1, 0.04), (0, TCY, SZ), 'M_paint_white' if ERA else 'M_plank', bevel=0.006)
if ERA == 0:
    TOP = K.tent('sh', (0, TCY, SZ), GS + 0.14, 0.8, ERA, top_mat='M_thatch')
else:
    TOP = K.tent('sh', (0, TCY, SZ), GS + 0.1, 1.05, ERA)
# навершие
if ERA == 2:
    K.log('shpil', 0.2, 0.03, (0, TCY, TOP + 0.08), 'z', material='M_gold', segs=8, jitter=0)
    K.box('glaz_zol', (0.2, 0.2, 0.2), (0, TCY, TOP + 0.26), 'M_gold', rot=(math.pi / 4, 0, math.pi / 4), bevel=0.04)
    K.log('glaz', 0.02, 0.07, (0, TCY - 0.11, TOP + 0.26), 'y', material='M_window', segs=12, jitter=0)
    FLAG_Z = TOP + 0.36
else:
    FLAG_Z = TOP
K.log('flagshtok', 0.55, 0.012, (0, TCY, FLAG_Z + 0.27), 'z', material='M_iron' if ERA else 'M_log', segs=6, jitter=0)
K.box('flag', (0.02, 0.32, 0.18), (0, TCY + 0.17, FLAG_Z + 0.44), 'M_paint_red', bevel=0.003)
K.add_marker('flag_top', (0, TCY, FLAG_Z + 0.55))

# ---- красное крыльцо: лестница вдоль фасада на площадку второго этажа
LZ = PODKLET + 0.55
LX = 0.62
K.box('kr_ploshad', (0.46, 0.4, 0.04), (LX, FRONT - R - 0.22, LZ), 'M_plank', bevel=0.006)
steps = 7
for i in range(steps):
    z = (i + 1) * LZ / (steps + 1)
    K.box(f'kr_st{i}', (0.36, 0.07, 0.03), (LX + 0.02, FRONT - R - 0.45 - (steps - 1 - i) * 0.075, z), 'M_plank', bevel=0.004)
for sx in (-1, 1):
    K.log(f'kr_stolb{sx}', LZ + 0.45, 0.024, (LX + sx * 0.2, FRONT - R - 0.38, (LZ + 0.45) / 2), 'z', segs=8, jitter=0.02)
    K.box(f'kr_kosour{sx}', (0.03, 0.62, 0.05), (LX + sx * 0.19, FRONT - R - 0.67, LZ / 2), 'M_plank',
          rot=(-math.atan2(LZ, 0.55), 0, 0), bevel=0.004)
kr_roof = K.capture(lambda: K.gable_roof('kr', (0, 0, 0), 0.34, 0.44, LZ + 0.45, 1 if ERA == 0 else ERA, ridge_axis='y', rov=0.08, R=0.02,
                                         gable_mat='M_paint_white' if ERA else 'M_plank'))
K.place(kr_roof, (LX, FRONT - R - 0.22, 0))
K.box('dver', (0.2, 0.02, 0.36), (LX, FRONT - R - 0.005, LZ + 0.2), 'M_dark', bevel=0.004)
K.box('dver_n', (0.26, 0.025, 0.42), (LX, FRONT - R, LZ + 0.22), 'M_brick' if STONE else 'M_paint_white', bevel=0.004)
K.box('dver_niz', (0.22, 0.02, 0.28), (0, TCY - TW / 2 - 0.05, PODKLET + 0.14), 'M_dark', bevel=0.004)   # вход в подклет

# ---- двор: бочки, лавка, колода-коновязь
for i, (x, y) in enumerate(((-1.05, FRONT - 0.35), (-0.92, FRONT - 0.42))):
    K.log(f'bochka{i}', 0.14, 0.055, (x, y, 0.07), 'z', material='M_plank', segs=10, jitter=0.02)
    for hz in (0.025, 0.115):
        K.log(f'obr{i}{hz}', 0.012, 0.058, (x, y, hz), 'z', material='M_iron', segs=10, jitter=0)
K.box('lavka', (0.5, 0.08, 0.025), (-0.45, FRONT - 0.3, 0.12), 'M_plank', bevel=0.003)
for s in (-1, 1):
    K.box(f'lavka_n{s}', (0.03, 0.07, 0.11), (-0.45 + s * 0.2, FRONT - 0.3, 0.055), 'M_plank', bevel=0.002)
K.log('konovyaz', 0.7, 0.02, (-1.0, MCY, 0.28), 'y', segs=6, jitter=0.05)
for s in (-1, 1):
    K.log(f'konovyaz_st{s}', 0.3, 0.025, (-1.0, MCY + s * 0.3, 0.15), 'z', segs=6, jitter=0.05)

K.world_uv()
K.tint_variation()
K.apply_all()
ob = K.join_all('townhall')
tris = K.tri_count()
K.bake_ao(ob, distance=0.3)
K.export_glb(out)
print('TOWNHALL_OK era=%d tris=%d size=%.2fx%.2fx%.2f out=%s' % (ERA, tris, ob.dimensions.x, ob.dimensions.y, ob.dimensions.z, out))
