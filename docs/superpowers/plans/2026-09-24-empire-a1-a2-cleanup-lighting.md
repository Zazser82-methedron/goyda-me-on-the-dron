# Империя: чистка карты (A1) и свет/пост (A2) — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Убрать бессмысленный декор с карты и перевести свет/пост-обработку с «пластиковой миниатюры» на тёплый стилизованный реализм (Tropico 6 / AoE2 DE), по `empire/GDD_2026.md` §1.3 и §2.2.

**Architecture:** Правки в трёх файлах: `world/TerrainMesh.js` (декор), `main.js` (декор у ратуши + сезонный грейд), `engine/Renderer.js` (тонмаппинг, свет, пост-проходы). Проект — статика без сборщика; кэш сбрасывается ручными `?v=N` в импортах.

**Tech Stack:** Three.js 0.160 (importmap CDN), нативные ES-модули. Тестового фреймворка нет — проверка: `node --check` + живой Playwright-скриншот до/после на `http://localhost:7842/empire/index.html` (сервер: `py -m http.server 7842` из корня репо).

---

### Task 1: Чистка процедурного декора

**Files:**
- Modify: `empire/js/world/TerrainMesh.js:225-297` (`_scatterDecor`)

- [ ] **Step 1: Скриншот «до»** — запустить партию (кнопка `#startGo`), сохранить кадр `.playwright-mcp/goyda/a1_before.png`.

- [ ] **Step 2: Переписать `_scatterDecor`** — удалить блоки `flames`, `flowers`, `dead`. Кусты — вместо конуса сплюснутая икосфера-«шапка» с вершинным шумом, в 2 раза реже. Камни — в 3 раза реже и только на биомах `rock`/`sand`. Пни — оставить, реже.

```js
  _scatterDecor(scene, grid, n) {
    // куст: икосфера с шумом вершин, сплюснута — читается как крона куста, а не как конус
    const bushGeo = new THREE.IcosahedronGeometry(0.2, 1);
    { const pa = bushGeo.attributes.position;
      for (let i = 0; i < pa.count; i++) {
        const k = 0.82 + Math.random() * 0.3;
        pa.setXYZ(i, pa.getX(i) * k, Math.max(-0.05, pa.getY(i) * k * 0.72), pa.getZ(i) * k);
      }
      bushGeo.computeVertexNormals(); }
    const rockGeo = new THREE.DodecahedronGeometry(0.16, 0);
    const dmat = () => new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 1 });
    const bn = Math.floor(n * n * 0.015), rn = Math.floor(n * n * 0.004), sn = Math.floor(n * n * 0.002);
    const bushes = new THREE.InstancedMesh(bushGeo, dmat(), bn);
    const rocks = new THREE.InstancedMesh(rockGeo, dmat(), rn);
    const stumps = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.15, 0.19, 0.22, 7), dmat(), sn);
    for (const inst of [bushes, rocks, stumps]) { inst.castShadow = false; inst.receiveShadow = true; inst.frustumCulled = false; }
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const fill = (inst, count, cA, cB, yb, sMin, sMax, biomes) => {
      let placed = 0;
      for (let attempt = 0; attempt < count * 6 && placed < count; attempt++) {
        const gx = 1 + Math.floor(Math.random() * (n - 2)), gy = 1 + Math.floor(Math.random() * (n - 2));
        const t = grid.get(gx, gy);
        if (!t || t.biome === 'water') continue;
        if (biomes && !biomes.includes(t.biome)) continue;
        const w = grid.gridToWorld(gx, gy);
        const sc = sMin + Math.random() * (sMax - sMin);
        const gy0 = grid.heightAt(w.wx, w.wz);
        p.set(w.wx + (Math.random() - 0.5) * 0.7, gy0 + yb * sc, w.wz + (Math.random() - 0.5) * 0.7);
        q.setFromAxisAngle(up, Math.random() * 6.28);
        s.set(sc, sc * (0.8 + Math.random() * 0.4), sc);
        m.compose(p, q, s); inst.setMatrixAt(placed, m);
        inst.setColorAt(placed, new THREE.Color(Math.random() < 0.5 ? cA : cB).multiplyScalar(0.85 + Math.random() * 0.3));
        placed++;
      }
      inst.count = placed;
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    };
    fill(bushes, bn, this.pal.b, this.pal.c, 0.1, 0.8, 1.5, ['grass', 'forest']);
    fill(rocks, rn, PAL.rock, PAL.rockDk, 0.08, 0.6, 1.4, ['rock', 'sand']);
    fill(stumps, sn, 0x6b5740, 0x55462f, 0.11, 0.7, 1.2, ['grass', 'forest']);
    scene.add(bushes); scene.add(rocks); scene.add(stumps);
  }
```

- [ ] **Step 3: Поднять версию** — `empire/js/main.js:10`: `TerrainMesh.js?v=102` → `?v=103`.

- [ ] **Step 4: Проверка** — `node --check empire/js/world/TerrainMesh.js` → без вывода. Скриншот `a1_after.png`: нет оранжевых огоньков, розовых конусов, коричневых кольев; кусты — округлые шапки.

### Task 2: Декор у ратуши

**Files:**
- Modify: `empire/js/main.js:532-534` (`_installHomeDetails`)

- [ ] **Step 1:** Удалить строки размещения `env_waystone` и `env_banner`, оставить только костры:

```js
    place('env_watchfire', [[-2.3, 4.4], [2.3, -4.4]], 0.88, 0.3);
```

Ветки `env_waystone`/`env_banner` в `_animateHomeDetails` станут недостижимы — удалить их тоже, оставив только ветку `env_watchfire`.

- [ ] **Step 2:** `node --check empire/js/main.js` → без вывода.

### Task 3: Свет, тонмаппинг, пост

**Files:**
- Modify: `empire/js/engine/Renderer.js` (конструктор, `setupComposer`, `resize`, `GRADE_SHADER`)
- Modify: `empire/js/main.js:1105-1108` (`_applySeason`)

- [ ] **Step 1: Тонмаппинг AgX** — в конструкторе:

```js
    this.renderer.toneMapping = THREE.AgXToneMapping;
    this.renderer.toneMappingExposure = 1.1;
```

- [ ] **Step 2: Свет** — меньше «плоской» засветки, сильнее солнце (форма читается тенью):

```js
    this.hemi = new THREE.HemisphereLight(0xcfe0f4, 0x5a6a3a, 0.9);
    ...
    this.amb = new THREE.AmbientLight(0xb8a888, 0.25);
    ...
    this.key = new THREE.DirectionalLight(0xffe8c8, 3.2);
```
Карта теней High: `this._shadowSize = low ? 1024 : 2048;`. В `setupEnvironment` компенсация: `this.hemi.intensity = 0.7; this.amb.intensity = 0.15;`.

- [ ] **Step 3: Грейд мягче** — в `GRADE_SHADER.uniforms`: `contrast 1.12→1.06`, `saturation 1.18→1.08`, `vignette 0.36→0.2`. В `main.js` `_applySeason`: `g.saturation.value = 1.08 + S.s;`.

- [ ] **Step 4: Убрать tilt-shift** — в `setupComposer` удалить создание `this.tilt` и `composer.addPass(this.tilt)`; в `resize` удалить строку с `this.tilt`; константу `TILTSHIFT_SHADER` удалить.

- [ ] **Step 5: Bloom** — `new UnrealBloomPass(new THREE.Vector2(w, h), 0.35, 0.35, 1.5)` (светятся только огонь/магия).

- [ ] **Step 6: Версии** — `main.js:3` `Renderer.js?v=99` → `?v=100`; `empire/index.html:91` `main.js?v=134` → `?v=135`.

- [ ] **Step 7: Проверка** — `node --check` для обоих файлов; скриншот `a2_after.png` с той же камеры, что `a1_before.png`. Критерии: нет размытия по краям кадра; видны тени от зданий; трава не кислотная; огонь/идолы светятся, песок и снег — нет. Если сцена темнее исходной на глаз — поднять `toneMappingExposure` шагом 0.1 и переснять.

### Task 4: Документация и коммит

- [ ] **Step 1:** В `empire/PLAN_2026.md` строку 3.3 пометить «❌ отменено — см. GDD_2026.md §2 (стилизованный реализм)».
- [ ] **Step 2:** Коммит — только после команды игрока (правило проекта):

```bash
git add empire/js/world/TerrainMesh.js empire/js/main.js empire/js/engine/Renderer.js empire/index.html empire/GDD_2026.md empire/PLAN_2026.md docs/superpowers/plans/2026-09-24-empire-a1-a2-cleanup-lighting.md
git commit -m "feat(empire): чистка декора карты, AgX-свет, без tilt-shift (GDD A1/A2)"
```
