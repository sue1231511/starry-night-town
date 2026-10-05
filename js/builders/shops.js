// ============================================================
// builders/shops.js — 广场商圈 · 8 家店铺
// ------------------------------------------------------------
// 每家一个专属细节函数 + 公共店铺外壳。
// 商铺清单/位置/文案在 layout.js SHOPS 里改。
// ============================================================
import * as THREE from 'three';
import { vox, dynBoxTo } from '../voxel.js';
import { registerBuilding, terrainHeight, SHOPS } from '../layout.js';
import { registerChimney } from '../systems/effects.js';
import * as I from './interior.js';

const FLOOR_H = 3.4;

/**
 * 公共店铺外壳（局部坐标，门朝 +z）—— 空心结构，内有完整房间：
 * 地板 + 四面薄墙（正面留大橱窗洞和门洞）+ 分组屋顶（进屋时整组隐藏）。
 * 屋顶桶 group = `roof-shop-{id}`（interaction 进屋模式消费）。
 */
function shopShell(cfg, { W = 10, D = 9, floors = 1, wall, roofC, roof = 'gable', floorA = 'awningCream', floorB = 'woodLight', skirt = null } = {}) {
  const wallH = floors * FLOOR_H;
  const roofGroup = `roof-shop-${cfg.id}`;
  const T = 0.55; // 墙厚

  // —— 地板 + 基座（室内铺 1×1 棋盘小地砖，双色主题）——
  vox.boxC(-W / 2 - 0.6, -0.5, -D / 2 - 0.6, W + 1.2, 0.5, D + 1.2, 'rockDark');
  for (let gx = -W / 2 + 0.55; gx < W / 2 - 0.55; gx += 1) {
    for (let gz = -D / 2 + 0.55; gz < D / 2 - 0.55; gz += 1) {
      const c = ((Math.round(gx) + Math.round(gz)) % 2 === 0) ? floorA : floorB;
      vox.boxC(gx, 0, gz, 1, 0.3, 1, c);
    }
  }

  // —— 墙裙（内侧下半段主题色腰线，让墙面有层次）——
  const skirtC = skirt || roofC;
  vox.boxC(-W / 2 + T, 0, -D / 2 + T, W - 2 * T - 0.0, 1.15, 0.14, skirtC);           // 后墙裙
  vox.boxC(-W / 2 + T, 1.15, -D / 2 + T, W - 2 * T, 0.12, 0.18, 'woodDark');          // 裙腰线
  for (const sx of [-1, 1]) {
    vox.boxC(sx * (W / 2 - T - 0.07), 0, -D / 2 + 0.7, 0.14, 1.15, D - 1.4, skirtC);
    vox.boxC(sx * (W / 2 - T - 0.07), 1.15, -D / 2 + 0.7, 0.18, 0.12, D - 1.4, 'woodDark');
  }

  // —— 后墙（-z）实心薄墙 ——
  vox.boxC(-W / 2, 0, -D / 2, W, wallH, T, wall);
  for (const sx of [-1, 1]) {
    const wx = sx > 0 ? W / 2 - T : -W / 2;
    vox.boxC(wx, 0, -D / 2, T, 0.8, D, wall);                        // 窗下墙
    vox.boxC(wx, 0.8, -D / 2, T, wallH - 0.8 - 1.8 - 0.4, D, wall);   // 窗上墙（一层）
    vox.boxC(wx, wallH - 1.2, -D / 2, T, 1.2, D, wall);               // 顶带
    vox.boxC(wx, 0.8, -D / 2, T, 1.8, (D - 2.4) / 2, wall);           // 窗洞两侧
    vox.boxC(wx, 0.8, -0.9, T, 1.8, (D - 2.4) / 2, wall);
    // 侧窗玻璃（发光窗）
    vox.windowBox(sx * (W / 2 - 0.1), 1.7, 0, 0.18, 1.8, 2.4, 'winGlow');
    // 窗帘（窗两侧暖色垂布 + 顶帘幔，室内的温馨感）
    vox.boxC(sx * (W / 2 - 0.3), 1.0, -1.5, 0.16, 2.4, 0.5, 'clothA');
    vox.boxC(sx * (W / 2 - 0.3), 1.0, 1.5, 0.16, 2.4, 0.5, 'clothA');
    vox.boxC(sx * (W / 2 - 0.3), 2.75, 0, 0.2, 0.4, 2.6, 'roofDark');
    // 二层（旅馆）
    if (floors >= 2) {
      vox.boxC(wx, FLOOR_H, -D / 2, T, 0.8, D, wall);
      vox.boxC(wx, FLOOR_H + 0.8, -D / 2, T, 1.0, D, wall);
      vox.boxC(wx, FLOOR_H + 1.8, -D / 2, T, wallH - FLOOR_H - 1.8, D, wall);
      vox.windowBox(sx * (W / 2 - 0.1), FLOOR_H + 1.3, 0, 0.18, 1.0, 2.0, 'winWarm');
    }
  }

  // —— 前墙（+z）：左 2/3 大橱窗洞 + 右 1/3 门洞 ——
  const shopW = W - 5.0;                       // 橱窗宽
  vox.boxC(-W / 2, 0, D / 2 - T, shopW, 0.8, T, wall);                 // 橱窗下墙
  vox.boxC(-W / 2, 2.8, D / 2 - T, shopW, wallH - 2.8, T, wall);       // 橱窗上墙
  vox.boxC(-W / 2, 0, D / 2 - T, 1.4, wallH, T, wall);                 // 左门柱
  vox.boxC(-W / 2 + shopW - 1.4, 0, D / 2 - T, 1.4, wallH, T, wall);   // 中柱
  // 门洞两侧短柱 + 门楣
  vox.boxC(W / 2 - 2.6, 0, D / 2 - T, 0.4, wallH, T, wall);
  vox.boxC(W / 2 - T, 0, D / 2 - T, T, wallH, T, wall);
  vox.boxC(W / 2 - 2.6, 3.0, D / 2 - T, 2.6, wallH - 3.0, T, wall);    // 门楣
  // 门板（开着一条缝的木门）+ 台阶
  vox.boxC(W / 2 - 2.0, 0, D / 2 - 0.3, 1.9, 2.9, 0.18, 'woodMid');
  vox.boxC(W / 2 - 2.0, 2.9, D / 2 - 0.4, 2.3, 0.25, 0.9, 'roofDark');
  vox.boxC(W / 2 - 2.3, -0.25, D / 2 + 0.15, 3.0, 0.25, 0.8, 'roadLit');
  // 橱窗玻璃（大发光窗，能看到室内）+ 窗台
  vox.windowBox(-W / 2 + shopW / 2, 1.8, D / 2 - 0.08, shopW - 0.3, 2.0, 0.22, 'winGlow');
  vox.boxC(-W / 2, 0.8, D / 2 - 0.15, shopW, 0.16, 0.4, 'woodDark');

  // —— 二层楼板（旅馆）——
  if (floors >= 2) {
    vox.boxC(-W / 2 + 0.1, FLOOR_H - 0.35, -D / 2 + 0.1, W - 0.2, 0.35, D - 0.2, 'woodMid');
  }

  // —— 檐口 ——
  vox.boxC(-W / 2 - 0.3, wallH - 0.4, -D / 2 - 0.3, W + 0.6, 0.5, D + 0.6, 'woodDark');

  // —— 屋顶（分组桶：进屋时隐藏） ——
  const roofBase = wallH + 0.1;
  const RG = { group: roofGroup };
  if (roof === 'gable') {
    vox.boxC(-W / 2 - 0.9, roofBase, -D / 2 - 0.9, W + 1.8, 1.1, D + 1.8, roofC, RG);
    vox.boxC(-W / 2 + 1.3, roofBase + 1.1, -D / 2 + 1.3, W - 2.6, 1.0, D - 2.6, roofC, RG);
    vox.boxC(-W / 2 - 0.4, roofBase + 2.1, -D / 2 - 0.4, W + 0.8, 0.45, D + 0.8, 'woodDark', RG);
    // 阁楼内景（屋顶揭开后能看到的小储物间）
    vox.boxC(-1.6, roofBase + 0.2, -1.6, 1.2, 0.8, 1.2, 'woodMid', RG);
    vox.boxC(-1.1, roofBase + 0.5, -1.1, 0.5, 0.5, 0.5, 'clothC', RG);
  } else {
    vox.boxC(-W / 2, roofBase, -D / 2, W, 0.7, D, 'roofDark', RG);
  }

  // 悬挂招牌（门上方伸出的短臂 + 招牌块）
  vox.boxC(W / 2 - 2.2, 3.3, D / 2 + 0.9, 0.25, 0.25, 1.6, 'woodDark');
  vox.boxC(W / 2 - 2.2, 2.7, D / 2 + 1.7, 0.3, 1.1, 1.5, 'awningCream');

  // 楼上窗（两层楼时，正面）
  if (floors >= 2) {
    for (const wx of [-W / 2 + 2.4, -W / 2 + 5.2, W / 2 - 3.2]) {
      vox.windowBox(wx, FLOOR_H + 1.1, D / 2 - 0.1, 1.6, 1.8, 0.22, 'winGlow');
    }
  }

  return { W, D, roofBase, wallH, roofGroup, hasInterior: true };
}

// ============================================================
// 各家专属细节
// ============================================================

function bakeryExtra(shell) {
  const { W, D } = shell;
  // 红白条纹遮阳篷（橱窗上方，锯齿边）
  for (let i = 0; i < 6; i++) {
    const c = i % 2 === 0 ? 'awningRed' : 'awningCream';
    vox.boxC(-W / 2 + 1.2 + i * 1.3, 3.15, D / 2 + 1.15, 1.3, 0.3, 2.1, c);
  }
  // —— 室内（地板面 y=0.3）：砖烤炉贴后墙、面包架、小桌，橱窗外就能看到炉火 ——
  vox.pushTransform(0, 0.3, 0, 0);
  I.breadOven(0, -D / 2 + 1.9);                 // 大烤炉（炉口朝门）
  I.breadShelf(-W / 2 + 1.8, -D / 2 + 1.6, { rot: 90 });
  I.table(1.8, 0.6, { w: 1.6, d: 1.2 });
  I.stool(1.0, 1.4);
  I.stool(2.6, 1.4);
  I.pottedPlant(W / 2 - 1.4, -D / 2 + 1.4);
  I.chandelier(0, 3.0, 0);
  I.counterCat(1.8, 1.1, 0.5, 25);             // 店宠：桌上打盹的黑猫
  // —— 墙面装饰：麦穗挂画×2 + 壁灯 + 角落木箱扫帚 ——
  vox.pushTransform(0, 0.3, 0, 0);
  I.wallPainting(-2.6, 2.2, { c1: 'flowerYel', c2: 'awningRed' });
  I.wallPainting(2.6, 2.2, { c1: 'flowerYel', c2: 'flowerBlu' });
  I.wallLamp(0, 2.4);
  I.crateStack(W / 2 - 1.6, 2.8);
  I.broom(-W / 2 + 1.2, 3.2);
  // 吊挂面包串（天花板垂下的麻绳+面包）
  vox.boxC(-2.2, 2.5, 0.6, 0.1, 0.9, 0.1, 'woodDark');
  vox.boxC(-2.2, 2.2, 0.6, 0.42, 0.36, 0.42, 'flowerYel');
  vox.boxC(2.2, 2.5, -0.6, 0.1, 0.7, 0.1, 'woodDark');
  vox.boxC(2.2, 2.26, -0.6, 0.42, 0.32, 0.42, 'flowerYel');
  vox.popTransform();
  vox.popTransform();
  // 门外出炉架：木架 + 两盘面包（浅金小块）
  vox.boxC(-W / 2 + 1.6, 0, D / 2 + 2.4, 0.25, 2.2, 0.25, 'woodDark');
  vox.boxC(-W / 2 + 1.6, 1.0, D / 2 + 2.6, 1.6, 0.18, 1.0, 'woodMid');
  vox.boxC(-W / 2 + 1.6, 2.0, D / 2 + 2.6, 1.6, 0.18, 1.0, 'woodMid');
  vox.boxC(-W / 2 + 1.6, 1.18, D / 2 + 2.6, 0.9, 0.35, 0.55, 'flowerYel');
  vox.boxC(-W / 2 + 1.6, 2.18, D / 2 + 2.6, 0.9, 0.35, 0.55, 'flowerYel');
  // 麻袋
  vox.boxC(W / 2 - 1.2, 0, D / 2 + 1.9, 1.1, 1.4, 1.1, 'fieldWheat');
  // 烟囱（烤炉）
  vox.boxC(-W / 2 + 1.8, shell.wallH - 0.4, -D / 2 + 1.6, 1.6, 3.4, 1.6, 'wallBrick');
  vox.boxC(-W / 2 + 1.65, shell.wallH + 2.9, -D / 2 + 1.55, 1.9, 0.45, 1.9, 'woodDark');
  return { chimney: { x: -W / 2 + 1.8, y: shell.wallH + 3.4, z: -D / 2 + 1.6 } };
}

function coffeeExtra(shell, group) {
  const { W, D } = shell;
  // 深咖啡色门脸饰带
  vox.boxC(-W / 2, 2.6, D / 2 + 0.12, W, 0.5, 0.28, 'woodDark');
  // —— 室内：吧台贴后墙、两桌卡座、地毯、吊灯 ——
  vox.pushTransform(0, 0.3, 0, 0);
  I.coffeeBar(-1.2, -D / 2 + 1.3);
  I.rug(0.6, 0.8, { w: 3.2, d: 2.4, c1: 'wallPlum', c2: 'awningCream' });
  I.table(-1.6, 1.6, { w: 1.4, d: 1.4 });
  I.stool(-2.4, 1.6);
  I.stool(-0.8, 1.6);
  I.table(1.6, 1.8, { w: 1.4, d: 1.4 });
  I.stool(0.9, 1.9);
  I.stool(2.3, 1.7);
  I.chandelier(-1.2, 3.0, 0.6);
  I.pottedPlant(W / 2 - 1.4, -D / 2 + 1.4);
  // —— 墙面装饰：咖啡主题挂画 + 壁架（糖罐）+ 报纸架 ——
  vox.pushTransform(0, 0.3, 0, 0);
  I.wallPainting(-2.8, 2.2, { c1: 'clothA', c2: 'flowerYel' });
  I.wallPainting(2.4, 2.2, { w: 0.8, h: 0.65, c1: 'wallPlum', c2: 'awningCream' });
  I.wallShelf(0.6, 2.3, { jars: 3 });
  I.wallLamp(-0.8, 2.5);
  // 墙角报纸架
  vox.boxC(-W / 2 + 0.9, 0, 1.2, 0.5, 1.1, 0.5, 'metal');
  vox.boxC(-W / 2 + 0.9, 1.1, 1.2, 0.44, 0.5, 0.44, 'awningCream');
  vox.boxC(-W / 2 + 0.9, 1.5, 1.2, 0.36, 0.14, 0.36, 'clothC');
  vox.popTransform();
  vox.popTransform();
  // 露天座：两张小圆桌 + 凳 + 大遮阳伞
  for (const ox of [-2.6, 1.8]) {
    const px = ox, pz = D / 2 + 3.2;
    vox.boxC(px, 0, pz, 0.25, 1.5, 0.25, 'metal');
    vox.boxC(px, 1.5, pz, 1.7, 0.16, 1.7, 'awningCream');
    vox.boxC(px - 1.3, 0, pz + 0.6, 0.6, 0.9, 0.6, 'woodMid');
    vox.boxC(px + 1.3, 0, pz - 0.5, 0.6, 0.9, 0.6, 'woodMid');
    // 伞
    vox.boxC(px, 1.66, pz, 0.15, 2.6, 0.15, 'metal');
    vox.boxC(px - 1.5, 4.2, pz - 1.5, 3.0, 0.3, 3.0, 'roofRed');
    vox.boxC(px - 1.0, 4.5, pz - 1.0, 2.0, 0.25, 2.0, 'awningRed');
  }
  // 串灯（檐下垂两条暖光点，入场即氛围）
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    const lx = -W / 2 + 0.8 + t * (W - 1.6);
    const ly = 3.0 - Math.sin(t * Math.PI) * 0.55;
    vox.windowBox(lx, ly, D / 2 + 1.4, 0.28, 0.28, 0.28, 'lampGlow');
  }
  // 杯子招牌（屋顶大咖啡杯：杯身 + 把手 + 热气位）
  vox.boxC(-1.2, shell.roofBase + 2.6, -1.2, 2.4, 1.6, 2.4, 'awningCream');
  vox.boxC(1.4, shell.roofBase + 3.0, -1.2, 0.5, 0.8, 0.8, 'awningCream');
  vox.boxC(-0.5, shell.roofBase + 3.4, -0.5, 1.0, 0.3, 1.0, 'woodDark');
}

function bookExtra(shell) {
  const { W, D } = shell;
  // —— 室内：两面大书架、阅读桌、座钟、吊灯 ——
  vox.pushTransform(0, 0.3, 0, 0);
  I.bookshelf(-W / 2 + 1.6, -D / 2 + 1.1, { rot: 0 });
  I.bookshelf(W / 2 - 1.6, -D / 2 + 1.1, { rot: 0 });
  I.bookshelf(-W / 2 + 1.6, -D / 2 + 3.4, { rot: 90 });
  I.rug(0.4, 0.6, { w: 3.6, d: 2.6, c1: 'clothB', c2: 'awningCream' });
  I.table(0.4, 0.4, { w: 2.2, d: 1.4 });
  I.chair(-0.9, 0.4, { rot: 90 });
  I.chair(1.7, 0.4, { rot: -90 });
  // 桌上摊开的书+台灯
  vox.boxC(0.2, 1.31, 0.4, 0.6, 0.1, 0.45, 'awningCream');
  vox.boxC(0.05, 1.36, 0.4, 0.3, 0.08, 0.4, 'clothC');
  vox.windowBox(1.0, 1.31, 0.35, 0.3, 0.4, 0.3, 'lampGlow');
  I.grandfatherClock(W / 2 - 1.5, -D / 2 + 1.2);
  I.chandelier(0.2, 3.0, 0);
  I.deskRabbit(-2.2, 0, 0.6, 60);              // 店宠：桌边听故事的白兔
  // —— 墙面装饰：书脊挂画 + 地球仪 + 梯子 ——
  vox.pushTransform(0, 0.3, 0, 0);
  I.wallPainting(-3.0, 2.3, { w: 1.1, h: 0.9, c1: 'clothB', c2: 'flowerRed' });
  I.wallPainting(3.0, 2.3, { w: 0.9, h: 0.7, c1: 'clothC', c2: 'flowerBlu' });
  I.wallShelf(0, 2.5, { jars: 2 });
  // 地球仪（立架+球）
  vox.boxC(-W / 2 + 1.0, 0, 0.4, 0.5, 0.9, 0.5, 'woodDark');
  vox.boxC(-W / 2 + 1.0, 0.9, 0.4, 0.14, 0.5, 0.14, 'metal');
  vox.boxC(-W / 2 + 1.0, 1.55, 0.4, 0.55, 0.55, 0.55, 'clothB');
  vox.boxC(-W / 2 + 1.0, 1.55, 0.4, 0.3, 0.3, 0.58, 'clothC');
  // 靠墙木梯（取书梯）
  vox.boxC(W / 2 - 1.2, 0, 0.4, 0.14, 2.6, 0.14, 'woodLight');
  vox.boxC(W / 2 - 0.6, 0, 0.4, 0.14, 2.6, 0.14, 'woodLight');
  for (let i = 0; i < 3; i++) vox.boxC(W / 2 - 1.2, 0.6 + i * 0.7, 0.4, 0.62, 0.1, 0.14, 'woodMid');
  vox.popTransform();
  vox.popTransform();
  // 橱窗里书堆（彩色薄条错落）
  const bookColors = ['flowerRed', 'clothB', 'clothC', 'flowerYel', 'clothA', 'flowerBlu'];
  let bx = -W / 2 + 2.0;
  for (let i = 0; i < 6; i++) {
    const bh = 0.45 + (i % 3) * 0.18;
    vox.boxC(bx, 0.95, D / 2 - 0.4, 0.75, bh, 1.4, bookColors[i]);
    if (i % 2 === 0) vox.boxC(bx + 0.9, 0.95, D / 2 - 0.4, 0.6, bh * 0.7, 1.4, bookColors[(i + 3) % 6]);
    bx += 1.35;
  }
  // 门口书车：斜靠的书
  vox.boxC(-W / 2 - 1.8, 0, D / 2 + 1.6, 1.8, 0.9, 1.2, 'woodMid');
  vox.boxC(-W / 2 - 1.8, 0.9, D / 2 + 1.6, 1.5, 0.5, 0.9, 'clothB');
  vox.boxC(-W / 2 - 1.8, 1.4, D / 2 + 1.4, 1.2, 0.4, 0.8, 'flowerRed');
  // 屋顶风向标（灯塔书店：小灯塔顶饰）
  vox.boxC(0, shell.roofBase + 2.55, 0, 0.2, 1.6, 0.2, 'metal');
  vox.windowBox(0, shell.roofBase + 3.4, 0, 0.5, 0.5, 0.5, 'winGlow');
  vox.boxC(0.55, shell.roofBase + 3.35, 0, 1.1, 0.1, 0.35, 'metal');
}

function flowerExtra(shell) {
  const { W, D } = shell;
  // —— 室内：花台×2 + 工作桌 + 盆栽 + 吊篮 ——
  vox.pushTransform(0, 0.3, 0, 0);
  I.flowerBench(-W / 2 + 1.9, -D / 2 + 1.4, { rot: 0 });
  I.flowerBench(W / 2 - 1.9, -D / 2 + 1.4, { rot: 0 });
  I.table(0, -D / 2 + 1.6, { w: 2.4, d: 1.2, top: 'woodLight' });
  // 工作台上的花束与麻绳
  vox.boxC(-0.6, 1.31, -D / 2 + 1.6, 0.5, 0.45, 0.5, 'flowerRed');
  vox.boxC(0.2, 1.31, -D / 2 + 1.6, 0.5, 0.4, 0.5, 'flowerBlu');
  vox.boxC(0.9, 1.31, -D / 2 + 1.6, 0.45, 0.35, 0.45, 'flowerYel');
  vox.boxC(0.2, 1.62, -D / 2 + 1.6, 0.24, 0.3, 0.24, 'fieldWheat');
  I.stool(0, -D / 2 + 2.6);
  I.rug(0.4, 0.6, { w: 3.0, d: 2.2, c1: 'bush', c2: 'awningCream' });
  I.pottedPlant(-W / 2 + 1.4, 1.4);
  I.pottedPlant(W / 2 - 1.4, 1.4);
  I.chandelier(0, 3.0, 0);
  // 店宠：枝头小鸟（挂横杆上）
  vox.boxC(-0.8, 2.35, -D / 2 + 3.0, 1.8, 0.14, 0.14, 'woodMid');
  vox.boxC(-0.9, 0, -D / 2 + 3.0, 0.14, 2.35, 0.14, 'woodMid');
  vox.boxC(0.9, 0, -D / 2 + 3.0, 0.14, 2.35, 0.14, 'woodMid');
  I.perchBird(-0.35, 2.42, -D / 2 + 3.0, 160);
  // —— 墙面装饰：花园挂画 + 花环 + 镜面 ——
  vox.pushTransform(0, 0.3, 0, 0);
  I.wallPainting(-2.8, 2.3, { c1: 'bush', c2: 'flowerRed' });
  I.wallPainting(2.6, 2.3, { w: 0.85, h: 0.7, c1: 'treeLite', c2: 'flowerYel' });
  // 花环（圆形挂环）
  vox.boxC(0, 2.6, 0.06, 0.9, 0.16, 0.1, 'bush');
  vox.boxC(0, 2.05, 0.06, 0.9, 0.16, 0.1, 'bush');
  vox.boxC(-0.42, 2.35, 0.06, 0.14, 0.5, 0.1, 'bush');
  vox.boxC(0.42, 2.35, 0.06, 0.14, 0.5, 0.1, 'bush');
  vox.boxC(0, 2.35, 0.06, 0.24, 0.24, 0.12, 'flowerRed');
  I.wallLamp(1.6, 2.5);
  // 喷壶+园艺篮（角落）
  vox.boxC(-W / 2 + 1.1, 0, 2.4, 0.5, 0.42, 0.5, 'metal');
  vox.boxC(-W / 2 + 1.35, 0.55, 2.4, 0.4, 0.14, 0.14, 'metal');
  vox.boxC(-W / 2 + 1.95, 0, 2.2, 0.7, 0.5, 0.55, 'woodLight');
  vox.boxC(-W / 2 + 1.95, 0.5, 2.2, 0.55, 0.2, 0.4, 'flowerYel');
  vox.popTransform();
  vox.popTransform();
  // 门外花架：三层台阶花槽，各色花团
  const cols = ['flowerRed', 'flowerYel', 'flowerBlu', 'bush'];
  for (let s = 0; s < 3; s++) {
    const fx = -W / 2 + 1.0, fz = D / 2 + 1.4 + s * 1.3;
    vox.boxC(fx + s * 0.7, 0, fz, 3.2 - s * 0.7, 0.5 + s * 0.45, 1.1, 'woodMid');
    for (let i = 0; i < 4 - s; i++) {
      vox.boxC(fx + 0.6 + s * 0.7 + i * 0.8, 0.9 + s * 0.45, fz, 0.62, 0.62, 0.9,
        cols[(i + s) % 4]);
    }
  }
  // 墙面攀藤（两侧绿色竖条 + 零星花点）
  for (const sx of [-1, 1]) {
    vox.boxC(sx * (W / 2 - 0.9), 0, D / 2 + 0.16, 1.2, 3.0, 0.25, 'bush');
    vox.boxC(sx * (W / 2 - 0.9), 3.1, D / 2 + 0.16, 1.2, 0.9, 0.25, 'treeLite');
  }
  vox.boxC(-W / 2 + 1.4, 2.2, D / 2 + 0.16, 0.5, 0.5, 0.3, 'flowerRed');
  vox.boxC(W / 2 - 2.6, 1.6, D / 2 + 0.16, 0.5, 0.5, 0.3, 'flowerYel');
  // 吊篮花（檐口）
  vox.boxC(-W / 2 + 2.2, 3.3, D / 2 + 0.7, 0.8, 0.4, 0.8, 'flowerBlu');
  vox.boxC(W / 2 - 3.4, 3.3, D / 2 + 0.7, 0.8, 0.4, 0.8, 'flowerYel');
}

/** 动态小旗：挂 group（店铺局部坐标），返回摆动 updater */
function makeFlag(group, { x, y, z, size, color, phase = 0 }) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  group.add(pivot);
  // 旗杆横臂 + 旗面（两段错拍摆）
  dynBoxTo(pivot, size / 2 + 0.1, 0, 0, size + 0.2, 0.14, 0.14, 'metal');
  const seg1 = new THREE.Group(); pivot.add(seg1);
  dynBoxTo(seg1, size * 0.28, -size * 0.25, 0, size * 0.55, size * 0.5, 0.08, color);
  const seg2 = new THREE.Group(); seg2.position.x = size * 0.55; seg1.add(seg2);
  dynBoxTo(seg2, size * 0.2, -size * 0.2, 0, size * 0.4, size * 0.4, 0.08, color);
  return (dt, t) => {
    seg1.rotation.y = Math.sin(t * 2.1 + phase) * 0.35;
    seg2.rotation.y = Math.sin(t * 2.1 + phase + 0.8) * 0.45;
  };
}

function postExtra(shell, group) {
  const { W, D } = shell;
  // —— 室内：柜台+信格柜 + 待寄包裹架 ——
  vox.pushTransform(0, 0.3, 0, 0);
  I.postCounter(0.4, -D / 2 + 1.5, { rot: 0 });
  I.table(-W / 2 + 1.7, 0.6, { w: 1.6, d: 1.2 });
  I.chair(-W / 2 + 1.7, 1.9, { rot: 180 });
  // 包裹堆在角落
  vox.boxC(W / 2 - 1.3, 0, 0.6, 1.1, 0.9, 1.1, 'woodLight');
  vox.boxC(W / 2 - 1.3, 0.9, 0.6, 0.8, 0.7, 0.8, 'woodMid');
  vox.boxC(W / 2 - 1.3, 0.92, 0.6, 0.84, 0.12, 0.84, 'awningCream');
  I.chandelier(0, 3.0, 0);
  // —— 墙面装饰：邮票挂画 + 时钟 + 邮袋挂钩 ——
  vox.pushTransform(0, 0.3, 0, 0);
  I.wallPainting(-2.2, 2.3, { w: 0.7, h: 0.85, c1: 'clothB', c2: 'awningRed' }); // 大邮票画
  I.wallPainting(0, 2.35, { w: 0.55, h: 0.65, c1: 'flowerBlu', c2: 'awningCream' });
  // 挂钟（圆盘+指针）
  vox.boxC(2.0, 2.5, 0.08, 0.6, 0.6, 0.12, 'awningCream');
  vox.boxC(2.0, 2.5, 0.15, 0.34, 0.1, 0.05, 'woodDark');
  vox.boxC(2.0, 2.65, 0.15, 0.1, 0.24, 0.05, 'woodDark');
  vox.boxC(2.14, 2.5, 0.15, 0.2, 0.08, 0.05, 'woodDark');
  // 墙钩+邮袋
  vox.boxC(-0.6, 2.0, 0.06, 0.3, 0.14, 0.1, 'metal');
  vox.boxC(-0.6, 1.7, 0.12, 0.7, 0.5, 0.25, 'clothB');
  vox.boxC(-0.6, 1.82, 0.26, 0.5, 0.22, 0.06, 'awningCream');
  I.broom(W / 2 - 0.8, 2.6);
  vox.popTransform();
  vox.popTransform();
  // 大邮筒（红蓝双柱圆角箱）
  vox.boxC(-W / 2 - 2.0, 0, D / 2 + 2.0, 1.4, 2.6, 1.4, 'carRed');
  vox.boxC(-W / 2 - 2.0, 2.6, D / 2 + 2.0, 1.4, 0.5, 1.4, 'clothB');
  vox.boxC(-W / 2 - 2.05, 1.6, D / 2 + 2.7, 0.5, 0.35, 0.1, 'awningCream'); // 投信口
  // 包裹堆（门口不同尺寸木箱）
  vox.boxC(W / 2 - 1.4, 0, D / 2 + 1.7, 1.6, 1.3, 1.5, 'woodLight');
  vox.boxC(W / 2 - 1.4, 1.3, D / 2 + 1.7, 1.1, 0.9, 1.1, 'woodMid');
  vox.boxC(W / 2 - 1.4, 1.11, D / 2 + 1.7, 1.12, 0.16, 1.12, 'awningCream'); // 封条
  vox.boxC(W / 2 - 3.1, 0, D / 2 + 2.1, 1.2, 1.0, 1.2, 'woodLight');
  // 旗杆（邮局标配小旗，微摆）
  vox.boxC(-W / 2 - 3.6, 0, D / 2 + 3.4, 0.22, 5.2, 0.22, 'metal');
  return makeFlag(group, { x: -W / 2 - 3.6, y: 4.6, z: D / 2 + 3.4, size: 1.6, color: 'clothB' });
}

function barberExtra(shell, group, worldPos, rot) {
  const { W, D } = shell;
  // —— 室内：镜柜+理发椅 + 等候长凳 + 座钟 ——
  vox.pushTransform(0, 0.3, 0, 0);
  I.barberSet(-1.2, -D / 2 + 1.5);
  // 等候长凳（贴侧墙）
  vox.boxC(-W / 2 + 1.2, 0.55, 1.6, 3.2, 0.18, 1.0, 'woodMid');
  vox.boxC(-W / 2 + 1.2, 0, 1.35, 0.2, 0.55, 0.2, 'metal');
  vox.boxC(-W / 2 + 1.2, 0, 1.85, 0.2, 0.55, 0.2, 'metal');
  vox.boxC(-W / 2 + 1.2, 0, 2.1, 3.2, 0.7, 0.16, 'woodMid');
  // 杂志小几
  vox.boxC(-W / 2 + 3.2, 0.62, 1.6, 0.7, 0.06, 0.7, 'woodLight');
  vox.boxC(-W / 2 + 3.2, 0.68, 1.6, 0.5, 0.12, 0.4, 'clothC');
  I.grandfatherClock(W / 2 - 1.5, -D / 2 + 1.2);
  I.chandelier(0, 3.0, 0.4);
  // —— 墙面装饰：发型图挂画 + 转彩柱海报 + 壁灯 ——
  vox.pushTransform(0, 0.3, 0, 0);
  I.wallPainting(-2.0, 2.3, { w: 0.8, h: 0.9, c1: 'clothC', c2: 'awningRed' });
  I.wallPainting(0.4, 2.3, { w: 0.8, h: 0.9, c1: 'flowerBlu', c2: 'awningCream' });
  I.wallLamp(2.2, 2.5);
  // 等候区小圆桌上的杂志堆
  vox.boxC(-W / 2 + 3.2, 0.74, 1.6, 0.5, 0.1, 0.4, 'clothB');
  vox.boxC(-W / 2 + 3.2, 0.84, 1.6, 0.44, 0.08, 0.36, 'flowerRed');
  vox.boxC(-W / 2 + 3.2, 0.92, 1.6, 0.38, 0.08, 0.32, 'clothC');
  vox.popTransform();
  vox.popTransform();
  // 转彩柱：中柱白 + 斜纹用环绕的小色块（动画：绕柱自转）
  const px = -W / 2 - 1.3, pz = D / 2 + 1.2;
  vox.boxC(px, 0, pz, 0.9, 4.6, 0.9, 'awningCream');
  const spinner = new THREE.Group();
  spinner.position.set(px, 2.3, pz);
  // 斜纹：四段贴柱面的色片，旋转时像螺旋上升
  for (let i = 0; i < 10; i++) {
    const a = i * Math.PI / 5;
    const seg = dynBoxTo(spinner, Math.cos(a) * 0.5, (i - 5) * 0.42, Math.sin(a) * 0.5, 0.55, 0.22, 0.55,
      i % 2 === 0 ? 'carRed' : 'clothB', {});
    seg.rotation.y = -a;
  }
  group.add(spinner);
  // 顶灯（小圆球发光）
  vox.windowBox(px, 4.9, pz, 0.7, 0.7, 0.7, 'lampGlow');
  return { spinner };
}

function generalExtra(shell) {
  const { W, D } = shell;
  // —— 室内：双列货架 + 收银柜台 + 筐堆 ——
  vox.pushTransform(0, 0.3, 0, 0);
  I.groceryShelf(-1.8, -D / 2 + 1.6, { rot: 0 });
  I.groceryShelf(1.8, -D / 2 + 1.6, { rot: 0 });
  // 收银台
  vox.boxC(W / 2 - 2.0, 0, 0.4, 1.4, 1.05, 2.8, 'wallBrick');
  vox.boxC(W / 2 - 2.05, 1.05, 0.4, 1.5, 0.15, 2.9, 'woodMid');
  vox.boxC(W / 2 - 2.0, 1.2, 0.9, 0.4, 0.35, 0.4, 'metal');   // 收银机
  vox.boxC(W / 2 - 2.0, 1.55, 0.9, 0.5, 0.2, 0.3, 'awningCream');
  // 地上三只购物筐
  vox.boxC(-W / 2 + 1.6, 0, 1.8, 0.9, 0.5, 0.9, 'woodLight');
  vox.boxC(-W / 2 + 1.6, 0.5, 1.75, 0.75, 0.35, 0.75, 'flowerRed');
  vox.boxC(-W / 2 + 2.8, 0, 2.1, 0.9, 0.45, 0.9, 'woodLight');
  vox.boxC(-W / 2 + 2.8, 0.45, 2.05, 0.75, 0.3, 0.75, 'clothC');
  I.chandelier(0, 3.0, 0);
  I.shelfHamster(1.8, 2.6, -D / 2 + 1.6, -20);  // 店宠：货架顶抱瓜子的仓鼠
  // —— 墙面装饰：价目黑板 + 蔬果挂画 + 天平 ——
  vox.pushTransform(0, 0.3, 0, 0);
  // 大黑板（木框+板面+粉笔字迹色条）
  vox.boxC(-1.8, 2.1, 0.05, 2.2, 1.3, 0.12, 'woodDark');
  vox.boxC(-1.7, 2.1, 0.12, 2.0, 1.15, 0.06, 'roofDark');
  vox.boxC(-1.45, 2.42, 0.16, 1.5, 0.14, 0.04, 'awningCream');
  vox.boxC(-1.45, 2.12, 0.16, 1.7, 0.12, 0.04, 'awningCream');
  vox.boxC(-1.0, 1.82, 0.16, 0.9, 0.1, 0.04, 'awningCream');
  I.wallPainting(1.8, 2.3, { w: 0.7, h: 0.6, c1: 'bush', c2: 'flowerRed' });
  // 天平（老式秤）
  vox.boxC(W / 2 - 1.1, 0, 2.4, 0.4, 0.9, 0.4, 'woodMid');
  vox.boxC(W / 2 - 1.1, 0.9, 2.4, 0.1, 0.5, 0.1, 'metal');
  vox.boxC(W / 2 - 1.1, 1.35, 2.4, 0.8, 0.08, 0.08, 'metal');
  vox.boxC(W / 2 - 1.45, 1.1, 2.4, 0.24, 0.22, 0.24, 'metal');
  vox.boxC(W / 2 - 0.75, 1.1, 2.4, 0.24, 0.22, 0.24, 'metal');
  vox.popTransform();
  vox.popTransform();
  // 门口果蔬筐阵列
  const bins = [
    { x: -W / 2 + 1.2, z: D / 2 + 2.0, c: 'flowerRed' },   // 苹果筐
    { x: -W / 2 + 3.4, z: D / 2 + 2.2, c: 'flowerYel' },   // 柠檬筐
    { x: -W / 2 + 2.2, z: D / 2 + 3.6, c: 'bush' },        // 绿叶菜筐
    { x: W / 2 - 3.6, z: D / 2 + 2.0, c: 'clothC' },       // 青瓜筐
  ];
  for (const b of bins) {
    vox.boxC(b.x, 0, b.z, 1.7, 0.8, 1.5, 'woodLight');
    vox.boxC(b.x, 0.8, b.z, 1.45, 0.55, 1.25, b.c);
    vox.boxC(b.x + 0.3, 1.35, b.z - 0.2, 0.5, 0.4, 0.5, b.c);
  }
  // 锡罐金字塔（橱窗边）
  vox.boxC(W / 2 - 1.6, 0, D / 2 + 1.9, 1.8, 0.7, 1.2, 'metal');
  vox.boxC(W / 2 - 1.75, 0.7, D / 2 + 1.9, 1.5, 0.65, 1.05, 'metal');
  vox.boxC(W / 2 - 1.6, 1.35, D / 2 + 1.9, 0.9, 0.6, 0.8, 'metal');
  // 立式黑板价目牌
  vox.boxC(-W / 2 - 2.4, 0, D / 2 + 1.4, 0.15, 2.3, 0.15, 'woodDark');
  vox.boxC(-W / 2 - 2.4, 0.9, D / 2 + 1.4, 1.5, 1.2, 0.12, 'roofDark');
  vox.boxC(-W / 2 - 2.4, 1.15, D / 2 + 1.47, 1.0, 0.16, 0.05, 'awningCream');
  vox.boxC(-W / 2 - 2.4, 0.85, D / 2 + 1.47, 1.1, 0.12, 0.05, 'awningCream');
}

function innExtra(shell, group) {
  const { W, D } = shell;
  // —— 一层大堂：前台+楼梯+挂画+壁炉+沙发区 ——
  vox.pushTransform(0, 0.3, 0, 0);
  I.innLobby(0.2, -0.6);
  // 壁炉贴右墙
  vox.pushTransform(W / 2 - 1.6, 0, 1.2, -90);
  I.fireplace(0, 0);
  vox.popTransform();
  // 壁炉前的双人沙发+茶几
  vox.boxC(0.6, 0.55, 1.0, 2.6, 0.2, 1.1, 'carRed');        // 坐垫
  vox.boxC(0.6, 0, 1.0, 2.2, 0.55, 0.9, 'wallPlum');        // 底座
  vox.boxC(0.6, 0.75, 1.5, 2.6, 0.9, 0.24, 'carRed');       // 靠背
  vox.boxC(-0.6, 0, 0.4, 0.28, 0.55, 0.9, 'wallPlum');
  vox.boxC(1.9, 0, 0.4, 0.28, 0.55, 0.9, 'wallPlum');
  I.table(-0.9, 1.1, { w: 1.2, d: 1.0, top: 'woodLight' });
  vox.windowBox(-0.9, 1.31, 1.1, 0.32, 0.36, 0.32, 'winWarm'); // 茶杯
  // —— 大堂补细节：钥匙墙 + 挂画 + 行李堆（都在一层坐标系里）——
  // 前台后的钥匙墙（木板上挂一排钥匙钩）
  vox.boxC(0.2, 2.6, -D / 2 + 0.62, 3.0, 0.5, 0.12, 'woodMid');
  for (let i = 0; i < 5; i++) {
    vox.boxC(-1.0 + i * 0.6, 2.72, -D / 2 + 0.7, 0.12, 0.18, 0.08, 'metal');
    vox.boxC(-1.0 + i * 0.6, 2.58, -D / 2 + 0.72, 0.08, 0.12, 0.06, 'metal');
  }
  I.wallPainting(-3.2, 2.4, { w: 0.9, h: 0.75, c1: 'roofBlue', c2: 'star' });
  // 角落行李堆（皮箱+帽盒）
  vox.boxC(-W / 2 + 1.1, 0, 2.2, 1.1, 0.8, 0.9, 'clothC');
  vox.boxC(-W / 2 + 1.1, 0.8, 2.2, 1.15, 0.12, 0.95, 'woodDark');
  vox.boxC(-W / 2 + 1.1, 0.92, 2.2, 0.6, 0.5, 0.6, 'roofBlue');
  vox.boxC(-W / 2 + 1.85, 0, 2.5, 0.7, 0.6, 0.7, 'wallPlum');
  // —— 二层走廊围栏（屋顶揭开时看到楼上房间一角；楼板顶面=绝对 FLOOR_H） ——
  const F2 = FLOOR_H - 0.3; // 相对室内地面的二层高度
  vox.boxC(-W / 2 + 0.3, F2 + 0.05, -D / 2 + 0.3, W - 0.6, 0.7, 0.35, 'woodMid', { group: shell.roofGroup });
  vox.boxC(-W / 2 + 0.3, F2 + 0.05, -0.1, 0.35, 0.7, D / 2 - 0.5, 'woodMid', { group: shell.roofGroup });
  // 二层一张床+床头柜（示意客房，跟着屋顶组一起显隐）
  vox.pushTransform(0, F2, 0, 0);
  I.bed(-1.6, -D / 2 + 2.6, { rot: 0, quilt: 'carRed' });
  vox.boxC(0.2, 0, -D / 2 + 2.6, 0.7, 0.75, 0.7, 'woodMid');
  vox.windowBox(0.2, 0.9, -D / 2 + 2.6, 0.3, 0.3, 0.3, 'lampGlow');
  vox.popTransform();
  vox.popTransform();
  // 雨棚灯带（门口一排小灯）
  vox.boxC(-1.8, 3.2, D / 2 + 1.5, 5.2, 0.28, 1.8, 'roofBlue');
  for (let i = 0; i < 4; i++) {
    vox.windowBox(-1.8 + i * 1.3, 2.85, D / 2 + 2.1, 0.4, 0.4, 0.4, 'lampGlow');
  }
  // 入口灯笼（两侧）
  vox.boxC(-3.2, 2.6, D / 2 + 0.7, 0.7, 0.9, 0.7, 'winWarm');
  vox.boxC(3.2, 2.6, D / 2 + 0.7, 0.7, 0.9, 0.7, 'winWarm');
  // 门口行李车（旅店叙事感）
  vox.boxC(W / 2 - 3.0, 0, D / 2 + 2.3, 1.9, 0.7, 1.3, 'metal');
  vox.boxC(W / 2 - 3.0, 0.7, D / 2 + 2.3, 1.6, 0.8, 1.1, 'clothC');
  vox.boxC(W / 2 - 3.0, 1.5, D / 2 + 2.15, 1.2, 0.55, 0.9, 'clothA');
  // 屋顶小旗
  vox.boxC(0, shell.roofBase + 2.55, -1.0, 0.18, 2.2, 0.18, 'metal');
  return makeFlag(group, { x: 0, y: shell.roofBase + 4.4, z: -1.0, size: 1.4, color: 'clothA', phase: 2 });
}

// ------------------------------------------------------------
// 总装：8 家店
// ------------------------------------------------------------
export function buildShops(scene) {
  const updaters = [];
  for (const cfg of SHOPS) {
    const group = new THREE.Group();
    group.position.set(cfg.x, terrainHeight(cfg.x, cfg.z), cfg.z);
    group.rotation.y = cfg.rot * Math.PI / 180;
    scene.add(group);

    // 各家墙色/规模/室内主题色（floorA/floorB=地砖双色，skirt=墙裙）
    const opts = {
      bakery:  { wall: 'wallCream', roofC: 'roofRed',   W: 10, D: 9, floors: 1, floorA: 'awningCream', floorB: 'flowerYel', skirt: 'awningRed' },
      coffee:  { wall: 'wallWood',  roofC: 'roofDark',  W: 10, D: 9, floors: 1, floorA: 'woodMid',      floorB: 'woodDark',  skirt: 'wallPlum' },
      book:    { wall: 'wallSlate', roofC: 'roofBlue',  W: 10, D: 9, floors: 1, floorA: 'awningCream', floorB: 'rockDark',  skirt: 'clothB' },
      flower:  { wall: 'wallCream', roofC: 'roofGreen', W: 10, D: 8, floors: 1, floorA: 'awningCream', floorB: 'bush',     skirt: 'treeLite' },
      post:    { wall: 'wallSlate', roofC: 'roofBlue',  W: 9,  D: 8, floors: 1, floorA: 'roadLit',      floorB: 'roadDark',  skirt: 'clothB' },
      barber:  { wall: 'awningCream', roofC: 'roofRed', W: 8,  D: 7, floors: 1, floorA: 'awningCream', floorB: 'rockDark',  skirt: 'carRed' },
      general: { wall: 'wallBrick', roofC: 'roofGreen', W: 11, D: 9, floors: 1, floorA: 'woodMid',      floorB: 'woodLight', skirt: 'woodDark' },
      inn:     { wall: 'wallPlum',  roofC: 'roofBlue',  W: 12, D: 10, floors: 2, floorA: 'awningCream', floorB: 'roadDark', skirt: 'roofBlue' },
    }[cfg.id];

    // 外壳画进体素桶（挂 transform），动态件挂 group
    vox.pushTransform(cfg.x, group.position.y, cfg.z, cfg.rot);
    const shell = shopShell(cfg, opts);
    let extraRet = null;
    switch (cfg.id) {
      case 'bakery': extraRet = bakeryExtra(shell); break;
      case 'coffee': coffeeExtra(shell, group); break;
      case 'book': bookExtra(shell); break;
      case 'flower': flowerExtra(shell); break;
      case 'post': extraRet = { flagUpdater: postExtra(shell, group) }; break;
      case 'barber': extraRet = barberExtra(shell, group); break;
      case 'general': generalExtra(shell); break;
      case 'inn': extraRet = { flagUpdater: innExtra(shell, group) }; break;
    }
    vox.popTransform();

    // 烟囱（烤炉）→ 世界坐标登记冒烟
    if (extraRet && extraRet.chimney) {
      const rad = cfg.rot * Math.PI / 180;
      const c = extraRet.chimney;
      registerChimney({
        x: cfg.x + c.x * Math.cos(rad) + c.z * Math.sin(rad),
        y: group.position.y + c.y,
        z: cfg.z - c.x * Math.sin(rad) + c.z * Math.cos(rad),
        rate: 0.85,
      });
    }

    // 理发店转彩柱动画
    if (extraRet && extraRet.spinner) {
      const sp = extraRet.spinner;
      updaters.push((dt) => { sp.rotation.y += dt * 1.8; });
    }
    // 旗帜摆动动画
    if (extraRet && extraRet.flagUpdater) {
      updaters.push(extraRet.flagUpdater);
    }

    registerBuilding({
      name: cfg.name, blurb: cfg.blurb,
      cx: cfg.x, cz: cfg.z,
      y0: group.position.y - 1,
      y1: group.position.y + shell.wallH + (opts.floors >= 2 ? 3.4 : 2.8),
      halfW: opts.W / 2 + 1.5, halfD: opts.D / 2 + 1.5,
      hasInterior: true, roofGroup: shell.roofGroup,
      _rot: cfg.rot, // 店面朝向（进店机位用）
    });
  }
  return updaters;
}
