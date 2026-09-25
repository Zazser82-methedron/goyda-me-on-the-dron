# РЕМОНТНЫЙ ДВОР (1×1, III эпоха): кирпичная мастерская с широкими воротами, поворотный кран-укосина
# с крюком, колесо на стойке в починке, штабель досок, бочка дёгтя, верстак.
# F:\blender.exe -b --factory-startup --python tools\blender\build_remdvor.py -- <out.glb> <эпоха 2>
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import goyda_kit as K

out, ERA = K.cli()
random.seed(211)
K.reset_scene()

W, D, CY = 0.62, 0.46, 0.2
K.box('steny', (W, D, 0.5), (-0.08, CY, 0.25), 'M_brick', bevel=0.01)
K.box('poyas', (W + 0.04, D + 0.04, 0.03), (-0.08, CY, 0.5), 'M_plaster', bevel=0.004)
K.gable_roof('r', (-0.08, CY, 0), W - 0.08, D - 0.08, 0.5, ERA, ridge_axis='x', rov=0.08, R=0.04, gable_mat='M_brick')
FY = CY - D / 2
K.box('vorota', (0.3, 0.02, 0.34), (-0.12, FY - 0.005, 0.17), 'M_dark', bevel=0.004)
for z in (0.08, 0.26):
    K.box(f'polosa{z}', (0.3, 0.025, 0.02), (-0.12, FY - 0.01, z), 'M_iron', bevel=0)
K.box('vorota_n', (0.36, 0.03, 0.04), (-0.12, FY, 0.36), 'M_plaster', bevel=0.004)
K.window('okno', (0.12, FY - 0.004, 0.3), '-y', ERA, ww=0.1, wh=0.14, shutters=False)
# кран-укосина с крюком
KX, KY = 0.36, -0.2
K.log('kran_st', 0.9, 0.03, (KX, KY, 0.45), 'z', material='M_iron', segs=8, jitter=0)
K.box('kran_str', (0.46, 0.03, 0.03), (KX - 0.2, KY, 0.86), 'M_iron', rot=(0, -0.12, 0), bevel=0)
K.box('kran_ras', (0.3, 0.02, 0.02), (KX - 0.1, KY, 0.74), 'M_iron', rot=(0, 0.6, 0), bevel=0)
K.log('kran_tros', 0.32, 0.004, (KX - 0.4, KY, 0.66), 'z', material='M_cloth', segs=4, jitter=0)
K.box('kryuk', (0.03, 0.02, 0.05), (KX - 0.4, KY, 0.49), 'M_iron', bevel=0.005)
# колесо на стойке, доски, бочка дёгтя
K.wheel('koleso', (0.3, 0.3, 0.2), r=0.13, axis='x', spokes=8)
K.box('koleso_st', (0.04, 0.2, 0.08), (0.3, 0.3, 0.04), 'M_plank', bevel=0.004)
for i in range(4):
    b = K.box(f'doski{i}', (0.03, 0.4, 0.015), (-0.42 + i * 0.035, -0.3, 0.008 + i * 0.016), 'M_plank', bevel=0)
    b['vary'] = 1
K.barrel('degot', (0.05, -0.36, 0), r=0.05, h=0.12)
K.lathe('degot_v', [(0.045, 0), (0.0, 0.005)], (0.05, -0.36, 0.12), 'M_dark', segs=10)

tris, dims = K.finish('remdvor', out, ao_distance=0.18)
print('REMDVOR_OK era=%d tris=%d size=%s out=%s' % (ERA, tris, dims, out))
