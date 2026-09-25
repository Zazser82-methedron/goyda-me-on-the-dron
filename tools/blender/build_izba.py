# ИЗБА по стандарту GDD_2026.md §2.5, три облика по эпохам (§3.9):
#   0 — Вольная слобода: пышная солома, каменный цоколь, конёк-голова;
#   1 — Уездная держава: тёсовая кровля внахлёст, резной подзор, белёная труба;
#   2 — Гойда-индустрия: обшивка охрой, зелёная железная кровля с фальцами, кирпичная труба.
# F:\blender.exe -b --factory-startup --python tools\blender\build_izba.py -- <out.glb> <эпоха 0|1|2>
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import goyda_kit as K

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
out = args[0] if args else os.path.abspath('bld_izba.glb')
ERA = int(args[1]) if len(args) > 1 else 0
random.seed(7)
K.reset_scene()

W, D = 0.86, 0.96          # между осями стен: ширина (X) и глубина (Y). Фасад-фронтон смотрит в -Y
R = 0.042                  # радиус бревна
BASE = 0.07                # цоколь
OVH = 0.075 if ERA < 2 else 0.0   # выпуск брёвен за угол («в чашу»); обшитый дом III эпохи — без выпусков
COURSES = 7

# ---- цоколь
K.box('cokol', (W + 0.1, D + 0.1, BASE), (0, 0, BASE / 2), 'M_brick' if ERA == 2 else 'M_stone', bevel=0.012)

# ---- сруб: фасадные/задние и боковые брёвна чередуются на полбревна
z = BASE + R
for i in range(COURSES):
    for sy in (-1, 1):
        K.log(f'lx{i}{sy}', W + 2 * OVH, R, (0, sy * D / 2, z), 'x')
    for sx in (-1, 1):
        K.log(f'ly{i}{sx}', D + 2 * OVH, R, (sx * W / 2, 0, z + R), 'y')
    z += 2 * R
EAVE = z + R * 0.2

# ---- III эпоха: сруб обшит тёсом, углы закрыты белыми пилястрами
if ERA == 2:
    hh = EAVE - BASE
    zc = BASE + hh / 2
    for sy in (-1, 1):
        K.box(f'obshivka_y{sy}', (W + 2 * R + 0.01, 0.02, hh), (0, sy * (D / 2 + R + 0.005), zc), 'M_siding', bevel=0.003)
    for sx in (-1, 1):
        K.box(f'obshivka_x{sx}', (0.02, D + 2 * R + 0.01, hh), (sx * (W / 2 + R + 0.005), 0, zc), 'M_siding', bevel=0.003)
    for sx in (-1, 1):
        for sy in (-1, 1):
            K.box(f'pilastra{sx}{sy}', (0.05, 0.05, hh + 0.02), (sx * (W / 2 + R + 0.01), sy * (D / 2 + R + 0.01), zc), 'M_paint_white', bevel=0.005)
    for sy in (-1, 1):   # карниз
        K.box(f'karniz{sy}', (W + 2 * R + 0.08, 0.05, 0.04), (0, sy * (D / 2 + R + 0.02), EAVE - 0.01), 'M_paint_white', bevel=0.005)

# ---- крыша: скаты вдоль Y, 45°
ROV = 0.14
half = W / 2 + ROV
RIDGE = EAVE + W / 2 + 0.02
L = half * math.sqrt(2) + 0.03
S2 = math.sqrt(0.5)


def slope_frame(side, lift):
    """Центр и поворот плоскости ската на высоте lift над ним (side −1 левый, +1 правый)."""
    cx, cz = side * half / 2, RIDGE - half / 2
    return (cx + side * S2 * lift, cz + S2 * lift), (0, side * math.pi / 4, 0)


if ERA == 0:
    T = 0.09
    for side in (-1, 1):
        (x, zz), rot = slope_frame(side, T / 2)
        K.box(f'roof{side}', (L, D + 2 * ROV, T), (x, 0, zz), 'M_thatch', rot=rot, bevel=0.03)
        # пышный валик соломы по нижнему краю ската
        ex = side * (half - 0.02); ez = RIDGE - half + 0.02
        K.log(f'strekha{side}', D + 2 * ROV + 0.02, 0.05, (ex, 0, ez), 'y', material='M_thatch', segs=8, jitter=0.3)
    K.log('ohlupen', D + 2 * ROV + 0.06, 0.06, (0, 0, RIDGE + T * 0.85), 'y', segs=8, jitter=0.05)
    TOP = RIDGE + T
elif ERA == 1:
    T = 0.03
    for side in (-1, 1):   # тёс: доски вдоль ската в два слоя внахлёст
        n = 15
        span = D + 2 * ROV
        for layer in (0, 1):
            for j in range(n - layer):
                y = -span / 2 + (j + 0.5 + layer * 0.5) * span / n
                (x, zz), rot = slope_frame(side, 0.012 + layer * 0.018)
                b = K.box(f'tes{side}{layer}{j}', (L + random.uniform(-0.02, 0.02), span / n * 0.96, 0.016), (x, y, zz),
                          'M_plank', rot=rot, bevel=0)   # фаска на тонкой доске не видна с камеры, а стоит 30 tris
                b['vary'] = 1
    K.log('ohlupen', D + 2 * ROV + 0.06, 0.05, (0, 0, RIDGE + 0.04), 'y', segs=8, jitter=0.05)
    TOP = RIDGE + 0.05
else:
    T = 0.025
    for side in (-1, 1):
        (x, zz), rot = slope_frame(side, T / 2)
        K.box(f'roof{side}', (L, D + 2 * ROV, T), (x, 0, zz), 'M_paint_green', rot=rot, bevel=0.004)
        # фальцы — стоячие швы железных листов
        for j in range(9):
            y = -(D / 2 + ROV) + (j + 0.5) * (D + 2 * ROV) / 9
            (x2, z2), _ = slope_frame(side, T + 0.008)
            K.box(f'falc{side}{j}', (L, 0.012, 0.016), (x2, y, z2), 'M_paint_green', rot=rot, bevel=0.002)
    K.box('konek_iron', (0.07, D + 2 * ROV, 0.04), (0, 0, RIDGE + 0.02), 'M_paint_green', rot=(0, math.pi / 4, 0), bevel=0.004)
    TOP = RIDGE + 0.03

# ---- фронтоны
gw = W / 2 + R
tri = [(-gw, EAVE - 0.01), (gw, EAVE - 0.01), (0, EAVE + gw - 0.02)]
for sy in (-1, 1):
    K.prism(f'gable{sy}', tri, 0.03, 'y', (0, sy * (D / 2 - 0.005 + (R + 0.02 if ERA == 2 else 0)), 0),
            'M_siding' if ERA == 2 else 'M_plank')

# конёк-голова над фасадом (I–II)
if ERA < 2:
    K.box('konek', (0.05, 0.16, 0.12), (0, -(D / 2 + ROV + 0.06), TOP + 0.05), 'M_log', rot=(0.5, 0, 0), bevel=0.01)

# ---- причелины, полотенце, слуховое окно
py = -(D / 2 + ROV - 0.01)
for sy_face, yy in ((-1, py), (1, -py)):
    for side in (-1, 1):
        K.box(f'prichelina{sy_face}{side}', (L * 0.98, 0.02, 0.06),
              (side * half / 2 + side * 0.012, yy, RIDGE - half / 2 - 0.035), 'M_paint_white',
              rot=(0, side * math.pi / 4, 0), bevel=0.004)
K.box('polotence', (0.06, 0.02, 0.18), (0, py, RIDGE - 0.11), 'M_paint_white', bevel=0.004)
K.prism('polotence_tip', [(-0.03, 0), (0.03, 0), (0, -0.05)], 0.02, 'y', (0, py, RIDGE - 0.2), 'M_paint_white')
fy = -(D / 2) - (R + 0.03 if ERA == 2 else 0.02)
K.box('w_gable', (0.09, 0.01, 0.11), (0, fy, EAVE + 0.17), 'M_window', bevel=0)
K.box('w_gable_frame', (0.13, 0.015, 0.15), (0, fy + 0.006, EAVE + 0.17), 'M_paint_white', bevel=0.003)

# ---- резной подзор под свесом вдоль длинных сторон (II–III): доска + зубцы
if ERA >= 1:
    for sx in (-1, 1):
        x = sx * (half - 0.04)
        zb = RIDGE - half + 0.0
        K.box(f'podzor{sx}', (0.015, D + 2 * ROV - 0.04, 0.05), (x, 0, zb - 0.02), 'M_paint_white', bevel=0.002)
        n = 14
        for j in range(n):
            y = -(D / 2 + ROV) + 0.04 + (j + 0.5) * (D + 2 * ROV - 0.08) / n
            K.prism(f'zub{sx}{j}', [(y - 0.025, 0), (y + 0.025, 0), (y, -0.045)], 0.012, 'x', (x, 0, zb - 0.045), 'M_paint_white')

# ---- окна с наличниками и открытыми ставнями
WALL_OUT = R + (0.03 if ERA == 2 else 0.004)
SHUTTER = 'M_paint_blue' if ERA < 2 else 'M_paint_green'


def window(name, cx, cy, cz, face):          # face: 'front' (-Y) | 'side' (+X)
    ww, wh = 0.15, 0.19 + (0.03 if ERA == 2 else 0)
    def b(n, fs, ss, off, dz, mat, rot=(0, 0, 0)):
        # fs — размер вдоль стены, ss — толщина, off — вынос от стены, dz — смещение по высоте
        if face == 'front':
            K.box(name + n, (fs[0], ss, fs[1]), (cx + fs[2], cy - WALL_OUT - off, cz + dz), mat, rot=rot)
        else:
            rr = (rot[1], 0, 0)   # на боковой стене ромб кокошника поворачиваем вокруг X
            K.box(name + n, (ss, fs[0], fs[1]), (cx + WALL_OUT + off, cy + fs[2], cz + dz), mat, rot=rr)
    b('_glass', (ww, wh, 0), 0.01, 0.0, 0, 'M_window')
    b('_perekrest_v', (0.012, wh, 0), 0.008, 0.006, 0, 'M_paint_white')
    b('_perekrest_h', (ww, 0.012, 0), 0.008, 0.006, 0.02, 'M_paint_white')
    b('_top', (ww + 0.07, 0.035, 0), 0.025, 0.01, wh / 2 + 0.02, 'M_paint_white')
    b('_kok', (ww * 0.62, 0.062, 0), 0.02, 0.012, wh / 2 + 0.065, 'M_paint_white', rot=(0, math.pi / 4, 0))
    b('_bot', (ww + 0.06, 0.025, 0), 0.03, 0.012, -wh / 2 - 0.015, 'M_paint_white')
    b('_podokon', (ww + 0.03, 0.04, 0), 0.02, 0.014, -wh / 2 - 0.045, 'M_paint_white')
    for s in (-1, 1):
        b(f'_jamb{s}', (0.025, wh + 0.02, s * (ww / 2 + 0.013)), 0.022, 0.008, 0, 'M_paint_white')
        b(f'_stavnya{s}', (ww / 2, wh, s * (ww * 0.78 + 0.03)), 0.012, 0.01, 0, SHUTTER)
        b(f'_stavnya_pl{s}', (ww / 2 - 0.03, wh - 0.05, s * (ww * 0.78 + 0.03)), 0.006, 0.018, 0, 'M_paint_white')


WZ = BASE + 0.34
window('w1', -0.2, -D / 2, WZ, 'front')
window('w2', 0.2, -D / 2, WZ, 'front')
window('w3', W / 2, 0.22, WZ, 'side')

# ---- дверь и крыльцо на боковой стене (+X)
DY = -0.2
K.box('door', (0.02, 0.17, 0.3), (W / 2 + WALL_OUT + 0.002, DY, BASE + 0.27), 'M_dark', bevel=0.004)
K.box('door_frame', (0.015, 0.22, 0.34), (W / 2 + WALL_OUT - 0.004, DY, BASE + 0.28), 'M_paint_white', bevel=0.003)
px = W / 2 + R + 0.14
K.box('porch', (0.24, 0.3, 0.035), (px, DY, BASE + 0.12), 'M_plank', bevel=0.006)
for i, h in enumerate((0.085, 0.045)):
    K.box(f'step{i}', (0.07, 0.24, 0.02), (px + 0.14 + i * 0.07, DY, h), 'M_plank', bevel=0.004)
for s in (-1, 1):
    K.log(f'post{s}', 0.42, 0.016, (px + 0.09, DY + s * 0.13, BASE + 0.12 + 0.21), 'z', segs=6, jitter=0.02)
    K.box(f'perila{s}', (0.2, 0.015, 0.015), (px, DY + s * 0.13, BASE + 0.27), 'M_plank', bevel=0.002)
    for k in range(3):
        K.box(f'balyasina{s}{k}', (0.014, 0.014, 0.12), (px - 0.06 + k * 0.06, DY + s * 0.13, BASE + 0.2), 'M_paint_white', bevel=0.002)
PROOF = 'M_paint_green' if ERA == 2 else 'M_plank'
for side in (-1, 1):
    K.box(f'porchroof{side}', (0.26, 0.2, 0.02), (px + 0.02, DY + side * 0.075, BASE + 0.58), PROOF,
          rot=(side * 0.55, 0, 0), bevel=0.004)

# ---- печная труба
CX, CY = -0.18, 0.18
if ERA == 0:
    K.box('truba', (0.1, 0.1, 0.34), (CX, CY, RIDGE - 0.1), 'M_stone', bevel=0.008)
    K.box('truba_cap', (0.13, 0.13, 0.025), (CX, CY, RIDGE + 0.08), 'M_stone', bevel=0.005)
elif ERA == 1:
    K.box('truba', (0.11, 0.11, 0.36), (CX, CY, RIDGE - 0.09), 'M_plaster', bevel=0.008)
    K.box('truba_cap', (0.14, 0.14, 0.03), (CX, CY, RIDGE + 0.1), 'M_plaster', bevel=0.005)
else:
    K.box('truba', (0.11, 0.11, 0.38), (CX, CY, RIDGE - 0.08), 'M_brick', bevel=0.006)
    K.box('truba_cap', (0.15, 0.15, 0.025), (CX, CY, RIDGE + 0.12), 'M_brick', bevel=0.004)
    K.box('dymnik', (0.15, 0.15, 0.02), (CX, CY, RIDGE + 0.2), 'M_iron', bevel=0.003)
    for sx in (-1, 1):
        for sy in (-1, 1):
            K.box(f'dymnik_st{sx}{sy}', (0.01, 0.01, 0.07), (CX + sx * 0.06, CY + sy * 0.06, RIDGE + 0.16), 'M_iron', bevel=0)
K.add_marker('chimney_top', (CX, CY, RIDGE + 0.14))

# ---- поленница, бочка, завалинка-лавка
for row in range(3):
    for j in range(6 - row):
        K.log(f'drova{row}{j}', 0.2, 0.022, (-0.3 + j * 0.046 + row * 0.023, D / 2 + R + 0.12 + (0.03 if ERA == 2 else 0),
              0.025 + row * 0.04), 'y', segs=6, jitter=0.1)
K.log('bochka', 0.13, 0.05, (px + 0.02, DY + 0.28, 0.065), 'z', material='M_plank', segs=10, jitter=0.02)
for hz in (0.025, 0.105):
    K.log(f'obruch{hz}', 0.012, 0.053, (px + 0.02, DY + 0.28, hz), 'z', material='M_iron', segs=10, jitter=0)
K.box('lavka', (0.36, 0.06, 0.02), (0, -(D / 2 + WALL_OUT + 0.05), 0.11), 'M_plank', bevel=0.003)
for s in (-1, 1):
    K.box(f'lavka_n{s}', (0.02, 0.05, 0.1), (s * 0.15, -(D / 2 + WALL_OUT + 0.05), 0.05), 'M_plank', bevel=0.002)

# ---- финал
K.world_uv()
K.tint_variation()
K.apply_all()
ob = K.join_all('izba')
tris = K.tri_count()
K.bake_ao(ob)
K.export_glb(out)
print('IZBA_OK era=%d tris=%d size=%.2fx%.2fx%.2f out=%s' % (ERA, tris, ob.dimensions.x, ob.dimensions.y, ob.dimensions.z, out))
