// ============================================================
// builders/yard.js — 民宅院子系统（开放式，不围死）
// ------------------------------------------------------------
// 每栋民居的院落点缀：石板小径 + 两侧花圃 + 局部矮栅栏 + 信箱，
// 再按 yard 风格加主题件（picket/garden/orchard/waterside/minimal）。
// 局部坐标与 house.js 一致：房中心原点、门朝 +z。
// 院子是开放式的（只有 L 形短栅栏），避免把摊开的住宅区重新围挤。
// ============================================================
import { vox } from '../voxel.js';
import { terrainHeight, HOUSES, makeRng } from '../layout.js';

// —— 通用件 ——————————————————————————

/** 矮栅栏段（从 (x0,z) 到 (x1,z) 沿 x；或竖排 axis='z'） */
function fenceRun(x0, z0, x1, z1) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.max(2, Math.round(len / 1.2));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const px = x0 + (x1 - x0) * t, pz = z0 + (z1 - z0) * t;
    vox.boxC(px - 0.13, 0, pz - 0.13, 0.26, 1.15, 0.26, 'woodMid');
    vox.boxC(px - 0.08, 1.15, pz - 0.08, 0.16, 0.14, 0.16, 'woodDark'); // 桩尖帽
  }
  // 两道横条（沿走向铺薄板）
  const segs = Math.max(1, Math.round(len / 2));
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs, t1 = (i + 1) / segs;
    const cx = (x0 + (x1 - x0) * (t0 + t1) / 2), cz = (z0 + (z1 - z0) * (t0 + t1) / 2);
    const ang = Math.atan2(x1 - x0, z1 - z0);
    vox.boxRotY(cx, 0.35, cz, len / segs + 0.15, 0.14, 0.14, 'woodLight', -ang * 180 / Math.PI);
    vox.boxRotY(cx, 0.85, cz, len / segs + 0.15, 0.14, 0.14, 'woodLight', -ang * 180 / Math.PI);
  }
}

/** 石板小径（从门口到院口，棋盘跳格） */
function stonePath(zFrom, zTo) {
  let i = 0;
  for (let z = zFrom; z <= zTo; z += 1.1, i++) {
    vox.boxC(-0.65 + (i % 2) * 0.18, 0.02, z, 1.3, 0.1, 0.85, i % 2 ? 'roadLit' : 'roadDark');
  }
}

/** 花圃（木框 + 两色花团） */
function flowerBed(x, z, { w = 3.2, d = 2.0 } = {}) {
  const cols = ['flowerRed', 'flowerYel', 'flowerBlu'];
  vox.boxC(x - w / 2, 0, z - d / 2, w, 0.3, d, 'fieldDark');       // 泥土
  vox.boxC(x - w / 2 - 0.12, 0, z - d / 2 - 0.12, w + 0.24, 0.42, 0.24, 'woodMid'); // 框（前后）
  vox.boxC(x - w / 2 - 0.12, 0, z + d / 2 - 0.12, w + 0.24, 0.42, 0.24, 'woodMid');
  vox.boxC(x - w / 2 - 0.12, 0, z - d / 2, 0.24, 0.42, d, 'woodMid');               // 框（左右）
  vox.boxC(x + w / 2 - 0.12, 0, z - d / 2, 0.24, 0.42, d, 'woodMid');
  const n = Math.floor(w / 1.0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < 2; j++) {
      vox.boxC(x - w / 2 + 0.55 + i * 1.0, 0.34, z - d / 2 + 0.55 + j * (d - 1.1), 0.55, 0.4, 0.55,
        cols[(i + j) % 3]);
    }
  }
}

/** 信箱（院口小径旁） */
function mailBox(x, z, roofC) {
  vox.boxC(x, 0, z, 0.22, 1.15, 0.22, 'woodDark');
  vox.boxC(x - 0.32, 1.15, z - 0.28, 0.85, 0.6, 0.62, roofC);
  vox.boxC(x - 0.32, 1.75, z - 0.28, 0.85, 0.12, 0.62, 'woodDark');
  vox.boxC(x - 0.3, 1.4, z + 0.05, 0.1, 0.1, 0.1, 'metal'); // 前盖钉
}

/** 小树（普通绿冠） */
function yardTree(x, z) {
  vox.boxC(x - 0.4, 0, z - 0.4, 0.8, 2.4, 0.8, 'trunk');
  vox.boxC(x - 1.4, 2.4, z - 1.4, 2.8, 1.4, 2.8, 'treeDeep');
  vox.boxC(x - 1.0, 3.8, z - 1.0, 2.0, 1.0, 2.0, 'treeLite');
  vox.boxC(x - 0.5, 4.8, z - 0.5, 1.0, 0.7, 1.0, 'treeDeep');
}

/** 果树（带果） */
function fruitTree(x, z) {
  yardTree(x, z);
  vox.boxC(x + 1.1, 3.0, z + 0.6, 0.4, 0.4, 0.4, 'flowerRed');
  vox.boxC(x - 0.9, 3.4, z + 0.9, 0.4, 0.4, 0.4, 'flowerYel');
  vox.boxC(x + 0.3, 4.2, z - 0.9, 0.4, 0.4, 0.4, 'flowerRed');
}

// —— 风格主题件 ——————————————————————————

function propsPicket(rng, roofC) {
  // 门前对称两盆柏 + 一棵小树
  vox.boxC(-2.9, 0, 8.2, 0.75, 0.65, 0.75, 'roofRed');
  vox.boxC(-2.9, 0.65, 8.2, 0.55, 1.1, 0.55, 'treeLite');
  vox.boxC(2.9, 0, 8.2, 0.75, 0.65, 0.75, 'roofRed');
  vox.boxC(2.9, 0.65, 8.2, 0.55, 1.1, 0.55, 'treeLite');
  yardTree(-7.2, -2.5);
  // 尖桩栅栏加密（前院两翼 L 形）
  fenceRun(-5.6, 6.2, -9.4, 6.2);
  fenceRun(-9.4, 6.2, -9.4, 1.4);
  fenceRun(5.6, 6.2, 9.4, 6.2);
  fenceRun(9.4, 6.2, 9.4, 1.4);
}

function propsGarden() {
  // 两条菜垄（右侧，避小径与信箱）+ 南瓜 + 洒水壶
  for (const rz of [7.2, 9.0]) {
    vox.boxC(1.8, 0, rz, 2.8, 0.28, 0.9, 'fieldWheat');
    vox.boxC(1.8, 0.28, rz, 2.8, 0.3, 0.55, 'clothC'); // 菜苗排
    for (let i = 0; i < 3; i++) vox.boxC(1.25 + i * 0.95, 0.58, rz, 0.3, 0.28, 0.3, 'bush');
  }
  vox.boxC(6.4, 0, 7.8, 0.9, 0.7, 0.9, 'fieldWheat');   // 南瓜
  vox.boxC(6.4, 0.7, 7.8, 0.7, 0.22, 0.7, 'flowerYel');
  vox.boxC(7.4, 0, 6.9, 0.65, 0.55, 0.65, 'fieldWheat');
  vox.boxC(6.0, 0, 6.2, 0.4, 0.5, 0.4, 'metal');        // 洒水壶
  vox.boxC(5.8, 0.5, 6.2, 0.14, 0.3, 0.14, 'metal');
  fenceRun(-5.6, 6.2, -8.8, 6.2);
  fenceRun(5.6, 6.2, 8.8, 6.2);
}

function propsOrchard() {
  fruitTree(-6.6, 9.8);
  fruitTree(6.6, 9.8);
  // 迷你草垛 + 木凳
  vox.boxC(-6.9, 0, -3.2, 1.9, 1.3, 1.9, 'fieldWheat');
  vox.boxC(-6.9, 1.3, -3.2, 1.3, 0.8, 1.3, 'fieldDark');
  vox.boxC(6.4, 0, -3.4, 1.7, 0.14, 0.55, 'woodMid');
  vox.boxC(5.7, 0, -3.5, 0.16, 0.55, 0.4, 'woodDark');
  vox.boxC(7.0, 0, -3.5, 0.16, 0.55, 0.4, 'woodDark');
  fenceRun(-5.6, 6.2, -9.0, 6.2);
  fenceRun(5.6, 6.2, 9.0, 6.2);
}

function propsWaterside() {
  // 系船桩 + 缆绳 + 渔网晾框 + 浮标桶（右侧前院，避花圃小径）
  vox.boxC(2.6, 0, 8.8, 0.34, 1.5, 0.34, 'woodDark');
  vox.boxC(4.8, 0, 8.8, 0.34, 1.5, 0.34, 'woodDark');
  vox.boxC(3.7, 1.28, 8.8, 2.2, 0.1, 0.1, 'awningCream'); // 缆绳
  // 渔网框（两立柱 + 横梁 + 网格）
  vox.boxC(5.2, 0, 7.0, 0.24, 2.4, 0.24, 'woodMid');
  vox.boxC(7.4, 0, 7.0, 0.24, 2.4, 0.24, 'woodMid');
  vox.boxC(6.3, 2.3, 7.0, 2.4, 0.2, 0.2, 'woodMid');
  for (let i = 1; i < 4; i++) vox.boxC(5.2 + i * 0.55, 0.35, 7.02, 0.08, 1.9, 0.08, 'awningCream');
  vox.boxC(6.3, 1.2, 7.02, 2.3, 0.07, 0.07, 'awningCream');
  // 浮标桶（红白条纹）
  vox.boxC(-5.0, 0, 10.2, 0.85, 0.55, 0.85, 'awningCream');
  vox.boxC(-5.0, 0.55, 10.2, 0.85, 0.28, 0.85, 'awningRed');
  vox.boxC(-5.0, 0.83, 10.2, 0.6, 0.18, 0.6, 'awningCream');
  // 小鱼干晒架（两根竹 + 挂着的鱼）
  vox.boxC(3.4, 0, -3.0, 0.16, 1.5, 0.16, 'woodLight');
  vox.boxC(4.6, 0, -3.0, 0.16, 1.5, 0.16, 'woodLight');
  vox.boxC(4.0, 1.42, -3.0, 1.4, 0.09, 0.09, 'woodLight');
  vox.boxC(3.8, 1.0, -3.0, 0.16, 0.5, 0.3, 'clothB');
  vox.boxC(4.25, 1.05, -3.0, 0.16, 0.45, 0.26, 'clothC');
}

function propsMinimal() {
  // 低配院：两盆栽 + 低晾衣绳 + 一段短栅栏
  vox.boxC(-4.6, 0, 7.4, 0.8, 0.7, 0.8, 'roofRed');
  vox.boxC(-4.6, 0.7, 7.4, 0.6, 0.9, 0.6, 'bush');
  vox.boxC(4.6, 0, 7.4, 0.8, 0.7, 0.8, 'roofRed');
  vox.boxC(4.6, 0.7, 7.4, 0.6, 0.9, 0.6, 'bush');
  vox.boxC(-6.8, 0, 1.4, 0.16, 2.0, 0.16, 'metal');
  vox.boxC(-6.8, 2.0, 1.4, 0.12, 0.1, 3.4, 'metal');
  vox.boxC(-6.8, 1.3, 0.4, 0.06, 0.7, 0.5, 'awningCream'); // 挂着的布
  vox.boxC(-6.8, 1.35, 1.8, 0.06, 0.65, 0.45, 'clothB');
  fenceRun(5.4, 6.2, 8.2, 6.2);
}

const PROPS = {
  picket: propsPicket,
  garden: propsGarden,
  orchard: propsOrchard,
  waterside: propsWaterside,
  minimal: propsMinimal,
};

// ------------------------------------------------------------
// 主入口：给每栋民居建院子
// ------------------------------------------------------------
export function buildYards() {
  const rng = makeRng(4242);
  for (const cfg of HOUSES) {
    const gy = terrainHeight(cfg.x, cfg.z);
    vox.pushTransform(cfg.x, gy, cfg.z, cfg.rot);
    const roofC = cfg.roofC ?? 'roofRed';

    // 公共：小径 + 院口信箱 + 门旁花圃
    stonePath(5.4, 10.6);
    mailBox(2.1, 10.6, roofC);
    flowerBed(-5.4, 7.8);
    flowerBed(5.4, 5.0, { w: 2.4, d: 1.8 });

    // 风格主题件
    const props = PROPS[cfg.yard] ?? propsPicket;
    props(rng, roofC);

    vox.popTransform();
  }
  return [];
}
