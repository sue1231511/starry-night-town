// ============================================================
// builders/boats.js — 河畔小船（系泊晃动）/ 热气球（巡航）
// ------------------------------------------------------------
// 全动态件：小船绕系泊点轻晃 + 随波升降；
// 热气球沿大圆航线巡航、高度缓变、吊篮暖灯、火焰闪。
// ============================================================
import * as THREE from 'three';
import { dynBoxTo } from '../voxel.js';
import { BOAT, riverZ } from '../layout.js';

export function buildBoats(scene) {
  const updaters = [];

  // —— 系泊小船 ——
  const boat = new THREE.Group();
  const rz = riverZ(BOAT.x);
  boat.position.set(BOAT.x, 0.55, BOAT.z);
  scene.add(boat);
  // 船体（中空槽近似：底 + 两侧舷 + 两头翘）
  dynBoxTo(boat, 0, 0.3, 0, 3.6, 0.35, 1.7, 'woodLight');      // 船底
  dynBoxTo(boat, 0, 0.55, 0.75, 3.6, 0.5, 0.28, 'woodMid');    // 左舷
  dynBoxTo(boat, 0, 0.55, -0.75, 3.6, 0.5, 0.28, 'woodMid');   // 右舷
  dynBoxTo(boat, 1.5, 0.62, 0, 0.6, 0.75, 1.7, 'woodMid');     // 船头翘
  dynBoxTo(boat, -1.5, 0.62, 0, 0.6, 0.75, 1.7, 'woodMid');    // 船尾翘
  dynBoxTo(boat, -0.9, 0.48, 0, 0.7, 0.24, 1.1, 'woodDark');   // 尾座板
  dynBoxTo(boat, 1.4, 0.85, 0, 0.22, 0.22, 0.9, 'metal');      // 系船环
  // 船内一盏小灯笼（夜钓氛围）
  dynBoxTo(boat, 0.2, 0.85, 0, 0.3, 0.36, 0.3, 'lampGlow', { glow: true });
  // 船桨斜搭
  dynBoxTo(boat, -0.3, 0.62, 0.3, 1.8, 0.14, 0.14, 'woodDark');

  // 晃动动画
  updaters.push((dt, t) => {
    boat.rotation.z = Math.sin(t * 1.1) * 0.045;
    boat.rotation.x = Math.sin(t * 0.8 + 1.3) * 0.03;
    boat.position.y = 0.55 + Math.sin(t * 1.4) * 0.06;
    // 系泊绳方向轻拽（绕系桩微摆）
    boat.rotation.y = Math.sin(t * 0.5) * 0.06;
  });

  return updaters;
}

export function buildBalloon(scene) {
  const updaters = [];

  const balloon = new THREE.Group();
  scene.add(balloon);

  // —— 球囊（八瓣条纹近似：中心柱 + 四周瓣块）——
  const envelope = new THREE.Group();
  balloon.add(envelope);
  dynBoxTo(envelope, 0, 0, 0, 2.4, 2.2, 2.4, 'awningRed');      // 芯
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    const px = Math.cos(a) * 1.6, pz = Math.sin(a) * 1.6;
    dynBoxTo(envelope, px, -0.2, pz, 1.5, 1.8, 1.5, i % 2 ? 'awningCream' : 'awningRed');
  }
  dynBoxTo(envelope, 0, 1.3, 0, 1.8, 1.2, 1.8, 'awningRed');   // 顶
  dynBoxTo(envelope, 0, 2.3, 0, 0.9, 0.7, 0.9, 'roofDark');    // 顶帽
  dynBoxTo(envelope, 0, -1.35, 0, 1.3, 0.6, 1.3, 'roofDark');  // 收口

  // —— 吊索 + 吊篮 ——
  for (const [sx, sz] of [[-1.0, -1.0], [1.0, -1.0], [-1.0, 1.0], [1.0, 1.0]]) {
    dynBoxTo(balloon, sx * 0.55, -2.5, sz * 0.55, 0.1, 1.6, 0.1, 'woodMid');
  }
  const basket = new THREE.Group();
  basket.position.y = -3.6;
  balloon.add(basket);
  dynBoxTo(basket, 0, 0, 0, 1.5, 0.9, 1.5, 'woodLight');       // 篮体
  dynBoxTo(basket, 0, -0.5, 0, 1.7, 0.2, 1.7, 'woodDark');     // 篮底
  dynBoxTo(basket, 0, 0.62, 0, 1.2, 0.28, 1.2, 'woodMid');     // 篮沿
  dynBoxTo(basket, 0, 1.0, 0, 0.4, 0.45, 0.4, 'awningRed');    // 沙袋
  // 燃烧器火焰（动态闪烁）+ 篮内暖灯
  const flame = dynBoxTo(basket, 0, 0.95, 0, 0.3, 0.5, 0.3, 'winWarm', { glow: true });
  dynBoxTo(basket, 0.4, 0.2, 0.4, 0.25, 0.25, 0.25, 'lampGlow', { glow: true });

  // —— 巡航参数：绕镇大圆 + 高度缓变（低空巡航，融进天际线）——
  const R = 46;
  const angularSpeed = 0.028; // rad/s，约 3.7 分钟一圈
  updaters.push((dt, t) => {
    const a = t * angularSpeed + 2.1;
    const x = Math.cos(a) * R;
    const z = Math.sin(a) * R * 0.8 - 2;
    const y = 17 + Math.sin(t * 0.11) * 3;
    balloon.position.set(x, y, z);
    // 朝向切线方向
    balloon.rotation.y = -a;
    // 球囊轻微摇摆 + 火焰闪
    envelope.rotation.z = Math.sin(t * 0.7) * 0.04;
    flame.scale.y = 0.5 + 0.45 * (0.6 + 0.4 * Math.sin(t * 9.3) * Math.sin(t * 3.1));
  });

  return updaters;
}
