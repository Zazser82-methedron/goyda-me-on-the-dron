// ===== Миникарта: ноды, постройки, юниты, рамка обзора =====
export class Minimap {
  constructor(game) {
    this.game = game;
    this.cv = document.getElementById('minimap');
    this.ctx = this.cv ? this.cv.getContext('2d') : null;
    this.t = 0;
    if (this.cv) this.cv.addEventListener('pointerdown', (e) => this._jump(e));
  }

  _jump(e) {
    const g = this.game.state.grid;
    const r = this.cv.getBoundingClientRect();
    const gx = ((e.clientX - r.left) / r.width) * g.n;
    const gy = ((e.clientY - r.top) / r.height) * g.n;
    const w = g.gridToWorld(Math.floor(gx), Math.floor(gy));
    this.game.cameraRig.focus(w.wx, w.wz);
  }

  update(dt) {
    if (!this.ctx) return;
    this.t += dt; if (this.t < 0.18) return; this.t = 0;
    this.draw();
  }

  draw() {
    const s = this.game.state, g = s.grid, w = this.cv.width, sc = w / g.n, ctx = this.ctx;
    ctx.fillStyle = '#0a0604'; ctx.fillRect(0, 0, w, w);
    for (const n of s.nodes) {
      ctx.fillStyle = n.resType === 'wood' ? '#3a6a1e' : n.resType === 'stone' ? '#9a9aa6' : '#ffcc00';
      ctx.fillRect(n.gx * sc, n.gy * sc, Math.max(1.5, sc), Math.max(1.5, sc));
    }
    for (const b of s.buildings) {
      ctx.fillStyle = b === s.townhall ? '#ffcc00' : (b.def.wonder ? '#ff00bb' : (b.def.wall ? '#7a5a2a' : '#d0a060'));
      ctx.fillRect(b.gx * sc, b.gy * sc, Math.max(2, b.w * sc), Math.max(2, b.h * sc));
    }
    for (const u of s.units) {
      const gg = g.worldToGrid(u.x, u.z);
      ctx.fillStyle = u.faction === 'enemy' ? (u.bossKey ? '#ff00bb' : '#ff3030') : (u.def.worker ? '#8effa0' : '#00eeff');
      ctx.fillRect(gg.x * sc - 1, gg.y * sc - 1, 2.5, 2.5);
    }
    const t = this.game.cameraRig.target, cg = g.worldToGrid(t.x, t.z);
    ctx.strokeStyle = 'rgba(255,236,180,.7)'; ctx.lineWidth = 1;
    ctx.strokeRect(cg.x * sc - 11, cg.y * sc - 11, 22, 22);
  }
}
