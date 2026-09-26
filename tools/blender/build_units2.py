# ЮНИТЫ II–III эпох и фракций (GDD §3.10): стрелец, воевода, Жрец Дрона, Криомаг (пешие);
# опричник на коне, Кромешник, конный лучник (конница: goyda_kit.horse + rider, части 5–8);
# пушка (лафет с колёсами + пушкарь). Части тела во втором UV — анимирует UnitRenderer.
# F:\blender.exe -b --factory-startup --python tools\blender\build_units2.py -- <папка models> [имя]
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import goyda_kit as K

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUTDIR = args[0] if args else os.path.abspath('.')
ONLY = args[1] if len(args) > 1 else None


def strelec():
    K.humanoid('s', cloth='M_paint_red', trousers='M_paint_blue', boots='M_wheat', belt='M_wheat', hem=0.115)
    K.lathe('s_shapka', [(0.066, 0), (0.07, 0.03), (0.055, 0.08), (0.0, 0.1)], (0, 0.005, 0.68), 'M_paint_red', segs=10)
    K.log('s_opushka', 0.03, 0.07, (0, 0.005, 0.685), 'z', material='M_fur', segs=10, jitter=0)
    K.box('s_berdysh_r', (0.012, 0.012, 0.5), (0.05, 0.1, 0.4), 'M_plank', rot=(0.2, 0, 0.1), bevel=0)   # бердыш за спиной
    K.box('s_berdysh_l', (0.01, 0.1, 0.16), (0.06, 0.12, 0.6), 'M_iron', rot=(0.2, 0, 0.1), bevel=0)
    def pishchal():
        K.box('pishchal_lozha', (0.02, 0.03, 0.2), (0, 0.0, 0.02), 'M_plank', bevel=0.004)
        K.log('pishchal_stvol', 0.3, 0.01, (0, 0, 0.22), 'z', material='M_iron', segs=6, jitter=0)
    objs = K.in_right_hand('pishchal', pishchal)
    K.place(objs, (0, 0, 0), 0.0)


def voevoda():
    K.humanoid('v', cloth='M_paint_red', trousers='M_paint_blue', boots='M_paint_red', belt='M_gold', bulk=1.2, hem=0.125)
    for s in (-1, 1):   # золотые петлицы
        for k in range(3):
            K.box(f'v_petl{s}{k}', (0.03, 0.01, 0.012), (s * 0.03, -0.1, 0.36 + k * 0.05), 'M_gold', bevel=0)
    K.lathe('v_shapka', [(0.07, 0), (0.075, 0.04), (0.06, 0.09), (0.0, 0.11)], (0, 0.005, 0.675), 'M_paint_red', segs=10)
    K.log('v_opushka', 0.035, 0.074, (0, 0.005, 0.68), 'z', material='M_fur', segs=10, jitter=0)
    K.box('v_pero', (0.01, 0.02, 0.12), (0.03, 0.02, 0.78), 'M_paint_white', rot=(0, 0.3, 0), bevel=0)
    K.box('v_boroda', (0.075, 0.035, 0.07), (0, -0.05, 0.6), 'M_fur', bevel=0.02)
    for s in (-1, 1):
        K.box(f'v_plasch{s}', (0.11, 0.012, 0.34), (s * 0.05, 0.1, 0.36), 'M_paint_blue', rot=(-0.12, 0, s * 0.12), bevel=0.003)
    def bulava():
        K.log('bulava_r', 0.2, 0.01, (0, 0, 0.0), 'z', material='M_gold', segs=6, jitter=0)
        K.lathe('bulava', [(0.0, 0), (0.035, 0.02), (0.04, 0.05), (0.02, 0.08), (0.0, 0.09)], (0, 0, 0.1), 'M_gold', segs=8)
    K.in_right_hand('bulava', bulava)


def zhrec():
    K.humanoid('z', cloth='M_paint_white', trousers='M_paint_white', boots='M_leather', belt='M_gold', hem=0.13)
    K.lathe('z_klobuk', [(0.064, 0), (0.06, 0.06), (0.05, 0.16), (0.0, 0.18)], (0, 0.005, 0.675), 'M_paint_white', segs=10)
    K.log('z_amulet', 0.012, 0.03, (0, -0.1, 0.44), 'y', material='M_gold', segs=10, jitter=0)
    K.log('z_amulet_g', 0.014, 0.014, (0, -0.105, 0.44), 'y', material='M_glow', segs=8, jitter=0)
    K.box('z_boroda', (0.07, 0.035, 0.1), (0, -0.05, 0.59), 'M_paint_white', bevel=0.02)
    def posoh():
        K.log('posoh', 0.7, 0.01, (0, 0, 0.15), 'z', material='M_plank', segs=6, jitter=0)
        K.log('posoh_k', 0.02, 0.04, (0, 0, 0.5), 'z', material='M_gold', segs=10, jitter=0)
        K.lathe('posoh_shar', [(0.0, 0), (0.035, 0.02), (0.04, 0.05), (0.0, 0.08)], (0, 0, 0.5), 'M_glow', segs=10)
    K.in_right_hand('posoh', posoh)


def kriomag():
    K.humanoid('k', cloth='M_paint_blue', trousers='M_paint_white', boots='M_paint_white', belt='M_glow', hem=0.13)
    K.lathe('k_kapyushon', [(0.07, 0), (0.072, 0.05), (0.05, 0.11), (0.0, 0.14)], (0, 0.012, 0.66), 'M_paint_blue', segs=10)
    for i in range(5):
        a = (i - 2) * 0.35
        K.crystal(f'k_korona{i}', (math.sin(a) * 0.05, 0.02 + math.cos(a) * -0.02, 0.75), 0.08, 0.012, material='M_glow', tilt=(-0.2, a * 0.6))
    def posoh():
        K.log('posoh', 0.62, 0.01, (0, 0, 0.12), 'z', material='M_paint_white', segs=6, jitter=0)
        K.crystal('posoh_kr', (0, 0, 0.42), 0.14, 0.03, material='M_glow')
    K.in_right_hand('posoh', posoh)


def oprichnik_kon():
    z = K.horse('h', coat='M_dark', mane='M_dark', saddle='M_paint_red')
    top = K.rider('r', z, cloth='M_dark')
    K.lathe('r_shapka', [(0.066, 0), (0.066, 0.05), (0.05, 0.08), (0.0, 0.085)], (0, 0.02, top - 0.04), 'M_fur', segs=10)
    K.box('pes', (0.05, 0.07, 0.05), (0, -0.44, 0.84), 'M_dark', bevel=0.015)   # пёсья голова у морды коня
    K.lathe('metla', [(0.012, 0), (0.035, 0.05), (0.03, 0.1), (0.0, 0.11)], (0, 0, 0), 'M_thatch', segs=8)
    m = K.bpy.data.objects['metla']; m.location = (0, 0.3, 0.62); m.rotation_euler = (-1.9, 0, 0)
    def sabre():
        K.box('sablya_r', (0.014, 0.014, 0.05), (0, 0, 0), 'M_gold', bevel=0.003)
        K.box('sablya', (0.008, 0.02, 0.26), (0, -0.01, 0.15), 'M_iron', rot=(0.12, 0, 0), bevel=0)
    K.in_rider_hand(sabre)


def kromeshnik():
    z = K.horse('h', coat='M_dark', mane='M_dark', saddle='M_gold', caparison='M_paint_red')
    top = K.rider('r', z, cloth='M_iron')
    K.lathe('r_shlem', [(0.064, 0), (0.064, 0.06), (0.03, 0.12), (0.0, 0.16)], (0, 0.02, top - 0.06), 'M_dark', segs=10)
    K.box('r_lichina', (0.07, 0.01, 0.06), (0, -0.04, top - 0.07), 'M_gold', bevel=0.005)   # золотая личина
    for s in (-1, 1):
        K.box(f'r_plasch{s}', (0.09, 0.012, 0.3), (s * 0.04, 0.12, z + 0.12), 'M_dark', rot=(-0.3, 0, s * 0.15), bevel=0.003)
    def kopyo():
        K.log('kopyo', 0.9, 0.009, (0, -0.2, 0.2), 'z', material='M_dark', segs=6, jitter=0)
        K.lathe('kopyo_n', [(0.014, 0), (0.02, 0.02), (0.0, 0.1)], (0, -0.2, 0.64), 'M_gold', segs=6)
        K.box('kopyo_prapor', (0.004, 0.08, 0.05), (0, -0.16, 0.58), 'M_paint_red', bevel=0)
    objs = K.in_rider_hand(kopyo)


def konny_luchnik():
    z = K.horse('h', coat='M_leather', mane='M_dark', saddle='M_paint_blue')
    top = K.rider('r', z, cloth='M_fur', boots='M_leather')
    K.lathe('r_shapka', [(0.066, 0), (0.07, 0.03), (0.04, 0.09), (0.0, 0.13)], (0, 0.02, top - 0.05), 'M_paint_red', segs=10)
    K.log('r_opushka', 0.03, 0.07, (0, 0.02, top - 0.045), 'z', material='M_fur', segs=10, jitter=0)
    K.log('kolchan', 0.2, 0.025, (-0.1, 0.08, z + 0.1), 'z', material='M_leather', segs=8, jitter=0)
    for i in range(3):
        K.log(f'strela{i}', 0.1, 0.004, (-0.1 + (i - 1) * 0.012, 0.08, z + 0.24), 'z', material='M_paint_white', segs=4, jitter=0)
    def luk():
        K.lathe('luk', [(0.2, 0), (0.21, 0.01), (0.2, 0.02)], (0, 0, 0), 'M_plank', segs=10)
        b = K.bpy.data.objects['luk']; b.rotation_euler = (0, math.pi / 2, 0); b.scale = (0.5, 1, 1)
        K.log('tetiva', 0.36, 0.003, (0.02, 0, 0.0), 'z', material='M_paint_white', segs=4, jitter=0)
    objs = K.in_rider_hand(luk)
    K.place(objs, (0, -0.08, 0.1), 0.0)


def pushka():
    # лафет с двумя колёсами и бронзовым стволом, пушкарь позади с банником
    K.box('lafet', (0.12, 0.5, 0.06), (0, 0.05, 0.16), 'M_plank', rot=(-0.12, 0, 0), bevel=0.01)
    for s in (-1, 1):
        K.wheel(f'koleso{s}', (s * 0.12, -0.08, 0.13), r=0.13, axis='x', spokes=8)
    K.lathe('stvol', [(0.06, 0), (0.07, 0.04), (0.055, 0.1), (0.045, 0.34), (0.055, 0.36), (0.04, 0.37)], (0, 0, 0), 'M_gold', segs=12)
    st = K.bpy.data.objects['stvol']; st.rotation_euler = (math.pi / 2 + 0.12, 0, 0); st.location = (0, 0.02, 0.25)
    for i in range(4):   # ядра
        K.lathe(f'yadro{i}', [(0.0, 0), (0.03, 0.01), (0.035, 0.035), (0.0, 0.07)], (0.16 + (i % 2) * 0.07, 0.3 + (i // 2) * 0.07, 0), 'M_iron', segs=8)
    K.humanoid('g', cloth='M_paint_red', trousers='M_dark', boots='M_leather', belt='M_wheat')
    for o in [o for o in K.bpy.context.scene.objects if o.name.startswith('g')]:
        o.location.y += 0.42
    def bannik():
        K.log('bannik', 0.5, 0.008, (0, 0, 0.1), 'z', material='M_plank', segs=5, jitter=0)
        K.log('bannik_g', 0.06, 0.02, (0, 0, 0.36), 'z', material='M_fur', segs=8, jitter=0)
    objs = K.in_right_hand('bannik', bannik)
    K.place(objs, (0, 0.42, 0), 0.0)


UNITS = {'unit_strelec': strelec, 'unit_voevoda': voevoda, 'unit_zhrec': zhrec, 'unit_kriomag': kriomag,
         'unit_oprichnik_kon': oprichnik_kon, 'unit_kromeshnik': kromeshnik, 'unit_konny_luchnik': konny_luchnik,
         'unit_pushka': pushka}
for name, fn in UNITS.items():
    if ONLY and name != ONLY:
        continue
    random.seed(sum(map(ord, name)))
    K.reset_scene()
    fn()
    tris, dims = K.finish_unit(name, os.path.join(OUTDIR, name + '.glb'))
    print('UNIT_OK %s tris=%d size=%s' % (name, tris, dims))
