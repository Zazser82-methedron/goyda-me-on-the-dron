// ===== Менеджер ассетов: GLB через GLTFLoader + кэш + фолбэк на плейсхолдер =====
// Геймплей играбелен ДО появления GLB — get() всегда возвращает что-то.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildPlaceholder } from './Placeholders.js?v=94';

export class AssetManager {
  constructor() {
    this.loader = new GLTFLoader();
    this.proto = {};      // name -> Object3D прототип (GLB-сцена или плейсхолдер)
    this.isGlb = {};      // name -> true если загружен реальный GLB
    this.base = './assets/models/';
    this.ver = '?v=98';   // кэш-бастер для GLB — бампится вместе со всеми ?v, чтобы новые модели доезжали до игрока
  }

  // Попытаться загрузить GLB; молча падаем на плейсхолдер.
  load(name) {
    return new Promise((resolve) => {
      this.loader.load(
        this.base + name + '.glb' + this.ver,
        (gltf) => {
          const root = gltf.scene;
          root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
          this.proto[name] = root;
          this.isGlb[name] = true;
          resolve(true);
        },
        undefined,
        () => { resolve(false); }   // нет файла — оставим плейсхолдер
      );
    });
  }

  // Предзагрузка списка (параллельно). Возвращает кол-во реально найденных GLB.
  async preload(names) {
    const r = await Promise.all(names.map(n => this.load(n)));
    return r.filter(Boolean).length;
  }

  _protoFor(name) {
    if (!this.proto[name]) this.proto[name] = buildPlaceholder(name);
    return this.proto[name];
  }

  // Новый инстанс модели (клон — геометрия/материалы шарятся).
  get(name) {
    const inst = this._protoFor(name).clone(true);
    return inst;
  }

  usingPlaceholder(name) { return !this.isGlb[name]; }
}
