// ============================================================
// builders/house.js — 参数化住宅生成器
// ------------------------------------------------------------
// 局部坐标建模：门朝 +z（南），中心为原点。rot 由 pushTransform 处理。
// 参数：floors 层数 / roof: gable|hip|flat / wall 墙色 / roofC 顶色
//       chimney 烟囱 / flower 花箱 / terrace 平顶露台
// 13 栋住宅的参数在 layout.js HOUSES 里，加房子去那里加一行。
// ============================================================
import { vox } from '../voxel.js';
import { registerBuilding, terrainHeight, HOUSES, makeRng } from '../layout.js';
import { registerChimney } from '../systems/effects.js';

const FLOOR_H = 3.2;        // 层高
const WALL_W = 9;           // 默认面宽
const WALL_D = 8;           // 默认进深

/** 一栋宅子（局部坐标，门朝 +z） */
function buildOne(cfg, rng) {
  const floors = cfg.floors ?? 1;
  const W = cfg.w ?? WALL_W;
  const D = cfg.d ?? WALL_D;
  const wallH = floors * FLOOR_H;
  const wall = cfg.wall ?? 'wallCream';
  const roofC = cfg.roofC ?? 'roofRed';

  // —— 基座石硌 ——
  vox.boxC(-W / 2 - 0.6, -0.5, -D / 2 - 0.6, W + 1.2, 0.5, D + 1.2, 'rockDark');

  // —— 主体墙 ——
  vox.boxC(-W / 2, 0, -D / 2, W, wallH, D, wall);

  // —— 四角木框架柱 ——
  const postS = 0.8;
  for (const px of [-W / 2, W / 2 - postS]) {
    for (const pz of [-D / 2, D / 2 - postS]) {
      vox.boxC(px, 0, pz, postS, wallH, postS, 'woodDark');
    }
  }
  // 檐口横梁（墙顶一圈）
  vox.boxC(-W / 2 - 0.3, wallH - 0.4, -D / 2 - 0.3, W + 0.6, 0.5, D + 0.6, 'woodDark');

  // —— 门（+z 面）——
  const doorW = 2, doorH = 2.8;
  vox.boxC(-doorW / 2, 0, D / 2 - 0.05, doorW, doorH, 0.35, 'woodMid');
  // 门框
  vox.boxC(-doorW / 2 - 0.25, 0, D / 2 + 0.05, 0.3, doorH + 0.3, 0.3, 'woodDark');
  vox.boxC(doorW / 2 - 0.05, 0, D / 2 + 0.05, 0.3, doorH + 0.3, 0.3, 'woodDark');
  // 门上小雨棚
  vox.boxC(-doorW / 2 - 0.5, doorH + 0.3, D / 2 + 0.45, doorW + 1, 0.4, 1.1, roofC);
  // 门把手
  vox.boxC(doorW / 2 - 0.5, 1.3, D / 2 + 0.18, 0.25, 0.25, 0.2, 'metal');
  // 台阶
  vox.boxC(-1.4, -0.25, D / 2 + 0.9, 2.8, 0.25, 0.9, 'roadDark');
  vox.boxC(-1.1, -0.12, D / 2 + 1.6, 2.2, 0.2, 0.7, 'roadLit');

  // —— 窗（贴墙面上的发光薄板 + 木框）——
  // 正面每层 2 窗，侧面每层 1 窗，背面每层 1 窗
  const winW = 1.5, winH = 1.7;
  for (let f = 0; f < floors; f++) {
    const wy = f * FLOOR_H + 1.1;
    const warm = rng() < 0.35;
    const winC = warm ? 'winWarm' : 'winGlow';
    // 正面两窗（避开门）
    for (const wx of [-W / 2 + 2.1, W / 2 - 3.6]) {
      if (f === 0 && Math.abs(wx) < doorW / 2 + 1.2) continue;
      vox.windowBox(wx + winW / 2, wy, D / 2 + 0.08, winW, winH, 0.25, winC);
      vox.boxC(wx - 0.2, wy - 0.25, D / 2 + 0.1, winW + 0.4, 0.25, 0.35, 'woodDark'); // 窗台
      if (cfg.flower && rng() < 0.7) {
        // 窗下花箱
        vox.boxC(wx - 0.1, wy - 0.65, D / 2 + 0.25, winW + 0.2, 0.4, 0.6, 'woodMid');
        vox.boxC(wx, wy - 0.28, D / 2 + 0.3, 0.4, 0.35, 0.4, rng() < 0.5 ? 'flowerRed' : 'flowerYel');
        vox.boxC(wx + winW - 0.4, wy - 0.28, D / 2 + 0.3, 0.4, 0.35, 0.4, 'flowerBlu');
      }
    }
    // 侧面（±x）各一窗（贴侧面外凸 0.12）
    vox.windowBox(W / 2 + 0.12, wy, -0.9, 0.25, winH, winW, winC);
    vox.windowBox(-W / 2 - 0.37, wy, -0.9, 0.25, winH, winW, rng() < 0.4 ? 'winWarm' : 'winGlow');
    // 背面一窗
    vox.windowBox(-winW / 2 + 0.6, wy, -D / 2 - 0.33, winW, winH, 0.25, rng() < 0.3 ? 'winWarm' : 'winGlow');
  }

  // —— 外挂楼梯（两层且非 terrace：侧面上二楼的小铁梯）——
  if (floors >= 2 && !cfg.terrace) {
    const sx = W / 2 + 0.7;
    for (let i = 0; i < 6; i++) {
      vox.boxC(sx - 0.1, i * (FLOOR_H / 6), -D / 2 + 1 + i * 1.0, 0.9, 0.25, 0.9, 'metal');
    }
    vox.boxC(sx + 0.4, 0, -D / 2 + 0.6, 0.25, FLOOR_H + 0.2, 0.25, 'metal'); // 扶手立柱
  }

  // —— 屋顶 ——
  const roofBase = wallH + 0.1;
  if (cfg.roof === 'gable') {
    // 山墙尖顶：两级阶梯坡 + 山墙三角填充
    const steps = [
      { inset: 0, h: 1.1 },
      { inset: 2.2, h: 1.1 },
      { inset: 4.0, h: 1.0 },
    ];
    let y = roofBase;
    for (const s of steps) {
      vox.boxC(-W / 2 - 0.9 + s.inset, y, -D / 2 - 0.9, W + 1.8 - s.inset * 2, s.h, D + 1.8, roofC);
      y += s.h;
    }
    // 屋脊
    vox.boxC(-W / 2 - 0.4, y, -D / 2 - 0.4, W + 0.8, 0.5, D + 0.8, 'woodDark');
    // 山墙三角（前后）
    vox.boxC(-W / 2 + 1.2, roofBase, -D / 2 - 0.5, W - 2.4, 1.0, 0.5, wall);
    vox.boxC(-W / 2 + 1.2, roofBase, D / 2, W - 2.4, 1.0, 0.5, wall);
    vox.boxC(-W / 2 + 2.8, roofBase + 1.0, -D / 2 - 0.5, W - 5.6, 0.9, 0.5, wall);
    vox.boxC(-W / 2 + 2.8, roofBase + 1.0, D / 2, W - 5.6, 0.9, 0.5, wall);
    // 阁楼小圆窗（正面山墙）
    vox.windowBox(-0.6, roofBase + 0.35, D / 2 + 0.05, 1.2, 1.0, 0.3, 'winWarm');
  } else if (cfg.roof === 'hip') {
    // 四坡顶：两级四周内缩
    vox.boxC(-W / 2 - 0.9, roofBase, -D / 2 - 0.9, W + 1.8, 1.0, D + 1.8, roofC);
    vox.boxC(-W / 2 - 0.4, roofBase + 1.0, -D / 2 - 0.4, W + 0.8 - 2.2, 0.9, D + 0.8 - 2.2, roofC);
    vox.boxC(-W / 2 + 1.4, roofBase + 1.9, -D / 2 + 1.4, W - 2.8, 0.8, D - 2.8, 'roofDark');
  } else {
    // 平顶 + 女儿墙
    vox.boxC(-W / 2, roofBase, -D / 2, W, 0.6, D, 'roofDark');
    const par = 0.7;
    vox.boxC(-W / 2 - 0.15, roofBase + 0.6, -D / 2 - 0.15, W + 0.3, par, 0.4, wall);
    vox.boxC(-W / 2 - 0.15, roofBase + 0.6, D / 2 - 0.25, W + 0.3, par, 0.4, wall);
    vox.boxC(-W / 2 - 0.15, roofBase + 0.6, -D / 2 + 0.2, 0.4, par, D - 0.4, wall);
    vox.boxC(W / 2 - 0.25, roofBase + 0.6, -D / 2 + 0.2, 0.4, par, D - 0.4, wall);
    // 露台：小桌两凳一盆花
    if (cfg.terrace) {
      vox.boxC(-1.2, roofBase + 0.6, -0.6, 1.6, 0.15, 1.6, 'woodMid');           // 桌面
      vox.boxC(-0.7, roofBase + 0.6, -0.2, 0.3, 1.1, 0.3, 'woodDark');           // 桌腿
      vox.boxC(0.9, roofBase + 0.6, 0.9, 0.7, 0.55, 0.7, 'woodMid');             // 凳1
      vox.boxC(-2.6, roofBase + 0.6, 1.1, 0.7, 0.55, 0.7, 'woodMid');            // 凳2
      vox.boxC(2.4, roofBase + 0.6, -2.2, 1.0, 0.8, 1.0, 'bush');                // 盆栽
      vox.boxC(2.4, roofBase + 1.4, -2.2, 0.5, 0.5, 0.5, 'flowerRed');
      // 晾衣绳（夜景里的小生活气）
      vox.boxC(-3.0, roofBase + 1.7, 2.2, 0.2, 1.2, 0.2, 'metal');
      vox.boxC(3.0, roofBase + 1.7, 2.2, 0.2, 1.2, 0.2, 'metal');
      vox.boxC(-3.0, roofBase + 2.8, 2.2, 6.2, 0.08, 0.08, 'metal');
      vox.boxC(-1.6, roofBase + 2.3, 2.2, 0.9, 0.9, 0.06, 'awningCream');
      vox.boxC(0.4, roofBase + 2.3, 2.2, 0.9, 0.9, 0.06, 'clothA');
    }
  }

  // —— 烟囱 ——
  let chimneyTop = null;
  if (cfg.chimney) {
    const cx = W / 2 - 2.2, cz = -D / 2 + 1.8;
    const chTop = roofBase + (cfg.roof === 'flat' ? 0.6 : 3.2);
    vox.boxC(cx, wallH - 0.6, cz, 1.6, chTop - wallH + 0.6, 1.6, cfg.roof === 'gable' ? 'wallBrick' : 'rock');
    vox.boxC(cx - 0.15, chTop, cz - 0.15, 1.9, 0.5, 1.9, 'woodDark');
    chimneyTop = { x: cx, y: chTop + 0.5, z: cz };
  }

  // —— 信箱 ——
  const mbx = W / 2 + 2.0;
  vox.boxC(mbx, 0, D / 2 + 1.8, 0.22, 1.1, 0.22, 'woodDark');
  vox.boxC(mbx - 0.35, 1.1, D / 2 + 1.6, 0.9, 0.6, 0.65, roofC);
  vox.boxC(mbx - 0.35, 1.7, D / 2 + 1.6, 0.9, 0.12, 0.65, 'woodDark');

  return { chimneyTop, W, D, totalH: wallH + (cfg.roof === 'flat' ? 1.4 : 3.6) };
}

// ------------------------------------------------------------
// 批量建宅（layout.HOUSES）
// ------------------------------------------------------------
export function buildHouses() {
  const rng = makeRng(777);
  for (const cfg of HOUSES) {
    const gy = terrainHeight(cfg.x, cfg.z);
    vox.pushTransform(cfg.x, gy, cfg.z, cfg.rot);
    const info = buildOne(cfg, rng);
    vox.popTransform();

    // 烟囱世界坐标（旋回世界系）登记给 effects 冒烟
    if (info.chimneyTop) {
      const rad = cfg.rot * Math.PI / 180;
      const lx = info.chimneyTop.x, lz = info.chimneyTop.z;
      const wx = cfg.x + lx * Math.cos(rad) + lz * Math.sin(rad);
      const wz = cfg.z - lx * Math.sin(rad) + lz * Math.cos(rad);
      registerChimney({ x: wx, y: gy + info.chimneyTop.y, z: wz, rate: 0.6 + rng() * 0.5 });
    }

    // 名牌注册（hitbox 按世界包围盒）
    const r = Math.max(info.W, info.D) / 2 + 1;
    registerBuilding({
      name: '小镇民居', blurb: '灯还亮着，是有人在等夜归的人。',
      cx: cfg.x, cz: cfg.z, y0: gy - 1, y1: gy + info.totalH, halfW: r, halfD: r,
    });
  }
  return [];
}
