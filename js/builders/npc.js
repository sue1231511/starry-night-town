// ============================================================
// builders/npc.js — 体素行人 ×8 + 屋顶猫
// ------------------------------------------------------------
// 行人沿 layout.PEDESTRIAN_LOOPS 漫游（走路浮步 + 朝向插值）；
// 屋顶猫蹲在钟楼旁的屋脊上，尾巴摆。
// ============================================================
import * as THREE from 'three';
import { dynBoxTo } from '../voxel.js';
import { vox } from '../voxel.js';
import { PEDESTRIAN_LOOPS, terrainHeight, makeRng, PLAZA, DOCK, riverZ, RIVER_HALF_W, CAMP } from '../layout.js';

// ------------------------------------------------------------
// 体素小人（参数配色）
// ------------------------------------------------------------
function makeVillager(scene, { shirt, pants, hat, skin = 'npcSkin' }) {
  const g = new THREE.Group();
  scene.add(g);
  // 腿×2（走路交替）
  const legL = dynBoxTo(g, -0.22, 0.45, 0, 0.3, 0.9, 0.3, pants);
  const legR = dynBoxTo(g, 0.22, 0.45, 0, 0.3, 0.9, 0.3, pants);
  // 身
  dynBoxTo(g, 0, 1.35, 0, 0.85, 0.95, 0.5, shirt);
  // 手臂×2
  const armL = dynBoxTo(g, -0.55, 1.4, 0, 0.24, 0.8, 0.24, shirt);
  const armR = dynBoxTo(g, 0.55, 1.4, 0, 0.24, 0.8, 0.24, shirt);
  // 头 + 帽
  dynBoxTo(g, 0, 2.15, 0, 0.6, 0.6, 0.6, skin);
  if (hat) {
    dynBoxTo(g, 0, 2.5, 0, 0.7, 0.25, 0.7, hat);
    dynBoxTo(g, 0, 2.32, 0.3, 0.66, 0.12, 0.3, hat); // 帽檐
  }
  // 手里的小道具：提灯笼（夜归感）
  dynBoxTo(g, 0.55, 0.85, 0.12, 0.22, 0.3, 0.22, 'lampGlow', { glow: true });
  return { g, legL, legR, armL, armR };
}

// ------------------------------------------------------------
// 夜遛的小狗（跟在 0 号行人后面 2.2 格，四腿倒腾 + 摇尾巴）
// ------------------------------------------------------------
function buildDog(scene, ownerUpdaterPath) {
  const g = new THREE.Group();
  scene.add(g);
  // 身体（横长）+ 头 + 耳
  dynBoxTo(g, 0, 0.55, 0, 1.1, 0.5, 0.55, 'catBlack');
  dynBoxTo(g, 0.62, 0.75, 0, 0.45, 0.45, 0.45, 'catBlack');
  dynBoxTo(g, 0.5, 1.02, 0.12, 0.16, 0.2, 0.1, 'catBlack');
  dynBoxTo(g, 0.5, 1.02, -0.12, 0.16, 0.2, 0.1, 'catBlack');
  // 吊牌（发光小铃铛）
  dynBoxTo(g, 0.86, 0.62, 0, 0.12, 0.12, 0.12, 'lampGlow', { glow: true });
  // 腿×4（小短腿倒腾）
  const legs = [];
  for (const [lx, lz] of [[-0.35, 0.18], [-0.35, -0.18], [0.35, 0.18], [0.35, -0.18]]) {
    const leg = dynBoxTo(g, lx, 0.15, lz, 0.16, 0.32, 0.16, 'catBlack');
    legs.push(leg);
  }
  // 尾巴（上翘，快速摇）
  const tailPivot = new THREE.Group();
  tailPivot.position.set(-0.58, 0.72, 0);
  g.add(tailPivot);
  dynBoxTo(tailPivot, -0.18, 0.14, 0, 0.14, 0.4, 0.14, 'catBlack');

  return function tickDog(t, ownerX, ownerZ, ownerAngle) {
    // 位置 = 主人身后 2.2 格（沿主人反方向 + 小幅游离）
    const back = ownerAngle + Math.PI;
    const wob = Math.sin(t * 0.8) * 0.6;
    const dx = Math.sin(back) * 2.2 + Math.sin(back + Math.PI / 2) * wob;
    const dz = Math.cos(back) * 2.2 + Math.cos(back + Math.PI / 2) * wob;
    const gy = terrainHeight(ownerX + dx, ownerZ + dz);
    g.position.set(ownerX + dx, gy, ownerZ + dz);
    g.rotation.y = Math.atan2(dx, dz) + Math.sin(t * 2) * 0.08; // 走路时头会左右嗅
    // 四腿对角倒腾
    const w = t * 10;
    legs[0].rotation.x = Math.sin(w) * 0.7;
    legs[3].rotation.x = Math.sin(w) * 0.7;
    legs[1].rotation.x = -Math.sin(w) * 0.7;
    legs[2].rotation.x = -Math.sin(w) * 0.7;
    // 摇尾巴
    tailPivot.rotation.z = 0.5 + Math.sin(t * 12) * 0.5;
    g.position.y = gy + Math.abs(Math.sin(w)) * 0.05;
  };
}

// ------------------------------------------------------------
// 行人系统
// ------------------------------------------------------------
export function buildNpcs(scene) {
  const updaters = [];
  const rng = makeRng(998877);

  const outfitPool = [
    { shirt: 'clothA', pants: 'woodDark', hat: 'roofRed' },
    { shirt: 'clothB', pants: 'rockDark', hat: null },
    { shirt: 'clothC', pants: 'woodMid', hat: 'roofBlue' },
    { shirt: 'clothD', pants: 'rockDark', hat: 'roofGreen' },
    { shirt: 'awningCream', pants: 'wallPlum', hat: null },
    { shirt: 'wallSlate', pants: 'woodDark', hat: 'carRed' },
    { shirt: 'clothA', pants: 'rockDark', hat: null },
    { shirt: 'flowerBlu', pants: 'woodMid', hat: 'fieldWheat' },
  ];

  // 0 号行人带狗（遛狗人）
  let dogTick = null;
  let ownerPos = { x: 0, z: 0, angle: 0 };

  for (let i = 0; i < 8; i++) {
    const loop = PEDESTRIAN_LOOPS[i % PEDESTRIAN_LOOPS.length];
    const villager = makeVillager(scene, outfitPool[i % outfitPool.length]);
    const speed = 0.55 + rng() * 0.5;          // 格/秒
    const startT = rng();
    const phase = rng() * Math.PI * 2;
    const dir = i % 3 === 2 ? -1 : 1;          // 部分反着走

    if (i === 0) dogTick = buildDog(scene);

    // 预计算环长
    let loopLen = 0;
    const segs = [];
    for (let k = 0; k < loop.length; k++) {
      const a = loop[k], b = loop[(k + 1) % loop.length];
      const d = Math.hypot(b.x - a.x, b.z - a.z);
      segs.push({ a, b, d }); loopLen += d;
    }

    updaters.push((dt, t) => {
      // 沿环参数化位置
      let p = ((startT + t * dir * speed / loopLen) % 1 + 1) % 1;
      let dist = p * loopLen;
      let cur = segs[0];
      for (const s of segs) {
        if (dist <= s.d) { cur = s; break; }
        dist -= s.d;
      }
      const tt = dist / cur.d;
      const x = cur.a.x + (cur.b.x - cur.a.x) * tt;
      const z = cur.a.z + (cur.b.z - cur.a.z) * tt;
      const gy = terrainHeight(x, z);
      villager.g.position.set(x, gy, z);
      // 朝向行进方向
      const ang = Math.atan2(cur.b.x - cur.a.x, cur.b.z - cur.a.z) * dir;
      villager.g.rotation.y = ang;
      // 走路：腿臂交替 + 身体浮步
      const w = t * 6 * (0.6 + speed * 0.5) + phase;
      villager.legL.rotation.x = Math.sin(w) * 0.6;
      villager.legR.rotation.x = -Math.sin(w) * 0.6;
      villager.armL.rotation.x = -Math.sin(w) * 0.45;
      villager.armR.rotation.x = Math.sin(w) * 0.45;
      villager.g.position.y = gy + Math.abs(Math.sin(w)) * 0.08;

      // 0 号是遛狗人：把方位喂给狗
      if (i === 0 && dogTick) {
        dogTick(t, x, z, ang);
      }
    });
  }
  return updaters;
}

// ------------------------------------------------------------
// 散布小镇的猫 ×3（广场 / 码头 / 篝火）：蹲姿 + 尾巴摆 + 呼吸
// ------------------------------------------------------------
function makeCatAt(scene, x, y, z, rot, seed) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rot * Math.PI / 180;
  scene.add(g);

  const body = new THREE.Group();
  g.add(body);
  dynBoxTo(body, 0, 0.25, 0, 0.7, 0.55, 1.05, 'catBlack');
  dynBoxTo(body, 0, 0.62, 0.4, 0.5, 0.45, 0.45, 'catBlack');
  dynBoxTo(body, -0.16, 0.95, 0.4, 0.14, 0.2, 0.1, 'catBlack');
  dynBoxTo(body, 0.16, 0.95, 0.4, 0.14, 0.2, 0.1, 'catBlack');
  dynBoxTo(body, -0.11, 0.66, 0.63, 0.1, 0.09, 0.05, 'winWarm', { glow: true });
  dynBoxTo(body, 0.11, 0.66, 0.63, 0.1, 0.09, 0.05, 'winWarm', { glow: true });
  dynBoxTo(body, 0, 0.06, 0.58, 0.3, 0.14, 0.28, 'catBlack');
  const tail1 = new THREE.Group(); tail1.position.set(0, 0.32, -0.52); body.add(tail1);
  dynBoxTo(tail1, 0, 0, -0.3, 0.16, 0.16, 0.62, 'catBlack');
  const tail2 = new THREE.Group(); tail2.position.set(0, 0, -0.6); tail1.add(tail2);
  dynBoxTo(tail2, 0, 0.1, -0.22, 0.13, 0.13, 0.5, 'catBlack');

  return (dt, t) => {
    tail1.rotation.y = Math.sin(t * 1.2 + seed) * 0.5;
    tail2.rotation.y = Math.sin(t * 1.2 + 0.9 + seed) * 0.6;
    const breathe = 1 + Math.sin(t * 1.6 + seed) * 0.035;
    body.scale.set(breathe, breathe, 1);
  };
}

/** 三只镇猫：喷泉边打盹 / 码头守鱼 / 篝火烤火 */
export function buildTownCats(scene) {
  const updaters = [];
  const plazaY = terrainHeight(PLAZA.cx - 5, PLAZA.cz + 4);
  updaters.push(makeCatAt(scene, PLAZA.cx - 5, plazaY, PLAZA.cz + 4, 140, 1.7));      // 广场猫
  const rz1 = riverZ(DOCK.x);
  updaters.push(makeCatAt(scene, DOCK.x + 1.6, 0.9, rz1 + RIVER_HALF_W - 3.8, -100, 4.2)); // 码头猫
  updaters.push(makeCatAt(scene, CAMP.fire.x + 2.6, CAMP.groundY, CAMP.fire.z + 2.0, -35, 7.9)); // 篝火猫
  return updaters;
}

// ------------------------------------------------------------
// 屋顶猫（蹲在旅馆屋脊，尾巴摆 + 偶尔抬头）
// ------------------------------------------------------------
export function buildRoofCat(scene) {
  const updaters = [];
  const g = new THREE.Group();
  // 旅馆 (x=-12, z=0) 屋脊上方
  g.position.set(-12, 8.1, -1.2);
  g.rotation.y = 0.35;
  scene.add(g);

  // 身体（蹲姿：一坨 + 头 + 耳朵）
  dynBoxTo(g, 0, 0.3, 0, 0.75, 0.6, 1.1, 'catBlack');
  dynBoxTo(g, 0, 0.62, 0.42, 0.55, 0.5, 0.5, 'catBlack');   // 头
  dynBoxTo(g, -0.18, 0.98, 0.42, 0.16, 0.22, 0.12, 'catBlack'); // 耳×2
  dynBoxTo(g, 0.18, 0.98, 0.42, 0.16, 0.22, 0.12, 'catBlack');
  // 眼睛（夜里发光的琥珀色）
  dynBoxTo(g, -0.13, 0.66, 0.68, 0.12, 0.1, 0.05, 'winWarm', { glow: true });
  dynBoxTo(g, 0.13, 0.66, 0.68, 0.12, 0.1, 0.05, 'winWarm', { glow: true });
  // 前爪并拢
  dynBoxTo(g, 0, 0.08, 0.62, 0.32, 0.16, 0.3, 'catBlack');
  // 尾巴（动态：两节摆）
  const tail1 = new THREE.Group(); tail1.position.set(0, 0.35, -0.55); g.add(tail1);
  dynBoxTo(tail1, 0, 0, -0.3, 0.18, 0.18, 0.65, 'catBlack');
  const tail2 = new THREE.Group(); tail2.position.set(0, 0, -0.62); tail1.add(tail2);
  dynBoxTo(tail2, 0, 0.12, -0.25, 0.15, 0.15, 0.55, 'catBlack');

  updaters.push((dt, t) => {
    tail1.rotation.y = Math.sin(t * 1.3) * 0.5;
    tail2.rotation.y = Math.sin(t * 1.3 + 0.9) * 0.6;
    // 偶尔抬头看月亮（缓慢点头周期）
    g.children[1].rotation.x = 0.15 + 0.25 * (0.5 + 0.5 * Math.sin(t * 0.23));
  });

  return updaters;
}
