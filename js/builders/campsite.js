// ============================================================
// builders/campsite.js — 北坡露营地：帐篷 ×2 / 篝火 / 柴堆 / 观星垫
// ------------------------------------------------------------
// 篝火是本档夜景核心：柴堆静态 + 动态火焰块（乱序抖动、橙黄两层）
// + 火星上升粒子 + 暖光光晕 + 一点真实点光（预算内第 3 个）。
// ============================================================
import * as THREE from 'three';
import { vox, dynBoxTo } from '../voxel.js';
import { glowSpriteMat, hexNum } from '../palette.js';
import { CAMP, registerBuilding } from '../layout.js';

// ------------------------------------------------------------
// 帐篷（A 字形：双色布面 + 门口暗腔 + 顶穗）
// ------------------------------------------------------------
function buildTent(t) {
  vox.pushTransform(t.x, CAMP.groundY, t.z, t.rot);
  // 主体两坡
  vox.boxC(-2.2, 0, -1.8, 4.4, 2.0, 1.0, 'clothC');
  vox.boxC(-2.2, 0, 0.8, 4.4, 2.0, 1.0, 'clothC');
  // 屋脊封边
  vox.boxC(-2.3, 1.9, -0.1, 4.6, 0.35, 0.5, 'clothA');
  // 门帘掀开（一侧掀起的小三角近似）
  vox.boxC(-0.8, 0, 1.45, 1.6, 1.2, 0.18, 'clothA');
  vox.boxC(-0.8, 0, 1.6, 1.6, 0.4, 0.18, 'roofDark');   // 门内暗腔
  // 地布边
  vox.boxC(-2.5, 0.02, -2.3, 5.0, 0.1, 5.0, 'fieldWheat');
  // 顶穗 + 拉绳桩
  vox.boxC(-0.1, 2.25, -0.1, 0.25, 0.5, 0.25, 'woodMid');
  vox.boxC(2.8, 0, 2.2, 0.22, 0.8, 0.22, 'woodMid');
  vox.boxC(-2.9, 0, 2.0, 0.22, 0.8, 0.22, 'woodMid');
  vox.popTransform();
}

// ------------------------------------------------------------
// 柴堆（码好的木柴 + 斧头插墩）
// ------------------------------------------------------------
function buildWoodpile(w) {
  vox.pushTransform(w.x, CAMP.groundY, w.z, w.rot);
  // 三层木柴（截面朝外的圆木近似）
  for (let layer = 0; layer < 3; layer++) {
    const n = 3 - layer;
    for (let i = 0; i < n; i++) {
      vox.boxC(-1.05 + i * 1.05, layer * 0.62, 0, 0.95, 0.58, 0.95,
        (i + layer) % 2 ? 'woodLight' : 'woodMid');
    }
  }
  // 垫木两根
  vox.boxC(-1.1, -0.28, 0.6, 2.2, 0.28, 0.35, 'woodDark');
  vox.boxC(-1.1, -0.28, -0.6, 2.2, 0.28, 0.35, 'woodDark');
  // 斧头（墩 + 柄 + 斧刃）
  vox.boxC(2.2, 0, 0, 0.55, 0.5, 0.55, 'woodMid');
  vox.boxC(2.2, 0.5, 0, 0.16, 1.5, 0.16, 'woodLight');
  vox.boxC(2.42, 1.75, 0, 0.5, 0.4, 0.14, 'metal');
  vox.popTransform();
}

// ------------------------------------------------------------
// 篝火（柴 + 动态火焰 + 火星 + 光晕 + 点光）
// ------------------------------------------------------------
function buildCampfire(scene, updaters, rng) {
  const { x, z } = CAMP.fire;
  const y = CAMP.groundY;

  // 石圈
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    vox.boxC(x + Math.cos(a) * 1.3 - 0.3, y, z + Math.sin(a) * 1.3 - 0.3,
      0.65, 0.55, 0.65, i % 2 ? 'rock' : 'rockDark');
  }
  // 焦土
  vox.boxC(x - 1.0, y + 0.02, z - 1.0, 2.0, 0.12, 2.0, 'rockDark');
  // 柴（交叉）
  vox.boxC(x - 0.85, y + 0.12, z - 0.2, 1.7, 0.4, 0.5, 'woodDark');
  vox.boxC(x - 0.2, y + 0.12, z - 0.85, 0.5, 0.4, 1.7, 'woodMid');
  vox.boxC(x - 0.6, y + 0.5, z - 0.15, 1.2, 0.35, 0.4, 'woodMid');

  // —— 动态火焰：两层乱序缩放的方块群 ——
  const fireGroup = new THREE.Group();
  fireGroup.position.set(x, y + 0.5, z);
  scene.add(fireGroup);
  const flames = [];
  // 外焰（橙）×5 + 内焰（亮黄）×3
  for (let i = 0; i < 8; i++) {
    const inner = i >= 5;
    const f = dynBoxTo(fireGroup,
      (rng() - 0.5) * (inner ? 0.4 : 0.9),
      0,
      (rng() - 0.5) * (inner ? 0.4 : 0.9),
      1, 1, 1,
      inner ? 'winGlow' : 'winWarm', { glow: true });
    f.userData.inner = inner;
    f.userData.seed = rng() * 10;
    flames.push(f);
  }
  // 火星 ×6（小亮点，上升+重置）
  const sparks = [];
  for (let i = 0; i < 6; i++) {
    const s = dynBoxTo(fireGroup, 0, 0, 0, 0.16, 0.16, 0.16, 'starWarm', { glow: true });
    s.userData.t = rng() * 1.6;
    s.userData.seed = rng() * 10;
    sparks.push(s);
  }

  // 光晕 + 真实点光（全镇点光预算第 3 个）
  const halo = new THREE.Sprite(glowSpriteMat('winWarm', 0.3));
  halo.position.set(x, y + 1.6, z);
  halo.scale.set(7, 7, 1);
  scene.add(halo);
  const light = new THREE.PointLight(hexNum('winWarm'), 18, 22, 1.9);
  light.position.set(x, y + 2.2, z);
  scene.add(light);

  updaters.push((dt, t) => {
    // 火焰块：快速乱序缩放/跳高（篝火的躁动感）
    for (const f of flames) {
      const s = f.userData;
      const wob = Math.sin(t * (s.inner ? 13 : 9) + s.seed);
      const h = (s.inner ? 0.9 : 1.4) + wob * (s.inner ? 0.35 : 0.5);
      f.scale.set((s.inner ? 0.5 : 0.8) + wob * 0.12, h, (s.inner ? 0.5 : 0.8) + wob * 0.12);
      f.position.y = h / 2 - 0.2;
      f.rotation.y = t * 2 + s.seed;
    }
    // 火星：螺旋上升，越升越小
    for (const s of sparks) {
      const u = s.userData;
      u.t += dt;
      if (u.t > 1.6) u.t -= 1.6;
      const k = u.t / 1.6;
      s.position.set(
        Math.sin(k * 9 + u.seed) * 0.5,
        1.2 + k * 3.4,
        Math.cos(k * 7 + u.seed) * 0.5,
      );
      s.scale.setScalar(0.16 * (1 - k));
    }
    // 光晕与点光呼吸
    const flick = 0.82 + 0.18 * Math.sin(t * 7.3) * Math.sin(t * 3.1);
    halo.material.opacity = 0.3 * flick;
    light.intensity = 18 * flick;
  });

  registerBuilding({
    name: '篝火营地', blurb: '火星升上去，有的变成了星星。',
    cx: x, cz: z, y0: y - 1, y1: y + 4.5, halfW: 2.0, halfD: 2.0,
  });
}

// ------------------------------------------------------------
// 坐 log + 观星垫
// ------------------------------------------------------------
function buildLogSeat(l) {
  vox.pushTransform(l.x, CAMP.groundY, l.z, l.rot);
  vox.boxC(-0.9, 0, -0.4, 1.8, 0.65, 0.8, 'woodMid');
  vox.boxC(-1.0, 0, -0.4, 0.2, 0.65, 0.8, 'woodDark');   // 截面
  vox.boxC(0.8, 0, -0.4, 0.2, 0.65, 0.8, 'woodDark');
  vox.popTransform();
}

function buildStargaze(p) {
  vox.pushTransform(p.x, CAMP.groundY, p.z, 12);
  // 圆形观星垫（三层同心）
  vox.boxC(-2.2, 0.04, -2.2, 4.4, 0.1, 4.4, 'grassB');
  vox.boxC(-1.7, 0.06, -1.7, 3.4, 0.1, 3.4, 'awningCream');
  vox.boxC(-1.1, 0.08, -1.1, 2.2, 0.1, 2.2, 'carRed');
  // 枕头 ×2
  vox.boxC(-0.6, 0.16, -0.6, 0.8, 0.3, 0.5, 'awningCream');
  vox.boxC(0.3, 0.16, 0.4, 0.8, 0.3, 0.5, 'awningCream');
  // 保温壶 + 两个杯子
  vox.boxC(1.2, 0.16, -0.9, 0.35, 0.6, 0.35, 'metal');
  vox.windowBox(0.9, 0.16, 0.9, 0.24, 0.26, 0.24, 'winWarm');
  vox.windowBox(1.4, 0.16, 0.8, 0.24, 0.26, 0.24, 'winWarm');
  vox.popTransform();
}

// ------------------------------------------------------------
// 总装
// ------------------------------------------------------------
export function buildCampsite(scene, rng) {
  const updaters = [];
  for (const t of CAMP.tents) buildTent(t);
  buildWoodpile(CAMP.woodpile);
  buildCampfire(scene, updaters, rng);
  for (const l of CAMP.logSeat) buildLogSeat(l);
  buildStargaze(CAMP.stargaze);
  return updaters;
}
