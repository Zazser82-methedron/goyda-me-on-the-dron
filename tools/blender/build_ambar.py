# АМБАР (2×2): сруб на валунах (от сырости и мышей), навес-гульбище над воротами,
# двустворчатые ворота с замком, мешки, бочки, телега. Крыша по эпохам (солома / тёс / железо).
# F:\blender.exe -b --factory-startup --python tools\blender\build_ambar.py -- <out.glb> <эпоха>
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import goyda_kit as K

out, ERA = K.cli()
random.seed(21)
K.reset_scene()

W, D, CY = 1.45, 1.05, 0.12      # сруб по осям стен; фасад (ворота) в -Y
R = 0.048
LIFT = 0.16                        # сруб поднят на валунах

# валуны-опоры по углам и серединам
for x in (-W / 2, 0, W / 2):
    for y in (CY - D / 2, CY + D / 2):
        K.box(f'valun{x:.1f}{y:.1f}', (0.16, 0.16, LIFT), (x, y, LIFT / 2), 'M_stone', rot=(0, 0, random.uniform(0, 1)), bevel=0.04)

EAVE = K.srub('s', 0, CY, W, D, LIFT, 8, R=R, ovh=0.08)
RIDGE = K.gable_roof('r', (0, CY, 0), W, D, EAVE, ERA, ridge_axis='x', rov=0.16, R=R)

# навес над воротами на двух столбах
FY = CY - D / 2 - R
K.box('naves', (1.0, 0.55, 0.03), (0, FY - 0.24, EAVE + 0.04), 'M_roof_iron' if ERA == 2 else 'M_roof',
      rot=(-0.28, 0, 0), bevel=0.004)
for s in (-1, 1):
    K.log(f'stolb{s}', EAVE + 0.02, 0.028, (s * 0.44, FY - 0.46, (EAVE + 0.02) / 2), 'z', segs=8, jitter=0.03)
K.box('pomost', (1.0, 0.5, 0.04), (0, FY - 0.22, LIFT - 0.02), 'M_plank', bevel=0.005)

# ворота: две створки, железные полосы, замок
for s in (-1, 1):
    K.box(f'stvorka{s}', (0.24, 0.025, 0.42), (s * 0.125, FY - 0.005, LIFT + 0.24), 'M_dark', bevel=0.004)
    for z in (0.1, 0.34):
        K.box(f'petlya{s}{z}', (0.2, 0.03, 0.022), (s * 0.13, FY - 0.012, LIFT + 0.03 + z), 'M_iron', bevel=0)
K.box('zamok', (0.05, 0.03, 0.06), (0, FY - 0.03, LIFT + 0.24), 'M_gold', bevel=0.01)
K.box('nalichnik', (0.58, 0.03, 0.5), (0, FY + 0.004, LIFT + 0.26), 'M_paint_white' if ERA else 'M_plank', bevel=0.005)

# слуховое окошко на фронтоне и маленькие продухи
K.window('okno', (0, CY - D / 2 - R - 0.004, EAVE + 0.18), '-y', ERA, ww=0.12, wh=0.12, shutters=False)

# двор: мешки на помосте, бочки, телега
K.sacks('m1', (-0.35, FY - 0.3, LIFT), 4)
K.sacks('m2', (0.36, FY - 0.3, LIFT), 3)
K.barrel('b1', (0.82, CY - 0.1, 0))
K.barrel('b2', (0.84, CY + 0.08, 0))
K.telega('tel', (-0.6, FY - 0.78, 0), angle=0.35, load='sacks')

tris, dims = K.finish('ambar', out)
print('AMBAR_OK era=%d tris=%d size=%s out=%s' % (ERA, tris, dims, out))
