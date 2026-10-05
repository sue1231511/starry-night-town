// ============================================================
// builders/bridges.js — 拱桥 / 木桥 / 踏石 / 南岸码头
// ------------------------------------------------------------
// 桥面要接住两岸路面高度（主街/环路），拱桥带石栏杆与灯。
// ============================================================
import { vox } from '../voxel.js';
import { BRIDGES, DOCK, riverZ, RIVER_HALF_W, terrainHeight, registerBuilding } from '../layout.js';

/** 石拱桥：主街跨河（有弧度、栏杆、灯） */
function buildArchBridge(b) {
  const rz = riverZ(b.x);
  const span = RIVER_HALF_W * 2 + 9;   // 跨径（覆盖河+两岸搭头）
  const half = span / 2;
  // 弧线：y = arch(z)
  const arch = (dz) => {
    const t = Math.max(0, 1 - Math.abs(dz) / half);
    return 1.8 * (t * t * (3 - 2 * t)); // 桥心比路面高 1.8
  };
  // 桥面板（沿 z 分条铺，微台阶化——体素拱）
  const deckW = b.width;
  for (let dz = -half; dz < half; dz += 1.0) {
    const y0 = arch(dz + 0.5);
    const len = 1.0;
    vox.boxC(b.x - deckW / 2, 0.55 + y0, dz, deckW, 0.5, len, 'roadLit');
    // 桥拱侧沿（两侧弧形石带）
    vox.boxC(b.x - deckW / 2 - 0.35, 0.2 + y0, dz, 0.7, 0.9, len, 'rock');
    vox.boxC(b.x + deckW / 2 - 0.35, 0.2 + y0, dz, 0.7, 0.9, len, 'rock');
  }
  // 栏杆柱（每 2.5 一根，桥面高随弧）
  for (let dz = -half; dz <= half; dz += 2.5) {
    const y = arch(dz) + 1.05;
    for (const sx of [b.x - deckW / 2 - 0.35, b.x + deckW / 2 - 0.35]) {
      vox.boxC(sx - 0.15, y, dz - 0.15, 0.5, 0.9, 0.5, 'rockDark');
      // 栏杆灯（桥心两盏）
      if (Math.abs(dz) < 1.3) {
        vox.windowBox(sx - 0.15, y + 0.9, dz - 0.15, 0.55, 0.55, 0.55, 'lampGlow');
      }
    }
  }
  // 拱腹（桥下弧形填充，让桥从侧面看有实体感）
  for (let dz = -half + 1; dz < half - 1; dz += 1.0) {
    const y = arch(dz) - 0.4;
    if (y > 0.3) {
      vox.boxC(b.x - deckW / 2 + 0.6, y - 1.6, dz, deckW - 1.2, 1.6, 1.0, 'rockDark');
    }
  }
}

/** 木桥：环路跨河 ×2（平桥，木板 + 绳栏杆） */
function buildWoodBridge(b) {
  const rz = riverZ(b.x);
  const span = RIVER_HALF_W * 2 + 7;
  const half = span / 2;
  const deckW = b.width;
  // 桥板（错缝双色）
  let i = 0;
  for (let dz = -half; dz < half; dz += 1.1) {
    vox.boxC(b.x - deckW / 2, 0.75, dz, deckW, 0.35, 1.0, i++ % 2 ? 'woodLight' : 'woodMid');
  }
  // 桥桩（两岸 + 河中各一对）
  for (const dz of [-half + 0.8, 0, half - 0.8]) {
    vox.boxC(b.x - deckW / 2 - 0.2, -1.4, dz - 0.2, 0.5, 2.5, 0.5, 'woodDark');
    vox.boxC(b.x + deckW / 2 - 0.3, -1.4, dz - 0.2, 0.5, 2.5, 0.5, 'woodDark');
  }
  // 绳栏杆（细横杆 + 立柱）
  for (const sx of [b.x - deckW / 2 - 0.2, b.x + deckW / 2 - 0.3]) {
    for (let dz = -half; dz <= half; dz += 2.2) {
      vox.boxC(sx - 0.12, 1.1, dz - 0.12, 0.3, 0.9, 0.3, 'woodMid');
    }
    vox.boxC(sx - 0.12, 1.85, -half, 0.22, 0.16, span, 'woodLight');
  }
}

/** 踏石：行人装饰（露出水面的石头串） */
function buildSteppingStones(b) {
  const rz = riverZ(b.x);
  for (let dz = -RIVER_HALF_W - 1; dz <= RIVER_HALF_W + 1; dz += 1.8) {
    vox.boxC(b.x - 0.8, 0.05, rz + dz - 0.8, 1.6, 0.55, 1.6, 'rock');
    // 石头小草帽
    if ((dz + 10) % 3.6 < 1) vox.boxC(b.x - 0.3, 0.6, rz + dz - 0.3, 0.7, 0.3, 0.7, 'bush');
  }
}

export function buildBridges() {
  for (const b of BRIDGES) {
    if (b.kind === 'arch') buildArchBridge(b);
    else if (b.kind === 'wood') buildWoodBridge(b);
    else buildSteppingStones(b);
  }
  return [];
}

/** 南岸小码头：栈道 + 系船桩 + 灯 + 鱼筐 */
export function buildDock() {
  const { x, z } = DOCK;
  const rz = riverZ(x);
  // 栈道从南岸伸进河面
  for (let dz = 0; dz > -5.4; dz -= 1.2) {
    vox.boxC(x - 1.3, 0.55, rz + RIVER_HALF_W + dz, 2.6, 0.35, 1.1, 'woodLight');
  }
  // 栈道桩
  for (const [px, pz] of [[x - 1.1, rz + RIVER_HALF_W - 1.0], [x + 1.1, rz + RIVER_HALF_W - 1.0], [x - 1.1, rz + RIVER_HALF_W - 4.4], [x + 1.1, rz + RIVER_HALF_W - 4.4]]) {
    vox.boxC(px - 0.2, -1.6, pz - 0.2, 0.45, 2.6, 0.45, 'woodDark');
  }
  // 系船桩（矮桩 + 绳环）
  vox.boxC(x + 1.0, 0.9, rz + RIVER_HALF_W - 0.8, 0.4, 0.7, 0.4, 'woodDark');
  // 桥头灯
  vox.boxC(x - 1.0, 0.9, rz + RIVER_HALF_W + 0.2, 0.22, 2.2, 0.22, 'metal');
  vox.windowBox(x - 1.0, 3.1, rz + RIVER_HALF_W + 0.2, 0.6, 0.6, 0.6, 'lampGlow');
  // 鱼筐小凳
  vox.boxC(x + 0.4, 0.9, rz + RIVER_HALF_W - 3.6, 0.9, 0.6, 0.9, 'woodMid');

  registerBuilding({
    name: '老码头', blurb: '系船桩上的绳结，是船长昨晚打的。',
    cx: x, cz: rz + RIVER_HALF_W - 2, y0: -1, y1: 3.8, halfW: 2.2, halfD: 4,
  });
  return [];
}
