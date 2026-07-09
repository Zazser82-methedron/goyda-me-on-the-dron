// ===== Атмосфера: дым из труб, искры кузницы, птицы, облака, ночные светлячки =====
// Дёшево: спрайты с собственной прозрачностью (дым/искры/облака) + один Points на светлячков.
import * as THREE from 'three';

function radialTex(c0, c1) {
  const s = 64, cv = document.createElement('canvas'); cv.width = cv.height = s;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, c0); g.addColorStop(1, c1);
  ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(cv); t.needsUpdate = true; return t;
}

// высота «трубы» по типу здания (с чего поднимается дым)
const SMOKE_Y = { izba: 1.35, kuznica: 1.6, townhall: 3.1, ambar: 1.4 };

export class Atmosphere {
  constructor(scene, grid, mapKey, tier) {
    this.scene = scene; this.grid = grid; this.mapKey = mapKey;
    this.neon = mapKey === 'neon';
    this.low = tier === 'low';   // меньше частиц/птиц/светлячков на слабом железе
    this._smokeT = 0; this._sparkT = 0;
    this._smokeTex = radialTex('rgba(196,196,202,0.85)', 'rgba(196,196,202,0)');
    this._sparkTex = radialTex('rgba(255,228,150,1)', 'rgba(255,120,20,0)');
    this._cloudTex = radialTex('rgba(255,255,255,0.92)', 'rgba(255,255,255,0)');
    this._dustTex = radialTex('rgba(170,150,116,0.7)', 'rgba(170,150,116,0)');
    this._buildSmoke(); this._buildSparks(); this._buildDust(); this._buildBurst(); this._buildBirds(); this._buildClouds(); this._buildFireflies();
  }

  _pool(tex, n, blend) {
    const arr = [];
    for (let i = 0; i < n; i++) {
      const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0, blending: blend || THREE.NormalBlending, fog: true });
      const sp = new THREE.Sprite(m); sp.scale.setScalar(0.01); sp.visible = false; sp.renderOrder = 12;
      this.scene.add(sp); arr.push({ sp, life: 0, max: 1, vx: 0, vz: 0, vy: 0 });
    }
    return arr;
  }
  _buildSmoke() { this.smoke = this._pool(this._smokeTex, this.low ? 14 : 38); }
  _buildSparks() { this.sparks = this._pool(this._sparkTex, this.low ? 8 : 20, THREE.AdditiveBlending); }
  _buildDust() { this.dust = this._pool(this._dustTex, this.low ? 10 : 26); }
  _buildBurst() { this.burstPool = this._pool(this._sparkTex, this.low ? 20 : 46, THREE.AdditiveBlending); }

  // вспышка-фонтан частиц (стройка готова / гибель врага / сбор ресурса). Зовётся через ctx.burst.
  burst(x, y, z, color = 0xffd060, count = 12) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * 6.28, sp = 1 + Math.random() * 2.6;
      this._emit(this.burstPool, x, y, z,
        { life: 0.45 + Math.random() * 0.4, vx: Math.cos(a) * sp, vy: 1.2 + Math.random() * 1.9, vz: Math.sin(a) * sp, op: 1, sc: 0.17, sc1: 0.03, col: color });
    }
  }

  // пыль из-под ног идущих юнитов (зовётся из main render-loop, троттлинг там же)
  spawnDust(x, y, z) {
    this._emit(this.dust, x, y + 0.05, z,
      { life: 0.6 + Math.random() * 0.3, vx: (Math.random() - 0.5) * 0.3, vy: 0.25 + Math.random() * 0.2, vz: (Math.random() - 0.5) * 0.3, op: 0.4, sc: 0.18, sc1: 0.52, col: 0xb09668 });
  }

  // общий спад частицы-спрайта (gravity>0 — падающие искры; иначе мягкое затухание)
  _decay(pool, fdt, gravity) {
    for (const p of pool) {
      if (p.life <= 0) continue;
      p.life -= fdt; const t = 1 - p.life / p.max;
      if (gravity) p.vy -= gravity * fdt;
      p.sp.position.x += p.vx * fdt; p.sp.position.y += p.vy * fdt; p.sp.position.z += p.vz * fdt;
      p.sp.scale.setScalar(p._sc0 + (p._sc1 - p._sc0) * t);
      p.sp.material.opacity = p._op * (gravity ? (1 - t) : (1 - t) * (1 - t));
      if (p.life <= 0) { p.sp.visible = false; p.sp.material.opacity = 0; }
    }
  }

  _buildClouds() {
    this.clouds = [];
    const half = this.grid.n * 0.5;
    const tint = this.neon ? new THREE.Color(0x9a6cff) : new THREE.Color(0xffffff);
    for (let i = 0; i < (this.low ? 3 : 6); i++) {
      const m = new THREE.SpriteMaterial({ map: this._cloudTex, transparent: true, depthWrite: false, opacity: 0.16 + Math.random() * 0.1, color: tint, fog: false });
      const sp = new THREE.Sprite(m);
      const sc = 10 + Math.random() * 12; sp.scale.set(sc * 1.6, sc, 1);
      sp.position.set((Math.random() - 0.5) * half * 2, 20 + Math.random() * 8, (Math.random() - 0.5) * half * 2);
      sp.renderOrder = 5; this.scene.add(sp);
      this.clouds.push({ sp, spd: 0.25 + Math.random() * 0.35, half });
    }
  }

  _buildBirds() {
    this.birds = [];
    const mat = new THREE.MeshBasicMaterial({ color: this.neon ? 0x301a44 : 0x20242c, fog: true });
    const half = this.grid.n * 0.4;
    for (let i = 0; i < (this.low ? 3 : 7); i++) {
      const g = new THREE.Group();
      const wl = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.18), mat);
      const wr = wl.clone(); wl.position.x = -0.26; wr.position.x = 0.26;
      g.add(wl, wr); g.renderOrder = 8; this.scene.add(g);
      this.birds.push({
        g, wl, wr,
        cx: (Math.random() - 0.5) * half, cz: (Math.random() - 0.5) * half,   // МИРОВОЙ центр круга (не камера!)
        a: Math.random() * 6.28, r: 6 + Math.random() * 10, h: 10 + Math.random() * 7,
        spd: (0.09 + Math.random() * 0.12) * (Math.random() < 0.5 ? 1 : -1),    // разные направления вращения
        flap: Math.random() * 6.28, flapSpd: 7 + Math.random() * 4, glide: 0,
        driftA: Math.random() * 6.28, driftR: 5 + Math.random() * 6,
      });
    }
  }

  _buildFireflies() {
    const N = this.low ? 16 : 42; this.ffN = N;
    const pos = new Float32Array(N * 3);
    this._ffVel = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 30; pos[i * 3 + 1] = 0.4 + Math.random() * 1.6; pos[i * 3 + 2] = (Math.random() - 0.5) * 30;
      this._ffVel[i * 3] = (Math.random() - 0.5) * 0.4; this._ffVel[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this._ffGeo = g;
    const mat = new THREE.PointsMaterial({ color: this.neon ? 0xff66dd : 0xffe066, size: 0.22, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    this.fireflies = new THREE.Points(g, mat); this.fireflies.frustumCulled = false; this.fireflies.renderOrder = 14;
    this.scene.add(this.fireflies);
  }

  _emit(pool, x, y, z, opt) {
    const p = pool.find(q => q.life <= 0); if (!p) return;
    p.life = p.max = opt.life;
    p.sp.position.set(x, y, z);
    p.vx = opt.vx; p.vy = opt.vy; p.vz = opt.vz;
    p.sp.material.opacity = opt.op; p.sp.material.color.setHex(opt.col);
    p.sp.scale.setScalar(opt.sc); p.sp.visible = true;
    p._op = opt.op; p._sc0 = opt.sc; p._sc1 = opt.sc1;
  }

  update(fdt, now, buildings, target, night) {
    night = Math.max(0, Math.min(1, night || 0));
    // источники дыма/искр из текущих построек
    const chimneys = [], forges = [];
    for (const b of buildings) {
      if (!b.built) continue;
      if (SMOKE_Y[b.kind] !== undefined) chimneys.push({ x: b.cx, y: (b.cy || 0) + SMOKE_Y[b.kind], z: b.cz });
      if (b.kind === 'kuznica') forges.push({ x: b.cx, y: (b.cy || 0) + 0.5, z: b.cz });
    }

    // дым
    this._smokeT -= fdt;
    if (chimneys.length && this._smokeT <= 0) {
      this._smokeT = 0.16;
      const s = chimneys[(Math.random() * chimneys.length) | 0];
      this._emit(this.smoke, s.x + (Math.random() - 0.5) * 0.12, s.y, s.z + (Math.random() - 0.5) * 0.12,
        { life: 2.6 + Math.random() * 1.4, vx: (Math.random() - 0.5) * 0.2 + 0.12, vy: 0.55 + Math.random() * 0.25, vz: (Math.random() - 0.5) * 0.2, op: 0.5, sc: 0.28, sc1: 1.1, col: 0xc4c4ca });
    }
    this._decay(this.smoke, fdt, 0);
    this._decay(this.dust, fdt, 0);

    // искры кузницы
    this._sparkT -= fdt;
    if (forges.length && this._sparkT <= 0) {
      this._sparkT = 0.05 + Math.random() * 0.07;
      const f = forges[(Math.random() * forges.length) | 0];
      for (let k = 0; k < 2; k++) this._emit(this.sparks, f.x, f.y, f.z,
        { life: 0.5 + Math.random() * 0.4, vx: (Math.random() - 0.5) * 1.6, vy: 1.4 + Math.random() * 1.2, vz: (Math.random() - 0.5) * 1.6, op: 1, sc: 0.13, sc1: 0.04, col: 0xffd060 });
    }
    this._decay(this.sparks, fdt, 4.5);   // гравитация
    this._decay(this.burstPool, fdt, 4.0);

    // птицы — кочуют по МИРУ (центр круга медленно дрейфует), машут/планируют. НЕ привязаны к камере.
    for (const b of this.birds) {
      b.a += b.spd * fdt; b.driftA += fdt * 0.04;
      // иногда сложить крылья и планировать (пауза взмахов) — живее
      b.glide -= fdt;
      if (b.glide <= 0 && Math.random() < fdt * 0.15) b.glide = 0.8 + Math.random() * 1.4;
      if (b.glide <= 0) b.flap += fdt * b.flapSpd;
      const ox = Math.cos(b.driftA) * b.driftR, oz = Math.sin(b.driftA * 0.8) * b.driftR;
      const x = b.cx + ox + Math.cos(b.a) * b.r;
      const z = b.cz + oz + Math.sin(b.a) * b.r;
      const y = b.h + Math.sin(b.flap * 0.13) * 0.7 - night * 2;
      b.g.position.set(x, y, z);
      b.g.rotation.y = -b.a + (b.spd < 0 ? Math.PI : 0);     // нос по ходу
      const fl = b.glide > 0 ? 0.25 : Math.sin(b.flap) * 0.7; // планирование — крылья почти ровно
      b.wl.rotation.z = fl; b.wr.rotation.z = -fl;
      b.g.rotation.x = Math.cos(b.a) * 0.14 * (b.spd < 0 ? -1 : 1);   // крен на вираже
      b.g.visible = night < 0.75;   // на ночь прячутся
    }

    // облака — медленно дрейфуют, заворачиваются
    for (const c of this.clouds) {
      c.sp.position.x += c.spd * fdt;
      if (c.sp.position.x > c.half + 14) c.sp.position.x = -c.half - 14;
    }

    // светлячки — видны ночью, бродят вокруг камеры
    const ffOp = Math.max(0, night - 0.35) * 0.9;
    this.fireflies.material.opacity = ffOp;
    if (ffOp > 0.01) {
      const arr = this._ffGeo.attributes.position.array, V = this._ffVel;
      for (let i = 0; i < this.ffN; i++) {
        const j = i * 3;
        V[j] += (Math.random() - 0.5) * 0.6 * fdt; V[j + 2] += (Math.random() - 0.5) * 0.6 * fdt;
        V[j] *= 0.96; V[j + 2] *= 0.96;
        arr[j] += V[j] * fdt * 6; arr[j + 2] += V[j + 2] * fdt * 6;
        arr[j + 1] = 0.4 + Math.abs(Math.sin(now * 0.001 + i * 1.3)) * 1.5;
        const dx = arr[j] - target.x, dz = arr[j + 2] - target.z;   // держим у камеры
        if (dx * dx + dz * dz > 22 * 22) { arr[j] = target.x + (Math.random() - 0.5) * 24; arr[j + 2] = target.z + (Math.random() - 0.5) * 24; }
      }
      this._ffGeo.attributes.position.needsUpdate = true;
    }
  }
}
