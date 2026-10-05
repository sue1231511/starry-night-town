// ============================================================
// builders/tower.js — 市政钟楼（中央广场地标，全镇最高建筑）
// ------------------------------------------------------------
// 指针是动态件（联动 townClock），钟面/塔身走体素桶。
// ============================================================
import * as THREE from 'three';
import { vox, dynBox } from '../voxel.js';
import { registerBuilding, terrainHeight, PLAZA } from '../layout.js';
import { townClock } from '../clock.js';

export function buildTower(scene) {
  const updaters = [];
  const gx = PLAZA.cx, gz = PLAZA.cz;
  const gy = terrainHeight(gx, gz);

  const group = new THREE.Group();
  group.position.set(gx, gy, gz);
  scene.add(group);

  vox.pushTransform(gx, gy, gz, 0);

  // —— 石基座（两级）——
  vox.boxC(-3.4, 0, -3.4, 6.8, 0.8, 6.8, 'rock');
  vox.boxC(-2.9, 0.8, -2.9, 5.8, 0.6, 5.8, 'rockDark');

  // —— 塔身（4.6 见方，高 11）——
  const T = 4.6, bodyH = 11;
  vox.boxC(-T / 2, 1.4, -T / 2, T, bodyH, T, 'wallSlate');
  // 角柱
  for (const px of [-T / 2, T / 2 - 0.7]) {
    for (const pz of [-T / 2, T / 2 - 0.7]) {
      vox.boxC(px, 1.4, pz, 0.7, bodyH, 0.7, 'rock');
    }
  }
  // 塔身细长窗（两层，四面）
  for (const wy of [3.4, 7.0]) {
    vox.windowBox(-0.55, wy, T / 2 + 0.08, 1.1, 1.9, 0.25, 'winWarm');
    vox.windowBox(-0.55, wy, -T / 2 - 0.33, 1.1, 1.9, 0.25, 'winWarm');
    vox.windowBox(T / 2 + 0.12, wy, -0.55, 0.25, 1.9, 1.1, 'winWarm');
    vox.windowBox(-T / 2 - 0.37, wy, -0.55, 0.25, 1.9, 1.1, 'winWarm');
  }

  // —— 钟阁（四柱撑顶，大钟在里面）——
  const deckY = 1.4 + bodyH; // 12.4
  vox.boxC(-T / 2 - 0.4, deckY, -T / 2 - 0.4, T + 0.8, 0.5, T + 0.8, 'rockDark'); // 平台
  const colH = 3.4;
  for (const px of [-T / 2, T / 2 - 0.6]) {
    for (const pz of [-T / 2, T / 2 - 0.6]) {
      vox.boxC(px, deckY + 0.5, pz, 0.6, colH, 0.6, 'wallCream');
    }
  }

  // —— 钟面（南/北两面：白盘 + 发光刻度 + 指针）——
  const clockY = deckY + 2.0;
  for (const side of [1, -1]) {
    const fz = side * (T / 2 + 0.18);
    // 白盘（大块）+ 石框
    vox.boxC(-1.9, clockY - 1.9, fz - side * 0.1, 3.8, 3.8, 0.35, 'awningCream');
    vox.boxC(-2.15, clockY - 2.15, fz - side * 0.12, 4.3, 4.3, 0.22, 'rock');
    // 12/3/6/9 刻度（发光小块）
    vox.windowBox(-0.25, clockY + 1.35, fz + side * 0.1, 0.5, 0.5, 0.15, 'winGlow');   // 12
    vox.windowBox(-0.25, clockY - 1.85, fz + side * 0.1, 0.5, 0.5, 0.15, 'winGlow');   // 6
    vox.windowBox(1.35 - 0.5, clockY - 0.25, fz + side * 0.1, 0.5, 0.5, 0.15, 'winGlow'); // 3
    vox.windowBox(-1.85, clockY - 0.25, fz + side * 0.1, 0.5, 0.5, 0.15, 'winGlow');   // 9
  }
  // 指针（动态，南面 + 北面各一套）
  const hands = [];
  for (const side of [1, -1]) {
    const fz = side * (T / 2 + 0.55);
    // 指针原点在钟心（pivot 组），针体上移使旋转绕底端；粗而亮保证夜视可读
    const pivotH = new THREE.Group(); pivotH.position.set(0, clockY, fz); group.add(pivotH);
    const hourHand = dynBox(0.55, 1.45, 0.22, 'awningCream', { glow: true });
    hourHand.position.set(0, 0.72, 0); pivotH.add(hourHand);

    const pivotM = new THREE.Group(); pivotM.position.set(0, clockY, fz); group.add(pivotM);
    const minHand = dynBox(0.38, 2.1, 0.22, 'awningCream', { glow: true });
    minHand.position.set(0, 1.05, 0); pivotM.add(minHand);

    // 中心轴帽
    const hub = dynBox(0.4, 0.4, 0.28, 'roofDark');
    hub.position.set(0, 0, side * 0.1); pivotH.add(hub);

    hands.push({ pivotH, pivotM, side });
  }

  // —— 尖顶 ——
  const roofY = deckY + 0.5 + colH;
  vox.boxC(-T / 2 - 0.2, roofY, -T / 2 - 0.2, T + 0.4, 0.9, T + 0.4, 'roofBlue');
  vox.boxC(-T / 2 + 0.5, roofY + 0.9, -T / 2 + 0.5, T - 1.0, 0.9, T - 1.0, 'roofBlue');
  vox.boxC(-1.0, roofY + 1.8, -1.0, 2.0, 0.9, 2.0, 'roofDark');
  // 避雷针 + 顶球
  vox.boxC(-0.12, roofY + 2.7, -0.12, 0.24, 1.8, 0.24, 'metal');
  vox.windowBox(0, roofY + 4.6, 0, 0.55, 0.55, 0.55, 'lampGlow');

  // —— 门（南面）——
  vox.boxC(-1.1, 1.4, T / 2 - 0.05, 2.2, 3.0, 0.35, 'woodDark');
  vox.boxC(-1.4, 1.4, T / 2 + 0.15, 0.3, 3.3, 0.3, 'rock');
  vox.boxC(1.1, 1.4, T / 2 + 0.15, 0.3, 3.3, 0.3, 'rock');

  // —— 台阶（南面，欢迎上来对时）——
  vox.boxC(-1.8, 0.35, T / 2 + 0.9, 3.6, 0.45, 1.4, 'roadLit');

  vox.popTransform();

  // —— 指针动画：联动小镇时钟 ——
  updaters.push(() => {
    const h = townClock.hourFloat();
    const m = (h % 1) * 60;
    const hourAng = -(h % 12) / 12 * Math.PI * 2;
    const minAng = -m / 60 * Math.PI * 2;
    for (const hand of hands) {
      hand.pivotH.rotation.z = hourAng;
      hand.pivotM.rotation.z = minAng;
    }
  });

  registerBuilding({
    name: '市政钟楼', blurb: '全镇的时间从这里出发，包括今晚的梦。',
    cx: gx, cz: gz, y0: gy - 1, y1: gy + roofY + 5.4,
    halfW: 4.4, halfD: 4.4,
  });

  return updaters;
}
