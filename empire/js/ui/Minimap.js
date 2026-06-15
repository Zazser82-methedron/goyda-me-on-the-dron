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
    // фон по биому + туман войны
    const img = ctx.createImageData(w, w), d = img.data;
    for (let py = 0; py < w; py++) {
      for (let px = 0; px < w; px++) {
        const gx = Math.min(g.n - 1, Math.floor(px / sc)), gy = Math.min(g.n - 1, Math.floor(py / sc));
        const t = g.tiles[gy][gx], i = (py * w + px) * 4; d[i + 3] = 255;
        if (!t.explored) { d[i] = 8; d[i + 1] = 6; d[i + 2] = 12; continue; }
        let r = 60, gg = 110, b = 50;
        if (t.biome === 'water') { r = 30; gg = 74; b = 104; }
        else if (t.biome === 'rock') { r = 112; gg = 112; b = 122; }
        else if (t.biome === 'snow') { r = 210; gg = 220; b = 230; }
        else if (t.biome === 'sand') { r = 192; gg = 172; b = 112; }
        const dim = t.visible ? 1 : 0.5;
        d[i] = r * dim; d[i + 1] = gg * dim; d[i + 2] = b * dim;
      }
    }
    ctx.putImageData(img, 0, 0);
    for (const n of s.nodes) { const t = g.get(n.gx, n.gy); if (!t || !t.explored) continue; ctx.fillStyle = n.resType === 'wood' ? '#3a6a1e' : n.resType === 'stone' ? '#c0c0cc' : '#ffcc00'; ctx.fillRect(n.gx * sc, n.gy * sc, Math.max(1.5, sc), Math.max(1.5, sc)); }
    for (const b of s.buildings) { const t = g.get(b.gx, b.gy); if (!t || !t.explored) continue; ctx.fillStyle = b === s.townhall ? '#ffcc00' : (b.def.wonder ? '#ff00bb' : (b.def.wall ? '#7a5a2a' : '#e0b070')); ctx.fillRect(b.gx * sc, b.gy * sc, Math.max(2, b.w * sc), Math.max(2, b.h * sc)); }
    for (const u of s.units) { const gg = g.worldToGrid(u.x, u.z); const t = g.get(gg.x, gg.y); if (!t || !t.explored) continue; if (u.faction === 'enemy' && !t.visible) continue; ctx.fillStyle = u.faction === 'enemy' ? (u.bossKey ? '#ff00bb' : '#ff3030') : (u.def.worker ? '#8effa0' : '#00eeff'); ctx.fillRect(gg.x * sc - 1, gg.y * sc - 1, 2.5, 2.5); }
    const cam = this.game.cameraRig.target, cg = g.worldToGrid(cam.x, cam.z);
    ctx.strokeStyle = 'rgba(255,236,180,.7)'; ctx.lineWidth = 1;
    ctx.strokeRect(cg.x * sc - 11, cg.y * sc - 11, 22, 22);
  }
}
