# Общий набор для моделей ГОЙДА-ИМПЕРИИ по стандарту GDD_2026.md §2.5.
# Запуск без окна Blender:  F:\blender.exe -b --factory-startup --python build_<модель>.py
#
# Правила, которые держит этот модуль:
#  - координаты Blender: Z вверх, фасад (вход) смотрит в -Y  → в игре это +Z;
#  - материалы с префиксом M_ игра подменяет общей библиотекой с фактурами
#    (empire/js/engine/MaterialLib.js), поэтому фактуры в GLB НЕ встраиваются;
#  - UV считаются в мировых единицах (фактура повторяется каждые 1/TEX_DENSITY единицы),
#    чтобы брёвна и солома имели одинаковый масштаб на всех постройках;
#  - затенение в углах (AO) запекается в цвет вершин и экспортируется как COLOR_0.
import bpy, bmesh, math, random
from mathutils import Vector, Matrix

TEX_DENSITY = 2.0   # повторов фактуры на 1 игровую единицу (1 клетка)

# имя → (базовый цвет, шероховатость). Цвет — запасной, если библиотека в игре не подменит.
# ВНИМАНИЕ: цвета ЛИНЕЙНЫЕ (как хранит glTF), не sRGB — sRGB-значения дают бледные «пастельные» краски.
MATS = {
    'M_log':         ((0.42, 0.28, 0.16), 0.85),
    'M_plank':       ((0.46, 0.33, 0.21), 0.85),
    'M_thatch':      ((0.62, 0.50, 0.28), 0.95),
    'M_stone':       ((0.50, 0.48, 0.44), 0.9),
    'M_plaster':     ((0.88, 0.86, 0.80), 0.9),
    'M_paint_white': ((0.74, 0.72, 0.66), 0.7),
    'M_paint_blue':  ((0.02, 0.08, 0.32), 0.6),
    'M_paint_red':   ((0.38, 0.03, 0.02), 0.6),
    'M_paint_green': ((0.012, 0.075, 0.03), 0.45),
    'M_siding':      ((0.80, 0.62, 0.30), 0.8),   # обшивка тёсом, крашенная охрой (III эпоха)
    'M_brick':       ((0.19, 0.035, 0.018), 0.9),
    'M_dark':        ((0.16, 0.11, 0.07), 0.8),
    'M_iron':        ((0.20, 0.20, 0.22), 0.5),
    'M_window':      ((0.05, 0.07, 0.10), 0.15),
    'M_crop':        ((0.10, 0.22, 0.03), 0.8),    # всходы на грядах
    'M_wheat':       ((0.55, 0.38, 0.08), 0.8),    # спелая рожь
    'M_soil':        ((0.07, 0.04, 0.02), 1.0),    # пашня
    'M_cloth':       ((0.45, 0.36, 0.22), 0.95),   # мешковина
    'M_fire':        ((0.9, 0.3, 0.05), 0.5),      # угли горна (светятся)
    'M_glow':        ((0.05, 0.6, 0.7), 0.3),      # бирюзовый свет Дрона (алтари, глаза идолов)
    'M_gem':         ((0.45, 0.08, 0.7), 0.15),    # самоцветы (лиловое свечение)
}


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def mat(name):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    col, rough = MATS[name]
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*col, 1.0)
    bsdf.inputs['Roughness'].default_value = rough
    if name in ('M_gold', 'M_iron'):
        bsdf.inputs['Metallic'].default_value = 1.0
    if name == 'M_fire':
        bsdf.inputs['Emission Color'].default_value = (1.0, 0.35, 0.05, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 3.0
    if name == 'M_glow':
        bsdf.inputs['Emission Color'].default_value = (0.1, 0.9, 1.0, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 2.5
    if name == 'M_gem':
        bsdf.inputs['Emission Color'].default_value = (0.7, 0.2, 1.0, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 1.6
    if name == 'M_window':   # тёплое свечение окон — игра приглушает днём
        bsdf.inputs['Emission Color'].default_value = (1.0, 0.62, 0.25, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 0.08   # днём тёмное стекло; ночное свечение — задача игры
    return m


def _new_obj(name, bm, material):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    me.materials.append(mat(material))
    return ob


def box(name, size, loc, material, rot=(0, 0, 0), bevel=0.006):
    """Коробка size=(sx,sy,sz) с центром loc, с фаской на рёбрах."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    if bevel > 0:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=1, affect='EDGES')
    ob = _new_obj(name, bm, material)
    ob.location = loc
    ob.rotation_euler = rot
    return ob


def prism(name, pts2d, depth, axis, loc, material):
    """Выдавленный многоугольник (фронтон и т.п.). pts2d в плоскости (a, z), выдавливание по axis ('x'|'y')."""
    bm = bmesh.new()
    vs = []
    for a, z in pts2d:
        vs.append(bm.verts.new((a, 0, z) if axis == 'y' else (0, a, z)))
    f = bm.faces.new(vs)
    d = Vector((0, depth, 0)) if axis == 'y' else Vector((depth, 0, 0))
    r = bmesh.ops.extrude_face_region(bm, geom=[f])
    moved = [e for e in r['geom'] if isinstance(e, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, vec=d, verts=moved)
    bmesh.ops.translate(bm, vec=-d * 0.5, verts=bm.verts)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = _new_obj(name, bm, material)
    ob.location = loc
    return ob


def log(name, length, radius, loc, axis, material='M_log', segs=10, jitter=0.12):
    """Бревно вдоль оси axis ('x'|'y'|'z'). Лёгкая неровность — чтобы стена не выглядела пластиковой."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs,
                          radius1=radius, radius2=radius * (1 - random.uniform(0, 0.08)), depth=length)
    for v in bm.verts:   # неровность бревна: каждая вершина чуть дальше/ближе к оси
        k = 1 + random.uniform(-jitter, jitter) * 0.25
        v.co.x *= k; v.co.y *= k
    # поворот вокруг собственной оси — чтобы грани соседних брёвен не совпадали
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(random.uniform(0, math.tau), 3, 'Z'))
    ob = _new_obj(name, bm, material)
    ob.location = loc
    if axis == 'x':
        ob.rotation_euler = (0, math.pi / 2, 0)
    elif axis == 'y':
        ob.rotation_euler = (math.pi / 2, 0, 0)
    ob['uv_log'] = 'z'   # UV считаются в локальных координатах, где ось бревна — Z
    return ob


def apply_all():
    for ob in bpy.context.scene.objects:
        if ob.type != 'MESH':
            continue
        ob.select_set(True)
    bpy.context.view_layer.objects.active = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def world_uv():
    """UV в игровых единицах, в ЛОКАЛЬНЫХ координатах детали (вызывать ДО apply_all):
    так солома ложится вдоль ската, а брёвна — вдоль оси. Случайный сдвиг — чтобы фактура не повторялась."""
    for ob in bpy.context.scene.objects:
        if ob.type != 'MESH':
            continue
        me = ob.data
        bm = bmesh.new(); bm.from_mesh(me)
        uv = bm.loops.layers.uv.verify()
        axis = ob.get('uv_log')
        du, dv = random.random(), random.random()
        if axis:
            ai = {'x': 0, 'y': 1, 'z': 2}[axis]
            c = sum((v.co for v in bm.verts), Vector()) / len(bm.verts)
            others = [i for i in range(3) if i != ai]
            for f in bm.faces:
                n = f.normal
                cap = abs(n[ai]) > 0.7
                angs = []
                for l in f.loops:
                    p = l.vert.co - c
                    angs.append(math.atan2(p[others[1]], p[others[0]]))
                # шов: не даём грани перескочить через ±pi
                if max(angs) - min(angs) > math.pi:
                    angs = [a + math.tau if a < 0 else a for a in angs]
                for l, a in zip(f.loops, angs):
                    p = l.vert.co
                    if cap:   # торец — годичные кольца: берём плоскую проекцию
                        l[uv].uv = (p[others[0]] * TEX_DENSITY * 2 + du, p[others[1]] * TEX_DENSITY * 2 + dv)
                    else:
                        rad = (Vector((p[others[0]] - c[others[0]], p[others[1]] - c[others[1]]))).length
                        l[uv].uv = (p[ai] * TEX_DENSITY + du, a * rad * TEX_DENSITY + dv)
        else:
            for f in bm.faces:
                n = f.normal
                ax = max(range(3), key=lambda i: abs(n[i]))
                for l in f.loops:
                    p = l.vert.co
                    if ax == 0:   l[uv].uv = (p.y * TEX_DENSITY + du, p.z * TEX_DENSITY + dv)
                    elif ax == 1: l[uv].uv = (p.x * TEX_DENSITY + du, p.z * TEX_DENSITY + dv)
                    else:         l[uv].uv = (p.x * TEX_DENSITY + du, p.y * TEX_DENSITY + dv)
        bm.to_mesh(me); bm.free()


def join_all(name):
    obs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    for o in bpy.context.scene.objects:
        o.select_set(o in obs)
    bpy.context.view_layer.objects.active = obs[0]
    bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = name; ob.data.name = name
    for k in list(ob.keys()):
        del ob[k]
    return ob


def tint_variation(lo=0.8, hi=1.0):
    """Разный тон у каждой детали (брёвна/доски темнее-светлее) — убирает «одинаковый пластик».
    Вызывать ДО join_all: пишет атрибут TINT во ВСЕ меши (иначе join заполнит пропуски чёрным)."""
    for ob in bpy.context.scene.objects:
        if ob.type != 'MESH':
            continue
        v = random.uniform(lo, hi) if (ob.get('uv_log') or ob.get('vary')) else 1.0
        ca = ob.data.color_attributes.new('TINT', 'BYTE_COLOR', 'CORNER')
        for d in ca.data:
            d.color = (v, v * 0.98, v * 0.95, 1.0)


def bake_ao(ob, samples=48, distance=0.2, strength=0.6):
    """Затенение в углах → цвет вершин (COLOR_0). Земля-плоскость временно добавляется для контакта с грунтом.
    strength < 1 ослабляет AO: иначе фронтон под свесом крыши и стены у земли уходят почти в чёрный."""
    bpy.ops.mesh.primitive_plane_add(size=20, location=(0, 0, -0.001))
    ground = bpy.context.active_object
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = samples
    sc.cycles.device = 'CPU'
    sc.world = sc.world or bpy.data.worlds.new('W')
    sc.world.light_settings.distance = distance
    ca = ob.data.color_attributes.new('AO', 'BYTE_COLOR', 'CORNER')
    ob.data.color_attributes.active_color = ca
    for o in sc.objects:
        o.select_set(o == ob)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.bake(type='AO', target='VERTEX_COLORS')
    bpy.data.objects.remove(ground)
    tint = ob.data.color_attributes.get('TINT')
    for i, d in enumerate(ca.data):
        v = 1 - strength * (1 - d.color[0])
        t = tint.data[i].color if tint else (1, 1, 1, 1)
        d.color = (v * t[0], v * t[1], v * t[2], 1.0)
    if tint:
        ob.data.color_attributes.remove(tint)
    ob.data.color_attributes.active_color = ob.data.color_attributes.get('AO')


def add_marker(name, loc):
    e = bpy.data.objects.new(name, None)
    e.location = loc
    bpy.context.scene.collection.objects.link(e)
    return e


def export_glb(path):
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', use_selection=False,
        export_apply=True, export_yup=True,
        export_image_format='NONE', export_materials='EXPORT',
        export_vertex_color='ACTIVE', export_all_vertex_colors=False,
    )


def tri_count():
    n = 0
    for ob in bpy.context.scene.objects:
        if ob.type == 'MESH':
            n += sum(len(p.vertices) - 2 for p in ob.data.polygons)
    return n


# ================= Сборочные узлы для построек (сруб, окно, крыша, шатёр) =================
# Узел строится «у себя» в начале координат, потом ставится place()-ом: сдвиг + поворот вокруг Z.
# Так одно окно или крыша годятся для любой стены и любого направления конька.
MATS.setdefault('M_gold', ((1.0, 0.62, 0.18), 0.3))
FACING = {'-y': 0.0, '+x': math.pi / 2, '+y': math.pi, '-x': -math.pi / 2}


def capture(fn, *a, **kw):
    """Выполнить fn и вернуть список объектов, которые она создала."""
    before = set(bpy.context.scene.objects)
    fn(*a, **kw)
    return [o for o in bpy.context.scene.objects if o not in before]


def place(objs, loc=(0, 0, 0), angle=0.0):
    bpy.context.view_layer.update()
    M = Matrix.Translation(Vector(loc)) @ Matrix.Rotation(angle, 4, 'Z')
    for o in objs:
        o.matrix_world = M @ o.matrix_world


def srub(prefix, cx, cy, W, D, z0, courses, R=0.042, ovh=0.075):
    """Сруб «в чашу» по осям стен W×D; возвращает высоту верха."""
    z = z0 + R
    for i in range(courses):
        for sy in (-1, 1):
            log(f'{prefix}x{i}{sy}', W + 2 * ovh, R, (cx, cy + sy * D / 2, z), 'x')
        for sx in (-1, 1):
            log(f'{prefix}y{i}{sx}', D + 2 * ovh, R, (cx + sx * W / 2, cy, z + R), 'y')
        z += 2 * R
    return z + R * 0.2


def _window_local(p, era, ww, wh, shutters):
    """Окно в плоскости стены y=0, наружу -Y."""
    sh = 'M_paint_blue' if era < 2 else 'M_paint_green'
    trim = 'M_paint_white' if era < 2 else 'M_brick'
    box(p + 'gl', (ww, 0.01, wh), (0, 0, 0), 'M_window', bevel=0)
    box(p + 'pv', (0.012, 0.008, wh), (0, -0.006, 0), 'M_paint_white', bevel=0)
    box(p + 'ph', (ww, 0.008, 0.012), (0, -0.006, 0.02), 'M_paint_white', bevel=0)
    box(p + 'top', (ww + 0.07, 0.025, 0.035), (0, -0.01, wh / 2 + 0.02), trim)
    box(p + 'kok', (ww * 0.62, 0.02, ww * 0.62), (0, -0.012, wh / 2 + 0.065), trim, rot=(0, math.pi / 4, 0))
    box(p + 'bot', (ww + 0.06, 0.03, 0.025), (0, -0.012, -wh / 2 - 0.015), trim)
    for s in (-1, 1):
        box(p + f'j{s}', (0.025, 0.022, wh + 0.02), (s * (ww / 2 + 0.013), -0.008, 0), trim)
        if shutters:
            box(p + f's{s}', (ww / 2, 0.012, wh), (s * (ww * 0.78 + 0.03), -0.01, 0), sh)


def window(p, loc, facing, era, ww=0.15, wh=0.19, shutters=True):
    place(capture(_window_local, p, era, ww, wh, shutters), loc, FACING[facing])


def _roof_local(p, W, D, eave, era, rov, R, gable_mat):
    """Двускатная крыша, конёк вдоль Y, центр в (0,0). Возвращает высоту конька."""
    half = W / 2 + rov
    ridge = eave + W / 2 + 0.02
    L = half * math.sqrt(2) + 0.03
    s2 = math.sqrt(0.5)
    span = D + 2 * rov

    def frame(side, lift):
        return (side * half / 2 + side * s2 * lift, ridge - half / 2 + s2 * lift), (0, side * math.pi / 4, 0)

    for side in (-1, 1):
        if era == 0:
            (x, z), rot = frame(side, 0.045)
            box(p + f'r{side}', (L, span, 0.09), (x, 0, z), 'M_thatch', rot=rot, bevel=0.03)
            log(p + f'st{side}', span + 0.02, 0.05, (side * (half - 0.02), 0, ridge - half + 0.02), 'y', material='M_thatch', segs=8, jitter=0.3)
        elif era == 1:
            n = max(6, int(span / 0.085))
            for layer in (0, 1):
                for j in range(n - layer):
                    y = -span / 2 + (j + 0.5 + layer * 0.5) * span / n
                    (x, z), rot = frame(side, 0.012 + layer * 0.018)
                    b = box(p + f't{side}{layer}{j}', (L + random.uniform(-0.02, 0.02), span / n * 0.96, 0.016), (x, y, z), 'M_plank', rot=rot, bevel=0)
                    b['vary'] = 1
        else:
            (x, z), rot = frame(side, 0.0125)
            box(p + f'r{side}', (L, span, 0.025), (x, 0, z), 'M_paint_green', rot=rot, bevel=0.004)
            nf = max(5, int(span / 0.13))
            for j in range(nf):
                y = -span / 2 + (j + 0.5) * span / nf
                (x2, z2), _ = frame(side, 0.033)
                box(p + f'f{side}{j}', (L, 0.012, 0.016), (x2, y, z2), 'M_paint_green', rot=rot, bevel=0.002)
    if era < 2:
        log(p + 'ohl', span + 0.06, 0.05 + 0.01 * (era == 0), (0, 0, ridge + (0.075 if era == 0 else 0.04)), 'y', segs=8, jitter=0.05)
    else:
        box(p + 'kon', (0.07, span, 0.04), (0, 0, ridge + 0.02), 'M_paint_green', rot=(0, math.pi / 4, 0), bevel=0.004)
    gw = W / 2 + R
    tri = [(-gw, eave - 0.01), (gw, eave - 0.01), (0, eave + gw - 0.02)]
    for sy in (-1, 1):
        prism(p + f'g{sy}', tri, 0.03, 'y', (0, sy * (D / 2 - 0.005), 0), gable_mat)
        for side in (-1, 1):
            box(p + f'pr{sy}{side}', (L * 0.98, 0.02, 0.06),
                (side * half / 2 + side * 0.012, sy * (D / 2 + rov - 0.01), ridge - half / 2 - 0.035), 'M_paint_white',
                rot=(0, side * math.pi / 4, 0), bevel=0.004)
    return ridge


def gable_roof(p, loc, W, D, eave, era, ridge_axis='y', rov=0.14, R=0.042, gable_mat=None):
    """Крыша над срубом W×D (по осям стен) с коньком вдоль ridge_axis. Возвращает высоту конька."""
    gm = gable_mat or ('M_siding' if era == 2 else 'M_plank')
    out = {}
    if ridge_axis == 'y':
        objs = capture(lambda: out.setdefault('r', _roof_local(p, W, D, eave, era, rov, R, gm)))
        place(objs, loc, 0.0)
    else:   # строим с коньком по Y для размеров D×W и поворачиваем на 90°
        objs = capture(lambda: out.setdefault('r', _roof_local(p, D, W, eave, era, rov, R, gm)))
        place(objs, loc, math.pi / 2)
    return out['r']


def tent(p, loc, base, h, era, top_mat=None):
    """Шатёр (четырёхгранная пирамида) со свесом; возвращает высоту вершины."""
    mat_ = top_mat or {0: 'M_plank', 1: 'M_plank', 2: 'M_paint_green'}[era]
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=4, radius1=base * math.sqrt(0.5) * 1.02, radius2=0.0, depth=h)
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 4, 3, 'Z'))
    ob = _new_obj(p + 'tent', bm, mat_)
    ob.location = (loc[0], loc[1], loc[2] + h / 2)
    return loc[2] + h


def wheel(p, loc, r=0.1, axis='x', spokes=6):
    """Тележное колесо: обод, ступица, спицы (в плоскости, перпендикулярной axis)."""
    def local():
        log(p + 'rim', 0.025, r, (0, 0, 0), 'z', material='M_plank', segs=12, jitter=0)
        log(p + 'hub', 0.05, r * 0.22, (0, 0, 0), 'z', material='M_iron', segs=8, jitter=0)
        for i in range(spokes):
            a = i * math.pi / spokes
            box(p + f'sp{i}', (r * 1.8, 0.015, 0.015), (0, 0, 0), 'M_plank', rot=(0, 0, a), bevel=0)
    objs = capture(local)
    bpy.context.view_layer.update()
    rot = Matrix.Rotation(math.pi / 2, 4, 'Y') if axis == 'x' else Matrix.Rotation(math.pi / 2, 4, 'X')
    for o in objs:
        o.matrix_world = Matrix.Translation(Vector(loc)) @ rot @ o.matrix_world
    return objs


def telega(p, loc, angle=0.0, load='sacks'):
    """Телега с грузом: мешки или сено."""
    def local():
        box(p + 'kuzov', (0.5, 0.28, 0.04), (0, 0, 0.2), 'M_plank', bevel=0.004)
        for s in (-1, 1):
            box(p + f'bort{s}', (0.5, 0.02, 0.08), (0, s * 0.13, 0.25), 'M_plank', bevel=0.003)
        box(p + 'oglobli', (0.45, 0.02, 0.02), (0.45, 0.1, 0.19), 'M_plank', bevel=0)
        box(p + 'oglobli2', (0.45, 0.02, 0.02), (0.45, -0.1, 0.19), 'M_plank', bevel=0)
        for sx in (-1, 1):
            wheel(p + f'w{sx}a', (sx * 0.17, 0.16, 0.11), r=0.11, axis='y')
            wheel(p + f'w{sx}b', (sx * 0.17, -0.16, 0.11), r=0.11, axis='y')
        if load == 'sacks':
            for i, (x, y) in enumerate(((-0.12, -0.05), (0.02, 0.06), (0.14, -0.04), (-0.03, -0.06))):
                s_ = box(p + f'mesh{i}', (0.13, 0.1, 0.09), (x, y, 0.27 + (0.05 if i == 3 else 0)), 'M_cloth', bevel=0.03)
                s_['vary'] = 1
        else:
            box(p + 'seno', (0.46, 0.26, 0.14), (0, 0, 0.3), 'M_thatch', bevel=0.05)
    place(capture(local), loc, angle)


def sacks(p, loc, n=3):
    for i in range(n):
        a = i * 2.1
        s_ = box(p + f'{i}', (0.12, 0.1, 0.1), (loc[0] + math.cos(a) * 0.06, loc[1] + math.sin(a) * 0.06, loc[2] + 0.05 + (0.08 if i == n - 1 and n > 2 else 0)),
                 'M_cloth', rot=(0, 0, a), bevel=0.03)
        s_['vary'] = 1


def barrel(p, loc, r=0.055, h=0.14):
    log(p + 'b', h, r, (loc[0], loc[1], loc[2] + h / 2), 'z', material='M_plank', segs=10, jitter=0.02)
    for hz in (0.2, 0.8):
        log(p + f'o{hz}', 0.012, r * 1.05, (loc[0], loc[1], loc[2] + h * hz), 'z', material='M_iron', segs=10, jitter=0)


def finish(name, out, ao_distance=0.25):
    """Общий финал сборки: UV → тона → трансформы → один меш → AO → GLB. Возвращает (tris, dims)."""
    world_uv()
    tint_variation()
    apply_all()
    ob = join_all(name)
    tris = tri_count()
    bake_ao(ob, distance=ao_distance)
    export_glb(out)
    return tris, tuple(round(v, 2) for v in ob.dimensions)


def cli():
    """Разбор аргументов после '--': <out.glb> [эпоха]."""
    import sys, os
    a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    return (a[0] if a else os.path.abspath('out.glb')), (int(a[1]) if len(a) > 1 else 0)


def lathe(p, profile, loc, material, segs=16):
    """Тело вращения вокруг Z по профилю [(радиус, высота), ...] снизу вверх (купола, главки, чаши)."""
    bm = bmesh.new()
    rings = []
    for r, z in profile:
        ring = []
        for i in range(segs):
            a = i / segs * math.tau
            ring.append(bm.verts.new((math.cos(a) * r, math.sin(a) * r, z)))
        rings.append(ring)
    for a_, b_ in zip(rings, rings[1:]):
        for i in range(segs):
            j = (i + 1) % segs
            bm.faces.new((a_[i], a_[j], b_[j], b_[i]))
    if profile[0][0] > 1e-4:
        bm.faces.new(list(reversed(rings[0])))
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = _new_obj(p, bm, material)
    ob.location = loc
    return ob


def onion(p, loc, r, material, segs=16):
    """Луковичная главка с барабаном-шейкой; возвращает высоту маковки."""
    prof = [(r * 0.55, 0), (r * 0.55, r * 0.35), (r * 0.9, r * 0.5), (r * 1.08, r * 0.8), (r * 1.0, r * 1.1),
            (r * 0.75, r * 1.4), (r * 0.4, r * 1.7), (r * 0.12, r * 1.95), (0.0, r * 2.1)]
    lathe(p, prof, loc, material, segs)
    return loc[2] + r * 2.1


def octagon(p, loc, r, h, material, bevel=0.0):
    """Восьмерик (восьмигранный сруб/барабан)."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=r, radius2=r, depth=h)
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 8, 3, 'Z'))
    ob = _new_obj(p, bm, material)
    ob.location = (loc[0], loc[1], loc[2] + h / 2)
    return loc[2] + h


def crystal(p, loc, h, r, material='M_gem', tilt=(0.0, 0.0)):
    """Шестигранный кристалл с заострённой верхушкой."""
    lathe(p, [(r, 0), (r, h * 0.7), (0.0, h)], (0, 0, 0), material, segs=6)
    ob = bpy.data.objects[p]
    ob.location = loc
    ob.rotation_euler = (tilt[0], tilt[1], random.uniform(0, math.tau))
    return ob


def rock(p, loc, size, material='M_stone'):
    """Валун: икосфера с шумом вершин."""
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=1, radius=1.0)
    for v in bm.verts:
        k = random.uniform(0.8, 1.15)
        v.co.x *= size[0] * k; v.co.y *= size[1] * k; v.co.z *= size[2] * k
    ob = _new_obj(p, bm, material)
    ob.location = loc
    ob.rotation_euler = (0, 0, random.uniform(0, math.tau))
    return ob
