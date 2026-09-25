# ЮНИТЫ по GDD_2026.md §2.6: фигуры с частями тела (TEXCOORD_1 = номер части) для шейдерной анимации
# в UnitRenderer (шаг, отмашка рук, работа, удар). Лубочные пропорции: крупная голова, яркая одежда.
# F:\blender.exe -b --factory-startup --python tools\blender\build_units.py -- <папка models> [имя]
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import goyda_kit as K

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUTDIR = args[0] if args else os.path.abspath('.')
ONLY = args[1] if len(args) > 1 else None


def kolpak(p, mat_, z):
    K.lathe(p, [(0.066, 0), (0.06, 0.04), (0.035, 0.1), (0.0, 0.13)], (0, 0.01, z), mat_, segs=10)


def kholop():
    K.humanoid('h', cloth='M_paint_red', trousers='M_paint_white', boots='M_thatch', belt='M_paint_blue')
    K.box('h_boroda', (0.07, 0.03, 0.05), (0, -0.05, 0.605), 'M_fur', bevel=0.015)
    kolpak('h_kolpak', 'M_paint_blue', 0.685)
    K.box('h_zaplata', (0.04, 0.005, 0.04), (0.04, -0.1, 0.24), 'M_paint_white', bevel=0)
    def axe():
        K.log('topor_r', 0.26, 0.009, (0, 0, 0.0), 'z', material='M_plank', segs=6, jitter=0)
        K.box('topor_l', (0.012, 0.07, 0.05), (0, -0.03, 0.11), 'M_iron', bevel=0.004)
    K.in_right_hand('topor', axe)


def ratnik():
    K.humanoid('r', cloth='M_iron', trousers='M_paint_red', boots='M_leather', belt='M_leather', sleeve='M_iron')
    K.lathe('r_podol', [(0.112, 0.14), (0.1, 0.24), (0.0, 0.245)], (0, 0, 0), 'M_paint_red', segs=12)   # красный подол из-под кольчуги
    K.lathe('r_shishak', [(0.066, 0), (0.064, 0.04), (0.035, 0.09), (0.008, 0.14), (0.0, 0.16)], (0, 0.005, 0.675), 'M_iron', segs=10)
    K.box('r_nosnik', (0.012, 0.01, 0.05), (0, -0.064, 0.66), 'M_iron', bevel=0)
    def spear():
        K.log('kopyo', 0.72, 0.008, (0, 0, 0.18), 'z', material='M_plank', segs=6, jitter=0)
        K.lathe('kopyo_n', [(0.014, 0), (0.02, 0.02), (0.0, 0.09)], (0, 0, 0.54), 'M_iron', segs=6)
        K.box('kopyo_prapor', (0.004, 0.06, 0.04), (0, 0.03, 0.5), 'M_paint_red', bevel=0)
    K.in_right_hand('kopyo', spear)
    def shield():
        K.log('shit', 0.015, 0.09, (0, 0, 0), 'y', material='M_paint_red', segs=14, jitter=0)
        K.log('shit_um', 0.02, 0.025, (0, -0.005, 0), 'y', material='M_gold', segs=10, jitter=0)
        K.log('shit_obod', 0.016, 0.092, (0, 0.001, 0), 'y', material='M_iron', segs=14, jitter=0)
    objs = K.in_left_hand('shit', shield)
    K.place(objs, (-0.02, -0.02, 0.05), 0.0)


def oprichnik():
    K.humanoid('o', cloth='M_dark', trousers='M_dark', boots='M_leather', belt='M_gold', hem=0.12)
    K.lathe('o_shapka', [(0.07, 0), (0.07, 0.05), (0.055, 0.08), (0.0, 0.085)], (0, 0.005, 0.67), 'M_fur', segs=10)
    K.box('o_zapona', (0.03, 0.01, 0.03), (0, -0.075, 0.48), 'M_gold', bevel=0.005)
    # сатира: метла и собачья голова — опричные знаки — за спиной
    K.log('o_metla_r', 0.36, 0.007, (0.04, 0.09, 0.45), 'z', material='M_plank', segs=5, jitter=0)
    K.lathe('o_metla', [(0.01, 0), (0.035, 0.05), (0.03, 0.1), (0.0, 0.11)], (0.04, 0.09, 0.6), 'M_thatch', segs=8)
    K.box('o_pes', (0.04, 0.05, 0.035), (-0.04, 0.09, 0.62), 'M_dark', bevel=0.012)
    def sabre():
        K.box('sablya_r', (0.014, 0.014, 0.05), (0, 0, 0), 'M_gold', bevel=0.003)
        K.box('sablya', (0.008, 0.02, 0.26), (0, -0.01, 0.15), 'M_iron', rot=(0.12, 0, 0), bevel=0)
    K.in_right_hand('sablya', sabre)


def bogatyr():
    K.humanoid('b', cloth='M_iron', trousers='M_paint_blue', boots='M_paint_red', belt='M_gold', bulk=1.25, hem=0.115, sleeve='M_iron')
    K.lathe('b_podol', [(0.14, 0.14), (0.125, 0.26), (0.0, 0.265)], (0, 0, 0), 'M_paint_blue', segs=12)
    K.lathe('b_shlem', [(0.068, 0), (0.066, 0.045), (0.035, 0.1), (0.005, 0.16), (0.0, 0.2)], (0, 0.005, 0.675), 'M_gold', segs=12)
    K.box('b_boroda', (0.08, 0.035, 0.08), (0, -0.05, 0.6), 'M_fur', bevel=0.02)
    for s in (-1, 1):   # красный плащ за спиной
        K.box(f'b_plasch{s}', (0.12, 0.012, 0.36), (s * 0.05, 0.11, 0.37), 'M_paint_red', rot=(-0.12, 0, s * 0.12), bevel=0.003)
    def sword():
        K.box('mech_r', (0.016, 0.016, 0.06), (0, 0, 0), 'M_leather', bevel=0.003)
        K.box('mech_g', (0.1, 0.018, 0.016), (0, 0, 0.035), 'M_gold', bevel=0.003)
        K.box('mech', (0.014, 0.03, 0.34), (0, 0, 0.21), 'M_iron', bevel=0)
    K.in_right_hand('mech', sword)
    def shield():
        K.box('shit', (0.16, 0.02, 0.22), (0, 0, 0), 'M_paint_red', bevel=0.02)
        K.box('shit_z', (0.05, 0.022, 0.05), (0, -0.002, 0.01), 'M_gold', rot=(0, math.pi / 4, 0), bevel=0.006)
    objs = K.in_left_hand('shit', shield)
    K.place(objs, (-0.03, -0.03, 0.05), 0.0)


def raider(p='e', boss=False):
    bulk = 1.35 if boss else 1.0
    K.humanoid(p, cloth='M_fur', trousers='M_dark', boots='M_fur', belt='M_leather', bulk=bulk, hem=0.115, sleeve='M_skin')
    K.box(f'{p}_kushak', (0.2 * bulk, 0.2 * bulk, 0.03), (0, 0, 0.36), 'M_gem', bevel=0.01)   # лиловый пояс — цвет Орды
    K.lathe(f'{p}_shlem', [(0.066, 0), (0.064, 0.045), (0.04, 0.08), (0.0, 0.09)], (0, 0.005, 0.675), 'M_iron', segs=10)
    for s in (-1, 1):   # рога
        K.lathe(f'{p}_rog{s}', [(0.016, 0), (0.01, 0.05), (0.0, 0.09)], (0, 0, 0), 'M_paint_white', segs=6)
        r = K.bpy.data.objects[f'{p}_rog{s}']
        r.location = (s * 0.06, 0, 0.72)
        r.rotation_euler = (0, s * 0.9, 0)
    K.box(f'{p}_boroda', (0.075, 0.035, 0.06), (0, -0.05, 0.6), 'M_fur', bevel=0.02)
    if boss:
        for i in range(5):   # корона самозванца
            a = i / 5 * math.tau
            K.lathe(f'{p}_korona{i}', [(0.012, 0), (0.0, 0.05)], (math.cos(a) * 0.05, math.sin(a) * 0.05, 0.77), 'M_gold', segs=5)
        K.log(f'{p}_korona_o', 0.02, 0.065, (0, 0, 0.765), 'z', material='M_gold', segs=10, jitter=0)
    def club():
        K.log('dubina_r', 0.2, 0.012, (0, 0, 0.0), 'z', material='M_log', segs=6, jitter=0)
        K.lathe('dubina', [(0.018, 0), (0.035, 0.05), (0.04, 0.12), (0.0, 0.14)], (0, 0, 0.1), 'M_log', segs=8)
        for i in range(4):
            K.lathe(f'dubina_sh{i}', [(0.006, 0), (0.0, 0.025)], (math.cos(i * 1.6) * 0.035, math.sin(i * 1.6) * 0.035, 0.17), 'M_iron', segs=4)
    K.in_right_hand('dubina', club)


UNITS = {
    'unit_kholop': kholop, 'unit_ratnik': ratnik, 'unit_oprichnik': oprichnik, 'unit_bogatyr': bogatyr,
    'enemy_raider': lambda: raider('e'), 'enemy_boss': lambda: raider('bs', boss=True),
}
for name, fn in UNITS.items():
    if ONLY and name != ONLY:
        continue
    random.seed(hash(name) & 0xffff)
    K.reset_scene()
    fn()
    tris, dims = K.finish_unit(name, os.path.join(OUTDIR, name + '.glb'))
    print('UNIT_OK %s tris=%d size=%s' % (name, tris, dims))
