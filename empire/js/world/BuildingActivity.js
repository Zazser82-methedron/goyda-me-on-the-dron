// Lightweight procedural life for single-node building GLBs.
// `time` in update() is expected in seconds. Every prop reuses this instance's
// geometry/material library; update() does not allocate transient objects.
import * as THREE from 'three';

const TAU = Math.PI * 2;
const SUPPORTED = new Set([
  'kuznica', 'market', 'traktir', 'ferma', 'rudnik', 'zhila',
  'observatory', 'veche', 'church', 'station',
  'banya', 'roshcha', 'zastava_ostrog',
]);

const STALK_POS = [
  [-0.72, 0.38], [-0.43, 0.68], [-0.16, 0.48], [0.12, 0.72],
  [0.38, 0.43], [0.62, 0.67], [0.76, 0.28],
];
const SAPLING_POS = [
  [-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5], [0, 0],
];

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function smooth01(v) { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); }

function phaseFor(b) {
  const x = Number.isFinite(b.cx) ? b.cx : 0;
  const z = Number.isFinite(b.cz) ? b.cz : 0;
  let h = 0;
  for (let i = 0; i < b.kind.length; i++) h = (h * 31 + b.kind.charCodeAt(i)) | 0;
  const n = Math.sin(x * 12.9898 + z * 78.233 + h * 0.017) * 43758.5453;
  return (n - Math.floor(n)) * TAU;
}

export class BuildingActivity {
  constructor(quality = 'high') {
    this.low = quality === 'low' || quality?.tier === 'low';
    this._time = 0;
    this._dummy = new THREE.Object3D();

    // Unit primitives. Per-prop transforms supply all dimensions.
    this.geo = {
      box: new THREE.BoxGeometry(1, 1, 1),
      cylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, this.low ? 6 : 8),
      sphere: new THREE.IcosahedronGeometry(0.5, this.low ? 0 : 1),
      crystal: new THREE.OctahedronGeometry(0.5, 0),
      torus: new THREE.TorusGeometry(0.5, this.low ? 0.035 : 0.045, this.low ? 5 : 7, this.low ? 16 : 24),
    };

    const std = (color, roughness = 0.72, metalness = 0.05, emissive = 0x000000, emissiveIntensity = 0) =>
      new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive, emissiveIntensity, flatShading: true });
    this.mat = {
      wood: std(0x70451f, 0.88),
      woodLight: std(0xa66d2f, 0.82),
      darkWood: std(0x3a2515, 0.92),
      iron: std(0x48505a, 0.4, 0.78),
      ironDark: std(0x252a30, 0.46, 0.72),
      cloth: std(0xa83325, 0.88),
      crop: std(0xa9b83e, 0.9),
      leaf: std(0x587f32, 0.92),
      stone: std(0x766d61, 0.9),
      gold: std(0xe3ad35, 0.35, 0.5, 0x6b3b05, 0.38),
      ember: std(0xff7b24, 0.48, 0.08, 0xff3d05, 2.1),
      gem: std(0x4de8ff, 0.28, 0.22, 0x087dff, 1.7),
      red: std(0xd62d27, 0.42, 0.16, 0x7a0804, 0.75),
      green: std(0x4cce68, 0.42, 0.16, 0x087522, 0.75),
      steam: new THREE.MeshStandardMaterial({ color: 0xe8eef2, roughness: 0.9, metalness: 0, transparent: true, opacity: 0.35, flatShading: true }),
    };
  }

  _mesh(parent, geometry, material, x, y, z, sx, sy, sz) {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    m.castShadow = !this.low;
    m.receiveShadow = false;
    parent.add(m);
    return m;
  }

  _instances(parent, geometry, material, count, dynamic = false) {
    const m = new THREE.InstancedMesh(geometry, material, count);
    m.castShadow = !this.low;
    m.receiveShadow = false;
    if (dynamic) m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    parent.add(m);
    return m;
  }

  _root(b) {
    const root = new THREE.Group();
    root.name = 'building_activity';
    root.userData.buildingActivity = true;
    root.renderOrder = 3;
    b.view.add(root);
    return root;
  }

  attach(b) {
    if (!b?.view || !SUPPORTED.has(b.kind)) return null;

    if (b._buildingActivity?.root) {
      const a = b._buildingActivity;
      if (a.root.parent !== b.view) b.view.add(a.root);
      return a.root;
    }

    // Also survives accidental repeated attach() calls after a caller drops the
    // building-side cache.
    const existing = b.view.children.find(c => c.userData?.buildingActivity === true);
    if (existing?.__activity) {
      b._buildingActivity = existing.__activity;
      return existing;
    }

    const root = this._root(b);
    const a = { root, kind: b.kind, phase: phaseFor(b), parts: Object.create(null) };
    root.__activity = a;
    b._buildingActivity = a;

    switch (b.kind) {
      case 'kuznica': this._forge(a); break;
      case 'market':
      case 'traktir': this._sign(a, b.kind === 'traktir'); break;
      case 'ferma': this._farm(a); break;
      case 'rudnik': this._mineCart(a); break;
      case 'zhila': this._gemVein(a); break;
      case 'observatory':
      case 'veche': this._orrery(a, b.kind === 'veche'); break;
      case 'church': this._halo(a); break;
      case 'station': this._semaphore(a); break;
      case 'banya': this._steam(a); break;
      case 'roshcha': this._saplings(a); break;
      case 'zastava_ostrog': this._flag(a); break;
    }

    root.visible = !!b.built;
    return root;
  }

  _forge(a) {
    const r = a.root;
    // Anvil + a small readable forge glow in front of the building.
    this._mesh(r, this.geo.box, this.mat.ironDark, -0.22, 0.16, 0.48, 0.34, 0.12, 0.22);
    this._mesh(r, this.geo.box, this.mat.iron, -0.22, 0.27, 0.48, 0.24, 0.10, 0.17);
    this._mesh(r, this.geo.box, this.mat.stone, 0.25, 0.12, 0.46, 0.34, 0.22, 0.28);
    const ember = this._mesh(r, this.geo.sphere, this.mat.ember, 0.25, 0.27, 0.46, 0.21, 0.08, 0.18);

    const hammer = new THREE.Group();
    hammer.position.set(-0.04, 0.22, 0.48);
    this._mesh(hammer, this.geo.cylinder, this.mat.woodLight, 0, 0.28, 0, 0.055, 0.52, 0.055);
    const head = this._mesh(hammer, this.geo.box, this.mat.iron, 0, 0.55, 0, 0.28, 0.12, 0.14);
    head.rotation.z = 0.05;
    r.add(hammer);
    a.parts.hammer = hammer;
    a.parts.ember = ember;
  }

  _steam(a) {
    const r = a.root;
    const count = this.low ? 2 : 3;
    const steam = [];
    for (let i = 0; i < count; i++) steam.push(this._mesh(r, this.geo.sphere, this.mat.steam, 0.18, 0.97, -0.08, 0.06, 0.05, 0.06));
    a.parts.steam = steam;
  }

  _sign(a, tavern) {
    const r = a.root;
    const x = 0.72, z = 0.58;
    this._mesh(r, this.geo.cylinder, this.mat.darkWood, x, 0.72, z, 0.055, 1.42, 0.055);
    this._mesh(r, this.geo.box, this.mat.darkWood, x - 0.24, 1.31, z, 0.52, 0.06, 0.06);
    const sign = new THREE.Group();
    sign.position.set(x - 0.44, 1.27, z);
    this._mesh(sign, this.geo.box, tavern ? this.mat.cloth : this.mat.woodLight, 0, -0.18, 0, 0.36, 0.27, 0.08);
    const mark = this._mesh(sign, this.geo.sphere, tavern ? this.mat.ember : this.mat.gold, 0, -0.18, 0.06, 0.10, 0.10, 0.035);
    sign.add(mark);
    r.add(sign);

    const lantern = new THREE.Group();
    lantern.position.set(x + 0.02, 0.82, z + 0.08);
    this._mesh(lantern, this.geo.box, this.mat.ironDark, 0, 0, 0, 0.13, 0.19, 0.13);
    const light = this._mesh(lantern, this.geo.sphere, this.mat.ember, 0, 0, 0.01, 0.09, 0.12, 0.09);
    r.add(lantern);
    a.parts.sign = sign;
    a.parts.lantern = lantern;
    a.parts.light = light;
  }

  _flag(a) {
    const r = a.root;
    const x = 0.28, z = -0.12;
    this._mesh(r, this.geo.cylinder, this.mat.darkWood, x, 1.60, z, 0.035, 0.92, 0.035);
    const flag = new THREE.Group();
    flag.position.set(x, 2.02, z);
    this._mesh(flag, this.geo.box, this.mat.cloth, 0.18, -0.12, 0, 0.36, 0.24, 0.035);
    r.add(flag);
    a.parts.flag = flag;
  }

  _farm(a) {
    const r = a.root;
    const mill = new THREE.Group();
    mill.position.set(0.58, 0, 0.54);
    this._mesh(mill, this.geo.cylinder, this.mat.wood, 0, 0.58, 0, 0.075, 1.16, 0.075);
    const rotor = new THREE.Group();
    rotor.position.set(0, 1.11, 0.045);
    const blades = this._instances(rotor, this.geo.box, this.mat.cloth, 4);
    const d = this._dummy;
    for (let i = 0; i < 4; i++) {
      const angle = i * Math.PI * 0.5;
      d.position.set(-Math.sin(angle) * 0.29, Math.cos(angle) * 0.29, 0);
      d.rotation.set(0, 0, angle - 0.12);
      d.scale.set(0.10, 0.51, 0.035);
      d.updateMatrix();
      blades.setMatrixAt(i, d.matrix);
    }
    blades.instanceMatrix.needsUpdate = true;
    this._mesh(rotor, this.geo.sphere, this.mat.iron, 0, 0, 0.02, 0.14, 0.14, 0.10);
    mill.add(rotor);
    r.add(mill);

    const count = this.low ? 3 : STALK_POS.length;
    const stems = this._instances(r, this.geo.cylinder, this.mat.crop, count, true);
    const heads = this._instances(r, this.geo.sphere, this.mat.gold, count, true);
    for (let i = 0; i < count; i++) {
      const p = STALK_POS[i];
      d.position.set(p[0], 0.24, p[1]);
      d.rotation.set(0, 0, 0);
      d.scale.set(0.025, 0.48, 0.025);
      d.updateMatrix();
      stems.setMatrixAt(i, d.matrix);
      d.position.set(p[0], 0.51, p[1]);
      d.rotation.set(0, 0, 0.18);
      d.scale.set(0.065, 0.15, 0.065);
      d.updateMatrix();
      heads.setMatrixAt(i, d.matrix);
    }
    stems.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;
    a.parts.rotor = rotor;
    a.parts.stems = stems;
    a.parts.heads = heads;
    a.parts.stalkCount = count;
  }

  _saplings(a) {
    const r = a.root;
    const count = this.low ? 4 : SAPLING_POS.length;
    const saplings = this._instances(r, this.geo.sphere, this.mat.leaf, count, true);
    const d = this._dummy;
    for (let i = 0; i < count; i++) {
      const p = SAPLING_POS[i];
      d.position.set(p[0], 0.5, p[1]);
      d.rotation.set(0, 0, 0);
      d.scale.set(0.32, 0.34, 0.32);
      d.updateMatrix();
      saplings.setMatrixAt(i, d.matrix);
    }
    saplings.instanceMatrix.needsUpdate = true;
    a.parts.saplings = saplings;
    a.parts.saplingCount = count;
  }

  _mineCart(a) {
    const r = a.root;
    const cart = new THREE.Group();
    cart.position.set(0, 0, 0.62);
    this._mesh(cart, this.geo.box, this.mat.wood, 0, 0.27, 0, 0.52, 0.25, 0.38);
    this._mesh(cart, this.geo.box, this.mat.ironDark, 0, 0.42, 0, 0.46, 0.08, 0.32);
    const wheels = [];
    for (let ix = -1; ix <= 1; ix += 2) {
      for (let iz = -1; iz <= 1; iz += 2) {
        const wheel = new THREE.Group();
        wheel.position.set(ix * 0.23, 0.12, iz * 0.22);
        const tire = this._mesh(wheel, this.geo.cylinder, this.mat.iron, 0, 0, 0, 0.13, 0.09, 0.13);
        tire.rotation.x = Math.PI * 0.5;
        cart.add(wheel);
        wheels.push(wheel);
      }
    }
    r.add(cart);
    a.parts.cart = cart;
    a.parts.wheels = wheels;
  }

  _gemVein(a) {
    const r = a.root;
    const cluster = new THREE.Group();
    cluster.position.set(0.48, 0.18, 0.56);
    const c0 = this._mesh(cluster, this.geo.crystal, this.mat.gem, 0, 0.28, 0, 0.22, 0.52, 0.22);
    c0.rotation.z = 0.12;
    const c1 = this._mesh(cluster, this.geo.crystal, this.mat.gem, -0.22, 0.18, 0.04, 0.14, 0.35, 0.14);
    c1.rotation.z = -0.35;
    if (!this.low) {
      const c2 = this._mesh(cluster, this.geo.crystal, this.mat.gold, 0.22, 0.15, -0.03, 0.12, 0.28, 0.12);
      c2.rotation.z = 0.42;
    }
    r.add(cluster);
    a.parts.cluster = cluster;
  }

  _orrery(a, veche) {
    const r = a.root;
    const rig = new THREE.Group();
    rig.position.set(0, veche ? 1.22 : 1.48, 0);
    const ringA = this._mesh(rig, this.geo.torus, veche ? this.mat.gold : this.mat.iron, 0, 0, 0, 1.08, 1.08, 1.08);
    ringA.rotation.x = Math.PI * 0.16;
    let ringB = null;
    if (!this.low) {
      ringB = this._mesh(rig, this.geo.torus, veche ? this.mat.woodLight : this.mat.gold, 0, 0, 0, 0.78, 0.78, 0.78);
      ringB.rotation.y = Math.PI * 0.5;
    }
    const core = this._mesh(rig, this.geo.sphere, veche ? this.mat.ember : this.mat.gem, 0, 0, 0, 0.22, 0.22, 0.22);
    r.add(rig);
    a.parts.rig = rig;
    a.parts.ringA = ringA;
    a.parts.ringB = ringB;
    a.parts.core = core;
  }

  _halo(a) {
    const r = a.root;
    const halo = new THREE.Group();
    halo.position.set(0, 1.62, 0);
    const ring = this._mesh(halo, this.geo.torus, this.mat.gold, 0, 0, 0, 0.92, 0.92, 0.92);
    ring.rotation.x = Math.PI * 0.5;
    const core = this._mesh(halo, this.geo.sphere, this.mat.ember, 0, 0, 0, 0.13, 0.13, 0.13);
    if (!this.low) {
      for (let i = 0; i < 4; i++) {
        const ray = this._mesh(halo, this.geo.box, this.mat.gold, 0, 0, 0, 0.045, 0.045, 0.34);
        ray.rotation.y = i * Math.PI * 0.5;
        ray.position.set(Math.sin(ray.rotation.y) * 0.58, 0, Math.cos(ray.rotation.y) * 0.58);
      }
    }
    r.add(halo);
    a.parts.halo = halo;
    a.parts.core = core;
  }

  _semaphore(a) {
    const r = a.root;
    const rig = new THREE.Group();
    rig.position.set(0.72, 0, 0.66);
    this._mesh(rig, this.geo.cylinder, this.mat.ironDark, 0, 0.65, 0, 0.055, 1.30, 0.055);
    this._mesh(rig, this.geo.box, this.mat.stone, 0, 0.07, 0, 0.24, 0.14, 0.24);
    const arm = new THREE.Group();
    arm.position.set(0, 1.16, 0);
    this._mesh(arm, this.geo.box, this.mat.cloth, -0.26, 0, 0, 0.52, 0.09, 0.07);
    this._mesh(arm, this.geo.sphere, this.mat.red, -0.52, 0, 0.01, 0.11, 0.11, 0.08);
    rig.add(arm);
    const green = this._mesh(rig, this.geo.sphere, this.mat.green, 0, 0.93, 0.02, 0.12, 0.12, 0.09);
    r.add(rig);
    a.parts.arm = arm;
    a.parts.green = green;
  }

  update(buildings, dt, time, wind = 0) {
    if (!Array.isArray(buildings)) return;
    const fdt = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.1);
    this._time = Number.isFinite(time) ? time : this._time + fdt;
    const t = this._time;
    const w = clamp(Number.isFinite(wind) ? wind : 0, -1, 1);

    for (let i = 0; i < buildings.length; i++) {
      const b = buildings[i];
      if (!b?.view || !SUPPORTED.has(b.kind)) continue;
      if (!b._buildingActivity) this.attach(b);
      const a = b._buildingActivity;
      if (!a) continue;
      if (a.root.parent !== b.view) b.view.add(a.root);
      a.root.visible = !!b.built;
      if (!b.built) continue;

      const p = a.parts;
      const q = t + a.phase;
      switch (a.kind) {
        case 'kuznica': {
          const cycle = (q * 0.72) % 1;
          let swing;
          if (cycle < 0.58) swing = smooth01(cycle / 0.58);
          else if (cycle < 0.72) swing = 1 - smooth01((cycle - 0.58) / 0.14);
          else swing = 0;
          p.hammer.rotation.z = -0.88 + swing * 1.28;
          const hit = Math.max(0, 1 - Math.abs(cycle - 0.72) * 26);
          const pulse = 1 + Math.sin(q * 8.4) * 0.08 + hit * 0.32;
          p.ember.scale.set(0.21 * pulse, 0.08 * pulse, 0.18 * pulse);
          break;
        }
        case 'market':
        case 'traktir': {
          const gust = 0.055 + Math.abs(w) * 0.16;
          p.sign.rotation.z = Math.sin(q * (1.25 + Math.abs(w))) * gust;
          p.sign.rotation.x = Math.sin(q * 0.73) * gust * 0.35;
          p.lantern.rotation.z = Math.sin(q * 1.7 + 1.1) * gust * 0.75;
          const pulse = 1 + Math.sin(q * 4.8) * 0.11;
          p.light.scale.set(0.09 * pulse, 0.12 * pulse, 0.09 * pulse);
          break;
        }
        case 'ferma': {
          p.rotor.rotation.z += fdt * (0.55 + Math.abs(w) * 2.2);
          const d = this._dummy;
          for (let j = 0; j < p.stalkCount; j++) {
            const pos = STALK_POS[j];
            const rz = Math.sin(q * 1.35 + j * 0.71) * (0.035 + Math.abs(w) * 0.13);
            const rx = Math.cos(q * 1.11 + j * 0.43) * (0.018 + Math.abs(w) * 0.06);
            d.position.set(pos[0] - Math.sin(rz) * 0.24, Math.cos(rz) * 0.24, pos[1] + Math.sin(rx) * 0.24);
            d.rotation.set(rx, 0, rz);
            d.scale.set(0.025, 0.48, 0.025);
            d.updateMatrix();
            p.stems.setMatrixAt(j, d.matrix);
            d.position.set(pos[0] - Math.sin(rz) * 0.51, Math.cos(rz) * 0.51, pos[1] + Math.sin(rx) * 0.51);
            d.rotation.set(rx, 0, rz + 0.18);
            d.scale.set(0.065, 0.15, 0.065);
            d.updateMatrix();
            p.heads.setMatrixAt(j, d.matrix);
          }
          p.stems.instanceMatrix.needsUpdate = true;
          p.heads.instanceMatrix.needsUpdate = true;
          break;
        }
        case 'rudnik': {
          const travel = Math.sin(q * 0.72);
          p.cart.position.x = travel * 0.46;
          p.cart.position.y = Math.abs(Math.sin(q * 2.9)) * 0.018;
          const spin = -q * 1.35;
          for (let j = 0; j < p.wheels.length; j++) p.wheels[j].rotation.z = spin;
          break;
        }
        case 'zhila': {
          p.cluster.rotation.y = q * 0.28;
          p.cluster.position.y = 0.18 + Math.sin(q * 1.7) * 0.035;
          const pulse = 1 + Math.sin(q * 2.5) * 0.045;
          p.cluster.scale.setScalar(pulse);
          break;
        }
        case 'observatory':
        case 'veche': {
          p.rig.rotation.y = q * (a.kind === 'veche' ? 0.18 : 0.34);
          p.ringA.rotation.z = q * 0.31;
          if (p.ringB) p.ringB.rotation.x = q * -0.27;
          const pulse = 1 + Math.sin(q * 2.2) * 0.09;
          p.core.scale.setScalar(0.22 * pulse);
          break;
        }
        case 'church': {
          p.halo.rotation.y = q * 0.22;
          p.halo.position.y = 1.62 + Math.sin(q * 1.3) * 0.045;
          const pulse = 1 + Math.sin(q * 2.7) * 0.11;
          p.core.scale.setScalar(0.13 * pulse);
          break;
        }
        case 'station': {
          const signal = smooth01((Math.sin(q * 0.38) + 1) * 0.5);
          p.arm.rotation.z = -0.62 + signal * 1.05;
          const pulse = 1 + Math.sin(q * 3.5) * 0.10;
          p.green.scale.set(0.12 * pulse, 0.12 * pulse, 0.09 * pulse);
          break;
        }
        case 'banya': {
          for (let j = 0; j < p.steam.length; j++) {
            const cycle = (q * 0.24 + j / p.steam.length) % 1;
            const rise = smooth01(cycle);
            const puff = 0.06 + rise * 0.16;
            p.steam[j].position.set(0.18 + Math.sin(q * 0.7 + j * 1.9) * rise * 0.07, 0.97 + rise * 0.66, -0.08 + Math.cos(q * 0.55 + j * 1.3) * rise * 0.05);
            p.steam[j].scale.set(puff, puff * (0.78 + rise * 0.42), puff);
          }
          break;
        }
        case 'roshcha': {
          const d = this._dummy;
          for (let j = 0; j < p.saplingCount; j++) {
            const pos = SAPLING_POS[j];
            const rz = Math.sin(q * 1.35 + j * 0.71) * (0.035 + Math.abs(w) * 0.13);
            const rx = Math.cos(q * 1.11 + j * 0.43) * (0.018 + Math.abs(w) * 0.06);
            d.position.set(pos[0] - Math.sin(rz) * 0.22, 0.5 + (Math.cos(rz) - 1) * 0.22, pos[1] + Math.sin(rx) * 0.22);
            d.rotation.set(rx, 0, rz);
            d.scale.set(0.32, 0.34, 0.32);
            d.updateMatrix();
            p.saplings.setMatrixAt(j, d.matrix);
          }
          p.saplings.instanceMatrix.needsUpdate = true;
          break;
        }
        case 'zastava_ostrog': {
          const gust = 0.055 + Math.abs(w) * 0.16;
          p.flag.rotation.z = Math.sin(q * (1.25 + Math.abs(w))) * gust;
          p.flag.rotation.x = Math.sin(q * 0.73) * gust * 0.35;
          break;
        }
      }
    }
  }
}
