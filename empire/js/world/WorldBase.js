// ===== Мир-плита на слонах и черепахе в океане (лор «плоской земли») =====
import * as THREE from 'three';
import { TILE, PAL } from '../data/config.js?v=102';
import { makeRippleNormal } from './WaterFx.js?v=94';

const _m = {};
function matStd(c, o = {}) { const k = c + '|' + (o.r ?? 1); if (!_m[k]) _m[k] = new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: o.r ?? 1, metalness: o.m ?? 0 }); return _m[k]; }
function box(w, h, d, m, x = 0, y = 0, z = 0) { const e = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); e.position.set(x, y, z); return e; }
function cyl(rt, rb, h, s, m, x = 0, y = 0, z = 0) { const e = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, s), m); e.position.set(x, y, z); return e; }
function cone(r, h, s, m, x = 0, y = 0, z = 0) { const e = new THREE.Mesh(new THREE.ConeGeometry(r, h, s), m); e.position.set(x, y, z); return e; }

function elephant(s) {
  const g = new THREE.Group();
  const grey = matStd(0x8a8a93), greyD = matStd(0x6a6a73), white = matStd(0xe8e4d6);
  g.add(box(1.7 * s, 1.2 * s, 2.6 * s, grey, 0, 1.3 * s, 0));
  for (const [x, z] of [[-0.62, -0.85], [0.62, -0.85], [-0.62, 0.85], [0.62, 0.85]]) g.add(cyl(0.3 * s, 0.34 * s, 1.4 * s, 6, greyD, x * s, 0.65 * s, z * s));
  g.add(box(1.15 * s, 1.05 * s, 1.0 * s, grey, 0, 1.6 * s, 1.6 * s));
  g.add(box(1.4 * s, 1.0 * s, 0.12 * s, greyD, -0.78 * s, 1.7 * s, 1.55 * s));
  g.add(box(1.4 * s, 1.0 * s, 0.12 * s, greyD, 0.78 * s, 1.7 * s, 1.55 * s));
  for (let i = 0; i < 4; i++) g.add(cyl((0.2 - 0.035 * i) * s, (0.22 - 0.035 * i) * s, 0.45 * s, 6, grey, 0, (1.45 - 0.32 * i) * s, (2.1 + 0.02 * i) * s));
  g.add(cone(0.13 * s, 0.9 * s, 5, white, -0.36 * s, 1.05 * s, 2.2 * s));
  g.add(cone(0.13 * s, 0.9 * s, 5, white, 0.36 * s, 1.05 * s, 2.2 * s));
  return g;
}

function turtle(s) {
  const g = new THREE.Group();
  const shell = matStd(0x3c5e3a), shellD = matStd(0x2c4a2a), skin = matStd(0x6a7a58);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 9, 0, Math.PI * 2, 0, Math.PI / 2), shell);
  dome.scale.set(s, s * 0.5, s); g.add(dome);
  for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; g.add(box(0.18 * s, 0.18 * s, 0.18 * s, shellD, Math.cos(a) * 0.55 * s, 0.42 * s, Math.sin(a) * 0.55 * s)); }
  g.add(box(0.6 * s, 0.5 * s, 0.9 * s, skin, 0, 0.12 * s, s * 0.98));
  for (const [x, z] of [[-0.85, -0.6], [0.85, -0.6], [-0.85, 0.6], [0.85, 0.6]]) g.add(box(0.55 * s, 0.28 * s, 1.0 * s, skin, x * s, 0.06 * s, z * s));
  return g;
}

export class WorldBase {
  constructor(scene, grid, quality = 'high') {
    this.group = new THREE.Group();
    this.lowFx = quality === 'low';
    const n = grid.n, ww = n * TILE;
    let minH = 0;
    if (grid.heights) { minH = Infinity; for (let i = 0; i < grid.heights.length; i++) if (grid.heights[i] < minH) minH = grid.heights[i]; }
    const top = minH - 0.15, THICK = 10;

    // ---- плита-мир со стратами (vertex-color по высоте) ----
    const geo = new THREE.BoxGeometry(ww, THICK, ww, 1, 4, 1);
    const pos = geo.attributes.position, col = new Float32Array(pos.count * 3), cc = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const f = (pos.getY(i) + THICK / 2) / THICK;        // 0 низ .. 1 верх
      // Боковина мира находится за водопадом: держим её в палитре океана,
      // чтобы через прозрачный поток не просвечивал коричневый «земляной ящик».
      cc.setHex(f > 0.82 ? 0x285b6d : f > 0.45 ? 0x1b4b60 : 0x102f45);
      col[i * 3] = cc.r; col[i * 3 + 1] = cc.g; col[i * 3 + 2] = cc.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const slab = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
    slab.position.y = top - THICK / 2;
    slab.receiveShadow = false; slab.castShadow = false;
    this.group.add(slab);

    const slabBottom = top - THICK;

    // ---- черепаха ----
    const tS = ww * 0.42;
    const tur = turtle(tS);
    const turTop = slabBottom - ww * 0.42;     // слоны между плитой и панцирем
    tur.position.set(0, turTop - tS * 0.5, 0);
    this.group.add(tur);

    // ---- 3 слона держат плиту ----
    const eS = ww * 0.10;
    const ePos = [[-ww * 0.22, -ww * 0.18], [ww * 0.24, -ww * 0.05], [-ww * 0.05, ww * 0.24]];
    for (const [x, z] of ePos) { const el = elephant(eS); el.position.set(x, turTop, z); this.group.add(el); }

    // ---- океан ----
    const ocean = new THREE.Mesh(
      new THREE.PlaneGeometry(ww * 4, ww * 4, 1, 1),
      // зеркальный океан — отражает IBL-небо/окружение
      new THREE.MeshStandardMaterial({ color: PAL.waterDeep, transparent: true, opacity: 0.94, roughness: 0.07, metalness: 0.75, envMapIntensity: 1.6 })
    );
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.y = turTop - tS - ww * 0.12;
    const on = makeRippleNormal(128); on.repeat.set(24, 24);   // рябь океана
    ocean.material.normalMap = on; ocean.material.normalScale = new THREE.Vector2(0.28, 0.28); ocean.material.needsUpdate = true;
    this._oceanN = on;
    this.ocean = ocean;
    this.group.add(ocean);

    // ---- водопады с края «плоской земли» (анимированные) ----
    const waterY = (grid.water ?? -0.5) - 0.02;
    this._buildWaterfallsV2(slabBottom, ww, waterY);

    scene.add(this.group);
  }

  // короткие водопады у самой кромки: струи с пеной сверху, тают книзу (не «стеклянный куб»)
  // Stylised waterfall v2: coloured, broken-up water sheets with animated
  // flow lines, then separate foam and droplets only where water hits below.
  // This deliberately avoids a stretched white bitmap across the whole edge.
  _buildWaterfallsV2(slabBottom, ww, waterY) {
    const H = ww * 0.20, half = ww / 2, yTop = waterY + 0.015, yBottom = yTop - H;
    const fx = { time: 0, mats: [], foam: [], drops: [] };
    this._waterfallV2 = fx;
    const makeFallMat = (seed, opacity) => {
      const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true,
        uniforms: {
          ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
          uTime: { value: 0 }, uSeed: { value: seed }, uOpacity: { value: opacity }, uWaterColor: { value: new THREE.Color(PAL.water) },
        },
        vertexShader: `
          uniform float uTime; uniform float uSeed; varying vec2 vUv;
          #include <fog_pars_vertex>
          void main(){
            vUv = uv; vec3 p = position;
            float w = sin(uv.y * 19.0 + uTime * 3.0 + uSeed) * 0.10
                    + sin(uv.y * 7.0 - uTime * 1.7 + uv.x * 8.0) * 0.06;
            p.x += w * (0.35 + sin(uv.x * 6.283) * 0.65);
            p.z += sin(uv.y * 27.0 - uTime * 4.0 + uSeed) * 0.055;
            p.y += sin(uv.x * 12.0 + uTime * 2.0 + uSeed) * 0.022;
            vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mvPosition;
            #include <fog_vertex>
          }`,
        fragmentShader: `
          uniform float uTime; uniform float uSeed; uniform float uOpacity; uniform vec3 uWaterColor; varying vec2 vUv;
          #include <fog_pars_fragment>
          float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7))) * 43758.5453123); }
          float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
            return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y); }
          float fbm(vec2 p){ float v=0.; v+=noise(p)*.55; p=p*2.03+3.1; v+=noise(p)*.27; p=p*2.01+1.7; v+=noise(p)*.18; return v; }
          void main(){
            float t = uTime * 0.72;
            float n = fbm(vec2(vUv.x * 7.0 + sin(vUv.y*7.0+t)*.24+uSeed, vUv.y * 5.5 - t));
            float edge = smoothstep(.015,.115,vUv.x) * smoothstep(.015,.115,1.0-vUv.x);
            float breaks = smoothstep(.17,.46,n + sin(vUv.y*18.0-t*4.0+uSeed)*.10);
            float topFoam = smoothstep(.90,1.0,vUv.y) * .18;
            float baseFoam = (1.0-smoothstep(.0,.16,vUv.y)) * (.22 + n*.34);
            float foam = clamp(topFoam + baseFoam, 0.0, 1.0);
            vec3 water = uWaterColor * mix(.82, 1.28, n);
            vec3 color = mix(water, vec3(.68,.86,.91), foam);
            float alpha = (.42 + n*.30 + foam*.24) * edge * breaks * uOpacity;
            if(alpha < .035) discard;
            gl_FragColor = vec4(color, alpha);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
            #include <fog_fragment>
          }`,
      });
      fx.mats.push(mat); return mat;
    };
    const foamCanvas = document.createElement('canvas'); foamCanvas.width = foamCanvas.height = 96;
    const fc = foamCanvas.getContext('2d');
    for (let i = 0; i < 34; i++) {
      const r = 3 + Math.random() * 11, x = Math.random() * 96, y = 40 + Math.random() * 45;
      const g = fc.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(235,252,255,.88)'); g.addColorStop(1, 'rgba(164,230,255,0)');
      fc.fillStyle = g; fc.beginPath(); fc.arc(x, y, r, 0, Math.PI * 2); fc.fill();
    }
    const foamTex = new THREE.CanvasTexture(foamCanvas);
    const waterBackMat = new THREE.MeshStandardMaterial({ color: PAL.water, roughness: .18, metalness: .52, envMapIntensity: 1.25 });
    const waterLipMat = new THREE.MeshStandardMaterial({ color: PAL.water, roughness: .22, metalness: .46, envMapIntensity: 1.20 });
    const edges = [{ x: 0, z: half, ry: 0 }, { x: 0, z: -half, ry: Math.PI }, { x: half, z: 0, ry: Math.PI / 2 }, { x: -half, z: 0, ry: -Math.PI / 2 }];
    const fallsPerEdge = this.lowFx ? 2 : 4;
    for (let ei = 0; ei < edges.length; ei++) {
      const e = edges[ei], nx = Math.sin(e.ry), nz = Math.cos(e.ry), alongZ = Math.abs(e.ry) > 1.0;
      // Непрозрачное ядро полностью закрывает плиту; поверх него живёт
      // полупрозрачный shader-flow, поэтому цвет остаётся единым с океаном.
      const coverBottom = Math.max(yBottom, slabBottom - .04), coverH = Math.max(.02, yTop - coverBottom);
      const back = new THREE.Mesh(new THREE.PlaneGeometry(ww * 1.005, coverH), waterBackMat);
      back.position.set(e.x + nx * .022, yTop - coverH * .5, e.z + nz * .022); back.rotation.y = e.ry; back.renderOrder = 7; this.group.add(back);
      const lip = new THREE.Mesh(new THREE.BoxGeometry(ww * 1.01, .13, .22), waterLipMat);
      lip.position.set(e.x + nx * .06, waterY + .025, e.z + nz * .06); lip.rotation.y = e.ry; lip.renderOrder = 9; this.group.add(lip);
      // Under-sheet provides blue mass; individual ribbons produce the lively silhouette.
      const under = new THREE.Mesh(new THREE.PlaneGeometry(ww * .98, H, 18, 20), makeFallMat(ei * 1.71, .80));
      under.position.set(e.x + nx * .04, yTop - H * .5, e.z + nz * .04); under.rotation.y = e.ry; under.renderOrder = 8; this.group.add(under);
      for (let i = 0; i < fallsPerEdge; i++) {
        const frac = (i + .5) / fallsPerEdge - .5, width = ww * (.16 + Math.random() * .08);
        const offset = frac * ww * .80, x = alongZ ? e.x + nx * (.11 + i*.025) : offset, z = alongZ ? offset : e.z + nz * (.11 + i*.025);
        const ribbon = new THREE.Mesh(new THREE.PlaneGeometry(width, H * (.84 + Math.random()*.12), 10, 20), makeFallMat(7.3 + ei*3.1 + i, .88));
        ribbon.position.set(x, yTop - H * (.49 + Math.random()*.03), z); ribbon.rotation.y = e.ry; ribbon.renderOrder = 10; this.group.add(ribbon);
        const foamMat = new THREE.MeshBasicMaterial({ map: foamTex, transparent: true, depthWrite: false, color: 0xcdf5ff, opacity: .64, blending: THREE.AdditiveBlending, fog: false });
        const foam = new THREE.Mesh(new THREE.PlaneGeometry(width * 1.35, H * .20), foamMat);
        foam.rotation.set(-Math.PI / 2, e.ry, 0);
        foam.position.set(x + nx*.34, yBottom + .16, z + nz*.34); foam.renderOrder = 14; this.group.add(foam);
        fx.foam.push({ m: foam, opacity: foamMat.opacity, phase: Math.random()*6.28, sx: 1, sy: 1 });
        const dropMat = new THREE.SpriteMaterial({ map: foamTex, transparent: true, depthWrite: false, color: 0xbdefff, opacity: .44, blending: THREE.AdditiveBlending, fog: false });
        for (let d = 0; d < (this.lowFx ? 3 : 7); d++) {
          const drop = new THREE.Sprite(dropMat);
          const spread = (Math.random()-.5)*width*.92, dx = alongZ ? nx*.42 : spread, dz = alongZ ? spread : nz*.42;
          drop.position.set(x+dx, yBottom+Math.random()*H*.34, z+dz); drop.scale.set(.24+Math.random()*.28, .34+Math.random()*.34, 1); drop.renderOrder = 15;
          this.group.add(drop); fx.drops.push({ sp: drop, x: x+dx, z: z+dz, top: yBottom+.32+Math.random()*H*.38, bottom: yBottom-.12, speed: .65+Math.random()*.85, phase: Math.random()*6.28, scale: drop.scale.x });
        }
      }
    }
  }

  _buildWaterfalls(top, ww) {
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 128;
    const x = cv.getContext('2d');
    // вертикальные струйки: пена сверху → прозрачно книзу
    for (let i = 0; i < 28; i++) {
      const px = Math.floor(Math.random() * 64), wd = 1 + Math.random() * 2.2;
      const a = 0.4 + Math.random() * 0.4;
      const g = x.createLinearGradient(0, 0, 0, 128);
      g.addColorStop(0, 'rgba(255,255,255,' + Math.min(1, a + 0.3) + ')');   // пена-гребень
      g.addColorStop(0.3, 'rgba(214,242,255,' + a + ')');
      g.addColorStop(1, 'rgba(170,220,255,0)');                              // тает книзу
      x.fillStyle = g; x.fillRect(px, 0, wd, 128);
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(10, 1); tex.magFilter = THREE.LinearFilter;
    this._fallTex = tex;
    this._fallTextures = [{ tex, speed: 0.70 }];

    const H = ww * 0.2;   // короткий каскад, не на всю высоту
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0.5, fog: false });
    const foamMat = new THREE.MeshBasicMaterial({ color: 0xeaf6ff, transparent: true, opacity: 0.7, depthWrite: false, fog: false });
    const half = ww / 2, yTop = top + 0.25, yC = yTop - H / 2;
    const edges = [
      { x: 0, z: half, ry: 0 },
      { x: 0, z: -half, ry: Math.PI },
      { x: half, z: 0, ry: Math.PI / 2 },
      { x: -half, z: 0, ry: -Math.PI / 2 },
    ];
    // дымка-брызги у подножия каскада
    const mistCv = document.createElement('canvas'); mistCv.width = mistCv.height = 32;
    const mx = mistCv.getContext('2d');
    const mg = mx.createRadialGradient(16, 18, 1, 16, 18, 16); mg.addColorStop(0, 'rgba(255,255,255,0.75)'); mg.addColorStop(1, 'rgba(255,255,255,0)');
    mx.fillStyle = mg; mx.fillRect(0, 0, 32, 32);
    const mistTex = new THREE.CanvasTexture(mistCv);
    this._mist = []; this._falls = []; this._crests = []; this._splash = []; this._t = 0;
    for (const e of edges) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(ww, H), mat.clone());
      m.position.set(e.x, yC, e.z); m.rotation.y = e.ry; m.renderOrder = 8; this.group.add(m);
      this._falls.push({ m, y: yC, op: 0.5, phase: Math.random() * 6.28 });
      // Два внутренних слоя струй создают глубину и бегут иначе, чем внешний.
      const nx = Math.sin(e.ry), nz = Math.cos(e.ry);
      for (let layer = 1; layer <= 2; layer++) {
        const flow = tex.clone(); flow.needsUpdate = true;
        flow.repeat.set(8 + layer * 2, 1);
        this._fallTextures.push({ tex: flow, speed: 0.70 + layer * 0.30 });
        const flowMat = new THREE.MeshBasicMaterial({ map: flow, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0.32 - layer * 0.07, fog: false });
        const flowMesh = new THREE.Mesh(new THREE.PlaneGeometry(ww * (1 - layer * 0.07), H * (1 - layer * 0.055)), flowMat);
        const offset = layer * 0.07;
        flowMesh.position.set(e.x + nx * offset, yC - layer * 0.04, e.z + nz * offset);
        flowMesh.rotation.y = e.ry; flowMesh.renderOrder = 8 + layer; this.group.add(flowMesh);
        this._falls.push({ m: flowMesh, y: flowMesh.position.y, op: flowMat.opacity, phase: Math.random() * 6.28 });
      }
      // пенный гребень по кромке
      const foam = new THREE.Mesh(new THREE.BoxGeometry(ww, 0.22, 0.45), foamMat.clone());
      foam.position.set(e.x, yTop, e.z); foam.rotation.y = e.ry; this.group.add(foam);
      this._crests.push({ m: foam, op: foamMat.opacity, phase: Math.random() * 6.28 });
      // ряд мягких клубов брызг у основания
      const along = Math.abs(e.ry) > 1.0;   // ±PI/2 → кромка вдоль оси Z
      for (let k = 0; k < 7; k++) {
        const f = (k / 6 - 0.5) * ww * 0.86;
        const mm = new THREE.SpriteMaterial({ map: mistTex, transparent: true, depthWrite: false, opacity: 0.25, fog: false });
        const sp = new THREE.Sprite(mm); sp.scale.set(ww * 0.11, H * 0.55, 1);
        const bx = along ? e.x + nx * 0.22 : f, bz = along ? f : e.z + nz * 0.22;
        sp.position.set(bx, yC - H * 0.42, bz); sp.renderOrder = 12;
        this.group.add(sp); this._mist.push({ sp, ph: Math.random() * 6.28, y: sp.position.y, x: bx, z: bz });
      }
      // Крупная пена у подножия: хорошо читается даже с тактического ракурса.
      for (let k = 0; k < 3; k++) {
        const splashMat = new THREE.SpriteMaterial({ map: mistTex, transparent: true, depthWrite: false, opacity: 0.28, fog: false });
        const sp = new THREE.Sprite(splashMat);
        const f = (k / 2 - 0.5) * ww * 0.56;
        const bx = along ? e.x + nx * 0.42 : f, bz = along ? f : e.z + nz * 0.42;
        sp.scale.set(ww * 0.24, H * 0.22, 1); sp.position.set(bx, yTop - H + 0.2, bz); sp.renderOrder = 13;
        this.group.add(sp); this._splash.push({ sp, ph: Math.random() * 6.28, y: sp.position.y, x: bx, z: bz, nx, nz, sx: sp.scale.x, sy: sp.scale.y });
      }
    }
  }

  _updateWaterfallV2(dt) {
    const fx = this._waterfallV2;
    if (!fx) return;
    fx.time += dt;
    for (const mat of fx.mats) mat.uniforms.uTime.value = fx.time;
    for (const f of fx.foam) {
      const p = Math.sin(fx.time * 2.5 + f.phase);
      f.m.scale.set(1 + p * .08, 1 + Math.abs(p) * .14, 1);
      f.m.material.opacity = f.opacity + p * .11;
    }
    for (const d of fx.drops) {
      d.sp.position.y -= dt * d.speed;
      if (d.sp.position.y < d.bottom) d.sp.position.y = d.top;
      const p = Math.sin(fx.time * 6.0 + d.phase), s = d.scale * (.76 + Math.abs(p) * .45);
      d.sp.position.x = d.x + p * .055; d.sp.position.z = d.z + Math.cos(fx.time * 4.0 + d.phase) * .055;
      d.sp.scale.set(s, s * (1.15 + Math.abs(p) * .4), 1);
    }
  }

  update(dt) {
    this._updateWaterfallV2(dt);
    this._t = (this._t || 0) + dt;
    if (this._fallTextures) for (const flow of this._fallTextures) {
      flow.tex.offset.y -= dt * flow.speed;
      if (flow.tex.offset.y < -10) flow.tex.offset.y += 10;
    }
    if (this._falls) for (const fall of this._falls) {
      fall.m.position.y = fall.y + Math.sin(this._t * 2.1 + fall.phase) * 0.025;
      fall.m.material.opacity = fall.op + Math.sin(this._t * 1.7 + fall.phase) * 0.045;
    }
    if (this._crests) for (const crest of this._crests) {
      const p = 0.90 + Math.sin(this._t * 2.8 + crest.phase) * 0.10;
      crest.m.scale.z = p;
      crest.m.material.opacity = crest.op + Math.sin(this._t * 2.5 + crest.phase) * 0.10;
    }
    if (this._oceanN) { this._oceanN.offset.x += dt * 0.01; this._oceanN.offset.y += dt * 0.014; }
    if (this._mist) for (const m of this._mist) {
      const p = Math.sin(this._t * 0.8 + m.ph);
      m.sp.material.opacity = 0.12 + Math.abs(p) * 0.25;
      m.sp.position.set(m.x, m.y + p * 0.14, m.z);
    }
    if (this._splash) for (const splash of this._splash) {
      const p = Math.sin(this._t * 2.3 + splash.ph);
      splash.sp.material.opacity = 0.20 + Math.abs(p) * 0.27;
      splash.sp.position.set(splash.x + splash.nx * p * 0.13, splash.y + p * 0.08, splash.z + splash.nz * p * 0.13);
      const q = 0.88 + Math.abs(p) * 0.24; splash.sp.scale.set(splash.sx * q, splash.sy * q, 1);
    }
  }
}
