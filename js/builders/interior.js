// ============================================================
// builders/interior.js — 室内家具库
// ------------------------------------------------------------
// 商铺/住宅内景的全部陈设，全是参数化体素组合（进静态桶）。
// 家具在建筑局部坐标里摆放（地面 y=0，门朝 +z）。
// ============================================================
import { vox } from '../voxel.js';

// —— 墙面装饰件 ——————————————————————————

/** 挂画（框+画布内容色块，贴 -z 后墙；rot 由 pushTransform 外层管） */
export function wallPainting(x, y, { w = 1.0, h = 0.8, c1 = 'clothC', c2 = 'flowerBlu' } = {}) {
  vox.boxC(x - w / 2, y, -0.02, w + 0.16, h + 0.16, 0.1, 'woodDark');   // 框
  vox.boxC(x - w / 2 + 0.08, y + 0.08, 0.05, w, h, 0.06, 'awningCream');// 画布
  vox.boxC(x - w / 2 + 0.2, y + 0.14, 0.1, w * 0.42, h * 0.4, 0.05, c1);// 内容色块1（山）
  vox.boxC(x - w / 2 + 0.16, y + 0.1, 0.1, w * 0.24, h * 0.28, 0.05, c2);// 内容色块2（日/月）
}

/** 壁灯（小灯罩+暖光，贴墙） */
export function wallLamp(x, y) {
  vox.boxC(x - 0.2, y, 0.06, 0.4, 0.14, 0.14, 'metal');     // 支臂
  vox.boxC(x - 0.28, y + 0.3, 0.08, 0.56, 0.4, 0.3, 'roofDark'); // 灯罩
  vox.windowBox(x, y + 0.02, 0.12, 0.32, 0.32, 0.2, 'lampGlow');
}

/** 壁架（木板+瓶瓶罐罐） */
export function wallShelf(x, y, { jars = 3 } = {}) {
  vox.boxC(x - 0.9, y, 0.02, 1.8, 0.14, 0.5, 'woodMid');
  const cols = ['flowerRed', 'clothC', 'flowerYel', 'bush'];
  for (let i = 0; i < jars; i++) {
    vox.boxC(x - 0.7 + i * 0.55, y + 0.24, 0.06, 0.3, 0.34, 0.3, cols[i % 4]);
    vox.boxC(x - 0.7 + i * 0.55, y + 0.6, 0.06, 0.2, 0.12, 0.2, 'woodDark'); // 罐口
  }
}

/** 扫帚（斜靠墙角） */
export function broom(x, z) {
  vox.boxC(x, 0.9, z, 0.14, 1.9, 0.14, 'woodLight');
  vox.boxC(x, 0.25, z, 0.42, 0.62, 0.2, 'fieldWheat');
  vox.boxC(x, 0.56, z, 0.3, 0.2, 0.16, 'clothA');
}

/** 木箱堆（两只叠放） */
export function crateStack(x, z, { rot = 0 } = {}) {
  vox.pushTransform(x, 0, z, rot);
  vox.boxC(-0.55, 0, -0.55, 1.1, 1.0, 1.1, 'woodLight');
  vox.boxC(-0.5, 0.06, 0.52, 1.0, 0.16, 0.08, 'woodDark');   // 箱条
  vox.boxC(0.5, 0.06, -0.52, 0.08, 0.16, 1.0, 'woodDark');
  vox.boxC(-0.4, 1.0, -0.4, 0.8, 0.75, 0.8, 'woodMid');
  vox.boxC(-0.35, 1.06, 0.38, 0.7, 0.14, 0.07, 'woodDark');
  vox.popTransform();
}

// —— 基础件（加密版）—————————————————————————

/** 木桌：加桌布垂边 + 桌面三件套（杯/盘/小花瓶） */
export function table(x, z, { w = 2.0, d = 1.6, h = 1.1, top = 'woodMid', leg = 'woodDark', cloth = null } = {}) {
  vox.boxC(x - w / 2, h - 0.18, z - d / 2, w, 0.2, d, top);
  for (const [lx, lz] of [[-w / 2 + 0.18, -d / 2 + 0.18], [w / 2 - 0.34, -d / 2 + 0.18], [-w / 2 + 0.18, d / 2 - 0.34], [w / 2 - 0.34, d / 2 - 0.34]]) {
    vox.boxC(x + lx, 0, z + lz, 0.18, h - 0.18, 0.18, leg);
  }
  if (cloth) {
    // 桌布：桌面铺色+四边垂帘
    vox.boxC(x - w / 2 - 0.06, h + 0.03, z - d / 2 - 0.06, w + 0.12, 0.08, d + 0.12, cloth);
    vox.boxC(x - w / 2 - 0.06, h - 0.28, z - d / 2 - 0.06, w + 0.12, 0.3, 0.1, cloth);
    vox.boxC(x - w / 2 - 0.06, h - 0.28, z + d / 2 - 0.02, w + 0.12, 0.3, 0.1, cloth);
    vox.boxC(x - w / 2 - 0.06, h - 0.28, z - d / 2, 0.1, 0.3, d, cloth);
    vox.boxC(x + w / 2 - 0.02, h - 0.28, z - d / 2, 0.1, 0.3, d, cloth);
  }
  // 三件套：杯、盘、花瓶
  vox.windowBox(x - w / 4, h + 0.05, z, 0.2, 0.24, 0.2, 'winGlow');
  vox.boxC(x, h + 0.04, z + d / 5, 0.5, 0.08, 0.4, 'awningCream');
  vox.boxC(x + w / 4, h + 0.05, z - d / 6, 0.18, 0.3, 0.18, 'flowerBlu');
  vox.boxC(x + w / 4, h + 0.38, z - d / 6, 0.12, 0.16, 0.12, 'flowerRed');
}

/** 圆凳 */
export function stool(x, z, { c = 'woodMid' } = {}) {
  vox.boxC(x - 0.35, 0, z - 0.35, 0.7, 0.62, 0.7, c);
  vox.boxC(x - 0.2, 0.62, z - 0.2, 0.4, 0.14, 0.4, 'woodDark');
}

/** 靠背椅 */
export function chair(x, z, { rot = 0, c = 'woodMid' } = {}) {
  vox.pushTransform(x, 0, z, rot);
  vox.boxC(-0.4, 0.5, -0.4, 0.8, 0.14, 0.8, c);        // 坐板
  vox.boxC(-0.4, 0.64, -0.72, 0.8, 0.95, 0.16, c);     // 靠背
  vox.boxC(-0.36, 0, -0.36, 0.16, 0.5, 0.16, 'woodDark');
  vox.boxC(0.2, 0, -0.36, 0.16, 0.5, 0.16, 'woodDark');
  vox.boxC(-0.36, 0, 0.2, 0.16, 0.5, 0.16, 'woodDark');
  vox.boxC(0.2, 0, 0.2, 0.16, 0.5, 0.16, 'woodDark');
  vox.popTransform();
}

/** 单人床（床头靠 -z 墙）：床架+褥+枕头+被子 */
export function bed(x, z, { rot = 0, quilt = 'clothB', sheet = 'awningCream' } = {}) {
  vox.pushTransform(x, 0, z, rot);
  vox.boxC(-1.1, 0, -2.0, 2.2, 0.55, 4.0, 'woodMid');   // 床架
  vox.boxC(-1.0, 0.55, -1.9, 2.0, 0.35, 3.8, sheet);     // 褥
  vox.boxC(-0.85, 0.9, -1.75, 1.7, 0.3, 0.9, 'awningCream'); // 枕头
  vox.boxC(-1.0, 0.9, -0.6, 2.0, 0.3, 2.4, quilt);       // 被子
  vox.boxC(-1.15, 0.55, -2.15, 2.3, 1.5, 0.3, 'woodDark'); // 床头板
  vox.popTransform();
}

/** 地毯（扁平面，双色边框） */
export function rug(x, z, { w = 3.4, d = 2.6, c1 = 'carRed', c2 = 'awningCream' } = {}) {
  vox.boxC(x - w / 2, 0.02, z - d / 2, w, 0.06, d, c1);
  vox.boxC(x - w / 2 + 0.4, 0.045, z - d / 2 + 0.4, w - 0.8, 0.06, d - 0.8, c2);
}

/** 吊灯（屋顶垂下的暖光） */
export function chandelier(x, y, z, { arms = 3 } = {}) {
  vox.boxC(x - 0.06, y - 0.8, z - 0.06, 0.12, 0.8, 0.12, 'metal');   // 吊线
  vox.boxC(x - 0.4, y - 1.0, z - 0.4, 0.8, 0.2, 0.8, 'metal');       // 盘
  for (let i = 0; i < arms; i++) {
    const a = (i / arms) * Math.PI * 2;
    vox.windowBox(x + Math.cos(a) * 0.55 - 0.12, y - 1.25, z + Math.sin(a) * 0.55 - 0.12,
      0.24, 0.3, 0.24, 'lampGlow');
  }
}

/** 壁炉（石框+柴+火光，靠墙 -z） */
export function fireplace(x, z, { fireGlow = true } = {}) {
  vox.boxC(x - 1.3, 0, z - 0.55, 2.6, 2.4, 1.1, 'rock');       // 石框
  vox.boxC(x - 0.9, 0, z - 0.35, 1.8, 1.4, 0.7, 'roofDark');   // 炉膛
  vox.boxC(x - 1.4, 2.4, z - 0.6, 2.8, 0.35, 1.2, 'rockDark'); // 台
  vox.boxC(x - 0.6, 0.15, z - 0.1, 1.2, 0.35, 0.4, 'woodDark');// 柴
  if (fireGlow) vox.windowBox(x - 0.4, 0.5, z - 0.05, 0.8, 0.5, 0.35, 'winWarm');
  // 烟囱部分由外墙负责
}

/** 盆栽 */
export function pottedPlant(x, z) {
  vox.boxC(x - 0.4, 0, z - 0.4, 0.8, 0.7, 0.8, 'roofRed');
  vox.boxC(x - 0.35, 0.7, z - 0.35, 0.7, 0.5, 0.7, 'bush');
  vox.boxC(x - 0.2, 1.2, z - 0.2, 0.4, 0.45, 0.4, 'treeLite');
}

// —— 商铺专用件 ——————————————————————————

/** 面包房：砖烤炉（拱顶+炉口火光+烟道） */
export function breadOven(x, z) {
  vox.boxC(x - 1.4, 0, z - 1.0, 2.8, 2.6, 2.0, 'wallBrick');
  vox.boxC(x - 1.5, 2.6, z - 1.1, 3.0, 0.3, 2.2, 'rockDark');
  vox.boxC(x - 1.1, 2.9, z - 1.2, 2.2, 0.8, 2.4, 'wallBrick');  // 拱顶
  vox.boxC(x - 0.6, 0, z + 0.92, 1.2, 1.2, 0.25, 'roofDark');   // 炉口
  vox.windowBox(x - 0.5, 0.45, z + 1.0, 1.0, 0.8, 0.12, 'winWarm'); // 炉火
  vox.boxC(x - 0.85, 1.6, z + 0.95, 0.3, 0.3, 0.12, 'metal');   // 炉门铰
  // 出炉托盘
  vox.boxC(x - 0.7, 1.15, z + 1.35, 1.4, 0.14, 0.7, 'metal');
  vox.boxC(x - 0.4, 1.29, z + 1.3, 0.55, 0.28, 0.5, 'flowerYel');
  vox.boxC(x + 0.3, 1.29, z + 1.4, 0.45, 0.24, 0.45, 'flowerYel');
}

/** 面包架（木架+两层面包） */
export function breadShelf(x, z, { rot = 0 } = {}) {
  vox.pushTransform(x, 0, z, rot);
  vox.boxC(-0.9, 0, -0.3, 0.16, 2.0, 0.6, 'woodDark');
  vox.boxC(0.74, 0, -0.3, 0.16, 2.0, 0.6, 'woodDark');
  vox.boxC(-0.9, 0.85, -0.32, 1.8, 0.16, 0.64, 'woodLight');
  vox.boxC(-0.9, 1.75, -0.32, 1.8, 0.16, 0.64, 'woodLight');
  for (let i = 0; i < 3; i++) {
    vox.boxC(-0.55 + i * 0.6, 1.01, -0.15, 0.5, 0.3, 0.4, 'flowerYel');
    if (i < 2) vox.boxC(-0.35 + i * 0.75, 1.91, -0.15, 0.55, 0.32, 0.42, 'flowerYel');
  }
  vox.popTransform();
}

/** 咖啡馆：咖啡吧台+咖啡机 */
export function coffeeBar(x, z, { rot = 0 } = {}) {
  vox.pushTransform(x, 0, z, rot);
  vox.boxC(-2.0, 0, -0.45, 4.0, 1.15, 0.9, 'woodMid');    // 台身
  vox.boxC(-2.1, 1.15, -0.5, 4.2, 0.16, 1.0, 'awningCream'); // 台面
  // 咖啡机（金属身子+出液口+暖光指示）
  vox.boxC(-1.2, 1.31, -0.2, 0.9, 0.9, 0.7, 'metal');
  vox.boxC(-1.2, 2.21, -0.2, 0.7, 0.25, 0.5, 'roofDark');
  vox.boxC(-1.2, 1.31, 0.18, 0.4, 0.35, 0.14, 'woodDark');
  vox.windowBox(-0.95, 1.95, 0.14, 0.2, 0.2, 0.08, 'winWarm');
  // 杯子×2 + 蛋糕罩
  vox.windowBox(-0.1, 1.31, 0, 0.26, 0.3, 0.26, 'winGlow');
  vox.windowBox(0.35, 1.31, -0.1, 0.26, 0.3, 0.26, 'winGlow');
  vox.boxC(1.0, 1.31, 0, 0.7, 0.55, 0.7, 'awningCream');
  vox.boxC(1.0, 1.86, 0, 0.5, 0.2, 0.5, 'flowerYel');
  vox.popTransform();
}

/** 书店：书架（两列四层，彩色书脊） */
export function bookshelf(x, z, { rot = 0 } = {}) {
  vox.pushTransform(x, 0, z, rot);
  const bookCols = ['flowerRed', 'clothB', 'clothC', 'flowerYel', 'flowerBlu', 'clothA'];
  vox.boxC(-0.9, 0, -0.28, 1.8, 3.4, 0.56, 'woodDark');    // 框
  vox.boxC(-0.35, 0.15, -0.2, 0.7, 3.1, 0.4, 'roofDark');  // 内腔
  vox.boxC(0.35, 0.15, -0.2, 0.7, 3.1, 0.4, 'roofDark');
  for (let s = 0; s < 4; s++) {
    const sy = 0.35 + s * 0.78;
    vox.boxC(-0.9, sy + 0.62, -0.3, 1.8, 0.14, 0.6, 'woodMid'); // 层板
    for (let i = 0; i < 3; i++) {
      const bh = 0.4 + ((s + i) % 3) * 0.12;
      vox.boxC(-0.78 + i * 0.42, sy + 0.07, -0.22, 0.34, bh, 0.36, bookCols[(s * 3 + i) % 6]);
      vox.boxC(0.02 + i * 0.42, sy + 0.07, -0.22, 0.34, bh * 0.8, 0.36, bookCols[(s * 3 + i + 2) % 6]);
    }
  }
  vox.popTransform();
}

/** 花店：花台（阶梯三层，各色花团+水桶） */
export function flowerBench(x, z, { rot = 0 } = {}) {
  vox.pushTransform(x, 0, z, rot);
  const cols = ['flowerRed', 'flowerYel', 'flowerBlu'];
  for (let s = 0; s < 3; s++) {
    vox.boxC(-1.0, s * 0.55, -0.4 + s * 0.35, 2.0, 0.55, 0.7, 'woodMid');
    for (let i = 0; i < 3; i++) {
      vox.boxC(-0.8 + i * 0.8, s * 0.55 + 0.55, -0.3 + s * 0.35, 0.62, 0.5, 0.6, cols[(i + s) % 3]);
    }
  }
  // 锡皮洒水壶
  vox.boxC(1.3, 0, 0.1, 0.45, 0.5, 0.45, 'metal');
  vox.boxC(1.15, 0.5, 0.1, 0.16, 0.3, 0.16, 'metal');
  vox.popTransform();
}

/** 邮局：柜台+信格柜 */
export function postCounter(x, z, { rot = 0 } = {}) {
  vox.pushTransform(x, 0, z, rot);
  vox.boxC(-1.6, 0, -0.4, 3.2, 1.1, 0.8, 'wallSlate');
  vox.boxC(-1.7, 1.1, -0.45, 3.4, 0.16, 0.9, 'woodMid');
  // 信格柜（墙上柜）
  vox.boxC(-1.2, 1.4, -0.5, 2.4, 1.6, 0.5, 'woodMid');
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 4; c++) {
      vox.boxC(-1.05 + c * 0.58, 1.62 + r * 0.72, -0.28, 0.46, 0.56, 0.1, 'roofDark');
    }
  }
  // 待寄包裹一枚
  vox.boxC(0.9, 1.26, 0, 0.6, 0.5, 0.6, 'woodLight');
  vox.boxC(0.9, 1.76, 0, 0.5, 0.1, 0.5, 'awningCream');
  vox.popTransform();
}

/** 理发店：转镜柜+理发椅 */
export function barberSet(x, z) {
  // 镜柜
  vox.boxC(x - 1.0, 1.2, z - 0.35, 2.0, 1.8, 0.7, 'woodMid');
  vox.boxC(x - 0.8, 1.45, z + 0.02, 1.6, 1.3, 0.12, 'star');   // 镜面（亮材质）
  vox.boxC(x, 2.35, z - 0.3, 1.4, 0.2, 0.4, 'metal');           // 台面
  vox.boxC(x - 0.5, 2.5, z - 0.25, 0.24, 0.3, 0.24, 'metal');   // 剪刀罐
  vox.boxC(x + 0.4, 2.5, z - 0.25, 0.24, 0.3, 0.24, 'metal');
  // 理发椅（红座+铬脚）
  vox.boxC(x + 2.2, 0.7, z, 1.0, 0.3, 1.0, 'carRed');
  vox.boxC(x + 2.2, 1.0, z - 0.45, 1.0, 1.1, 0.2, 'carRed');
  vox.boxC(x + 2.2, 0, z, 0.5, 0.7, 0.5, 'metal');
  vox.boxC(x + 2.2, 0.25, z + 0.55, 0.3, 0.2, 0.4, 'metal');
}

/** 杂货铺：货架两组+筐堆 */
export function groceryShelf(x, z, { rot = 0 } = {}) {
  vox.pushTransform(x, 0, z, rot);
  const goods = ['flowerRed', 'clothC', 'flowerYel', 'clothB', 'bush', 'metal'];
  for (const sx of [-0.85, 0.15]) {
    vox.boxC(sx, 0, -0.3, 1.7, 2.6, 0.6, 'woodMid');
    vox.boxC(sx, 0.15, -0.22, 1.5, 2.3, 0.4, 'roofDark');
    for (let s = 0; s < 3; s++) {
      vox.boxC(sx, 0.75 + s * 0.75, -0.32, 1.7, 0.13, 0.62, 'woodLight');
      for (let i = 0; i < 3; i++) {
        vox.boxC(sx - 0.55 + i * 0.55, 0.88 + s * 0.75, -0.2, 0.4, 0.42, 0.36, goods[(s * 3 + i) % 6]);
      }
    }
  }
  vox.popTransform();
}

/** 旅馆大堂：前台+行李架+挂画+楼梯段 */
export function innLobby(x, z) {
  // 前台
  vox.boxC(x - 1.8, 0, z - 0.45, 3.6, 1.15, 0.9, 'wallPlum');
  vox.boxC(x - 1.9, 1.15, z - 0.5, 3.8, 0.16, 1.0, 'woodMid');
  vox.boxC(x - 0.4, 1.31, z, 0.5, 0.06, 0.5, 'roofDark');       // 台账
  vox.windowBox(x + 0.5, 1.36, z, 0.3, 0.36, 0.3, 'winGlow');   // 台灯
  // 楼梯（上二楼的段，贴 -x 墙）
  for (let i = 0; i < 5; i++) {
    vox.boxC(x - 3.4, i * 0.55, z - 2.6 + i * 0.85, 1.6, 0.55, 0.85, 'woodLight');
  }
  vox.boxC(x - 3.4, 2.75, z - 0.3, 1.6, 0.14, 4.4, 'metal');    // 扶手
  // 墙上挂画×2
  vox.boxC(x - 0.9, 2.4, z - 2.85, 0.9, 0.7, 0.1, 'woodDark');
  vox.boxC(x - 0.75, 2.47, z - 2.82, 0.6, 0.5, 0.06, 'clothC');
  vox.boxC(x + 0.8, 2.4, z - 2.85, 0.7, 0.55, 0.1, 'woodDark');
  vox.boxC(x + 0.68, 2.46, z - 2.82, 0.45, 0.4, 0.06, 'flowerBlu');
}

/** 座钟（角落立钟：壳+钟面+摆） */
export function grandfatherClock(x, z) {
  vox.boxC(x - 0.45, 0, z - 0.35, 0.9, 3.0, 0.7, 'woodDark');
  vox.boxC(x - 0.3, 2.1, z + 0.02, 0.6, 0.6, 0.1, 'awningCream');
  vox.boxC(x - 0.32, 1.9, z + 0.01, 0.64, 0.64, 0.06, 'woodMid');
  vox.boxC(x - 0.2, 0.4, z + 0.05, 0.4, 1.4, 0.1, 'roofDark');  // 摆腔
  vox.boxC(x - 0.12, 0.5, z + 0.09, 0.24, 0.7, 0.06, 'metal');  // 摆
  vox.boxC(x - 0.18, 0.44, z + 0.07, 0.36, 0.3, 0.1, 'awningRed');
}

// —— 店宠（萌点担当，静态体素小动物 + 呼吸靠灯效，不动也可爱）——

/** 趴猫（面包房柜台上）：盘成一团的黑猫，尾巴圈身前 */
export function counterCat(x, y, z, rot = 0) {
  vox.pushTransform(x, y, z, rot);
  vox.boxC(-0.45, 0, -0.45, 0.9, 0.4, 0.9, 'catBlack');        // 盘身
  vox.boxC(-0.3, 0.4, -0.3, 0.6, 0.42, 0.6, 'catBlack');       // 背拱
  vox.boxC(0.05, 0.35, 0.5, 0.48, 0.44, 0.42, 'catBlack');     // 头
  vox.boxC(-0.12, 0.68, 0.52, 0.12, 0.16, 0.08, 'catBlack');   // 耳×2
  vox.boxC(0.22, 0.68, 0.52, 0.12, 0.16, 0.08, 'catBlack');
  vox.windowBox(0.0, 0.42, 0.72, 0.09, 0.08, 0.05, 'winWarm'); // 闭目（暖色眯眯眼）
  vox.windowBox(0.16, 0.42, 0.72, 0.09, 0.08, 0.05, 'winWarm');
  vox.boxC(-0.5, 0.08, 0.55, 0.85, 0.18, 0.2, 'catBlack');     // 尾巴圈前
  vox.popTransform();
}

/** 枝头小鸟（花房）：圆身+尖喙+小爪，站横杆上 */
export function perchBird(x, y, z, rot = 0) {
  vox.pushTransform(x, y, z, rot);
  vox.boxC(-0.22, 0, -0.32, 0.44, 0.42, 0.62, 'flowerYel');    // 身
  vox.boxC(0, 0.24, -0.55, 0.34, 0.34, 0.3, 'flowerYel');      // 头
  vox.boxC(0, 0.22, -0.74, 0.12, 0.1, 0.12, 'carRed');         // 尖喙
  vox.windowBox(0.1, 0.28, -0.62, 0.08, 0.08, 0.05, 'catBlack'); // 眼
  vox.boxC(-0.28, 0.05, -0.35, 0.14, 0.1, 0.5, 'clothB');      // 翅
  vox.boxC(0.28, 0.05, -0.35, 0.14, 0.1, 0.5, 'clothB');
  vox.boxC(-0.15, -0.24, -0.2, 0.08, 0.24, 0.08, 'carRed');    // 爪×2
  vox.boxC(0.15, -0.24, -0.2, 0.08, 0.24, 0.08, 'carRed');
  vox.popTransform();
}

/** 仓鼠（杂货货架顶）：胖团子+小耳+腮帮食粮 */
export function shelfHamster(x, y, z, rot = 0) {
  vox.pushTransform(x, y, z, rot);
  vox.boxC(-0.3, 0, -0.35, 0.6, 0.5, 0.7, 'fieldWheat');       // 胖身
  vox.boxC(0, 0.25, -0.42, 0.42, 0.4, 0.4, 'fieldWheat');      // 头
  vox.boxC(-0.13, 0.5, -0.42, 0.12, 0.14, 0.08, 'awningCream');// 耳×2
  vox.boxC(0.13, 0.5, -0.42, 0.12, 0.14, 0.08, 'awningCream');
  vox.windowBox(0, 0.3, -0.63, 0.07, 0.07, 0.05, 'catBlack');  // 眼×2
  vox.windowBox(0.14, 0.3, -0.63, 0.07, 0.07, 0.05, 'catBlack');
  vox.boxC(0, 0.16, -0.66, 0.1, 0.08, 0.08, 'flowerRed');      // 小鼻
  vox.boxC(-0.2, 0.15, -0.55, 0.24, 0.24, 0.2, 'flowerYel');   // 抱着的瓜子
  vox.popTransform();
}

/** 兔子（书店阅读桌旁）：长耳白兔坐姿 */
export function deskRabbit(x, y, z, rot = 0) {
  vox.pushTransform(x, y, z, rot);
  vox.boxC(-0.3, 0, -0.32, 0.6, 0.55, 0.64, 'awningCream');    // 坐身
  vox.boxC(0, 0.42, -0.4, 0.44, 0.42, 0.4, 'awningCream');     // 头
  vox.boxC(-0.12, 0.78, -0.42, 0.12, 0.42, 0.09, 'awningCream');// 长耳×2
  vox.boxC(0.12, 0.78, -0.42, 0.12, 0.42, 0.09, 'awningCream');
  vox.windowBox(0, 0.5, -0.61, 0.08, 0.08, 0.05, 'catBlack');  // 眼×2
  vox.windowBox(0.14, 0.5, -0.61, 0.08, 0.08, 0.05, 'catBlack');
  vox.boxC(0, 0.36, -0.62, 0.1, 0.07, 0.06, 'flowerRed');      // 鼻
  vox.boxC(-0.36, 0.3, -0.2, 0.14, 0.4, 0.14, 'awningCream');  // 前爪×2
  vox.boxC(0.36, 0.3, -0.2, 0.14, 0.4, 0.14, 'awningCream');
  vox.boxC(0, 0.1, 0.5, 0.14, 0.14, 0.5, 'awningCream');       // 圆尾
  vox.popTransform();
}

// ============================================================
// 民宅家具（house.js 内景消费）
// ============================================================

/** 摇椅（弧形底轨 + 高背，靠 -z 墙摆最 cozy） */
export function rockingChair(x, z, { rot = 0, c = 'woodMid' } = {}) {
  vox.pushTransform(x, 0, z, rot);
  // 座 + 靠背（横板条）
  vox.boxC(-0.45, 0.55, -0.4, 0.9, 0.14, 0.85, c);
  for (let i = 0; i < 3; i++) vox.boxC(-0.45, 0.72 + i * 0.3, -0.62, 0.9, 0.14, 0.1, c);
  vox.boxC(-0.45, 1.72, -0.66, 0.9, 0.16, 0.2, c);               // 顶枕
  // 扶手 + 前后腿
  vox.boxC(-0.52, 0.72, -0.1, 0.1, 0.5, 0.6, c);
  vox.boxC(0.42, 0.72, -0.1, 0.1, 0.5, 0.6, c);
  // 弧形滑轨（两段阶梯近似弧）
  for (const sx of [-0.5, 0.4]) {
    vox.boxC(sx, 0.06, -0.5, 0.12, 0.16, 0.36, 'woodDark');
    vox.boxC(sx, 0.0, -0.2, 0.12, 0.12, 0.7, 'woodDark');
    vox.boxC(sx, 0.06, 0.22, 0.12, 0.16, 0.36, 'woodDark');
  }
  // 搭在扶手上的小毯子
  vox.boxC(0.42, 0.98, -0.1, 0.26, 0.08, 0.62, 'clothC');
  vox.popTransform();
}

/** 厨房台（贴墙：台面+水槽+双灶眼+墙上吊柜） */
export function kitchenCounter(x, z, { rot = 0, len = 3.2 } = {}) {
  vox.pushTransform(x, 0, z, rot);
  vox.boxC(-len / 2, 0, -0.42, len, 1.0, 0.84, 'wallSlate');    // 柜身
  vox.boxC(-len / 2 - 0.06, 1.0, -0.48, len + 0.12, 0.14, 0.96, 'awningCream'); // 台面
  // 水槽（左）+ 龙头
  vox.boxC(-len / 2 + 0.3, 1.0, -0.4, 0.9, 0.2, 0.6, 'metal');
  vox.boxC(-len / 2 + 0.35, 1.2, -0.68, 0.1, 0.34, 0.1, 'metal');
  vox.boxC(-len / 2 + 0.35, 1.5, -0.56, 0.1, 0.08, 0.34, 'metal');
  // 双灶眼（右，微暖光）
  for (const ox of [0.45, 1.15]) {
    vox.boxC(-len / 2 + len - ox - 0.6, 1.06, -0.36, 0.62, 0.08, 0.62, 'roofDark');
    vox.windowBox(-len / 2 + len - ox - 0.6, 1.12, -0.36, 0.44, 0.05, 0.44, 'winWarm');
  }
  // 墙上吊柜 + 搁板
  vox.boxC(-len / 2 + 0.2, 2.1, -0.66, len - 1.4, 0.9, 0.4, 'woodMid');
  vox.boxC(-len / 2 + 0.3, 2.25, -0.44, len - 1.6, 0.6, 0.1, 'roofDark'); // 柜门缝
  // 灶上小锅
  vox.boxC(-len / 2 + len - 1.05, 1.16, -0.36, 0.42, 0.22, 0.42, 'metal');
  vox.popTransform();
}

/** 碗柜（双层玻璃门 + 摆着的碗碟） */
export function cupboard(x, z, { rot = 0 } = {}) {
  vox.pushTransform(x, 0, z, rot);
  vox.boxC(-0.7, 0, -0.35, 1.4, 0.8, 0.7, 'woodMid');           // 下柜
  vox.boxC(-0.6, 0.12, 0.01, 1.2, 0.56, 0.06, 'woodDark');      // 门缝
  vox.boxC(-0.75, 0.8, -0.38, 1.5, 0.14, 0.76, 'woodDark');     // 腰线
  vox.boxC(-0.7, 0.94, -0.35, 1.4, 1.15, 0.7, 'woodMid');       // 上柜
  // 玻璃门里露出的碗碟
  vox.boxC(-0.55, 1.08, 0.01, 0.5, 0.8, 0.08, 'star');
  vox.boxC(0.05, 1.08, 0.01, 0.5, 0.8, 0.08, 'star');
  for (let i = 0; i < 3; i++) {
    vox.boxC(-0.5 + i * 0.42, 1.2 + (i % 2) * 0.06, -0.12, 0.3, 0.16, 0.3, 'awningCream');
    vox.boxC(-0.5 + i * 0.42, 1.42 + (i % 2) * 0.06, -0.12, 0.24, 0.12, 0.24, 'clothC');
  }
  vox.boxC(-0.78, 2.09, -0.38, 1.56, 0.12, 0.76, 'woodDark');   // 顶檐
  vox.popTransform();
}

/** 书桌（摊开的书 + 烛台 + 墨水瓶） */
export function desk(x, z, { rot = 0 } = {}) {
  vox.pushTransform(x, 0, z, rot);
  vox.boxC(-0.9, 0.86, -0.45, 1.8, 0.14, 0.9, 'woodMid');
  vox.boxC(-0.78, 0, -0.4, 0.16, 0.86, 0.16, 'woodDark');
  vox.boxC(0.62, 0, -0.4, 0.16, 0.86, 0.16, 'woodDark');
  vox.boxC(-0.78, 0, 0.28, 0.16, 0.86, 0.16, 'woodDark');
  vox.boxC(0.62, 0, 0.28, 0.16, 0.86, 0.16, 'woodDark');
  // 抽屉柜（右侧两抽）
  vox.boxC(0.32, 0, -0.42, 0.56, 0.86, 0.84, 'woodMid');
  vox.boxC(0.38, 0.18, 0.01, 0.44, 0.26, 0.06, 'woodDark');
  vox.boxC(0.38, 0.52, 0.01, 0.44, 0.26, 0.06, 'woodDark');
  // 摊开的书（两页）+ 压书镇
  vox.boxC(-0.42, 1.0, -0.1, 0.44, 0.06, 0.6, 'awningCream');
  vox.boxC(-0.5, 1.0, -0.1, 0.12, 0.08, 0.6, 'flowerRed');
  vox.boxC(0.02, 1.0, -0.1, 0.12, 0.08, 0.6, 'flowerRed');
  vox.boxC(0.3, 1.03, 0.1, 0.14, 0.1, 0.14, 'clothB');
  // 烛台（发光）
  vox.boxC(-0.7, 1.0, 0.12, 0.16, 0.3, 0.16, 'metal');
  vox.windowBox(-0.7, 1.32, 0.12, 0.13, 0.26, 0.13, 'winWarm');
  // 墨水 + 笔
  vox.boxC(-0.62, 1.0, -0.2, 0.12, 0.14, 0.12, 'roofDark');
  vox.boxC(-0.55, 1.14, -0.22, 0.05, 0.24, 0.05, 'woodDark');
  vox.popTransform();
}

/** 落地灯（弧杆 + 灯罩 + 暖光） */
export function floorLamp(x, z, { rot = 0 } = {}) {
  vox.pushTransform(x, 0, z, rot);
  vox.boxC(-0.4, 0, -0.4, 0.8, 0.14, 0.8, 'metal');   // 底盘
  vox.boxC(-0.07, 0.14, -0.07, 0.14, 2.1, 0.14, 'metal'); // 杆
  vox.boxC(-0.32, 2.24, -0.32, 0.64, 0.5, 0.64, 'awningRed'); // 灯罩
  vox.windowBox(0, 2.3, 0, 0.4, 0.28, 0.4, 'winWarm');
  vox.popTransform();
}

/** 床头柜（蜡烛 + 小书 + 抽屉） */
export function bedsideTable(x, z, { rot = 0 } = {}) {
  vox.pushTransform(x, 0, z, rot);
  vox.boxC(-0.4, 0, -0.4, 0.8, 0.66, 0.8, 'woodMid');
  vox.boxC(-0.34, 0.3, 0.01, 0.68, 0.24, 0.06, 'woodDark');
  vox.boxC(-0.06, 0.44, 0.01, 0.12, 0.05, 0.04, 'metal');
  vox.boxC(-0.4, 0.66, -0.4, 0.8, 0.1, 0.8, 'woodDark');
  // 蜡烛 + 烛碟
  vox.boxC(-0.16, 0.76, -0.14, 0.24, 0.04, 0.24, 'metal');
  vox.boxC(-0.16, 0.8, -0.14, 0.12, 0.34, 0.12, 'awningCream');
  vox.windowBox(-0.16, 1.16, -0.14, 0.09, 0.18, 0.09, 'winWarm');
  // 摞起的小书×2
  vox.boxC(0.16, 0.76, -0.1, 0.3, 0.08, 0.4, 'clothB');
  vox.boxC(0.13, 0.84, -0.12, 0.26, 0.07, 0.34, 'clothC');
  vox.popTransform();
}

/** 工作台（木匠屋：台面工具 + 木料 + 砂纸堆） */
export function workbench(x, z, { rot = 0 } = {}) {
  vox.pushTransform(x, 0, z, rot);
  vox.boxC(-1.2, 0.9, -0.5, 2.4, 0.18, 1.0, 'woodLight');
  vox.boxC(-1.05, 0, -0.44, 0.2, 0.9, 0.2, 'woodDark');
  vox.boxC(0.85, 0, -0.44, 0.2, 0.9, 0.2, 'woodDark');
  vox.boxC(-1.05, 0, 0.24, 0.2, 0.9, 0.2, 'woodDark');
  vox.boxC(0.85, 0, 0.24, 0.2, 0.9, 0.2, 'woodDark');
  // 下层搁板 + 木料
  vox.boxC(-1.05, 0.3, -0.3, 2.1, 0.1, 0.6, 'woodMid');
  vox.boxC(-0.7, 0.4, -0.15, 1.1, 0.18, 0.18, 'woodLight');
  vox.boxC(-0.5, 0.58, -0.15, 0.8, 0.18, 0.18, 'woodMid');
  // 台面：台钳 + 半成品 + 锤子
  vox.boxC(-0.85, 1.08, -0.15, 0.3, 0.36, 0.3, 'metal');        // 台钳
  vox.boxC(-0.85, 1.2, -0.32, 0.34, 0.14, 0.08, 'metal');
  vox.boxC(0.1, 1.08, 0.05, 0.7, 0.16, 0.3, 'woodLight');       // 半成品木件
  vox.boxC(0.75, 1.08, -0.2, 0.24, 0.14, 0.5, 'woodDark');      // 锤头
  vox.boxC(0.75, 1.22, -0.2, 0.1, 0.3, 0.1, 'woodLight');       // 锤柄
  vox.popTransform();
}

/** 墙上工具架（挂锯 + 锤 + 一排木钻） */
export function toolRack(x, y, z) {
  vox.boxC(x - 0.9, y, z, 1.8, 0.16, 0.3, 'woodMid');
  // 手锯（斜挂）
  vox.boxC(x - 0.55, y - 0.5, z + 0.05, 0.14, 0.7, 0.08, 'metal');
  vox.boxC(x - 0.62, y - 0.9, z + 0.05, 0.28, 0.16, 0.1, 'woodDark');
  // 锤子
  vox.boxC(x - 0.1, y - 0.42, z + 0.05, 0.1, 0.6, 0.1, 'woodLight');
  vox.boxC(x - 0.1, y - 0.78, z + 0.05, 0.26, 0.16, 0.16, 'metal');
  // 三只木钻
  for (let i = 0; i < 3; i++) {
    vox.boxC(x + 0.3 + i * 0.22, y - 0.4, z + 0.05, 0.08, 0.56, 0.08, 'metal');
  }
}

/** 婴儿床（围栏柱 + 小被子 + 悬顶小星星挂饰） */
export function babyCrib(x, z, { rot = 0 } = {}) {
  vox.pushTransform(x, 0, z, rot);
  vox.boxC(-0.6, 0, -0.85, 1.2, 0.3, 1.7, 'woodMid');           // 底箱
  // 四角立柱 + 顶部横杆
  for (const [px, pz] of [[-0.55, -0.8], [0.45, -0.8], [-0.55, 0.7], [0.45, 0.7]]) {
    vox.boxC(px, 0.3, pz, 0.14, 1.5, 0.14, 'woodMid');
  }
  vox.boxC(-0.6, 1.8, -0.85, 1.2, 0.1, 0.14, 'woodDark');
  vox.boxC(-0.6, 1.8, 0.66, 1.2, 0.1, 0.14, 'woodDark');
  // 围栏条
  for (let i = 0; i < 4; i++) {
    vox.boxC(-0.45 + i * 0.3, 0.3, -0.83, 0.08, 1.4, 0.08, 'woodLight');
    vox.boxC(-0.45 + i * 0.3, 0.3, 0.68, 0.08, 1.4, 0.08, 'woodLight');
  }
  // 小被子 + 小枕头
  vox.boxC(-0.5, 0.3, -0.2, 1.0, 0.16, 1.1, 'clothC');
  vox.boxC(-0.45, 0.46, -0.72, 0.9, 0.12, 0.36, 'awningCream');
  // 悬顶挂饰（三颗小星星，最低的一颗发光）
  vox.boxC(-0.3, 2.0, -0.3, 0.04, 0.24, 0.04, 'metal');
  vox.boxC(0.05, 2.0, -0.15, 0.04, 0.32, 0.04, 'metal');
  vox.boxC(0.38, 2.0, -0.35, 0.04, 0.2, 0.04, 'metal');
  vox.boxC(-0.36, 1.9, -0.36, 0.16, 0.16, 0.05, 'flowerYel');
  vox.windowBox(-0.01, 1.8, -0.21, 0.16, 0.16, 0.05, 'starWarm');
  vox.boxC(0.32, 1.92, -0.41, 0.16, 0.16, 0.05, 'flowerRed');
  vox.popTransform();
}

/** 壁挂钟（小圆钟面 + 摆锤窗） */
export function wallClock(x, y, z) {
  vox.boxC(x - 0.4, y, z, 0.8, 0.8, 0.14, 'woodDark');
  vox.boxC(x - 0.3, y + 0.1, z + 0.05, 0.6, 0.6, 0.06, 'awningCream');
  vox.boxC(x - 0.06, y + 0.28, z + 0.09, 0.1, 0.18, 0.04, 'catBlack'); // 时针
  vox.boxC(x - 0.04, y + 0.18, z + 0.09, 0.06, 0.3, 0.04, 'catBlack'); // 分针
}

/** 阶梯花架（三层盆栽，garden 风格民居用） */
export function flowerStand(x, z, { rot = 0 } = {}) {
  vox.pushTransform(x, 0, z, rot);
  const cols = ['flowerRed', 'flowerYel', 'flowerBlu', 'flowerRed'];
  for (let s = 0; s < 3; s++) {
    const w = 1.6 - s * 0.4;
    vox.boxC(-w / 2, s * 0.6, -0.3 + s * 0.28, w, 0.12, 0.5, 'woodMid');
    const pot = 0.44 - s * 0.05;
    vox.boxC(-w / 2 + pot / 2 + 0.06, s * 0.6 + 0.12, -0.06 + s * 0.28, pot, 0.3, pot, 'roofRed');
    vox.boxC(-w / 2 + pot / 2 + 0.06, s * 0.6 + 0.42, -0.06 + s * 0.28, pot * 0.8, 0.26, pot * 0.8, cols[s]);
  }
  vox.popTransform();
}
