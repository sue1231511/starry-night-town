// ============================================================
// systems/effects.js — 环境粒子：烟囱烟 / 喷泉水花 / 萤火虫
// ------------------------------------------------------------
// 三类粒子各自用一个 InstancedMesh（单 draw call），
// 用缩放/位移实现体素游戏式的出现与消失，不依赖透明排序。
// builders 在建模期调用 register* 登记。
// ============================================================
import * as THREE from 'three';
import { WORLD, riverZ, RIVER_HALF_W, makeRng } from '../layout.js';

// ------------------------------------------------------------
// 登记表（builders 建模时写入）
// ------------------------------------------------------------
const chimneys = [];   // { x, y, z, rate }
const fountains = [];  // { x, y, z, radius }

export function registerChimney(c) { chimneys.push(c); }
export function registerFountain(f) { fountains.push(f); }

/** 剧情用：全部烟囱冒烟速率加倍（面包房开炉） */
export function boostChimneys(mult = 1.8, seconds = 30) {
  chimneys.forEach(c => { c.rate *= mult; });
  setTimeout(() => {
    chimneys.forEach(c => { c.rate /= mult; });
  }, seconds * 1000);
}

/** 通用实例池：一个 InstancedMesh + 每帧重排矩阵 */
function makeInstancePool(scene, count, geoSize, colorHex, { dynamic = true } = {}) {
  const geo = new THREE.BoxGeometry(geoSize, geoSize, geoSize);
  const mat = new THREE.MeshBasicMaterial({ color: colorHex });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.instanceMatrix.setUsage(dynamic ? THREE.DynamicDrawUsage : THREE.StaticDrawUsage);
  scene.add(mesh);
  const m = new THREE.Matrix4();
  const zero = new THREE.Matrix4().makeScale(0.0001, 0.0001, 0.0001);
  for (let i = 0; i < count; i++) mesh.setMatrixAt(i, zero);
  return { mesh, m };
}

const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _eul = new THREE.Euler();
const _scl = new THREE.Vector3();

// ------------------------------------------------------------
// 烟囱烟：每根烟囱一串循环上升的方块（先胖后瘦消失）
// ------------------------------------------------------------
function makeSmoke(scene) {
  const PER = 5;
  const count = chimneys.length * PER;
  const pool = makeInstancePool(scene, count, 1, 0x8a8fa8);

  const puffs = [];
  let i = 0;
  for (const c of chimneys) {
    for (let k = 0; k < PER; k++) {
      // dur 不固化：tick 动态读 c.rate（支持 boostChimneys 剧情加速）
      puffs.push({ i: i++, c, t: (k / PER) * (6 / c.rate), seed: c.x * 0.7 + k * 1.3 });
    }
  }

  return function tickSmoke(dt, t) {
    for (const p of puffs) {
      const dur = 6 / p.c.rate;
      p.t += dt;
      if (p.t >= dur) p.t -= dur;
      const k = p.t / dur;
      const rise = 4.2 * k;
      const sway = Math.sin(t * 0.8 + p.seed) * 0.35 + k * 1.2; // 夜风往东送
      const size = 0.55 + Math.sin(k * Math.PI) * 0.85;
      _pos.set(p.c.x + sway, p.c.y + rise, p.c.z + Math.cos(t * 0.6 + p.seed) * 0.25);
      _eul.set(0, k * 1.2, 0);
      _quat.setFromEuler(_eul);
      _scl.setScalar(size);
      pool.m.compose(_pos, _quat, _scl);
      pool.mesh.setMatrixAt(p.i, pool.m);
    }
    pool.mesh.instanceMatrix.needsUpdate = true;
  };
}

// ------------------------------------------------------------
// 喷泉水花：顶盘沿抛物线洒落的亮块
// ------------------------------------------------------------
function makeFountainDrops(scene) {
  const PER = 16; // 数量收敛：密集小亮块=闪烁源
  const count = fountains.length * PER;
  const pool = makeInstancePool(scene, count, 1, 0xaad4ff);

  const drops = [];
  let i = 0;
  const rng = makeRng(808);
  for (const f of fountains) {
    for (let k = 0; k < PER; k++) {
      drops.push({
        i: i++, f,
        angle: (k / PER) * Math.PI * 2 + rng() * 0.4,
        speed: 1.6 + rng() * 1.2,
        t: rng() * 1.4,
      });
    }
  }

  _quat.identity();

  return function tickFountain(dt) {
    for (const d of drops) {
      d.t += dt;
      const life = 1.4;
      if (d.t >= life) {
        d.t -= life;
        d.angle += 0.7; // 下一圈换方向
        d.speed = 1.6 + rng() * 1.2;
      }
      const k = d.t / life;
      const r = d.f.radius + d.speed * k * 2.4;
      const y = d.f.y + 1.7 * k - 4.6 * k * k;
      _pos.set(d.f.x + Math.cos(d.angle) * r, y, d.f.z + Math.sin(d.angle) * r);
      _scl.setScalar(0.32 * (1 - k * 0.4));
      pool.m.compose(_pos, _quat, _scl);
      pool.mesh.setMatrixAt(d.i, pool.m);
    }
    pool.mesh.instanceMatrix.needsUpdate = true;
  };
}

// ------------------------------------------------------------
// 萤火虫：河畔 + 树冠附近的游走亮块，呼吸明灭
// ------------------------------------------------------------
function makeFireflies(scene, rng, treeTops) {
  // 数量与闪幅收敛：低分辨率下密集快闪=噪点（晕动源）
  const COUNT = 18;
  const pool = makeInstancePool(scene, COUNT, 1, 0xffd88a);

  const GROUPS = [];
  for (let i = 0; i < 5; i++) {
    const fx = (rng() - 0.5) * 2 * (WORLD.HALF - 8);
    GROUPS.push({ x: fx, y: 1.6 + rng() * 1.4, z: riverZ(fx) + (rng() < 0.5 ? -1 : 1) * (RIVER_HALF_W + 1.5 + rng() * 2) });
  }
  if (treeTops) {
    for (let i = 0; i < treeTops.length; i += 6) {
      const tt = treeTops[i];
      GROUPS.push({ x: tt.x, y: tt.y + 3.6 + rng() * 1.6, z: tt.z });
    }
  }

  const flies = [];
  for (let i = 0; i < COUNT; i++) {
    const g = GROUPS[Math.floor(rng() * GROUPS.length)];
    flies.push({
      i, g,
      ox: (rng() - 0.5) * 5, oy: (rng() - 0.5) * 2.4, oz: (rng() - 0.5) * 5,
      w1: 0.5 + rng() * 1.4, w2: 0.4 + rng() * 1.2, w3: 0.5 + rng() * 1.3,
      p1: rng() * 7, p2: rng() * 7, p3: rng() * 7,
      blinkSpeed: 0.5 + rng() * 1.0, blinkPhase: rng() * Math.PI * 2,
    });
  }

  _quat.identity();

  return function tickFireflies(dt, t) {
    for (const f of flies) {
      const x = f.g.x + f.ox + Math.sin(t * f.w1 + f.p1) * 1.6;
      const y = f.g.y + f.oy + Math.sin(t * f.w2 + f.p2) * 0.8;
      const z = f.g.z + f.oz + Math.cos(t * f.w3 + f.p3) * 1.6;
      _pos.set(x, y, z);
      // 呼吸幅度减半：明暗过渡平缓，不再「跳」
      const b = 0.5 + 0.5 * Math.sin(t * f.blinkSpeed + f.blinkPhase);
      _scl.setScalar(0.12 + b * 0.12);
      pool.m.compose(_pos, _quat, _scl);
      pool.mesh.setMatrixAt(f.i, pool.m);
    }
    pool.mesh.instanceMatrix.needsUpdate = true;
  };
}

// ------------------------------------------------------------
// 总装
// ------------------------------------------------------------
export function buildAmbientFx(scene, rng, treeTops = []) {
  const ticks = [];
  if (chimneys.length) ticks.push(makeSmoke(scene));
  if (fountains.length) ticks.push(makeFountainDrops(scene));
  ticks.push(makeFireflies(scene, rng, treeTops));
  return function tickEffects(dt, t) {
    for (const fn of ticks) fn(dt, t);
  };
}
