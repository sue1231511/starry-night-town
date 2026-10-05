// ============================================================
// builders/landmarks.js — 新地标：水车磨坊（河边）/ 树屋（北坡）
// ------------------------------------------------------------
// 水车是动态件（环状叶片慢转，一半沉进河里）；
// 树屋 = 巨树 + 悬在树冠的小木屋 + 绳梯 + 木质天桥。
// ============================================================
import * as THREE from 'three';
import { vox, dynBoxTo } from '../voxel.js';
import { registerBuilding, terrainHeight, riverZ, RIVER_HALF_W } from '../layout.js';

// ------------------------------------------------------------
// 水车磨坊：贴南岸，水道引河水推轮
// ------------------------------------------------------------
export function buildWaterMill(scene, { x = -38, z = null } = {}) {
  const rz = riverZ(x);
  const zBank = rz + RIVER_HALF_W + 2.2;          // 南岸建筑位置
  const gy = terrainHeight(x, zBank);
  const updaters = [];

  const group = new THREE.Group();
  group.position.set(x, gy, zBank);
  group.rotation.y = 0;                            // 门朝 +z（南），水轮朝 -z（河）
  scene.add(group);
  vox.pushTransform(x, gy, zBank, 0);

  // —— 小磨坊主体（石+木混筑，比风车矮胖）——
  const W = 7, D = 6.5, H = 4.4;
  vox.boxC(-W / 2 - 0.5, -0.4, -D / 2 - 0.5, W + 1.0, 0.4, D + 1.0, 'rockDark');
  vox.boxC(-W / 2, 0, -D / 2, W, H, D, 'wallSlate');
  // 木横带 + 角柱
  vox.boxC(-W / 2 - 0.15, H - 0.9, -D / 2 - 0.15, W + 0.3, 0.4, D + 0.3, 'woodDark');
  for (const px of [-W / 2, W / 2 - 0.6]) {
    for (const pz of [-D / 2, D / 2 - 0.6]) {
      vox.boxC(px, 0, pz, 0.6, H, 0.6, 'woodMid');
    }
  }
  // 门 + 门灯 + 台阶
  vox.boxC(-1.0, 0, D / 2 - 0.05, 2.0, 2.8, 0.35, 'woodMid');
  vox.boxC(-1.0, 3.0, D / 2 + 0.1, 2.4, 0.3, 0.7, 'roofRed');
  vox.windowBox(1.35, 3.3, D / 2 + 0.3, 0.45, 0.45, 0.45, 'lampGlow');
  vox.boxC(-1.3, -0.2, D / 2 + 0.5, 2.6, 0.22, 0.9, 'roadLit');
  // 侧窗 ×2 + 阁楼小窗
  vox.windowBox(-W / 2 - 0.12, 1.6, 0, 0.25, 1.4, 1.4, 'winWarm');
  vox.windowBox(W / 2 + 0.12, 1.6, 0, 0.25, 1.4, 1.4, 'winWarm');
  vox.windowBox(-0.5, 4.6, D / 2 + 0.12, 1.0, 1.0, 0.25, 'winWarm');
  // 四坡顶
  vox.boxC(-W / 2 - 0.7, H + 0.1, -D / 2 - 0.7, W + 1.4, 0.8, D + 1.4, 'roofRed');
  vox.boxC(-W / 2 + 0.9, H + 0.9, -D / 2 + 0.9, W - 1.8, 0.8, D - 1.8, 'roofRed');
  vox.boxC(-0.8, H + 1.7, -0.8, 1.6, 0.7, 1.6, 'roofDark');
  // 顶饰：小麦束风标
  vox.boxC(0, H + 2.4, 0, 0.16, 1.1, 0.16, 'metal');
  vox.boxC(0.45, H + 3.0, 0, 0.7, 0.45, 0.1, 'fieldWheat');

  // —— 河侧（-z）：引水石槽 + 支撑架 ——
  const wheelZ = rz + 1.2; // 水轮中心（一半在水面上）
  // 石槽从建筑底部伸向河面
  vox.boxC(-1.6, 1.0, -D / 2 - 1.3, 3.2, 0.5, 2.6, 'rock');
  vox.boxC(-1.3, 0.5, -D / 2 - 2.4, 2.6, 0.5, 0.6, 'rock');
  // 轮轴支架（两侧 A 型）
  for (const sx of [-2.1, 1.5]) {
    vox.boxC(sx, 0, wheelZ - 0.6, 0.5, 4.6, 0.5, 'woodDark');
    vox.boxC(sx + 0.4, 0, wheelZ + 0.6, 0.5, 4.6, 0.5, 'woodDark');
    vox.boxC(sx + 0.2, 4.2, wheelZ, 1.3, 0.4, 1.9, 'woodMid');
  }
  vox.popTransform();

  // —— 大水轮（动态：8 组辐条+轮缘叶片，慢转）——
  const wheel = new THREE.Group();
  wheel.position.set(x, gy + 3.4, wheelZ);
  scene.add(wheel);
  // 中轴
  const axle = dynBoxTo(wheel, 0, 0, 0, 5.2, 0.6, 0.6, 'woodDark');
  axle.rotation.z = Math.PI / 2; // 沿 x 轴
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const sp = new THREE.Group();
    sp.rotation.z = a;
    wheel.add(sp);
    // 辐条
    dynBoxTo(sp, 0, 1.5, 0, 0.35, 3.0, 0.35, 'woodMid');
    // 轮缘（弧段近似：两块错角板）
    dynBoxTo(sp, 0, 2.9, 0.28, 0.4, 0.8, 0.25, 'woodLight');
    dynBoxTo(sp, 0.28, 3.18, 0, 0.25, 0.55, 0.4, 'woodLight');
    dynBoxTo(sp, 0, 3.35, -0.28, 0.4, 0.8, 0.25, 'woodLight');
    // 叶片（兜水板）
    dynBoxTo(sp, 0.55, 2.8, 0, 0.15, 1.1, 1.5, 'woodMid');
  }
  updaters.push((dt, t) => { wheel.rotation.z = t * 0.45; });

  registerBuilding({
    name: '水车磨坊', blurb: '水轮转一圈，时间就慢一步。',
    cx: x, cz: zBank, y0: gy - 1, y1: gy + H + 3.6, halfW: 4.6, halfD: 4.2,
  });

  return updaters;
}

// ------------------------------------------------------------
// 树屋：北坡巨树 + 树冠小木屋 + 绳梯 + 天桥
// ------------------------------------------------------------
export function buildTreehouse(scene, { x = 26, z = -33 } = {}) {
  const gy = terrainHeight(x, z);
  const updaters = [];

  vox.pushTransform(x, gy, z, 12);

  // —— 巨树 ——
  vox.boxC(-1.6, 0, -1.6, 3.2, 9.0, 3.2, 'trunk');
  // 板根（四角撑开）
  for (const px of [-2.6, 1.0]) {
    for (const pz of [-2.6, 1.0]) {
      vox.boxC(px, 0, pz, 2.2, 2.2, 2.2, 'trunk');
      vox.boxC(px + 0.5, 2.2, pz + 0.5, 1.2, 1.0, 1.2, 'trunk');
    }
  }
  // 主树冠（三层大蓬）
  vox.boxC(-5.0, 8.2, -5.0, 10.0, 2.6, 10.0, 'treeDeep');
  vox.boxC(-3.8, 10.4, -3.8, 7.6, 2.2, 7.6, 'treeLite');
  vox.boxC(-2.2, 12.2, -2.2, 4.4, 1.6, 4.4, 'treeDeep');

  // —— 树冠里的小木屋（坐在 8.2 层冠顶）——
  const hz = 10.0; // 屋底
  vox.boxC(-2.4, hz, -2.4, 4.8, 0.4, 4.8, 'woodMid');          // 地板
  vox.boxC(-2.4, hz + 0.4, -2.4, 4.8, 2.6, 0.4, 'woodMid');    // 后墙
  vox.boxC(-2.4, hz + 0.4, 2.0, 4.8, 2.6, 0.4, 'woodMid');     // 前墙（右留门洞）
  vox.boxC(-2.4, hz + 0.4, -2.4, 0.4, 2.6, 4.8, 'woodMid');    // 左墙
  vox.boxC(2.0, hz + 0.4, -2.4, 0.4, 2.6, 4.8, 'woodMid');     // 右墙
  // 前墙门洞（右半开）
  vox.boxC(-2.4, hz + 0.4, 2.0, 3.2, 0.8, 0.4, 'woodMid');
  vox.boxC(-2.4, hz + 2.2, 2.0, 4.8, 0.8, 0.4, 'woodMid');
  vox.windowBox(1.35, hz + 1.6, 2.21, 1.3, 1.3, 0.2, 'winWarm'); // 门+窗
  vox.windowBox(-1.2, hz + 1.5, 2.21, 1.1, 1.1, 0.2, 'winGlow');
  // 屋内小景（透过门窗可见）
  vox.boxC(-1.4, hz + 0.4, -1.2, 1.4, 0.55, 1.9, 'clothC');   // 床垫
  vox.boxC(-1.4, hz + 0.95, -1.6, 1.4, 0.35, 0.8, 'awningCream');
  vox.boxC(0.6, hz + 0.95, -1.0, 0.7, 0.14, 0.7, 'woodLight'); // 小几
  vox.windowBox(0.6, hz + 1.09, -1.0, 0.3, 0.3, 0.3, 'lampGlow');
  // 小尖顶
  vox.boxC(-3.0, hz + 3.0, -3.0, 6.0, 0.9, 6.0, 'roofGreen');
  vox.boxC(-1.8, hz + 3.9, -1.8, 3.6, 0.8, 3.6, 'roofGreen');
  vox.boxC(-0.7, hz + 4.7, -0.7, 1.4, 0.7, 1.4, 'roofDark');
  // 门牌（挂树枝上）
  vox.boxC(2.6, hz + 2.0, 1.6, 0.14, 1.2, 0.14, 'woodDark');
  vox.boxC(2.3, hz + 2.2, 1.9, 0.6, 0.5, 0.65, 'fieldWheat');

  // —— 绳梯（树干垂到地面）——
  for (let i = 0; i < 9; i++) {
    vox.boxC(-0.5, 0.5 + i * 1.05, 1.9, 0.14, 0.7, 0.14, 'woodMid');
    vox.boxC(0.4, 0.5 + i * 1.05, 1.9, 0.14, 0.7, 0.14, 'woodMid');
    if (i % 2 === 0) vox.boxC(-0.5, 0.75 + i * 1.05, 1.9, 1.05, 0.14, 0.14, 'woodLight');
  }

  // —— 天桥（树屋通往观景小平台）——
  vox.boxC(3.4, hz + 0.3, -4.6, 5.2, 0.25, 1.3, 'woodLight');
  for (let i = 0; i < 5; i++) {
    vox.boxC(2.9 + i * 1.15, hz + 1.4, -5.3, 0.14, 1.0, 0.14, 'woodMid');
  }
  vox.boxC(3.4, hz + 2.3, -5.15, 5.2, 0.14, 0.14, 'woodMid');
  // 平台+护栏+望远镜
  vox.boxC(6.4, hz, -6.8, 3.0, 0.35, 3.0, 'woodMid');
  for (const px of [5.2, 8.2]) {
    for (const pz of [-8.1, -5.7]) {
      vox.boxC(px, hz + 0.35, pz, 0.22, 0.9, 0.22, 'woodMid');
    }
  }
  vox.boxC(6.4, hz + 1.25, -8.0, 3.2, 0.14, 0.14, 'woodMid');
  vox.boxC(6.4, hz + 1.25, -5.8, 3.2, 0.14, 0.14, 'woodMid');
  vox.boxC(6.4, hz + 1.25, -8.0, 0.14, 0.14, 2.4, 'woodMid');
  vox.boxC(8.1, hz + 1.25, -8.0, 0.14, 0.14, 2.4, 'woodMid');
  // 望远镜（三脚架+镜筒）
  vox.boxC(6.4, hz + 0.35, -6.8, 0.2, 1.0, 0.2, 'metal');
  vox.boxRotY(6.4, hz + 1.45, -6.8, 1.4, 0.5, 0.5, 'metal', 30);

  vox.popTransform();

  registerBuilding({
    name: '树屋', blurb: '这里只有风来敲门。',
    cx: x, cz: z, y0: gy - 1, y1: gy + 15.5, halfW: 6.2, halfD: 6.2,
  });

  return updaters;
}
