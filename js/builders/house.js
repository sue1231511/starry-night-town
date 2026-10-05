// ============================================================
// builders/house.js — 参数化住宅生成器（空心版）
// ------------------------------------------------------------
// 局部坐标建模：门朝 +z（南），中心为原点。rot 由 pushTransform 处理。
// 参数：floors 层数 / roof: gable|hip|flat / wall 墙色 / roofC 顶色
//       chimney 烟囱 / flower 花箱 / terrace 平顶露台 / yard 院子风格
// · 空心：四片薄墙 + 门洞 + 木地板，屋顶整组进 group（双击揭顶看内景）
// · 内景按 yard 风格出 5 套装修（cozy/family/loft/rustic/garden）
// · 2F 有楼板 + 屋内楼梯 + 卧室
// 住宅参数在 layout.js HOUSES，坐标经 tools/layoutcheck.mjs 校验。
// ============================================================
import { vox } from '../voxel.js';
import { registerBuilding, terrainHeight, HOUSES, makeRng } from '../layout.js';
import { registerChimney } from '../systems/effects.js';
import * as I from './interior.js';

const FLOOR_H = 3.2;        // 层高
const WALL_W = 9;           // 默认面宽
const WALL_D = 8;           // 默认进深
const WT = 0.5;             // 墙厚

/** 名牌 blurb 池（11 栋轮换，都是夜里亮灯的语气） */
const BLURBS = [
  '灯还亮着，是有人在等夜归的人。',
  '烟囱的烟是直的——今晚没有风。',
  '院子里的花比昨天多开了一朵。',
  '门廊的灯为晚归的猫留着。',
  '二楼窗户的影子里，有人在读信。',
  '灶上的汤一直温着，谁来都能喝一碗。',
  '屋顶的瓦换过三次，故事换过更多。',
  '门前的石阶被踩得发亮。',
  '信箱里躺着一封还没拆的远方来信。',
  '窗台的花是早市上最便宜也最好看的那盆。',
  '钥匙压在门口第三块砖下面——全镇都知道。',
];

// ------------------------------------------------------------
// 内景装修（1F，局部坐标，门 +z；W/D 为内腔尺寸参考）
// yard 风格 → 装修风格一一对应
// ------------------------------------------------------------
function decorateCozy(W, D) {
  I.fireplace(1.9, -D / 2 + 0.7);
  I.rockingChair(2.6, 0.9, { rot: -100 });
  I.rug(0.2, 0.8, { w: 3.6, d: 2.8, c1: 'carRed' });
  I.bed(-2.2, -D / 2 + 2.1, { quilt: 'clothC' });
  I.bedsideTable(-3.5, -D / 2 + 1.2);
  I.grandfatherClock(-W / 2 + 0.9, -D / 2 + 0.8);
  I.chandelier(0, FLOOR_H - 0.4, 0.3);
  I.wallPainting(-0.8, 2.1);
  I.pottedPlant(W / 2 - 1.0, D / 2 - 1.2);
}

function decorateFamily(W, D) {
  I.kitchenCounter(0.6, -D / 2 + 0.55, { len: 3.4 });
  I.cupboard(-W / 2 + 0.9, -D / 2 + 0.8);
  I.table(0.5, 0.8, { cloth: 'clothC' });
  I.chair(-0.6, 1.9, { rot: 180 });
  I.chair(1.6, 0.8, { rot: -90 });
  I.rug(0.4, 0.7, { w: 3.0, d: 2.4, c1: 'clothB', c2: 'awningCream' });
  I.chandelier(0.3, FLOOR_H - 0.4, 0);
  I.wallClock(1.8, 2.4, -D / 2 + WT + 0.1);
  I.babyCrib(W / 2 - 1.2, D / 2 - 1.6, { rot: -90 });
  I.pottedPlant(-W / 2 + 0.9, D / 2 - 1.1);
}

function decorateLoft(W, D) {
  I.desk(-1.9, -D / 2 + 1.3);
  I.chair(-1.9, -0.4, { rot: 180 });
  I.bookshelf(-W / 2 + 0.5, -D / 2 + 1.6, { rot: 90 });
  I.bed(-2.0, D / 2 - 2.3, { quilt: 'clothB' });
  I.bedsideTable(-3.5, D / 2 - 1.3);
  I.floorLamp(3.4, 1.9);
  I.rug(0.6, 0.2, { w: 2.6, d: 2.2, c1: 'roofBlue', c2: 'awningCream' });
  I.wallPainting(1.2, 2.2, { c1: 'clothB', c2: 'flowerYel' });
  I.wallClock(-1.0, 2.5, -D / 2 + WT + 0.1);
}

function decorateRustic(W, D) {
  I.workbench(0.3, -D / 2 + 1.4);
  I.toolRack(1.6, 2.1, -D / 2 + WT + 0.15);
  I.crateStack(W / 2 - 1.0, D / 2 - 1.3);
  I.broom(-W / 2 + 0.6, D / 2 - 0.8);
  I.bed(-2.2, -D / 2 + 2.1, { quilt: 'clothA' });
  I.fireplace(-W / 2 + 1.6, -D / 2 + 0.7);
  I.rug(0.6, 1.4, { w: 2.6, d: 2.0, c1: 'fieldWheat', c2: 'woodMid' });
  I.chandelier(0, FLOOR_H - 0.4, 0);
  I.pottedPlant(W / 2 - 0.9, -D / 2 + 0.9);
}

function decorateGarden(W, D) {
  I.flowerStand(-W / 2 + 1.2, -D / 2 + 1.2);
  I.pottedPlant(W / 2 - 0.9, -D / 2 + 0.9);
  I.pottedPlant(W / 2 - 0.9, D / 2 - 1.1);
  I.table(0.4, 0.4, { cloth: 'flowerBlu' });
  I.chair(-0.7, 1.6, { rot: 170 });
  I.chair(1.5, 0.5, { rot: -80 });
  I.rug(0.4, 0.5, { w: 3.0, d: 2.4, c1: 'clothC', c2: 'awningCream' });
  I.bed(-2.2, -D / 2 + 2.1, { quilt: 'clothB' });
  I.chandelier(0.2, FLOOR_H - 0.4, 0.4);
  I.wallPainting(-1.2, 2.2, { c1: 'flowerRed', c2: 'flowerYel' });
}

const DECOR = {
  picket: decorateCozy,
  garden: decorateGarden,
  orchard: decorateFamily,
  waterside: decorateRustic,
  minimal: decorateLoft,
};

// ------------------------------------------------------------
// 一栋宅子（局部坐标，门朝 +z）
// ------------------------------------------------------------
function buildOne(cfg, rng, idx) {
  const floors = cfg.floors ?? 1;
  const W = cfg.w ?? WALL_W;
  const D = cfg.d ?? WALL_D;
  const wallH = floors * FLOOR_H;
  const wall = cfg.wall ?? 'wallCream';
  const roofC = cfg.roofC ?? 'roofRed';
  const roofGroup = 'houseroof-' + idx; // 揭顶看内景的分组

  // —— 基座石硌（加深兜坡地：北坡脚的地形落差全埋进来）——
  vox.boxC(-W / 2 - 0.6, -2.2, -D / 2 - 0.6, W + 1.2, 2.7, D + 1.2, 'rockDark');

  // —— 室内木地板（略高于地面，防穿地）——
  vox.boxC(-W / 2 + WT, 0.04, -D / 2 + WT, W - WT * 2, 0.1, D - WT * 2, 'woodMid');
  // 地板拼条（横向浅色缝，像素木地板感）
  for (let i = 1; i < 4; i++) {
    vox.boxC(-W / 2 + WT, 0.12, -D / 2 + WT + (i - 0.5) * (D - WT * 2) / 4, W - WT * 2, 0.03, 0.08, 'woodDark');
  }

  // —— 四片外墙（空心）——
  const doorW = 2, doorH = 2.8;
  // 前墙（+z，开门洞）
  vox.boxC(-W / 2, 0, D / 2 - WT, W / 2 - doorW / 2, wallH, WT, wall);
  vox.boxC(doorW / 2, 0, D / 2 - WT, W / 2 - doorW / 2, wallH, WT, wall);
  vox.boxC(-W / 2, doorH, D / 2 - WT, W, wallH - doorH, WT, wall); // 门楣
  // 后墙（-z）
  vox.boxC(-W / 2, 0, -D / 2, W, wallH, WT, wall);
  // 左右墙
  vox.boxC(-W / 2, 0, -D / 2 + WT, WT, wallH, D - WT * 2, wall);
  vox.boxC(W / 2 - WT, 0, -D / 2 + WT, WT, wallH, D - WT * 2, wall);

  // —— 四角木框架柱 + 檐口横梁 ——
  const postS = 0.8;
  for (const px of [-W / 2, W / 2 - postS]) {
    for (const pz of [-D / 2, D / 2 - postS]) {
      vox.boxC(px, 0, pz, postS, wallH, postS, 'woodDark');
    }
  }
  vox.boxC(-W / 2 - 0.3, wallH - 0.4, -D / 2 - 0.3, W + 0.6, 0.5, D + 0.6, 'woodDark');

  // —— 门（开着的门板 + 门框 + 台阶）——
  vox.boxC(-doorW / 2 - 0.25, 0, D / 2 + 0.05, 0.3, doorH + 0.3, 0.3, 'woodDark');
  vox.boxC(doorW / 2 - 0.05, 0, D / 2 + 0.05, 0.3, doorH + 0.3, 0.3, 'woodDark');
  // 门板斜开 25°（欢迎光临的姿态，也让人一眼看进屋）
  vox.boxRotY(doorW / 2 - 0.1, doorH / 2, D / 2 + 0.95, 0.14, doorH, doorW - 0.15, 'woodMid', 25);
  vox.boxC(doorW / 2 - 0.4, 1.3, D / 2 + 1.6, 0.22, 0.22, 0.2, 'metal'); // 门环
  vox.boxC(-1.4, -0.25, D / 2 + 0.9, 2.8, 0.25, 0.9, 'roadDark');
  vox.boxC(-1.1, -0.12, D / 2 + 1.6, 2.2, 0.2, 0.7, 'roadLit');

  // —— 门廊（两柱 + 披檐）——
  const porchZ = D / 2 + 1.6;
  for (const px of [-2.0, 2.0]) {
    vox.boxC(px - 0.2, 0, porchZ - 0.2, 0.45, doorH + 0.9, 0.45, 'woodMid');
  }
  vox.boxC(-2.2, doorH + 0.9, porchZ - 0.35, 4.5, 0.35, 0.75, 'woodDark'); // 檐梁
  vox.boxC(-2.3, doorH + 1.25, porchZ - 0.5, 4.7, 0.3, 1.0, roofC);       // 披檐
  // 门口壁灯（灯笼）
  vox.boxC(-1.7, 2.4, D / 2 + 0.28, 0.3, 0.42, 0.24, 'roofDark');
  vox.windowBox(-1.7, 2.42, D / 2 + 0.42, 0.2, 0.28, 0.14, 'lampGlow');
  // 门牌（号码牌）
  vox.boxC(1.75, 2.5, D / 2 + 0.22, 0.55, 0.4, 0.12, 'awningCream');
  vox.boxC(1.62, 2.56, D / 2 + 0.3, 0.12, 0.26, 0.06, 'catBlack');
  vox.boxC(1.86, 2.62, D / 2 + 0.3, 0.2, 0.1, 0.06, 'catBlack');

  // —— 窗（贴墙面上的发光薄板 + 木框 + 花箱）——
  const winW = 1.5, winH = 1.7;
  for (let f = 0; f < floors; f++) {
    const wy = f * FLOOR_H + 1.1;
    const winC = rng() < 0.35 ? 'winWarm' : 'winGlow';
    for (const wx of [-W / 2 + 2.1, W / 2 - 3.6]) {
      if (f === 0 && Math.abs(wx) < doorW / 2 + 1.2) continue;
      vox.windowBox(wx + winW / 2, wy, D / 2 + 0.08, winW, winH, 0.25, winC);
      vox.boxC(wx - 0.2, wy - 0.25, D / 2 + 0.1, winW + 0.4, 0.25, 0.35, 'woodDark');
      if (cfg.flower && rng() < 0.7) {
        vox.boxC(wx - 0.1, wy - 0.65, D / 2 + 0.25, winW + 0.2, 0.4, 0.6, 'woodMid');
        vox.boxC(wx, wy - 0.28, D / 2 + 0.3, 0.4, 0.35, 0.4, rng() < 0.5 ? 'flowerRed' : 'flowerYel');
        vox.boxC(wx + winW - 0.4, wy - 0.28, D / 2 + 0.3, 0.4, 0.35, 0.4, 'flowerBlu');
      }
    }
    // 侧窗位置避开门廊柱与外挂梯
    vox.windowBox(W / 2 + 0.12, wy, -1.6, 0.25, winH, winW, winC);
    vox.windowBox(-W / 2 - 0.37, wy, -0.9, 0.25, winH, winW, rng() < 0.4 ? 'winWarm' : 'winGlow');
    vox.windowBox(-winW / 2 + 0.6, wy, -D / 2 - 0.33, winW, winH, 0.25, rng() < 0.3 ? 'winWarm' : 'winGlow');
  }

  // —— 外挂楼梯（两层且非 terrace：后侧上二楼的小铁梯）——
  if (floors >= 2 && !cfg.terrace) {
    const sx = W / 2 + 0.7;
    for (let i = 0; i < 6; i++) {
      vox.boxC(sx - 0.1, i * (FLOOR_H / 6), -D / 2 + 1 + i * 1.0, 0.9, 0.25, 0.9, 'metal');
    }
    vox.boxC(sx + 0.4, 0, -D / 2 + 0.6, 0.25, FLOOR_H + 0.2, 0.25, 'metal');
  }

  // —— 屋顶（整组可揭）——
  const ROOF = { group: roofGroup };
  const roofBase = wallH + 0.1;
  if (cfg.roof === 'gable') {
    const steps = [
      { inset: 0, h: 1.1 },
      { inset: 2.2, h: 1.1 },
      { inset: 4.0, h: 1.0 },
    ];
    let y = roofBase;
    for (const s of steps) {
      vox.boxC(-W / 2 - 0.9 + s.inset, y, -D / 2 - 0.9, W + 1.8 - s.inset * 2, s.h, D + 1.8, roofC, ROOF);
      y += s.h;
    }
    vox.boxC(-W / 2 - 0.4, y, -D / 2 - 0.4, W + 0.8, 0.5, D + 0.8, 'woodDark', ROOF);
    vox.boxC(-W / 2 + 1.2, roofBase, -D / 2 - 0.5, W - 2.4, 1.0, 0.5, wall, ROOF);
    vox.boxC(-W / 2 + 1.2, roofBase, D / 2, W - 2.4, 1.0, 0.5, wall, ROOF);
    vox.boxC(-W / 2 + 2.8, roofBase + 1.0, -D / 2 - 0.5, W - 5.6, 0.9, 0.5, wall, ROOF);
    vox.boxC(-W / 2 + 2.8, roofBase + 1.0, D / 2, W - 5.6, 0.9, 0.5, wall, ROOF);
    // 阁楼小圆窗 + 山墙装饰横木（正面）
    vox.windowBox(-0.6, roofBase + 0.35, D / 2 + 0.05, 1.2, 1.0, 0.3, 'winWarm', ROOF);
    vox.boxC(-W / 2 + 1.4, roofBase + 2.05, D / 2 + 0.1, W - 2.8, 0.3, 0.14, 'woodDark', ROOF);
  } else if (cfg.roof === 'hip') {
    vox.boxC(-W / 2 - 0.9, roofBase, -D / 2 - 0.9, W + 1.8, 1.0, D + 1.8, roofC, ROOF);
    vox.boxC(-W / 2 - 0.4, roofBase + 1.0, -D / 2 - 0.4, W + 0.8 - 2.2, 0.9, D + 0.8 - 2.2, roofC, ROOF);
    vox.boxC(-W / 2 + 1.4, roofBase + 1.9, -D / 2 + 1.4, W - 2.8, 0.8, D - 2.8, 'roofDark', ROOF);
    // 顶尖小风向标（箭头）
    vox.boxC(0, roofBase + 2.7, 0, 0.18, 0.5, 0.18, 'metal', ROOF);
    vox.boxC(-0.5, roofBase + 3.1, 0, 1.4, 0.16, 0.16, 'metal', ROOF);
    vox.boxC(0.55, roofBase + 3.18, 0, 0.36, 0.3, 0.06, 'metal', ROOF);
  } else {
    // 平顶 + 女儿墙（露台在顶）
    vox.boxC(-W / 2, roofBase, -D / 2, W, 0.6, D, 'roofDark', ROOF);
    const par = 0.7;
    vox.boxC(-W / 2 - 0.15, roofBase + 0.6, -D / 2 - 0.15, W + 0.3, par, 0.4, wall, ROOF);
    vox.boxC(-W / 2 - 0.15, roofBase + 0.6, D / 2 - 0.25, W + 0.3, par, 0.4, wall, ROOF);
    vox.boxC(-W / 2 - 0.15, roofBase + 0.6, -D / 2 + 0.2, 0.4, par, D - 0.4, wall, ROOF);
    vox.boxC(W / 2 - 0.25, roofBase + 0.6, -D / 2 + 0.2, 0.4, par, D - 0.4, wall, ROOF);
    if (cfg.terrace) {
      vox.boxC(-1.2, roofBase + 0.6, -0.6, 1.6, 0.15, 1.6, 'woodMid', ROOF);
      vox.boxC(-0.7, roofBase + 0.6, -0.2, 0.3, 1.1, 0.3, 'woodDark', ROOF);
      vox.boxC(0.9, roofBase + 0.6, 0.9, 0.7, 0.55, 0.7, 'woodMid', ROOF);
      vox.boxC(-2.6, roofBase + 0.6, 1.1, 0.7, 0.55, 0.7, 'woodMid', ROOF);
      vox.boxC(2.4, roofBase + 0.6, -2.2, 1.0, 0.8, 1.0, 'bush', ROOF);
      vox.boxC(2.4, roofBase + 1.4, -2.2, 0.5, 0.5, 0.5, 'flowerRed', ROOF);
      vox.boxC(-3.0, roofBase + 1.7, 2.2, 0.2, 1.2, 0.2, 'metal', ROOF);
      vox.boxC(3.0, roofBase + 1.7, 2.2, 0.2, 1.2, 0.2, 'metal', ROOF);
      vox.boxC(-3.0, roofBase + 2.8, 2.2, 6.2, 0.08, 0.08, 'metal', ROOF);
      vox.boxC(-1.6, roofBase + 2.3, 2.2, 0.9, 0.9, 0.06, 'awningCream', ROOF);
      vox.boxC(0.4, roofBase + 2.3, 2.2, 0.9, 0.9, 0.06, 'clothA', ROOF);
    }
  }

  // —— 烟囱（跟屋顶一组，揭顶时一起掀）——
  let chimneyTop = null;
  if (cfg.chimney) {
    const cx = W / 2 - 2.2, cz = -D / 2 + 1.8;
    const chTop = roofBase + (cfg.roof === 'flat' ? 0.6 : 3.2);
    vox.boxC(cx, wallH - 0.6, cz, 1.6, chTop - wallH + 0.6, 1.6, cfg.roof === 'gable' ? 'wallBrick' : 'rock', ROOF);
    vox.boxC(cx - 0.15, chTop, cz - 0.15, 1.9, 0.5, 1.9, 'woodDark', ROOF);
    chimneyTop = { x: cx, y: chTop + 0.5, z: cz };
  }

  // —— 2F：楼板（留楼梯洞）+ 屋内楼梯 + 卧室 ——
  if (floors >= 2) {
    const fy = FLOOR_H;
    // 楼板两块拼（洞开在东南角 x∈[1.2, W/2-WT] z∈[0, D/2-WT]，楼梯从这里上来）
    vox.boxC(-W / 2 + WT, fy, -D / 2 + WT, (1.2) - (-W / 2 + WT), 0.35, D - WT * 2, 'woodMid');
    vox.boxC(1.2, fy, -D / 2 + WT, (W / 2 - WT) - 1.2, 0.35, (0) - (-D / 2 + WT), 'woodMid');
    // 楼梯：沿东墙从南向北爬 8 级（1F 地面 → 2F 楼板面）
    for (let i = 0; i < 8; i++) {
      const sy = 0.04 + i * (fy - 0.31) / 8;
      vox.boxC(W / 2 - WT - 0.85, sy, D / 2 - WT - 0.5 - i * 0.42, 1.5, 0.3, 0.44, 'woodLight');
    }
    // 楼梯口矮栏（防摔，也是揭顶俯视的细节）
    vox.boxC(1.2, fy + 0.35, 0.2, 0.12, 0.7, D / 2 - WT - 0.2, 'woodDark');
    // 2F 卧室（家具整体垫高到楼板面上）
    vox.pushTransform(0, fy + 0.35, 0, 0);
    I.bed(-2.2, -D / 2 + 2.3, { quilt: 'clothB' });
    I.bedsideTable(-3.6, -D / 2 + 1.0);
    I.rug(-0.4, 0.8, { w: 2.4, d: 1.8, c1: 'roofBlue', c2: 'awningCream' });
    I.floorLamp(W / 2 - 1.0, D / 2 - 1.6);
    vox.popTransform();
  }

  // —— 1F 内景（按院子风格出装修）——
  const decor = DECOR[cfg.yard] ?? decorateCozy;
  decor(W, D);

  return { chimneyTop, W, D, totalH: wallH + (cfg.roof === 'flat' ? 1.4 : 3.6), roofGroup };
}

// ------------------------------------------------------------
// 批量建宅（layout.HOUSES）
// ------------------------------------------------------------
export function buildHouses() {
  const rng = makeRng(777);
  HOUSES.forEach((cfg, idx) => {
    const gy = terrainHeight(cfg.x, cfg.z);
    vox.pushTransform(cfg.x, gy, cfg.z, cfg.rot);
    const info = buildOne(cfg, rng, idx);
    vox.popTransform();

    // 烟囱世界坐标（旋回世界系）登记给 effects 冒烟
    if (info.chimneyTop) {
      const rad = cfg.rot * Math.PI / 180;
      const lx = info.chimneyTop.x, lz = info.chimneyTop.z;
      const wx = cfg.x + lx * Math.cos(rad) + lz * Math.sin(rad);
      const wz = cfg.z - lx * Math.sin(rad) + lz * Math.cos(rad);
      registerChimney({ x: wx, y: gy + info.chimneyTop.y, z: wz, rate: 0.6 + rng() * 0.5 });
    }

    // 名牌注册（hitbox 按世界包围盒；roofGroup 供双击揭顶）
    const r = Math.max(info.W, info.D) / 2 + 1;
    registerBuilding({
      name: '小镇民居', blurb: BLURBS[idx % BLURBS.length],
      cx: cfg.x, cz: cfg.z, y0: gy - 1, y1: gy + info.totalH, halfW: r, halfD: r,
      roofGroup: info.roofGroup,
    });
  });
  return [];
}
