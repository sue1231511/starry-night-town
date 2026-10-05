// ============================================================
// builders/fountain.js — 中央广场许愿喷泉
// ------------------------------------------------------------
// 池体/雕像走体素桶；水花粒子是动态（effects.js 接管抛物线水滴）。
// ============================================================
import * as THREE from 'three';
import { vox } from '../voxel.js';
import { registerBuilding, terrainHeight, PLAZA } from '../layout.js';
import { registerFountain } from '../systems/effects.js';

export function buildFountain(scene) {
  const gx = PLAZA.cx, gz = PLAZA.cz;
  const gy = terrainHeight(gx, gz);

  vox.pushTransform(gx, gy, gz, 0);

  // —— 池体（八角近似：外方内圆的体素做法，两级池沿）——
  vox.boxC(-3.6, 0, -3.6, 7.2, 0.9, 7.2, 'rock');
  vox.boxC(-3.0, 0.35, -3.0, 6.0, 0.75, 6.0, 'rockDark');       // 池沿内衬
  vox.boxC(-2.7, 0.3, -2.7, 5.4, 0.5, 5.4, 'waterFace');          // 池水（静态池面）
  vox.windowBox(-2.7, 0.56, -2.7, 5.4, 0.14, 5.4, 'waterGlint');  // 水面高光层
  // 池沿角柱（四角小柱灯）
  for (const px of [-3.4, 3.0]) {
    for (const pz of [-3.4, 3.0]) {
      vox.boxC(px, 0.9, pz, 0.65, 0.65, 0.65, 'rockDark');
      vox.windowBox(px + 0.08, 1.7, pz + 0.08, 0.5, 0.5, 0.5, 'lampGlow');
    }
  }

  // —— 中央柱 + 承水盘 ——
  vox.boxC(-0.8, 0.8, -0.8, 1.6, 2.2, 1.6, 'rock');
  vox.boxC(-1.6, 3.0, -1.6, 3.2, 0.5, 3.2, 'rockDark');   // 一级承水盘
  vox.boxC(-0.5, 3.5, -0.5, 1.0, 1.4, 1.0, 'rock');        // 小柱
  vox.boxC(-1.15, 4.9, -1.15, 2.3, 0.4, 2.3, 'rockDark'); // 二级承水盘
  // 顶上：托星星的小人雕像（抽象体素小人 + 头顶发光星）
  vox.boxC(-0.55, 5.3, -0.55, 1.1, 1.5, 1.1, 'wallSlate');
  vox.boxC(-0.4, 6.8, -0.4, 0.8, 0.7, 0.8, 'npcSkin');
  vox.boxC(-0.75, 6.1, -0.75, 0.35, 1.2, 0.35, 'wallSlate'); // 手臂上举 ×2
  vox.boxC(0.4, 6.1, -0.75, 0.35, 1.2, 0.35, 'wallSlate');
  vox.windowBox(0, 7.8, 0, 0.9, 0.9, 0.9, 'winGlow');        // 头顶许愿星

  vox.popTransform();

  // 水花效果交给 effects（从二级盘沿向池面抛洒）
  registerFountain({ x: gx, y: gy + 5.1, z: gz, radius: 1.15 });

  registerBuilding({
    name: '许愿喷泉', blurb: '硬币每年秋天捞一次，捐给镇图书馆。',
    cx: gx, cz: gz, y0: gy - 1, y1: gy + 8.4, halfW: 3.9, halfD: 3.9,
  });

  return [];
}
