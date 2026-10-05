// ============================================================
// builders/props.js — 小镇家什：路灯 / 长椅 / 水塔 / 观星亭 / 秋千 / 水井 / 路牌
// ------------------------------------------------------------
// 路灯 = 灯柱(体素桶) + 发光灯头 + 假光斑 sprite（呼吸动画）。
// 秋千座 / 光斑是动态件，返回 updater。
// ============================================================
import * as THREE from 'three';
import { vox, dynBoxTo } from '../voxel.js';
import { glowSpriteMat } from '../palette.js';
import {
  registerBuilding, terrainHeight, ROADS, PLAZA,
  WATERTOWER, PAVILION, SWING, makeRng,
} from '../layout.js';
import { registerBeacon } from '../systems/schedule.js';

// ------------------------------------------------------------
// 路灯
// ------------------------------------------------------------
function streetLamp(x, z, { tall = false } = {}) {
  const gy = terrainHeight(x, z);
  const H = tall ? 5.6 : 4.6;
  vox.pushTransform(x, gy, z, 0);
  vox.boxC(-0.5, 0, -0.5, 1.0, 0.4, 1.0, 'rockDark');          // 底座
  vox.boxC(-0.14, 0.4, -0.14, 0.28, H, 0.28, 'metal');          // 灯柱
  vox.boxC(-0.3, H * 0.55, -0.3, 0.6, 0.12, 0.6, 'metal');      // 修灯踩环
  vox.boxC(-0.45, H + 0.4, -0.45, 0.9, 0.55, 0.9, 'metal');     // 灯罩
  vox.windowBox(-0.32, H - 0.5, -0.32, 0.64, 0.85, 0.64, 'lampGlow'); // 灯头
  vox.boxC(-0.1, H + 0.95, -0.1, 0.2, 0.3, 0.2, 'metal');       // 顶帽
  vox.popTransform();
  return { x, y: gy + H, z };
}

export function buildProps(scene) {
  const updaters = [];
  const rng = makeRng(424242);

  // —— 路网 → 路灯点位 ——
  const lampSpots = [];
  // 主街两侧（左右交替 + 高低交替）
  let sideFlip = false;
  for (let z = -18; z <= 30; z += 8) {
    if (Math.abs(z - 14) < 5) continue; // 桥上不放
    lampSpots.push({ x: sideFlip ? 3.2 : -3.2, z, tall: !sideFlip });
    sideFlip = !sideFlip;
  }
  // 环路四角与四边中点
  const L = ROADS.loop;
  for (const [lx, lz] of [
    [L.xMin + 2, L.zMin + 2], [L.xMax - 2, L.zMin + 2],
    [L.xMin + 2, L.zMax - 2], [L.xMax - 2, L.zMax - 2],
    [0, L.zMax - 2], [0, L.zMin + 2],
    [L.xMin + 2, 0], [L.xMax - 2, 0],
  ]) lampSpots.push({ x: lx, z: lz, tall: true });
  // 河岸两盏（踏石桥头）
  lampSpots.push({ x: -16, z: 9, tall: false });

  const lampGlows = [];
  for (const s of lampSpots) {
    streetLamp(s.x, s.z, s);
    // 假光斑（billboard，光晕呼吸；小而淡：只做氛围不给占位感）
    const spr = new THREE.Sprite(glowSpriteMat('lampGlow', 0.2));
    const gy = terrainHeight(s.x, s.z);
    spr.position.set(s.x, gy + (s.tall ? 5.4 : 4.4), s.z);
    spr.scale.set(2.3, 2.3, 1);
    scene.add(spr);
    lampGlows.push({ spr, phase: rng() * Math.PI * 2 });
  }
  // 光晕呼吸
  updaters.push((dt, t) => {
    for (const g of lampGlows) {
      const k = 0.78 + 0.22 * Math.sin(t * 1.7 + g.phase);
      g.spr.material.opacity = 0.2 * k;
    }
  });

  // —— 长椅（广场 4 + 河岸 2 + 公园 2）——
  const benchAt = (x, z, rot) => {
    const gy = terrainHeight(x, z);
    vox.pushTransform(x, gy, z, rot);
    vox.boxC(-1.5, 0.5, -0.55, 3.0, 0.22, 1.1, 'woodMid');    // 坐板
    vox.boxC(-1.5, 1.15, -0.95, 3.0, 0.9, 0.22, 'woodMid');   // 靠背
    vox.boxC(-1.4, 0, -0.5, 0.25, 0.5, 0.9, 'metal');         // 腿×2
    vox.boxC(1.15, 0, -0.5, 0.25, 0.5, 0.9, 'metal');
    vox.popTransform();
  };
  benchAt(-11, -10, 90); benchAt(11, -10, -90);
  benchAt(-11, 2, 90); benchAt(11, 2, -90);
  benchAt(-18, 9.5, 180); benchAt(20, 9.5, 180);
  benchAt(-20, 28, 135); benchAt(-10, 32, 45);

  // —— 水井（广场东北角）——
  const gy = terrainHeight(9, 2);
  vox.pushTransform(9, gy, 2, 0);
  vox.boxC(-1.3, 0, -1.3, 2.6, 1.3, 2.6, 'rock');            // 井身
  vox.boxC(-1.05, 0.5, -1.05, 2.1, 0.8, 2.1, 'waterFace');   // 井水面
  vox.boxC(-1.45, 1.3, -1.45, 2.9, 0.25, 2.9, 'rockDark');   // 井沿
  vox.boxC(-1.35, 1.55, -0.15, 0.25, 2.2, 0.25, 'woodMid');  // 支架×2
  vox.boxC(1.1, 1.55, -0.15, 0.25, 2.2, 0.25, 'woodMid');
  vox.boxC(-1.5, 3.75, -0.4, 3.0, 0.3, 0.9, 'roofRed');      // 小屋顶
  vox.boxC(-0.25, 3.0, -0.25, 0.5, 0.7, 0.5, 'woodDark');    // 滑轮罩
  vox.popTransform();
  registerBuilding({
    name: '老水井', blurb: '许愿请去喷泉，这里只打水。',
    cx: 9, cz: 2, y0: gy - 1, y1: gy + 4.1, halfW: 1.7, halfD: 1.7,
  });

  // —— 高地水塔（塔架 + 顶罐 + 航空障碍灯）——
  {
    const { x, z } = WATERTOWER;
    const y = WATERTOWER.groundY;
    vox.pushTransform(x, y, z, 0);
    // 四腿塔架（内收）
    for (let i = 0; i < 4; i++) {
      const lx = (i % 2 ? 1 : -1), lz = (i < 2 ? -1 : 1);
      vox.boxC(lx * 2.4 - 0.2, 0, lz * 2.4 - 0.2, 0.45, 3.2, 0.45, 'metal');
      vox.boxC(lx * 1.7 - 0.2, 3.2, lz * 1.7 - 0.2, 0.4, 3.0, 0.4, 'metal');
    }
    // 交叉斜撑
    vox.boxC(0, 1.6, -2.2, 4.6, 0.18, 0.18, 'metal');
    vox.boxC(-2.2, 3.0, 0, 0.18, 0.18, 4.6, 'metal');
    // 顶罐（圆肚近似：两段收腰）+ 锥顶
    vox.boxC(-2.3, 6.2, -2.3, 4.6, 2.6, 4.6, 'metal');
    vox.boxC(-2.5, 5.9, -2.5, 5.0, 0.5, 5.0, 'rockDark');
    vox.boxC(-2.5, 8.8, -2.5, 5.0, 0.5, 5.0, 'rockDark');
    vox.boxC(-1.7, 9.3, -1.7, 3.4, 1.4, 3.4, 'roofRed');
    vox.boxC(-0.7, 10.7, -0.7, 1.4, 0.9, 1.4, 'roofDark');
    vox.boxC(-0.06, 11.6, -0.06, 0.12, 0.9, 0.12, 'metal');
    // 爬梯
    for (let i = 0; i < 12; i++) vox.boxC(2.35, 0.4 + i * 0.85, 1.9, 0.16, 0.16, 0.6, 'metal');
    vox.popTransform();
    // 航空障碍灯（红，慢闪）——发光块走体素桶 + schedule 注册坐标闪替
    const beaconEntry = vox.windowBox(x, y + 12.6, z, 0.55, 0.55, 0.55, 'bulbRed');
    registerBeacon({ entry: beaconEntry, period: 2.4 });
    registerBuilding({
      name: '高地水塔', blurb: '红灯眨眼，是它在说晚安。',
      cx: x, cz: z, y0: y - 1, y1: y + 12.9, halfW: 2.9, halfD: 2.9,
    });
  }

  // —— 观星亭（南公园，六柱 + 尖顶 + 内灯）——
  {
    const { x, z } = PAVILION;
    const gy = terrainHeight(x, z);
    vox.pushTransform(x, gy, z, 0);
    vox.boxC(-3.2, 0, -3.2, 6.4, 0.5, 6.4, 'rock');           // 台基
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3 + Math.PI / 6;
      const px = Math.cos(a) * 2.7, pz = Math.sin(a) * 2.7;
      vox.boxC(px - 0.28, 0.5, pz - 0.28, 0.56, 3.4, 0.56, 'wallCream');
    }
    vox.boxC(-2.9, 3.9, -2.9, 5.8, 0.45, 5.8, 'roofGreen');   // 檐
    vox.boxC(-2.1, 4.35, -2.1, 4.2, 0.9, 4.2, 'roofGreen');
    vox.boxC(-1.1, 5.25, -1.1, 2.2, 0.9, 2.2, 'roofDark');
    vox.boxC(-0.15, 6.15, -0.15, 0.3, 1.1, 0.3, 'metal');
    // 亭内吊灯
    vox.windowBox(0, 3.1, 0, 0.8, 0.8, 0.8, 'lampGlow');
    // 亭内石桌石凳
    vox.boxC(-0.6, 0.5, -0.6, 1.2, 0.8, 1.2, 'rockDark');
    vox.boxC(1.6, 0.5, 0.4, 0.7, 0.6, 0.7, 'rock');
    vox.boxC(-1.8, 0.5, 1.2, 0.7, 0.6, 0.7, 'rock');
    vox.popTransform();
    registerBuilding({
      name: '观星亭', blurb: '流星一分钟最多一颗，别贪。',
      cx: x, cz: z, y0: gy - 1, y1: gy + 7.3, halfW: 3.3, halfD: 3.3,
    });
  }

  // —— 秋千架（动态摆）——
  {
    const { x, z } = SWING;
    const gy = terrainHeight(x, z);
    const swingGroup = new THREE.Group();
    swingGroup.position.set(x, gy, z);
    swingGroup.rotation.y = -30 * Math.PI / 180;
    scene.add(swingGroup);

    vox.pushTransform(x, gy, z, -30);
    vox.boxC(-2.4, 0, -1.2, 4.8, 0.3, 2.4, 'rockDark');       // 沙坑边框
    vox.boxC(-2.2, 0.05, -1.0, 4.4, 0.2, 2.0, 'fieldWheat');  // 沙坑
    // A 型架×2
    for (const ax of [-1.8, 1.2]) {
      vox.boxC(ax, 0.3, -1.0, 0.28, 3.6, 0.28, 'metal');
      vox.boxC(ax + 0.6, 0.3, -0.6, 0.28, 3.6, 0.28, 'metal');
      vox.boxC(ax + 0.3, 3.9, -0.8, 0.28, 0.28, 1.2, 'metal');
    }
    // 顶横梁
    vox.boxC(-1.8, 3.9, -0.8, 4.0, 0.26, 0.26, 'metal');
    vox.popTransform();

    // 秋千座（动态：两根绳 + 板，绕顶梁摆）
    const pend = new THREE.Group();
    pend.position.set(0, 3.9, -0.8);
    swingGroup.add(pend);
    dynBoxTo(pend, -0.5, -1.15, 0, 0.09, 2.3, 0.09, 'woodMid');
    dynBoxTo(pend, 0.5, -1.15, 0, 0.09, 2.3, 0.09, 'woodMid');
    dynBoxTo(pend, 0, -2.3, 0, 1.5, 0.14, 0.5, 'woodLight');
    updaters.push((dt, t) => {
      pend.rotation.x = Math.sin(t * 0.9) * 0.45 - 0.06;
    });
  }

  // —— 路牌（主街/横街口，双牌）——
  {
    const gy = terrainHeight(3.4, 4);
    vox.pushTransform(3.4, gy, 4, 0);
    vox.boxC(-0.14, 0, -0.14, 0.28, 3.4, 0.28, 'metal');
    vox.boxC(-0.75, 2.7, -0.02, 1.5, 0.45, 0.14, 'awningCream'); // 牌1：北街
    vox.boxC(0.02, 2.2, -0.75, 0.14, 0.45, 1.5, 'awningCream');  // 牌2：横街
    vox.popTransform();
  }

  return { updaters, lampGlows };
}
