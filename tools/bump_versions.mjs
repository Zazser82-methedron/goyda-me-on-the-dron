// Каскадный кэш-бастинг для empire/: импорты вида './x.js?v=N'. Если файл изменён (git: изменён или новый
// относительно HEAD), каждому, кто его импортирует, поднимается ?v= на этот импорт; сам импортёр от этого
// тоже меняется — и так до index.html (main.js?v=). Ручной подъём версий по цепочке раньше не раз
// забывался и оставлял игрокам закэшированные старые модули.
// Запуск из корня репо: node tools/bump_versions.mjs            — поднять
//                        node tools/bump_versions.mjs --dry      — только показать
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const ROOT = path.resolve('empire');
const DRY = process.argv.includes('--dry');
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (e.name !== 'assets') walk(p); }
    else if (/\.(js|html)$/.test(e.name)) files.push(p);
  }
})(ROOT);

const rel = (p) => path.relative(process.cwd(), p).replace(/\\/g, '/');
const status = execFileSync('git', ['status', '--porcelain', '--', 'empire'], { encoding: 'utf8' });
const changed = new Set(status.split('\n').filter(Boolean).map(l => path.resolve(l.slice(3).trim())).filter(p => /\.(js)$/.test(p)));

const IMPORT = /(['"])(\.{1,2}\/[^'"?]+\.js)\?v=(\d+)\1/g;
const queue = [...changed];
const done = new Set();
const edits = {};
while (queue.length) {
  const target = queue.shift();
  if (done.has(target)) continue;
  done.add(target);
  for (const f of files) {
    const src = edits[f] ?? fs.readFileSync(f, 'utf8');
    let hit = false;
    const out = src.replace(IMPORT, (m, q, spec, v) => {
      if (path.resolve(path.dirname(f), spec) !== target) return m;
      hit = true;
      return `${q}${spec}?v=${Number(v) + 1}${q}`;
    });
    if (hit) {
      edits[f] = out;
      console.log(`${rel(f)}  ← ${rel(target)}`);
      if (!done.has(f)) queue.push(f);
    }
  }
}
if (!DRY) for (const [f, s] of Object.entries(edits)) fs.writeFileSync(f, s);
console.log(DRY ? '(dry run)' : `поднято в ${Object.keys(edits).length} файлах`);
