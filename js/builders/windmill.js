// ============================================================
// builders/windmill.js — 北坡风车区：风车 / 谷仓 / 干草垛 / 田埂栅栏
// ------------------------------------------------------------
// 风车叶片是动态件（慢转），其余走体素桶。
// ============================================================
import * as THREE from 'three';
import { vox, dynBoxTo } from '../voxel.js';
import { registerBuilding, MILL, BARN } from '../layout.js';

/** 荷式小风车：石基座 + 木塔身 + 塔帽 + 四叶 */
function buildWindmill(scene, updaters) {
  const { x, z } = MILL;
  const y = MILL.groundY;

  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = 18 * Math.PI / 180; // 微微斜向，别和麦田一个朝向
  scene.add(group);

  vox.pushTransform(x, y, z, 0);

  // 高台地基（坡上垒石台）
  vox.boxC(-4.6, -1.2, -4.6, 9.2, 1.2, 9.2, 'rock');
  vox.boxC(-4.0, -0.5, -4.0, 8.0, 0.7, 8.0, 'rockDark');

  // 塔身（下宽上窄的两段）
  vox.boxC(-2.6, 0.2, -2.6, 5.2, 5.2, 5.2, 'wallCream');
  vox.boxC(-2.1, 5.4, -2.1, 4.2, 4.2, 4.2, 'wallWood');
  // 木箍带
  vox.boxC(-2.75, 2.4, -2.75, 5.5, 0.45, 5.5, 'woodDark');
  vox.boxC(-2.2, 6.6, -2.2, 4.4, 0.4, 4.4, 'woodDark');
  // 小窗与门
  vox.boxC(-0.9, 0.2, 2.55, 1.8, 2.6, 0.3, 'woodMid');
  vox.windowBox(-0.55, 3.2, 2.62, 1.1, 1.4, 0.25, 'winWarm');
  vox.windowBox(2.13, 1.6, 0, 0.25, 1.4, 1.1, 'winWarm');
  vox.windowBox(-2.4, 5.6, 0, 0.25, 1.4, 1.1, 'winGlow');

  // 塔帽（斗笠顶 + 尾杆）
  const capY = 9.6;
  vox.boxC(-2.4, capY, -2.4, 4.8, 1.0, 4.8, 'roofGreen');
  vox.boxC(-1.6, capY + 1.0, -1.6, 3.2, 0.9, 3.2, 'roofGreen');
  vox.boxC(-0.7, capY + 1.9, -0.7, 1.4, 0.8, 1.4, 'roofDark');
  vox.boxC(0, capY + 2.7, 0, 0.18, 1.2, 0.18, 'metal');
  // 尾杆（风车尾巴的平衡杆）
  vox.boxC(-0.25, capY + 0.4, -6.2, 0.5, 0.5, 5.5, 'woodMid');

  vox.popTransform();

  // —— 四片叶片（动态：绕 z 轴慢转，朝向南偏东）——
  const hub = new THREE.Group();
  hub.position.set(0, capY + 0.6, 3.1); // 局部（group 已在世界位）
  group.add(hub);
  // 轮毂
  vox.boxC(0, capY + 0.6, 3.1, 1.2, 1.2, 1.2, 'woodDark');
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Group();
    blade.rotation.z = i * Math.PI / 2;
    hub.add(blade);
    // 主梁
    dynBoxTo(blade, 0, 2.6, 0, 0.35, 5.6, 0.35, 'woodMid');
    // 帆布格（漏光的暖色格 + 木框条）
    for (let s = 0; s < 4; s++) {
      dynBoxTo(blade, 0.55, 1.4 + s * 1.35, 0, 1.0, 1.1, 0.16, s % 2 ? 'awningCream' : 'awningRed');
    }
    // 叶尖配重
    dynBoxTo(blade, 0, 5.5, 0, 0.5, 0.5, 0.5, 'metal');
  }
  updaters.push((dt, t) => { hub.rotation.z = t * 0.35; });

  registerBuilding({
    name: '老风车', blurb: '磨的不是面粉，是月光。',
    cx: x, cz: z, y0: y - 1.5, y1: y + capY + 4, halfW: 4.5, halfD: 4.5,
  });
}

/** 谷仓：红墙 + 白色大 X 门 + 干草透气窗 */
function buildBarn() {
  const { x, z } = BARN;
  const y = BARN.groundY;
  vox.pushTransform(x, y, z, -12);

  vox.boxC(-5.0, -0.8, -3.6, 10.0, 0.8, 7.2, 'rockDark');
  vox.boxC(-4.5, 0, -3.2, 9.0, 4.6, 6.4, 'wallBrick');
  // 山墙高顶
  vox.boxC(-5.1, 4.6, -3.7, 10.2, 0.5, 7.4, 'woodDark');
  vox.boxC(-4.9, 5.1, -3.5, 9.8, 1.6, 7.0, 'roofRed');
  vox.boxC(-3.6, 6.7, -2.2, 7.2, 1.5, 5.8, 'roofRed');
  vox.boxC(-2.3, 8.2, -0.9, 4.6, 1.3, 4.4, 'roofDark');
  vox.boxC(-0.6, 9.5, -0.6, 1.8, 0.9, 1.8, 'roofDark');
  // 大门 + 白 X
  vox.boxC(-1.8, 0, 3.18, 3.6, 3.6, 0.3, 'woodDark');
  vox.boxC(-1.35, 0.35, 3.3, 0.55, 3.0, 0.18, 'awningCream');
  vox.boxC(1.35, 0.35, 3.3, 0.55, 3.0, 0.18, 'awningCream');
  vox.boxC(-0.2, 1.8, 3.3, 2.7, 0.5, 0.18, 'awningCream');
  vox.boxC(-0.2, 1.8, 3.3, 2.7, 0.5, 0.18, 'awningCream');
  // 干草透气窗（山墙上的小方窗，暖光）
  vox.windowBox(-0.7, 5.6, 3.25, 1.4, 1.4, 0.25, 'winWarm');
  vox.windowBox(-0.6, 5.4, -3.55, 1.2, 1.2, 0.25, 'winWarm');
  // 侧窗
  vox.windowBox(4.55, 1.6, -0.6, 0.25, 1.5, 1.2, 'winGlow');
  vox.windowBox(-4.9, 1.6, -0.6, 0.25, 1.5, 1.2, 'winGlow');

  vox.popTransform();

  registerBuilding({
    name: '北坡谷仓', blurb: '干草垛数到第十个会犯困。',
    cx: x, cz: z, y0: y - 1, y1: y + 10.4, halfW: 5.4, halfD: 3.9,
  });
}

/** 干草垛 ×3 + 田埂木栅栏 */
function buildHayAndFence() {
  const hays = [
    { x: MILL.x + 7.5, z: MILL.z + 2.0, s: 1.0 },
    { x: MILL.x + 9.5, z: MILL.z - 1.5, s: 0.8 },
    { x: BARN.x + 6.5, z: BARN.z + 4.0, s: 1.15 },
  ];
  for (const h of hays) {
    const gy = MILL.groundY - 0.6; // 坡面近似
    vox.boxC(h.x - 1.1 * h.s, gy, h.z - 1.1 * h.s, 2.2 * h.s, 1.8 * h.s, 2.2 * h.s, 'fieldWheat');
    vox.boxC(h.x - 0.75 * h.s, gy + 1.8 * h.s, h.z - 0.75 * h.s, 1.5 * h.s, 0.9 * h.s, 1.5 * h.s, 'fieldDark');
  }
  // 麦田四周木栅栏（低矮两横杆）
  const fenceRect = (x0, z0, x1, z1) => {
    for (let fx = x0; fx <= x1; fx += 3.2) {
      vox.boxC(fx - 0.12, 0, z0 - 0.12, 0.24, 1.3, 0.24, 'woodMid');
      vox.boxC(fx - 0.12, 0, z1 - 0.12, 0.24, 1.3, 0.24, 'woodMid');
    }
    for (let fz = z0; fz <= z1; fz += 3.2) {
      vox.boxC(x0 - 0.12, 0, fz - 0.12, 0.24, 1.3, 0.24, 'woodMid');
      vox.boxC(x1 - 0.12, 0, fz - 0.12, 0.24, 1.3, 0.24, 'woodMid');
    }
    // 横杆（贴地近似坡度高差，取两端均值）
    const y0a = 0.95;
    vox.boxC(x0, y0a, z0 - 0.12, x1 - x0, 0.16, 0.16, 'woodLight');
    vox.boxC(x0, y0a - 0.5, z0 - 0.12, x1 - x0, 0.16, 0.16, 'woodLight');
    vox.boxC(x0, y0a, z1 - 0.12, x1 - x0, 0.16, 0.16, 'woodLight');
    vox.boxC(x0, y0a - 0.5, z1 - 0.12, x1 - x0, 0.16, 0.16, 'woodLight');
    vox.boxC(x0 - 0.12, y0a, z0, 0.16, 0.16, z1 - z0, 'woodLight');
    vox.boxC(x0 - 0.12, y0a - 0.5, z0, 0.16, 0.16, z1 - z0, 'woodLight');
    vox.boxC(x1 - 0.12, y0a, z0, 0.16, 0.16, z1 - z0, 'woodLight');
    vox.boxC(x1 - 0.12, y0a - 0.5, z0, 0.16, 0.16, z1 - z0, 'woodLight');
  };
  // 麦田围栏（布局在 layout WHEAT_FIELD，坡上高度近似用 MILL.groundY 抬升）
  vox.pushTransform(0, MILL.groundY, 0, 0);
  fenceRect(-42, -46, -6, -30);
  vox.popTransform();
}

export function buildWindmillArea(scene) {
  const updaters = [];
  buildWindmill(scene, updaters);
  buildBarn();
  buildHayAndFence();
  return updaters;
}
