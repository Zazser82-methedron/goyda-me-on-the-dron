// ===== RTS-камера: пан по XZ, орбита (ПКМ/Q-E), зум колесом, сглаживание =====
import * as THREE from 'three';
import { GRID_N, TILE } from '../data/config.js?v=81';

export class RTSCamera {
  constructor(dom) {
    this.dom = dom;
    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.5, 700);

    // целевая точка взгляда (на плоскости земли) + сферическое смещение
    this.target = new THREE.Vector3(0, 0, 0);
    this.radius = 52;
    this.azimuth = Math.PI * 0.25;     // поворот вокруг Y
    this.polar = Math.PI * 0.38;       // наклон (0 = сверху)

    // сглаженные (визуальные) значения
    this._target = this.target.clone();
    this._radius = this.radius;
    this._azimuth = this.azimuth;
    this._polar = this.polar;

    this.trauma = 0;                       // тряска камеры: 0..1, плавно спадает (удары/взрывы/босс)
    this._lookTmp = new THREE.Vector3();

    this.minRadius = 8; this.maxRadius = 200;
    this.minPolar = 0.12; this.maxPolar = 1.42;   // ниже наклон — видно край мира и слонов
    this.limit = GRID_N * TILE * 0.5 + 6;   // предел панорамирования под карту

    this.keys = {};
    this.panSpeed = 46;
    this._dragging = false;
    this._lastX = 0; this._lastY = 0;

    this._bind();
  }

  _bind() {
    const dom = this.dom;
    dom.addEventListener('contextmenu', e => e.preventDefault());

    dom.addEventListener('pointerdown', (e) => {
      if (e.button === 1) {   // СКМ — орбита камеры (ПКМ свободна под команды)
        e.preventDefault();
        this._dragging = 'rotate';
        this._lastX = e.clientX; this._lastY = e.clientY;
        dom.setPointerCapture(e.pointerId);
      }
    });
    dom.addEventListener('pointermove', (e) => {
      if (!this._dragging) return;
      const dx = e.clientX - this._lastX, dy = e.clientY - this._lastY;
      this._lastX = e.clientX; this._lastY = e.clientY;
      this.azimuth -= dx * 0.006;
      this.polar = THREE.MathUtils.clamp(this.polar - dy * 0.005, this.minPolar, this.maxPolar);
    });
    const end = (e) => { if (this._dragging) { this._dragging = false; try { dom.releasePointerCapture(e.pointerId); } catch (_) {} } };
    dom.addEventListener('pointerup', end);
    dom.addEventListener('pointercancel', end);

    dom.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.radius = THREE.MathUtils.clamp(this.radius * (1 + Math.sign(e.deltaY) * 0.12), this.minRadius, this.maxRadius);
    }, { passive: false });

    window.addEventListener('keydown', e => { this.keys[e.code] = true; });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });
  }

  // смещение цели в плоскости земли с учётом текущего азимута
  _panBy(sx, sy, scale) {
    const f = scale * (this.radius / 34);
    const cos = Math.cos(this.azimuth), sin = Math.sin(this.azimuth);
    // экранный X -> мировой (право), экранный Y -> мировой (вперёд по земле)
    this.target.x += (sx * cos - sy * sin) * f;
    this.target.z += (sx * sin + sy * cos) * f;
  }

  update(dt) {
    // WASD — экранно-относительно: w вперёд (от камеры), s назад, a влево, d вправо
    const k = this.keys;
    let f = 0, r = 0;
    if (k['KeyW'] || k['ArrowUp']) f += 1;
    if (k['KeyS'] || k['ArrowDown']) f -= 1;
    if (k['KeyD'] || k['ArrowRight']) r += 1;
    if (k['KeyA'] || k['ArrowLeft']) r -= 1;
    if (f || r) {
      const az = this.azimuth;
      // вперёд (в экран, от камеры) и вправо на плоскости земли
      const fx = -Math.sin(az), fz = -Math.cos(az);
      const rx = Math.cos(az), rz = -Math.sin(az);
      const sp = this.panSpeed * dt * (this.radius / 40);
      this.target.x += (f * fx + r * rx) * sp;
      this.target.z += (f * fz + r * rz) * sp;
    }
    if (k['KeyQ']) this.azimuth += dt * 1.2;
    if (k['KeyE']) this.azimuth -= dt * 1.2;

    // ограничим цель пределами карты (мягко)
    const lim = this.limit;
    this.target.x = THREE.MathUtils.clamp(this.target.x, -lim, lim);
    this.target.z = THREE.MathUtils.clamp(this.target.z, -lim, lim);

    // сглаживание
    const s = 1 - Math.pow(0.0008, dt);
    this._target.lerp(this.target, s);
    this._radius += (this.radius - this._radius) * s;
    this._azimuth += (this.azimuth - this._azimuth) * s;
    this._polar += (this.polar - this._polar) * s;

    // позиция камеры из сферических координат
    const rad = this._radius, ph = this._polar, th = this._azimuth;
    const sinp = Math.sin(ph);
    this.camera.position.set(
      this._target.x + rad * sinp * Math.sin(th),
      this._target.y + rad * Math.cos(ph),
      this._target.z + rad * sinp * Math.cos(th),
    );
    // тряска камеры (trauma² — резкий пик, мягкий спад); масштаб ~ зум, чтобы не укачивало вблизи
    if (this.trauma > 0) {
      const s = this.trauma * this.trauma, tt = performance.now() * 0.001, amp = 0.5 + rad * 0.012;
      const ox = Math.sin(tt * 47) * s * amp, oy = Math.sin(tt * 59 + 1.7) * s * amp * 0.8;
      this.camera.position.x += ox; this.camera.position.y += oy;
      this._lookTmp.set(this._target.x + ox * 0.4, this._target.y, this._target.z + oy * 0.4);
      this.camera.lookAt(this._lookTmp);
      this.trauma = Math.max(0, this.trauma - dt * 1.8);
    } else {
      this.camera.lookAt(this._target);
    }
  }

  // добавить тряску (накапливается, кап 1) — зовётся из ctx.shake
  addShake(a) { this.trauma = Math.min(1, this.trauma + a); }

  // тач: drag-пан «схватить карту» (dx,dy в пикселях, с учётом азимута) и pinch-зум
  panDrag(dx, dy) {
    const f = this.radius / 480, cos = Math.cos(this.azimuth), sin = Math.sin(this.azimuth);
    this.target.x -= (dx * cos - dy * sin) * f;
    this.target.z -= (dx * sin + dy * cos) * f;
  }
  zoomBy(f) { this.radius = THREE.MathUtils.clamp(this.radius * f, this.minRadius, this.maxRadius); }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // центрировать на мировой точке
  focus(wx, wz) { this.target.set(wx, 0, wz); }
}
