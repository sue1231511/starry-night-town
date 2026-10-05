// ============================================================
// tools/layoutcheck.mjs — 布局冲突校验（纯数据计算，不渲染）
// ------------------------------------------------------------
// 检查住宅/商铺/地标之间、以及与路网/河道/桥/公园设施是否重叠。
// 用法：node tools/layoutcheck.mjs   （0 冲突时静默通过）
// ============================================================
import {
  HOUSES, SHOPS, ROADS, riverZ, RIVER_HALF_W, MILL, BARN, WATERTOWER,
  ORCHARD, PARK, PAVILION, SWING, CAMP, STATION, DOCK, BRIDGES, WHEAT_FIELD,
} from '../js/layout.js';

const issues = [];
const warn = [];

// —— 民宅/商铺/地标的近似占地（圆近似，hypot(W,D)/2）——
const HOUSE_R = Math.hypot(9, 8) / 2; // 参数化住宅 9×8
// 原有共存对（商铺贴面的商业街形态 / 建成区既有关系），不算新冲突
const WHITELIST = new Set([
  '商铺|商铺', '水塔|树屋', '磨坊|谷仓', '树屋|篝火', '车站|秋千', '观星亭|秋千',
]);
const pairKey = (a, b) => [a.kind + '|' + b.kind, b.kind + '|' + a.kind].some(k => WHITELIST.has(k));
const placed = [];
for (const h of HOUSES) placed.push({ kind: '住宅', x: h.x, z: h.z, r: HOUSE_R });
for (const s of SHOPS) placed.push({ kind: '商铺', x: s.x, z: s.z, r: 6.5 });
placed.push(
  { kind: '磨坊', x: MILL.x, z: MILL.z, r: 6 },
  { kind: '谷仓', x: BARN.x, z: BARN.z, r: 6 },
  { kind: '水塔', x: WATERTOWER.x, z: WATERTOWER.z, r: 4 },
  { kind: '树屋', x: 26, z: -33, r: 7.2 },
  { kind: '水车磨坊', x: -38, z: riverZ(-38) + RIVER_HALF_W + 2.2, r: 6 },
  { kind: '车站', x: STATION.x, z: STATION.z, r: 5 },
  { kind: '观星亭', x: PAVILION.x, z: PAVILION.z, r: 3 },
  { kind: '秋千', x: SWING.x, z: SWING.z, r: 2.5 },
  { kind: '篝火', x: CAMP.fire.x, z: CAMP.fire.z, r: 4 },
);

// 1) 建筑两两间距
for (let i = 0; i < placed.length; i++) {
  for (let j = i + 1; j < placed.length; j++) {
    const a = placed[i], b = placed[j];
    if (pairKey(a, b)) continue;
    const d = Math.hypot(a.x - b.x, a.z - b.z);
    const need = a.r + b.r;
    if (d < need - 0.3) {
      issues.push(`[叠] ${a.kind}(${a.x},${a.z}) 与 ${b.kind}(${b.x},${b.z}) 中心距 ${d.toFixed(1)} < 需 ${need.toFixed(1)}`);
    } else if (d < need + 1.5) {
      warn.push(`[贴] ${a.kind}(${a.x},${a.z}) 与 ${b.kind}(${b.x},${b.z}) 间距仅 ${d.toFixed(1)}（需 ${need.toFixed(1)}）`);
    }
  }
}

// 2) 住宅四角不进河床（河床影响半径 RIVER_HALF_W+2.2）
for (const h of HOUSES) {
  const rad = (h.rot || 0) * Math.PI / 180;
  for (const [lx, lz] of [[-4.5, -4], [4.5, -4], [-4.5, 4], [4.5, 4]]) {
    const wx = h.x + lx * Math.cos(rad) + lz * Math.sin(rad);
    const wz = h.z - lx * Math.sin(rad) + lz * Math.cos(rad);
    const rd = Math.abs(wz - riverZ(wx));
    if (rd < RIVER_HALF_W + 2.0) {
      issues.push(`[河] 住宅(${h.x},${h.z}) 角 (${wx.toFixed(1)},${wz.toFixed(1)}) 距河心 ${rd.toFixed(1)} 进河床`);
    }
  }
}

// 3) 住宅不压汽车环路（环路中心线圆角矩形，路半宽 2.5 + 房角半径 0）
const L = ROADS.loop, R = L.radius;
function distToLoop(px, pz) {
  // 圆角矩形 SDF：先求内缩矩形
  const cx = Math.max(L.xMin + R, Math.min(L.xMax - R, px));
  const cz = Math.max(L.zMin + R, Math.min(L.zMax - R, pz));
  const dx = px - cx, dz = pz - cz;
  const inCore = px >= L.xMin + R && px <= L.xMax - R ? 'v' : (pz >= L.zMin + R && pz <= L.zMax - R ? 'h' : 'c');
  if (inCore === 'v') return Math.min(Math.abs(px - L.xMin), Math.abs(px - L.xMax));
  if (inCore === 'h') return Math.min(Math.abs(pz - L.zMin), Math.abs(pz - L.zMax));
  return Math.hypot(dx, dz) - 0; // 到圆角中心距离（角上）
}
for (const h of HOUSES) {
  const rad = (h.rot || 0) * Math.PI / 180;
  for (const [lx, lz] of [[-4.5, -4], [4.5, -4], [-4.5, 4], [4.5, 4]]) {
    const wx = h.x + lx * Math.cos(rad) + lz * Math.sin(rad);
    const wz = h.z - lx * Math.sin(rad) + lz * Math.cos(rad);
    // 只查环路包围盒附近的角
    if (wx > L.xMin - 12 && wx < L.xMax + 12 && wz > L.zMin - 12 && wz < L.zMax + 12) {
      const dl = distToLoop(wx, wz);
      if (dl < 2.5 + 0.6) issues.push(`[路] 住宅(${h.x},${h.z}) 角 (${wx.toFixed(1)},${wz.toFixed(1)}) 距环路中心 ${dl.toFixed(1)} 压路`);
    }
  }
}

// 4) 住宅 vs 桥通道（桥宽 4~6，河两侧 ±6 走向带）
for (const b of BRIDGES) {
  const rz = riverZ(b.x);
  for (const h of HOUSES) {
    if (Math.abs(h.x - b.x) < b.width / 2 + 7 && Math.abs(h.z - rz) < 6 + 6) {
      warn.push(`[桥] 住宅(${h.x},${h.z}) 靠近 ${b.kind} 桥通道 (x=${b.x}, z=${rz.toFixed(1)}) — 请目检`);
    }
  }
}

// 5) 住宅 vs 公园设施/果园/麦田（面状区只查 AABB 相交）
const rects = [
  { kind: '果园', ...ORCHARD },
  { kind: '菜畦', ...PARK.vegetable },
  { kind: '麦田', ...WHEAT_FIELD },
];
for (const h of HOUSES) {
  for (const rc of rects) {
    if (h.x + 5.5 > rc.x0 && h.x - 5.5 < rc.x1 && h.z + 5 > rc.z0 && h.z - 5 < rc.z1) {
      issues.push(`[园] 住宅(${h.x},${h.z}) 与${rc.kind} [${rc.x0}~${rc.x1}, ${rc.z0}~${rc.z1}] 相交`);
    }
  }
  for (const p of PARK.picnic) {
    if (Math.hypot(h.x - p.x, h.z - p.z) < 7) issues.push(`[园] 住宅(${h.x},${h.z}) 压野餐垫(${p.x},${p.z})`);
  }
  for (const s of [PARK.slide, PARK.seesaw, { x: PARK.kite.anchorX, z: PARK.kite.anchorZ }, PARK.scarecrow]) {
    if (Math.hypot(h.x - s.x, h.z - s.z) < 6.5) issues.push(`[园] 住宅(${h.x},${h.z}) 压公园设施(${s.x},${s.z})`);
  }
  for (const lp of PARK.lamps) {
    if (Math.hypot(h.x - lp.x, h.z - lp.z) < 5.5) warn.push(`[园] 住宅(${h.x},${h.z}) 贴公园路灯(${lp.x},${lp.z})`);
  }
}

// 6) 世界边界
for (const h of HOUSES) {
  if (Math.abs(h.x) > 47.5 || Math.abs(h.z) > 47.5) issues.push(`[界] 住宅(${h.x},${h.z}) 出世界边界`);
}

// —— 输出 ——
if (issues.length) {
  console.error(`✗ ${issues.length} 个冲突：`);
  for (const s of issues) console.error('  ' + s);
}
if (warn.length) {
  console.log(`⚠ ${warn.length} 个贴近提醒：`);
  for (const s of warn) console.log('  ' + s);
}
if (!issues.length) {
  console.log(`✓ 布局校验通过：${HOUSES.length} 栋住宅 + ${SHOPS.length} 商铺 + 地标，无硬冲突` +
    (warn.length ? `（${warn.length} 个贴近提醒，目检即可）` : ''));
  process.exit(0);
}
process.exit(1);
