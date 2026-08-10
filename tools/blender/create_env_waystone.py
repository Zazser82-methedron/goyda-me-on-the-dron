"""Build the low-poly Dron waystone used by the Empire scene.

Run from repository root with:
  F:\blender.exe --background --python tools/blender/create_env_waystone.py
"""
from pathlib import Path
import bpy
import math

ROOT = Path(__file__).resolve().parents[2]
OUT_GLB = ROOT / 'empire' / 'assets' / 'models' / 'env_waystone.glb'
OUT_BLEND = ROOT / 'tools' / 'blender' / 'env_waystone.blend'


def material(name, color, metallic=0.0, roughness=0.75, emission=None):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    # Blender 5 can localise/rename the default node; identify it by type instead.
    bsdf = next((node for node in nodes if node.type == 'BSDF_PRINCIPLED'), None)
    if not bsdf:
        bsdf = nodes.new('ShaderNodeBsdfPrincipled')
        output = next((node for node in nodes if node.type == 'OUTPUT_MATERIAL'), None) or nodes.new('ShaderNodeOutputMaterial')
        links.new(bsdf.outputs.get('BSDF'), output.inputs.get('Surface'))
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    if emission:
        color_input = bsdf.inputs.get('Emission Color') or bsdf.inputs.get('Emission')
        strength_input = bsdf.inputs.get('Emission Strength')
        if color_input:
            color_input.default_value = (*emission, 1.0)
        if strength_input:
            strength_input.default_value = 2.3
    return mat


def finish(obj, mat, bevel=0.0):
    obj.data.materials.append(mat)
    if bevel:
        mod = obj.modifiers.new('small_edge_bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = 1
        mod.limit_method = 'ANGLE'
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj


def cone(name, r1, r2, depth, vertices, location, mat, bevel=0.0):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=r1, radius2=r2, depth=depth, location=location)
    obj = bpy.context.object
    obj.name = name
    return finish(obj, mat, bevel)


def cube(name, scale, location, mat, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, mat, bevel)


# Fresh deterministic scene.
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for datablocks in (bpy.data.meshes, bpy.data.materials, bpy.data.curves, bpy.data.cameras, bpy.data.lights):
    # Materials are created below; this simply keeps repeated script runs clean.
    if datablocks is not bpy.data.materials:
        for block in list(datablocks):
            if block.users == 0:
                datablocks.remove(block)

stone = material('weathered basalt', (0.11, 0.16, 0.20), roughness=0.92)
stone_light = material('cut basalt', (0.19, 0.27, 0.31), roughness=0.84)
gold = material('aged bronze', (0.43, 0.25, 0.07), metallic=0.72, roughness=0.38)
rune = material('dron cyan rune', (0.02, 0.18, 0.23), metallic=0.25, roughness=0.3, emission=(0.04, 0.95, 1.0))

# A deliberately compact silhouette: 6-sided stepped plinth + obelisk + glowing crest.
# Blender is Z-up (Three.js converts it for the browser), so the third coordinate is height.
cone('hex foundation', 0.50, 0.43, 0.14, 6, (0, 0, 0.07), stone_light, 0.015)
cone('lower plinth', 0.39, 0.32, 0.18, 6, (0, 0, 0.23), stone, 0.012)
cone('dron obelisk', 0.27, 0.17, 1.12, 6, (0, 0, 0.88), stone_light, 0.018)
cone('bronze crown', 0.22, 0.10, 0.18, 6, (0, 0, 1.53), gold, 0.01)

# Inset vertical rune and four small bronze corner markers. Facing -Y in the game.
bpy.ops.mesh.primitive_torus_add(major_radius=0.15, minor_radius=0.026, major_segments=12, minor_segments=4,
                                 location=(0, -0.178, 0.98), rotation=(math.pi / 2, 0, 0))
finish(bpy.context.object, rune)
bpy.context.object.name = 'glowing dron rune'
for x, z in ((-0.34, -0.34), (0.34, -0.34), (-0.34, 0.34), (0.34, 0.34)):
    cone('corner marker', 0.045, 0.022, 0.16, 5, (x, z, 0.39), gold)

# Faceted crystal: low triangle count but makes the landmark recognisable from a tactical camera.
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.115, location=(0, 0, 1.70))
finish(bpy.context.object, rune)
bpy.context.object.name = 'dron crystal'

for obj in bpy.context.scene.objects:
    if obj.type == 'MESH':
        obj.select_set(True)

OUT_GLB.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT_BLEND))
bpy.ops.export_scene.gltf(filepath=str(OUT_GLB), export_format='GLB', export_apply=True,
                          export_materials='EXPORT', export_animations=False, export_cameras=False,
                          export_lights=False)

triangles = sum(len(obj.data.polygons) for obj in bpy.context.scene.objects if obj.type == 'MESH')
print(f'WAYSTONE_OK glb={OUT_GLB} triangles={triangles}')
