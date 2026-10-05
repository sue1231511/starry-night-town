// ============================================================
// builders/park.js — 南公园深化
// ------------------------------------------------------------
// 菜畦（垄作色带）/ 稻草人（守夜）/ 风筝（天上飘，线连地面）/
// 野餐垫 / 滑梯 / 跷跷板（微摆）/ 公园路灯 ×3。
// 风筝和跷跷板是动态件；其余走体素桶。
// ============================================================
import * as THREE from 'three';
import { vox, dynBoxTo } from '../voxel.js';
import { glowSpriteMat } from '../palette.js';
import { PARK, terrainHeight, registerBuilding } from '../layout.js';

// ------------------------------------------------------------
// 菜畦：垄作条带 + 作物点缀（夜里只有轮廓和几盏防虫灯）
// ------------------------------------------------------------
function buildVegetable() {
  const V = PARK.vegetable;
  for (let r = 0; r < V.rows; r++) {
    const z = V.z0 + (r + 0.5) * (V.z1 - V.z0) / V.rows;
    // 垄土
    vox.boxC(V.x0, 0, z - 1.1, V.x1 - V.x0, 0.4, 2.2, 'dirt');
    // 作物行（隔株换作物色）
    for (let x = V.x0 + 0.8; x < V.x1 - 0.6; x += 1.6) {
      const crop = Math.floor(x / 1.6 + r) % 3;
      const color = crop === 0 ? 'bush' : crop === 1 ? 'treeLite' : 'flowerYel';
      vox.boxC(x - 0.35, 0.4, z - 0.35, 0.7, 0.55 + (crop === 2 ? 0.25 : 0), 0.7, color);
      if (crop === 2) vox.boxC(x - 0.15, 1.2, z - 0.15, 0.3, 0.3, 0.3, 'flowerRed');
    }
    // 埂间小灯（防虫灯：暖光小点，夜里菜地的星）
    if (r % 2 === 0) {
      vox.windowBox(V.x1 - 0.5, 1.1, z, 0.35, 0.35, 0.35, 'lampGlow');
      vox.boxC(V.x1 - 0.62, 0.4, z - 0.08, 0.2, 0.7, 0.2, 'woodDark');
    }
  }
  // 竹篱笆围栏
  for (let x = V.x0 - 0.5; x <= V.x1 + 0.5; x += 2.0) {
    vox.boxC(x - 0.09, 0, V.z0 - 1.6, 0.18, 1.1, 0.18, 'woodLight');
    vox.boxC(x - 0.09, 0, V.z1 + 1.4, 0.18, 1.1, 0.18, 'woodLight');
  }
  vox.boxC(V.x0 - 0.5, 0.75, V.z0 - 1.6, V.x1 - V.x0 + 1, 0.14, 0.14, 'woodLight');
  vox.boxC(V.x0 - 0.5, 0.75, V.z1 + 1.4, V.x1 - V.x0 + 1, 0.14, 0.14, 'woodLight');
}

// ------------------------------------------------------------
// 稻草人：十字架 + 草帽 + 南瓜头（夜里微微转身的那个）
// ------------------------------------------------------------
function buildScarecrow(scene) {
  const { x, z } = PARK.scarecrow;
  const gy = terrainHeight(x, z);

  vox.pushTransform(x, gy, z, 25);
  vox.boxC(-0.12, 0, -0.12, 0.24, 2.6, 0.24, 'woodMid');   // 立杆
  vox.boxC(-1.0, 1.7, -0.1, 2.0, 0.2, 0.2, 'woodMid');     // 横臂
  vox.boxC(-0.5, 0.6, -0.5, 1.0, 1.5, 1.0, 'fieldWheat');  // 草身
  vox.boxC(-1.05, 1.6, -0.12, 0.35, 0.9, 0.35, 'fieldWheat'); // 袖草×2
  vox.boxC(0.85, 1.6, -0.12, 0.35, 0.9, 0.35, 'fieldWheat');
  vox.boxC(-0.4, 2.15, -0.4, 0.8, 0.7, 0.8, 'flowerYel');  // 南瓜头
  vox.windowBox(-0.14, 2.4, 0.42, 0.16, 0.22, 0.08, 'winWarm'); // 发光眼×2
  vox.windowBox(0.14, 2.4, 0.42, 0.16, 0.22, 0.08, 'winWarm');
  vox.boxC(-0.55, 2.7, -0.55, 1.1, 0.16, 1.1, 'fieldDark'); // 草帽
  vox.boxC(-0.35, 2.86, -0.35, 0.7, 0.16, 0.7, 'fieldDark');
  vox.popTransform();

  registerBuilding({
    name: '守夜稻草人', blurb: '它一晚上转三次身，都在你没看的时候。',
    cx: x, cz: z, y0: gy - 1, y1: gy + 3.1, halfW: 1.2, halfD: 1.2,
  });
}

// ------------------------------------------------------------
// 风筝：天上晃的风筝 + 折线风筝线（体素风斜线块）
// ------------------------------------------------------------
function buildKite(scene) {
  const updaters = [];
  const { anchorX, anchorZ } = PARK.kite;
  const gy = terrainHeight(anchorX, anchorZ);

  // 放飞人手里的小桩（线的锚点）
  vox.pushTransform(anchorX, gy, anchorZ, 0);
  vox.boxC(-0.15, 0, -0.15, 0.3, 0.9, 0.3, 'woodMid');
  vox.popTransform();

  // 风筝（动态：大幅摆动 + 自旋）
  const kite = new THREE.Group();
  scene.add(kite);
  dynBoxTo(kite, 0, 0, 0, 1.4, 1.8, 0.16, 'carRed');        // 面板
  dynBoxTo(kite, 0, 0, 0, 0.16, 1.8, 0.18, 'awningCream');  // 骨条
  dynBoxTo(kite, 0, 0, 0, 1.4, 0.16, 0.18, 'awningCream');
  dynBoxTo(kite, -0.55, -1.5, 0, 0.14, 1.2, 0.14, 'awningCream'); // 尾穗×3
  dynBoxTo(kite, 0.15, -1.9, 0, 0.12, 0.7, 0.12, 'flowerYel');
  dynBoxTo(kite, -0.2, -2.4, 0, 0.1, 0.5, 0.1, 'flowerBlu');

  // 风筝线（小方块串，跟随风筝端点摆动——每帧摆 5 个块近似弧线）
  const lineSegs = [];
  for (let i = 0; i < 6; i++) {
    const s = dynBoxTo(scene, 0, 0, 0, 0.1, 0.1, 0.1, 'metal');
    lineSegs.push(s);
  }

  const basePos = new THREE.Vector3(anchorX + 4, 0, anchorZ - 2);
  updaters.push((dt, t) => {
    // 风筝在锚点上方 14~17 格游走
    const swing = Math.sin(t * 0.7);
    const drift = Math.sin(t * 0.43 + 1);
    const kx = anchorX + 4 + swing * 2.2;
    const kz = anchorZ - 2 + drift * 2.8;
    const ky = 14 + Math.sin(t * 0.9 + 0.5) * 1.4;
    kite.position.set(kx, ky, kz);
    kite.rotation.z = Math.sin(t * 0.7) * 0.35;
    kite.rotation.y = Math.sin(t * 0.5) * 0.5;
    // 线：锚 → 风筝 之间的 6 段（垂度用二次贝塞尔近似）
    for (let i = 0; i < lineSegs.length; i++) {
      const s = (i + 1) / (lineSegs.length + 1);
      const sag = Math.sin(s * Math.PI) * 1.6; // 中段下垂
      lineSegs[i].position.set(
        anchorX + (kx - anchorX) * s,
        gy + 0.9 + (ky - gy - 0.9) * s - sag,
        anchorZ + (kz - anchorZ) * s,
      );
    }
  });
  return updaters;
}

// ------------------------------------------------------------
// 野餐垫 ×2：格子布 + 食篮 + 灯串小支架
// ------------------------------------------------------------
function buildPicnic() {
  for (let p = 0; p < PARK.picnic.length; p++) {
    const { x, z } = PARK.picnic[p];
    const gy = terrainHeight(x, z);
    vox.pushTransform(x, gy, z, p * 30);
    // 格子布（双色棋盘 3×3）
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        vox.boxC(-1.5 + i, 0.05, -1.5 + j, 0.95, 0.12, 0.95,
          (i + j) % 2 ? 'awningCream' : 'carRed');
      }
    }
    // 食篮
    vox.boxC(0.3, 0.15, 0.3, 0.9, 0.55, 0.9, 'woodLight');
    vox.boxC(0.3, 0.7, 0.3, 0.75, 0.2, 0.75, 'woodMid');
    // 篮里露出的面包
    vox.boxC(0.15, 0.85, 0.25, 0.35, 0.3, 0.35, 'flowerYel');
    vox.boxC(0.55, 0.85, 0.4, 0.28, 0.26, 0.28, 'flowerYel');
    // 小果汁杯
    vox.windowBox(-0.8, 0.15, 0.5, 0.3, 0.4, 0.3, 'winWarm');
    vox.popTransform();
  }
}

// ------------------------------------------------------------
// 滑梯：梯 + 平台 + 斜滑道
// ------------------------------------------------------------
function buildSlide() {
  const { x, z } = PARK.slide;
  const gy = terrainHeight(x, z);
  vox.pushTransform(x, gy, z, -40);
  // 爬梯
  for (let i = 0; i < 5; i++) {
    vox.boxC(-1.6, 0.5 + i * 0.5, -1.2 + i * 0.0, 0.9, 0.14, 0.14, 'metal');
  }
  vox.boxC(-1.95, 0, -1.3, 0.14, 3.0, 0.14, 'metal');
  vox.boxC(-1.25, 0, -1.3, 0.14, 3.0, 0.14, 'metal');
  // 平台
  vox.boxC(-1.0, 2.6, -1.2, 1.6, 0.22, 1.6, 'woodLight');
  // 护栏
  vox.boxC(-1.0, 3.6, -1.95, 1.6, 0.14, 0.14, 'metal');
  vox.boxC(-1.0, 3.6, -0.45, 1.6, 0.14, 0.14, 'metal');
  vox.boxC(-0.3, 2.8, -1.9, 0.14, 0.9, 0.14, 'metal');
  vox.boxC(-0.3, 2.8, -0.5, 0.14, 0.9, 0.14, 'metal');
  // 滑道（三段阶梯斜面）
  vox.boxC(0.15, 2.35, -1.0, 1.0, 0.18, 1.1, 'awningCream');
  vox.boxC(0.95, 1.75, -0.55, 1.0, 0.18, 1.1, 'awningCream');
  vox.boxC(1.75, 1.15, -0.1, 1.0, 0.18, 1.1, 'awningCream');
  vox.boxC(2.5, 0.55, 0.35, 1.0, 0.18, 1.1, 'awningCream');
  // 滑道侧沿
  vox.boxC(1.3, 2.1, -1.55, 2.9, 0.12, 0.12, 'clothB');
  vox.boxC(1.3, 2.1, -0.45, 2.9, 0.12, 0.12, 'clothB');
  vox.popTransform();
}

// ------------------------------------------------------------
// 跷跷板（动态微摆）+ 公园路灯
// ------------------------------------------------------------
function buildSeesaw(scene) {
  const updaters = [];
  const { x, z } = PARK.seesaw;
  const gy = terrainHeight(x, z);

  vox.pushTransform(x, gy, z, 15);
  // 支架
  vox.boxC(-0.6, 0, -1.0, 0.3, 1.2, 0.3, 'metal');
  vox.boxC(0.3, 0, -1.0, 0.3, 1.2, 0.3, 'metal');
  vox.boxC(-0.15, 1.1, -1.0, 0.6, 0.3, 0.9, 'metal');
  // 沙坑
  vox.boxC(-2.4, 0.03, -2.0, 4.8, 0.14, 4.0, 'fieldWheat');
  vox.popTransform();

  // 板（动态绕中心点摆）
  const board = new THREE.Group();
  board.position.set(x, gy + 1.35, z - 1.0);
  board.rotation.y = 15 * Math.PI / 180;
  scene.add(board);
  dynBoxTo(board, 0, 0, 0, 4.4, 0.18, 0.8, 'woodLight');
  dynBoxTo(board, -1.8, 0.45, 0, 0.55, 0.55, 0.7, 'carRed');    // 座A
  dynBoxTo(board, -1.8, 0.12, 0, 0.3, 0.35, 0.3, 'metal');      // 把手A
  dynBoxTo(board, 1.8, 0.45, 0, 0.55, 0.55, 0.7, 'clothB');     // 座B
  dynBoxTo(board, 1.8, 0.12, 0, 0.3, 0.35, 0.3, 'metal');       // 把手B
  updaters.push((dt, t) => {
    // 慢慢地翘（像有个看不见的小孩在玩）
    board.rotation.z = Math.sin(t * 0.55) * 0.18;
  });
  return updaters;
}

function buildParkLamps(scene) {
  for (const L of PARK.lamps) {
    const gy = terrainHeight(L.x, L.z);
    vox.pushTransform(L.x, gy, L.z, 0);
    vox.boxC(-0.4, 0, -0.4, 0.8, 0.35, 0.8, 'rockDark');
    vox.boxC(-0.12, 0.35, -0.12, 0.24, 3.6, 0.24, 'metal');
    vox.boxC(-0.38, 3.95, -0.38, 0.76, 0.5, 0.76, 'metal');
    vox.windowBox(-0.26, 3.5, -0.26, 0.52, 0.7, 0.52, 'lampGlow');
    vox.popTransform();
    const spr = new THREE.Sprite(glowSpriteMat('lampGlow', 0.18));
    spr.position.set(L.x, gy + 3.9, L.z);
    spr.scale.set(2.1, 2.1, 1);
    scene.add(spr);
  }
}

// ------------------------------------------------------------
// 总装
// ------------------------------------------------------------
export function buildPark(scene) {
  const updaters = [];
  buildVegetable();
  buildScarecrow(scene);
  updaters.push(...buildKite(scene));
  buildPicnic();
  buildSlide();
  updaters.push(...buildSeesaw(scene));
  buildParkLamps(scene);
  return updaters;
}
