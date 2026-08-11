"""Create lightweight environment details for the GOYDA Empire.

Run: F:\blender.exe --background --python tools/blender/create_env_details.py
Exports two independent browser-ready GLBs and their Blender sources.
"""
from pathlib import Path
import bpy
import math

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'empire' / 'assets' / 'models'
SRC = ROOT / 'tools' / 'blender'


def reset():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)


def material(name, color, metallic=0.0, roughness=0.75, emission=None):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = next((node for node in nodes if node.type == 'BSDF_PRINCIPLED'), None)
    if not bsdf:
        bsdf = nodes.new('ShaderNodeBsdfPrincipled')
        out = next((node for node in nodes if node.type == 'OUTPUT_MATERIAL'), None) or nodes.new('ShaderNodeOutputMaterial')
        links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    if emission:
        ci = bsdf.inputs.get('Emission Color') or bsdf.inputs.get('Emission')
        si = bsdf.inputs.get('Emission Strength')
        if ci: ci.default_value = (*emission, 1.0)
        if si: si.default_value = 2.1
    return mat


def finish(obj, mat, bevel=0.0):
    obj.data.materials.append(mat)
    if bevel:
        mod = obj.modifiers.new('edge bevel', 'BEVEL')
        mod.width, mod.segments, mod.limit_method = bevel, 1, 'ANGLE'
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj


def cone(name, r1, r2, depth, vertices, location, mat, rotation=None, bevel=0.0):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=r1, radius2=r2, depth=depth, location=location, rotation=rotation or (0, 0, 0))
    obj = bpy.context.object; obj.name = name
    return finish(obj, mat, bevel)


def cyl(name, radius, depth, vertices, location, mat, rotation=None, bevel=0.0):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation or (0, 0, 0))
    obj = bpy.context.object; obj.name = name
    return finish(obj, mat, bevel)


def mesh(name, verts, faces, mat):
    data = bpy.data.meshes.new(name + 'Mesh')
    data.from_pydata(verts, [], faces); data.materials.append(mat)
    obj = bpy.data.objects.new(name, data); bpy.context.collection.objects.link(obj)
    return obj


def export(asset):
    OUT.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.wm.save_as_mainfile(filepath=str(SRC / (asset + '.blend')))
    bpy.ops.export_scene.gltf(filepath=str(OUT / (asset + '.glb')), export_format='GLB', export_apply=True,
                              export_materials='EXPORT', export_animations=False, export_cameras=False,
                              export_lights=False, use_selection=True)
    triangles = sum(len(o.data.polygons) for o in bpy.context.scene.objects if o.type == 'MESH')
    print(f'DETAIL_OK asset={asset} triangles={triangles}')


def build_banner():
    reset()
    wood = material('dark birch', (0.13, 0.07, 0.025), roughness=0.9)
    bronze = material('banner bronze', (0.46, 0.25, 0.055), metallic=0.7, roughness=0.36)
    cloth = material('goyda crimson', (0.34, 0.018, 0.025), roughness=0.64)
    glyph = material('dron glyph', (0.05, 0.18, 0.2), metallic=0.25, roughness=0.3, emission=(0.1, 0.95, 1.0))
    cyl('banner pole', 0.034, 2.15, 8, (0, 0, 1.075), wood)
    cone('banner foot', 0.18, 0.13, 0.10, 6, (0, 0, 0.05), bronze, bevel=0.008)
    cone('banner finial', 0.08, 0.0, 0.18, 6, (0, 0, 2.22), bronze)
    # A real thin cloth volume instead of overlapping reverse faces: valid GLB,
    # visible from both sides and still only a handful of triangles.
    v = [(0, -0.018, 1.88), (0.88, -0.018, 1.78), (0, -0.018, 1.24), (0.72, -0.018, 1.15),
         (0, 0.018, 1.88), (0.88, 0.018, 1.78), (0, 0.018, 1.24), (0.72, 0.018, 1.15)]
    mesh('crimson banner', v, [(0, 2, 1), (1, 2, 3), (4, 5, 6), (5, 7, 6),
                               (0, 1, 4), (1, 5, 4), (1, 3, 5), (3, 7, 5),
                               (3, 2, 7), (2, 6, 7), (2, 0, 6), (0, 4, 6)], cloth)
    # A small luminous diamond tells the player that this is a Dron landmark.
    mesh('dron banner glyph', [(0.31, -0.024, 1.60), (0.42, -0.024, 1.48), (0.31, -0.024, 1.36), (0.20, -0.024, 1.48)], [(0, 1, 2), (0, 2, 3)], glyph)
    export('env_banner')


def build_watchfire():
    reset()
    rock = material('fire stones', (0.18, 0.20, 0.19), roughness=0.95)
    wood = material('charred wood', (0.105, 0.035, 0.012), roughness=0.92)
    coal = material('hot coal', (0.20, 0.015, 0.002), roughness=0.58, emission=(1.0, 0.06, 0.005))
    flame = material('cyan fire', (0.02, 0.20, 0.24), roughness=0.25, emission=(0.10, 0.90, 1.0))
    # Seven faceted stones and three crossed logs, all intentionally low-poly.
    for i in range(7):
        a = i * math.tau / 7
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.14, location=(math.cos(a) * 0.31, math.sin(a) * 0.31, 0.12))
        finish(bpy.context.object, rock); bpy.context.object.name = 'watchfire stone'
    for a in (0, math.pi / 3, -math.pi / 3):
        cyl('charred log', 0.065, 0.58, 7, (0, 0, 0.20), wood, rotation=(math.pi / 2, 0, a))
    cone('coal bed', 0.19, 0.13, 0.10, 7, (0, 0, 0.22), coal)
    cone('blue flame outer', 0.16, 0.0, 0.52, 6, (0, 0, 0.46), flame)
    cone('blue flame core', 0.08, 0.0, 0.36, 5, (0.035, -0.025, 0.42), coal)
    export('env_watchfire')


build_banner()
build_watchfire()
