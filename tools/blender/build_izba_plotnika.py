# ИЗБА ПЛОТНИКА (1×1): небольшой сруб и пристроенный навес-мастерская — козлы с бревном и пилой,
# верстак с топором, штабель тёса, щепа. Эта постройка чинит соседей, поэтому вид «вечной стройки».
# F:\blender.exe -b --factory-startup --python tools\blender\build_izba_plotnika.py -- <out.glb> <эпоха>
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import goyda_kit as K

out, ERA = K.cli()
random.seed(161)
K.reset_scene()

W, D, CX, CY = 0.5, 0.46, -0.16, 0.14
K.box('cokol', (W + 0.1, D + 0.1, 0.05), (CX, CY, 0.025), 'M_stone', bevel=0.01)
EAVE = K.srub('s', CX, CY, W, D, 0.05, 5, R=0.036, ovh=0.05)
K.gable_roof('r', (CX, CY, 0), W, D, EAVE, ERA, ridge_axis='y', rov=0.09, R=0.036)
K.box('dver', (0.13, 0.02, 0.24), (CX - 0.08, CY - D / 2 - 0.04, 0.17), 'M_dark', bevel=0.004)
K.window('okno', (CX + 0.12, CY - D / 2 - 0.04, 0.3), '-y', ERA, ww=0.1, wh=0.12)
K.box('truba', (0.07, 0.07, 0.24), (CX + 0.12, CY + 0.08, EAVE + 0.2), 'M_brick' if ERA else 'M_stone', bevel=0.006)

# навес-мастерская справа
NX = 0.3
for sy in (-1, 1):
    K.log(f'nst{sy}', EAVE - 0.05, 0.016, (NX + 0.12, CY + sy * 0.2, (EAVE - 0.05) / 2), 'z', segs=6, jitter=0.03)
K.box('naves', (0.36, 0.5, 0.02), (NX, CY, EAVE - 0.03), 'M_paint_green' if ERA == 2 else 'M_plank', rot=(0, 0.3, 0), bevel=0.003)
# козлы с бревном и пилой
for s in (-1, 1):
    for t in (-1, 1):
        K.box(f'kozly{s}{t}', (0.015, 0.015, 0.2), (NX + s * 0.05, CY - 0.28 + t * 0.12, 0.09), 'M_plank', rot=(0, s * 0.35, 0), bevel=0)
K.log('brevno', 0.42, 0.04, (NX, CY - 0.28, 0.2), 'y', segs=8, jitter=0.1)
K.box('pila', (0.004, 0.2, 0.05), (NX + 0.02, CY - 0.28, 0.27), 'M_iron', rot=(0.3, 0, 0), bevel=0)
# верстак с топором
K.box('verstak', (0.12, 0.3, 0.02), (NX + 0.04, CY + 0.12, 0.17), 'M_plank', bevel=0.003)
for sy in (-1, 1):
    K.box(f'verstak_n{sy}', (0.1, 0.02, 0.16), (NX + 0.04, CY + 0.12 + sy * 0.12, 0.08), 'M_plank', bevel=0.002)
K.box('topor_r', (0.012, 0.012, 0.14), (NX + 0.03, CY + 0.08, 0.2), 'M_plank', rot=(0, 1.2, 0), bevel=0)
K.box('topor', (0.03, 0.008, 0.05), (NX + 0.09, CY + 0.08, 0.2), 'M_iron', rot=(0, 1.2, 0), bevel=0)
# штабель тёса и щепа
for i in range(4):
    b = K.box(f'tes{i}', (0.36, 0.08, 0.015), (-0.18 + random.uniform(-0.01, 0.01), -0.38, 0.01 + i * 0.017), 'M_plank', bevel=0)
    b['vary'] = 1
for i in range(10):
    K.box(f'shepa{i}', (0.03, 0.012, 0.004), (NX + random.uniform(-0.15, 0.1), CY - 0.3 + random.uniform(-0.1, 0.1), 0.003),
          'M_plank', rot=(0, 0, random.uniform(0, 3)), bevel=0)

tris, dims = K.finish('izba_plotnika', out, ao_distance=0.18)
print('PLOTNIK_OK era=%d tris=%d size=%s out=%s' % (ERA, tris, dims, out))
