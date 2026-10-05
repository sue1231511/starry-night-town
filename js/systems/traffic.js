// ============================================================
// systems/traffic.js — 跨系统小镇事件
// ------------------------------------------------------------
// · 整点报时：小镇时钟每逢整点，钟楼顶灯打 5 秒脉冲（2.5 拍/秒）
//   —— 换乘提示：HUD 时钟读同一 townClock，报时瞬间同步
// · 车流概览（调试口）：window.__TOWN__.traffic() 查看火车/汽车状态
// ============================================================
import * as THREE from 'three';
import { dynBox } from '../voxel.js';
import { townClock } from '../clock.js';
import { PLAZA, terrainHeight } from '../layout.js';
import { PAL, glowMat } from '../palette.js';

export function buildTraffic(scene) {
  // —— 钟楼顶脉冲灯（独立动态块，不占窗灯调度）——
  const gy = terrainHeight(PLAZA.cx, PLAZA.cz);
  const chime = dynBox(0.9, 0.9, 0.9, 'winGlow', { glow: true });
  // 位置=钟楼避雷针顶端（比常亮顶球再高一截，视觉上分得开）
  chime.position.set(PLAZA.cx, gy + 22.6, PLAZA.cz);
  scene.add(chime);

  let lastHour = Math.floor(townClock.hourFloat());
  let chimeT = -1;

  function tick(dt, t) {
    const h = Math.floor(townClock.hourFloat());
    if (h !== lastHour) {
      lastHour = h;
      chimeT = 0;
    }
    if (chimeT >= 0) {
      chimeT += dt;
      const pulse = 0.5 + 0.5 * Math.sin(chimeT * Math.PI * 2 * 2.5);
      chime.scale.setScalar(0.5 + pulse * 1.1);
      if (chimeT > 5) {
        chimeT = -1;
        chime.scale.setScalar(1);
      }
    }
  }

  return tick;
}
