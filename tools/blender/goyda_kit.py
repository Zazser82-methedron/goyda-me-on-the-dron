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
    'M_paint_green': ((0.03, 0.15, 0.06), 0.45),
    'M_siding':      ((0.80, 0.62, 0.30), 0.8),   # обшивка тёсом, крашенная охрой (III эпоха)
    'M_brick':       ((0.30, 0.07, 0.04), 0.9),
    'M_dark':        ((0.16, 0.11, 0.07), 0.8),
    'M_iron':        ((0.20, 0.20, 0.22), 0.5),
    'M_window':      ((0.05, 0.07, 0.10), 0.15),
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
