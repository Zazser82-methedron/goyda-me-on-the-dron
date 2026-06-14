// ===== RTS-камера: пан по XZ, орбита (ПКМ/Q-E), зум колесом, сглаживание =====
import * as THREE from 'three';

export class RTSCamera {
  constructor(dom) {
    this.dom = dom;
    this.camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.5, 400);

    // целевая точка взгляда (на плоскости земли) + сферическое смещение
    this.target = new THREE.Vector3(0, 0, 0);
    this.radius = 34;
    this.azimuth = Math.PI * 0.25;     // поворот вокруг Y
    this.polar = Math.PI * 0.34;       // наклон (0 = сверху)

    // сглаженные (визуальные) значения
    this._target = this.target.clone();
    this._radius = this.radius;
    this._azimuth = this.azimuth;
    this._polar = this.polar;

    this.minRadius = 8; this.maxRadius = 90;
    this.minPolar = 0.12; this.maxPolar = 1.15;

    this.keys = {};
    this.panSpeed = 26;
    this._dragging = false;
    this._lastX = 0; this._lastY = 0;

    this._bind();
  }

  _bind() {
    const dom = this.dom;
    dom.addEventListener('contextmenu', e => e.preventDefault());

    dom.addEventListener('pointerdown', (e) => {
      // ПКМ (2) или СКМ (1) — орбита/пан
      if (e.button === 2 || e.button === 1) {
        this._dragging = e.button === 2 ? 'rotate' : 'pan';
        this._lastX = e.clientX; this._lastY = e.clientY;
        dom.setPointerCapture(e.pointerId);
      }
    });
    dom.addEventListener('pointermove', (e) => {
      if (!this._dragging) return;
      const dx = e.clientX - this._lastX, dy = e.clientY - this._lastY;
      this._lastX = e.clientX; this._lastY = e.clientY;
      if (this._dragging === 'rotate') {
        this.azimuth -= dx * 0.006;
        this.polar = THREE.MathUtils.clamp(this.polar - dy * 0.005, this.minPolar, this.maxPolar);
      } else {
        this._panBy(-dx, -dy, 0.04);
      }
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
    // клавиатурный пан
    const k = this.keys;
    let mx = 0, my = 0;
    if (k['KeyW'] || k['ArrowUp']) my -= 1;
    if (k['KeyS'] || k['ArrowDown']) my += 1;
    if (k['KeyA'] || k['ArrowLeft']) mx -= 1;
    if (k['KeyD'] || k['ArrowRight']) mx += 1;
    if (mx || my) {
      const cos = Math.cos(this.azimuth), sin = Math.sin(this.azimuth);
      const sp = this.panSpeed * dt * (this.radius / 34);
      this.target.x += (mx * cos - my * sin) * sp;
      this.target.z += (mx * sin + my * cos) * sp;
    }
    if (k['KeyQ']) this.azimuth += dt * 1.2;
    if (k['KeyE']) this.azimuth -= dt * 1.2;

    // ограничим цель пределами карты (мягко)
    const lim = 60;
    this.target.x = THREE.MathUtils.clamp(this.target.x, -lim, lim);
    this.target.z = THREE.MathUtils.clamp(this.target.z, -lim, lim);

    // сглаживание
    const s = 1 - Math.pow(0.0008, dt);
    this._target.lerp(this.target, s);
    this._radius += (this.radius - this._radius) * s;
    this._azimuth += (this.azimuth - this._azimuth) * s;
    this._polar += (this.polar - this._polar) * s;

    // позиция камеры из сферических координат
    const r = this._radius, ph = this._polar, th = this._azimuth;
    const sinp = Math.sin(ph);
    this.camera.position.set(
      this._target.x + r * sinp * Math.sin(th),
      this._target.y + r * Math.cos(ph),
      this._target.z + r * sinp * Math.cos(th),
    );
    this.camera.lookAt(this._target);
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // центрировать на мировой точке
  focus(wx, wz) { this.target.set(wx, 0, wz); }
}
