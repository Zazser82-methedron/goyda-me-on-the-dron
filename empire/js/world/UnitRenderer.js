// ===== Инстансный рендер юнитов =====
// Было: у каждого юнита свой Object3D-клон GLB (5-8 сабмешей = 5-8 draw call) + отдельный Mesh тени-пятна
// + отдельный Sprite шеврона ветерана — на 301 юните это и есть ~2500 draw calls, узкое место рендера.
// Стало: на КАЖДУЮ пару (модель × сабмеш) — один THREE.InstancedMesh, общий на всех юнитов этой модели
// (все GLB юнитов — плоские мультиматериальные меши без скелета/анимации, primitives:materials = 1:1,
// см. разведку в assets/models/*.glb — это и делает подход применимым без изменения ассетов).
// Плюс один InstancedMesh на тень-пятно (все юниты) и по одному на 3 уровня шеврона ветерана.
// Тело/тень/шеврон КАЖДЫЙ КАДР перезаписываются с нуля из state.units (см. beginFrame/writeUnit/endFrame) —
// поэтому никакого учёта «слотов» на споне/смерти не нужно: юнит просто перестаёт попадать в стройку кадра.
import * as THREE from 'three';

// Запас с большим потолком: стресс-тест (engine/Profiler.js __stress) спавнит raider/raider_fast/raider_heavy,
// а это ВСЕ ТРИ — одна и та же GLB-модель enemy_raider (см. data/units.js), т.е. при n=301 почти вся орда
// может оказаться в ОДНОЙ модельной группе. Капы ниже — с большим запасом сверх заявленных 301, не впритык.
const MAX_PER_MODEL = 500;   // ёмкость instanceMatrix на одну модель
const MAX_TOTAL = 650;       // ёмкость общего пула теней (все юниты разом, любых моделей)
const MAX_VETS = 80;         // ёмкость на один уровень шеврона (★/★★/★★★)
const BOB_RATE = 16.0;       // рад/сек — темп бобра ходьбы (соответствует старому CPU: now[мс]*0.016)

export class UnitRenderer {
  constructor(scene, assets) {
    this.scene = scene;
    this.assets = assets;
    this.groups = {};            // modelName -> { subs:[{inst}], phaseAttr, walkAttr, count, slots:[], provisional }
    this._fieldsCache = null;    // кэш пикинг-полей для Picker.entityUnder (сбрасывается при пересборке группы)
    this.timeUniform = { value: 0 };

    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this._c = new THREE.Color();
    this._camQ = new THREE.Quaternion();
    this._vetCount = [0, 0, 0];

    this._buildShadow();
    this._buildVetMarkers();
  }

  // ---------- сборка инстансных групп юнита (лениво, по первому обращению) ----------
  _ensureGroup(modelName) {
    let g = this.groups[modelName];
    const haveGlb = !this.assets.usingPlaceholder(modelName);
    if (g && (!g.provisional || !haveGlb)) return g;
    if (g) this._disposeGroup(modelName);   // GLB подъехал после плейсхолдера — пересобрать с реальной моделью

    const proto = this.assets._protoFor(modelName);
    proto.updateMatrixWorld(true);
    const subs = [];
    const phaseAttr = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PER_MODEL), 1).setUsage(THREE.DynamicDrawUsage);
    const walkAttr = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PER_MODEL), 1).setUsage(THREE.DynamicDrawUsage);
    proto.traverse((o) => {
      if (!o.isMesh) return;
      const geo = o.geometry.clone();
      geo.applyMatrix4(o.matrixWorld);            // запечь локальный оффсет сабмеша относительно корня прототипа
      // clone() тащит закэшированную boundingSphere/Box ДО оффсета — без пересчёта raycast мимо клика
      // (сабмеш смещён от центра, а старая сфера маленькая и не по месту). Отсюда неточный пикинг юнитов.
      geo.computeBoundingSphere();
      geo.computeBoundingBox();
      geo.setAttribute('aInstancePhase', phaseAttr);
      geo.setAttribute('aWalkAmp', walkAttr);
      const mat = o.material;
      this._injectWalkBob(mat);
      const inst = new THREE.InstancedMesh(geo, mat, MAX_PER_MODEL);
      inst.castShadow = false;                     // как и раньше — юниты дают только блоб-тень, не в shadow-map
      inst.receiveShadow = true;
      inst.count = 0;
      inst.frustumCulled = false;                  // инстансы двигаются каждый кадр — держим bbox не в кэше
      inst.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PER_MODEL * 3).fill(1), 3);
      this.scene.add(inst);
      subs.push({ inst });
    });
    g = { subs, phaseAttr, walkAttr, count: 0, slots: [], provisional: !haveGlb };
    this.groups[modelName] = g;
    this._fieldsCache = null;
    return g;
  }

  _disposeGroup(modelName) {
    const g = this.groups[modelName];
    if (!g) return;
    for (const sub of g.subs) { this.scene.remove(sub.inst); sub.inst.geometry.dispose(); }
    delete this.groups[modelName];
  }

  // вертексный сдвиг Y-походки: uTime — общий uniform (та же ссылка у всех материалов),
  // aInstancePhase — уникальная случайная фаза на инстанс, aWalkAmp — амплитуда (0 когда юнит не идёт).
  _injectWalkBob(mat) {
    const timeUniform = this.timeUniform;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = timeUniform;
      shader.vertexShader =
        'attribute float aInstancePhase;\nattribute float aWalkAmp;\nuniform float uTime;\n' +
        shader.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           transformed.y += abs(sin(uTime * ${BOB_RATE.toFixed(1)} + aInstancePhase)) * aWalkAmp;`
        );
    };
    mat.customProgramCacheKey = () => 'goyda-unit-walkbob-v1';
  }

  // ---------- тень-пятно (общая на всех юнитов) ----------
  _buildShadow() {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const cx = cv.getContext('2d'); const grad = cx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(0,0,0,0.5)'); grad.addColorStop(0.65, 'rgba(0,0,0,0.26)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
    cx.fillStyle = grad; cx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(cv);
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);   // сразу лежит горизонтально — инстанс-матрице не нужен поворот
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.55, fog: true });
    this.shadowInst = new THREE.InstancedMesh(geo, mat, MAX_TOTAL);
    this.shadowInst.renderOrder = 2;
    this.shadowInst.count = 0;
    this.shadowInst.frustumCulled = false;
    this.scene.add(this.shadowInst);
  }

  // ---------- шевроны ветеранов: 3 InstancedMesh (по числу звёзд), билборд к камере ----------
  _buildVetMarkers() {
    this.vet = [];
    for (let lv = 1; lv <= 3; lv++) {
      const cv = document.createElement('canvas'); cv.width = 40 * lv; cv.height = 44;
      const cx = cv.getContext('2d');
      cx.font = 'bold 30px serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
      for (let s = 0; s < lv; s++) {
        const x = 20 + s * 40;
        cx.lineWidth = 5; cx.strokeStyle = 'rgba(30,14,0,0.92)'; cx.strokeText('★', x, 24);
        cx.fillStyle = '#ffd84a'; cx.fillText('★', x, 24);
      }
      const tex = new THREE.CanvasTexture(cv); tex.magFilter = THREE.LinearFilter;
      const geo = new THREE.PlaneGeometry(0.3 * lv, 0.3);
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false, fog: false });
      const inst = new THREE.InstancedMesh(geo, mat, MAX_VETS);
      inst.count = 0; inst.renderOrder = 6; inst.frustumCulled = false;
      this.scene.add(inst);
      this.vet.push(inst);
    }
  }

  // ---------- покадровая запись ----------
  // camera — для билборда шевронов; timeSec — для GPU-бобра походки (секунды, монотонно).
  beginFrame(camera, timeSec) {
    this.timeUniform.value = timeSec;
    if (camera) camera.getWorldQuaternion(this._camQ);
    for (const k in this.groups) this.groups[k].count = 0;
    this._shadowCount = 0;
    this._vetCount[0] = this._vetCount[1] = this._vetCount[2] = 0;
  }

  // u — юнит (нужны u.id и u.def.model) либо совместимый по форме объект (unit-death fx).
  // pickable=false — для «трупов» (fx падения): они дорисовываются ещё 0.5с, но кликом их выбрать нельзя,
  // как и раньше (старый код явно обнулял userData.entity в момент смерти).
  writeUnit(u, px, py, pz, rx, ry, rz, sx, sy, sz, tint, walkAmp, pickable = true) {
    const g = this._ensureGroup(u.def.model);
    const i = g.count;
    if (i >= MAX_PER_MODEL) return;             // переполнение — юнит просто не рисуется, без краша
    g.count = i + 1;
    g.slots[i] = pickable ? u : null;
    this._p.set(px, py, pz);
    this._e.set(rx, ry, rz, 'XYZ');
    this._q.setFromEuler(this._e);
    this._s.set(sx, sy, sz);
    this._m.compose(this._p, this._q, this._s);
    this._c.set(tint != null ? tint : 0xffffff);
    g.phaseAttr.array[i] = (u.id * 1.7) % 6.28318;
    g.walkAttr.array[i] = walkAmp || 0;
    for (const sub of g.subs) { sub.inst.setMatrixAt(i, this._m); sub.inst.setColorAt(i, this._c); }
  }

  writeShadow(px, pz, gy, scale) {
    const i = this._shadowCount;
    if (i >= MAX_TOTAL) return;
    this._shadowCount = i + 1;
    this._p.set(px, gy + 0.04, pz);
    this._m.compose(this._p, IDENTITY_Q, this._s.set(scale, scale, scale));
    this.shadowInst.setMatrixAt(i, this._m);
  }

  writeVet(level, px, py, pz) {
    const lv = Math.min(3, Math.max(1, level | 0));
    const idx = lv - 1;
    const i = this._vetCount[idx];
    if (i >= MAX_VETS) return;
    this._vetCount[idx] = i + 1;
    this._p.set(px, py, pz);
    this._m.compose(this._p, this._camQ, ONE_SCALE);
    this.vet[idx].setMatrixAt(i, this._m);
  }

  endFrame() {
    for (const k in this.groups) {
      const g = this.groups[k];
      for (const sub of g.subs) {
        sub.inst.count = g.count;
        sub.inst.instanceMatrix.needsUpdate = true;
        sub.inst.instanceColor.needsUpdate = true;
        // У InstancedMesh своя АГРЕГИРОВАННАЯ boundingSphere (по всем инстансам разом) — отдельная от
        // geometry.boundingSphere. Считается лениво один раз при первом обращении и с тех пор НЕ обновляется
        // сама, хотя instanceMatrix двигается каждый кадр. THREE.InstancedMesh.raycast() грубо отсеивает луч
        // именно по ней ДО проверки отдельных инстансов — со протухшей (нулевой на старте) сферой почти любой
        // клик отсеивается ещё до реальной проверки. frustumCulled=false здесь не помогает — это про рендер,
        // raycast — отдельный путь. Юниты двигаются каждый кадр → пересчитываем каждый кадр, это и есть
        // реальная причина «нельзя выбрать юнита кликом».
        sub.inst.computeBoundingSphere();
      }
      g.phaseAttr.needsUpdate = true;
      g.walkAttr.needsUpdate = true;
    }
    this.shadowInst.count = this._shadowCount;
    this.shadowInst.instanceMatrix.needsUpdate = true;
    for (let idx = 0; idx < 3; idx++) {
      const inst = this.vet[idx];
      inst.count = this._vetCount[idx];
      inst.instanceMatrix.needsUpdate = true;
    }
  }

  // ---------- пикинг ----------
  // Поля в формате, понятном Picker.entityUnder(camera, pickables, fields): {inst, nodeAt(instanceId)}.
  pickFields() {
    if (this._fieldsCache) return this._fieldsCache;
    const out = [];
    for (const k in this.groups) {
      const g = this.groups[k];
      for (const sub of g.subs) out.push({ inst: sub.inst, nodeAt: (id) => g.slots[id] || null });
    }
    this._fieldsCache = out;
    return out;
  }

  getUnitAtInstance(mesh, instanceId) {
    for (const k in this.groups) {
      const g = this.groups[k];
      if (g.subs.some((s) => s.inst === mesh)) return g.slots[instanceId] || null;
    }
    return null;
  }
}

const IDENTITY_Q = new THREE.Quaternion();
const ONE_SCALE = new THREE.Vector3(1, 1, 1);
