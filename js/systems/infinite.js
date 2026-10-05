// ============================================================
// systems/infinite.js — 无限旷野（chunk 流式生成）
// ------------------------------------------------------------
// 主城（96×96 手工精品）之外是程序化生成的旷野：柔和起伏的草地、
// 散树、石头、花丛、小水塘，往任何方向走都是新的地。
// · chunk 48×48 格，seeded 随机（同一位置永远长一样的树）
// · 相机周围 5×5 chunk 常驻，超出卸载；每帧最多生成 1 个 chunk（防卡顿）
// · 每 chunk 合并成 4 个 mesh（地面/树干/树冠/石头），25 chunk ≈ 84 draw call
// · 高度场与主城在边界平滑混合（主城边缘仍是 0 平面）
// ============================================================
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PAL, hexNum } from '../palette.js';
import { WORLD, makeRng } from '../layout.js';
import { townClock } from '../clock.js';

const CHUNK = 48;
const LOAD_R = 5;    // 相机所在 chunk 周围加载半径（格数 5*48=240）
const UNLOAD_R = 7;  // 超出即卸载

// 每 chunk 的 seed：由 chunk 坐标决定（同位置永远同内容）
function chunkRng(cx, cz) {
  let h = (cx * 73856093) ^ (cz * 19349663) ^ 0x9e3779b9;
  return makeRng(h >>> 0);
}

/** 旷野高度：柔和起伏；主城边界 [48,64] 区间与 0 平滑混合 */
function wildHeight(x, z) {
  let h = Math.sin(x * 0.045) * Math.cos(z * 0.038) * 1.5
        + Math.sin((x + z) * 0.021) * 0.9
        + Math.cos(x * 0.013 - z * 0.017) * 0.6;
  const far = Math.max(Math.abs(x), Math.abs(z));
  if (far < 64) {
    const t = Math.max(0, Math.min(1, (64 - far) / 16)); // 主城侧压平
    h *= (1 - t);
  }
  return h;
}

/** chunk 是否与主城重叠（主城手工区 [-48,48] 不生成） */
function overlapsTown(cx, cz) {
  const x0 = cx * CHUNK, z0 = cz * CHUNK;
  return x0 < WORLD.HALF && x0 + CHUNK > -WORLD.HALF &&
         z0 < WORLD.HALF && z0 + CHUNK > -WORLD.HALF;
}

// —— 共享材质（四季 retint 用的色键）——
const matGround = new THREE.MeshLambertMaterial({ color: hexNum('grassA') });
const matTrunk = new THREE.MeshLambertMaterial({ color: hexNum('trunk') });
const matLeaf = new THREE.MeshLambertMaterial({ color: hexNum('treeDeep') });
const matRock = new THREE.MeshLambertMaterial({ color: hexNum('rock') });
const matWater = new THREE.MeshLambertMaterial({
  color: hexNum('waterFace'), emissive: hexNum('waterDeep'), emissiveIntensity: 0.35,
});
// 棋盘暗草：第二个地面材质（与 matGround 拼盘）
const matGroundB = new THREE.MeshLambertMaterial({ color: hexNum('grassB') });

// 四季换色时同步这些 chunk 材质（seasons.js 的 retint 走 palette 缓存，
// 这里独立材质要手动跟随）
const SEASON_TINTS = {
  spring: { grassA: '#5aa06a', grassB: '#4a905c', treeDeep: '#4a8a5a', trunk: '#5a4636' },
  summer: { grassA: '#3f6d5a', grassB: '#35604f', treeDeep: '#2f5d46', trunk: '#5a4636' },
  autumn: { grassA: '#9a8a4a', grassB: '#847438', treeDeep: '#a86038', trunk: '#5a4636' },
  winter: { grassA: '#c8d4e0', grassB: '#a8b8cc', treeDeep: '#b0bece', trunk: '#5a4636' },
};
export function retintInfinite(season) {
  const t = SEASON_TINTS[season] || SEASON_TINTS.summer;
  matGround.color.set(t.grassA);
  matGroundB.color.set(t.grassB);
  matLeaf.color.set(t.treeDeep);
}

// —— 几何工具：把一批 box 烘进合并几何 ————————————
const _boxGeo = new THREE.BoxGeometry(1, 1, 1);
const _m4 = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();

function bake(geos, cx, cy, cz, w, h, d) {
  _quat.identity();
  _m4.compose(_pos.set(cx, cy, cz), _quat, _scale.set(w, h, d));
  const g = _boxGeo.clone();
  g.applyMatrix4(_m4);
  geos.push(g);
}

// ------------------------------------------------------------
// 生成一个 chunk 的 Group
// ------------------------------------------------------------
function buildChunk(cx, cz) {
  const rng = chunkRng(cx, cz);
  const group = new THREE.Group();
  group.name = `chunk-${cx}-${cz}`;

  const groundA = [], groundB = [], trunks = [], leaves = [], rocks = [], waters = [];
  const x0 = cx * CHUNK, z0 = cz * CHUNK;

  // —— 地面（4×4 大格，棋盘双色）——
  const cell = 4;
  for (let gx = 0; gx < CHUNK; gx += cell) {
    for (let gz = 0; gz < CHUNK; gz += cell) {
      const wx = x0 + gx + cell / 2, wz = z0 + gz + cell / 2;
      const h = wildHeight(wx, wz);
      const arr = ((gx / cell + gz / cell) % 2 === 0) ? groundA : groundB;
      bake(arr, wx, h - 1.6, wz, cell, 2.0, cell);
    }
  }

  // —— 小水塘（~25% chunk 有一个，低洼处）——
  if (rng() < 0.25) {
    const px = x0 + 8 + rng() * (CHUNK - 16);
    const pz = z0 + 8 + rng() * (CHUNK - 16);
    const r = 4 + rng() * 4;
    const base = wildHeight(px, pz);
    for (let dx = -r; dx < r; dx += 2) {
      for (let dz = -r; dz < r; dz += 2) {
        if (dx * dx + dz * dz > r * r) continue;
        bake(waters, px + dx, base + 0.1, pz + dz, 2, 0.5, 2);
      }
    }
  }

  // —— 散树（圆蓬 + 杉混合；离主城近处稀一点）——
  const treeCount = 8 + Math.floor(rng() * 8);
  for (let i = 0; i < treeCount; i++) {
    const tx = x0 + 2 + rng() * (CHUNK - 4);
    const tz = z0 + 2 + rng() * (CHUNK - 4);
    // 水塘里不长树（简单按水塘中心距离）
    const th = wildHeight(tx, tz);
    const s = 0.8 + rng() * 0.6;
    const pine = rng() < 0.4;
    if (pine) {
      bake(trunks, tx, th + 0.9 * s, tz, 0.8 * s, 1.8 * s, 0.8 * s);
      bake(leaves, tx, th + 2.3 * s, tz, 3.2 * s, 1.2 * s, 3.2 * s);
      bake(leaves, tx, th + 3.3 * s, tz, 2.3 * s, 1.0 * s, 2.3 * s);
      bake(leaves, tx, th + 4.2 * s, tz, 1.4 * s, 0.9 * s, 1.4 * s);
    } else {
      bake(trunks, tx, th + 1.3 * s, tz, 0.9 * s, 2.6 * s, 0.9 * s);
      bake(leaves, tx, th + 3.6 * s, tz, 3.6 * s, 1.6 * s, 3.6 * s);
      bake(leaves, tx, th + 4.9 * s, tz, 2.4 * s, 1.2 * s, 2.4 * s);
    }
  }

  // —— 石头 + 花丛点缀 ——
  const nRock = 2 + Math.floor(rng() * 4);
  for (let i = 0; i < nRock; i++) {
    const rx = x0 + rng() * CHUNK, rz = z0 + rng() * CHUNK;
    const s = 0.8 + rng() * 1.6;
    bake(rocks, rx, wildHeight(rx, rz) + s * 0.25, rz, s, s * 0.6, s);
  }
  const flowerCols = [hexNum('flowerRed'), hexNum('flowerYel'), hexNum('flowerBlu')];
  // 花丛走发光材质不划算，混进 rocks 用亮色材质：单独一个 merged mesh
  const flowers = [];
  const nFlower = 3 + Math.floor(rng() * 5);
  for (let i = 0; i < nFlower; i++) {
    const fx = x0 + rng() * CHUNK, fz = z0 + rng() * CHUNK;
    const fh = wildHeight(fx, fz);
    for (let k = 0; k < 3; k++) {
      bake(flowers, fx + (rng() - 0.5) * 2, fh + 0.2, fz + (rng() - 0.5) * 2, 0.4, 0.4, 0.4);
    }
  }

  // —— 合并挂载（带数据的才建）——
  function attach(geos, mat, shadow = true) {
    if (!geos.length) return;
    const merged = mergeGeometries(geos, false);
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = shadow;
    mesh.receiveShadow = shadow;
    group.add(mesh);
  }
  attach(groundA, matGround, false);
  attach(groundB, matGroundB, false);
  attach(waters, matWater, false);
  attach(trunks, matTrunk);
  attach(leaves, matLeaf);
  attach(rocks, matRock);
  attach(flowers, new THREE.MeshLambertMaterial({ color: flowerCols[Math.floor(rng() * 3)] }));

  return group;
}

// ------------------------------------------------------------
// 管理器
// ------------------------------------------------------------
export function buildInfinite(scene) {
  const loaded = new Map(); // key "cx,cz" -> Group
  const pending = [];       // 待生成队列（每帧最多 1 个，防卡顿）
  let lastCamChunk = null;
  let checkAcc = 0;
  let lastSeason = null;

  function key(cx, cz) { return cx + ',' + cz; }

  function tick(dt, t) {
    // 四季换色（跟 townClock.season）
    if (townClock.season !== lastSeason) {
      lastSeason = townClock.season;
      retintInfinite(lastSeason);
    }
    // 每 0.4s 重估一次相机位置（平移时才需要）
    checkAcc += dt;
    if (checkAcc >= 0.4) {
      checkAcc = 0;
      const cam = _camRef;
      const ccx = Math.floor(cam.position.x / CHUNK);
      const ccz = Math.floor(cam.position.z / CHUNK);
      const k = key(ccx, ccz);
      if (k !== lastCamChunk) {
        lastCamChunk = k;
        // 计算需要的 chunk 集
        const want = new Set();
        for (let dx = -LOAD_R; dx <= LOAD_R; dx++) {
          for (let dz = -LOAD_R; dz <= LOAD_R; dz++) {
            const cx = ccx + dx, cz = ccz + dz;
            if (overlapsTown(cx, cz)) continue;
            if (dx * dx + dz * dz > (LOAD_R + 0.5) * (LOAD_R + 0.5)) continue;
            want.add(key(cx, cz));
            if (!loaded.has(key(cx, cz)) && !pending.some(p => p.k === key(cx, cz))) {
              pending.push({ k: key(cx, cz), cx, cz });
            }
          }
        }
        // 卸载超远的
        for (const [k2, g] of loaded) {
          if (!want.has(k2)) {
            scene.remove(g);
            g.traverse(o => { if (o.geometry) o.geometry.dispose(); });
            loaded.delete(k2);
          }
        }
      }
    }
    // 每帧最多生成 1 个 chunk
    if (pending.length) {
      const job = pending.shift();
      if (!loaded.has(job.k)) {
        const g = buildChunk(job.cx, job.cz);
        scene.add(g);
        loaded.set(job.k, g);
      }
    }
  }

  return {
    tick,
    stats: () => ({ chunks: loaded.size, pending: pending.length }),
    _setCam(c) { _camRef = c; },
  };
}

let _camRef = null;
