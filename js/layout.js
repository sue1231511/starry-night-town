// ============================================================
// layout.js — 小镇布局数据中枢
// ------------------------------------------------------------
// 想挪建筑 / 改路网 / 加地块，改这个文件就够了。
// 坐标系：x 东→西（+东），z 南→北（+南），y 上。世界 96×96，x,z ∈ [-48,48]。
// 所有"随机"布置用固定种子的伪随机（mulberry32），保证每次打开小镇同一副面孔。
// ============================================================

export const WORLD = {
  SIZE: 96,
  HALF: 48,
};

// 固定种子伪随机：布局可复现
export function makeRng(seed = 20261005) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------
// 河流：东西向蜿蜒，z = riverZ(x)
// ------------------------------------------------------------
export const RIVER_HALF_W = 3.5;

export function riverZ(x) {
  return 14 + 2 * Math.sin(x * Math.PI / 40);
}

export function riverDist(x, z) {
  return Math.abs(z - riverZ(x));
}

/** 河面上的水面高度（world 铺水用统一高度） */
export const WATER_Y = 0.35;

// ------------------------------------------------------------
// 地形高度场（连续函数，world.js 按格采样铺草）
// 北坡从 z=-24 开始抬升；河床沿河下切。
// ------------------------------------------------------------
export const HILL_START = -24;
export const HILL_MAX = 6;

export function terrainHeight(x, z) {
  let h = 0;
  // 北坡：两级阶梯感用平滑函数近似
  if (z < HILL_START) {
    const t = Math.min(1, (HILL_START - z) / 26);
    h += HILL_MAX * (t * t * (3 - 2 * t)); // smoothstep 到最高 6
    // 坡上加一点起伏（种子波形，避免大平板）
    h += 0.8 * Math.sin(x * 0.23 + 1.7) * t + 0.6 * Math.cos(z * 0.31) * t;
  }
  // 河床下切
  const rd = riverDist(x, z);
  const cut = 2.6;
  if (rd < RIVER_HALF_W + 2.2) {
    const t = Math.max(0, 1 - rd / (RIVER_HALF_W + 2.2));
    h -= cut * (t * t * (3 - 2 * t));
  }
  return h;
}

// ------------------------------------------------------------
// 路网（汽车环路为圆角矩形；主街/横街为直线段）
// world.js 依据这些数据铺石板；traffic.js 依据它们开车/行人。
// ------------------------------------------------------------
export const ROADS = {
  // 汽车环路：圆角矩形中心线
  loop: { xMin: -26, xMax: 26, zMin: -22, zMax: 26, radius: 7 },
  // 主街（南北，过拱桥）
  mainStreet: { x: 0, zFrom: -22, zTo: 34, width: 4 },
  // 横街（东西，河北岸沿）
  crossStreet: { z: 6, xFrom: -26, xTo: 26, width: 3.5 },
  // 通往北坡风车区的土路
  millPath: { x: -12, zFrom: -22, zTo: -34 },
  // 火车站引道
  stationPath: { x: -10, zFrom: 26, zTo: 36 },
};

/** 路网取样：该点是否为路面（供 world 铺石板、避免草地入侵） */
export function onRoad(x, z) {
  const L = ROADS.loop;
  const inRect = x >= L.xMin - 2.5 && x <= L.xMax + 2.5 && z >= L.zMin - 2.5 && z <= L.zMax + 2.5;
  const onLoop =
    inRect &&
    (Math.abs(x - L.xMin) <= 2.5 || Math.abs(x - L.xMax) <= 2.5 ||
      Math.abs(z - L.zMin) <= 2.5 || Math.abs(z - L.zMax) <= 2.5);
  const onMain = Math.abs(x - ROADS.mainStreet.x) <= ROADS.mainStreet.width / 2 + 0.5 &&
    z >= ROADS.mainStreet.zFrom - 1 && z <= ROADS.mainStreet.zTo + 1;
  const onCross = Math.abs(z - ROADS.crossStreet.z) <= ROADS.crossStreet.width / 2 + 0.5 &&
    x >= ROADS.crossStreet.xFrom - 1 && x <= ROADS.crossStreet.xTo + 1;
  return onLoop || onMain || onCross;
}

// ------------------------------------------------------------
// 桥 / 码头 / 踏石
// ------------------------------------------------------------
export const BRIDGES = [
  { kind: 'arch', x: 0, width: 6 },        // 主街拱桥
  { kind: 'wood', x: -26, width: 4 },       // 环路西木桥
  { kind: 'wood', x: 26, width: 4 },        // 环路东木桥
  { kind: 'stones', x: -14, width: 2 },     // 行人踏石（装饰）
];

export const DOCK = { x: 30, z: 11 };       // 南岸码头
export const BOAT = { x: 34, z: 16 };       // 系泊小船

// ------------------------------------------------------------
// 广场与商铺环（广场中心 (0,-4)，16×16 石板）
// 北排 4 家朝南，东西各 2 家朝主街/广场
// rot: 建筑朝向（度，0=门朝 +z 南）
// ------------------------------------------------------------
export const PLAZA = { cx: 0, cz: -4, half: 8 };

export const SHOPS = [
  { id: 'bakery',  name: '麦香房',   blurb: '明早六点开炉，风都可以闻到。', x: -15, z: -16, rot: 0 },
  { id: 'coffee',  name: '夜航咖啡', blurb: '招牌是热可可加棉花云，猫免单。', x: -5,  z: -16, rot: 0 },
  { id: 'book',    name: '灯塔书店', blurb: '打烊时间：看完这一章。', x: 5,   z: -16, rot: 0 },
  { id: 'flower',  name: '晚香花房', blurb: '夜来香只在夜里香，白天别来。', x: 15,  z: -16, rot: 0 },
  { id: 'post',    name: '晚风邮局', blurb: '慢信也一定会到，急件请喊一声。', x: -21, z: -6, rot: 90 },
  { id: 'barber',  name: '剪刀手安', blurb: '转彩柱已经旋转 4382 天。', x: 21,  z: -6, rot: -90 },
  { id: 'general', name: '百宝杂货', blurb: '没有的东西，明天进货。', x: 12,  z: 0,  rot: -90 },
  { id: 'inn',     name: '星子旅馆', blurb: '窗对着钟楼，醒来刚好七点。', x: -12, z: 0,  rot: 90 },
];

// ------------------------------------------------------------
// 住宅：西片 & 东片（参数化：层数/屋顶/墙色/朝向/烟囱/花箱）
// ------------------------------------------------------------
export const HOUSES = [
  // 西片（x ∈ [-44,-28]，z ∈ [-16,4]）
  { x: -38, z: -14, rot: 90,  floors: 1, roof: 'gable',  wall: 'wallCream', roofC: 'roofRed',   chimney: true,  flower: true },
  { x: -32, z: -8,  rot: 90,  floors: 2, roof: 'gable',  wall: 'wallBrick', roofC: 'roofBlue',  chimney: true,  flower: false },
  { x: -40, z: -2,  rot: 0,   floors: 1, roof: 'hip',    wall: 'wallWood',  roofC: 'roofGreen', chimney: true,  flower: true },
  { x: -33, z: 3,   rot: 180, floors: 2, roof: 'flat',   wall: 'wallPlum',  roofC: 'roofDark',  chimney: false, flower: true, terrace: true },
  { x: -44, z: -20, rot: 45,  floors: 1, roof: 'gable',  wall: 'wallCream', roofC: 'roofGreen', chimney: true,  flower: false },
  { x: -29, z: -18, rot: 135, floors: 2, roof: 'gable',  wall: 'wallSlate', roofC: 'roofRed',   chimney: true,  flower: true },
  // 东片（x ∈ [28,44]，z ∈ [-16,4]）
  { x: 38, z: -14, rot: -90, floors: 2, roof: 'gable',  wall: 'wallBrick', roofC: 'roofGreen', chimney: true,  flower: true },
  { x: 32, z: -8,  rot: -90, floors: 1, roof: 'hip',    wall: 'wallCream', roofC: 'roofBlue',  chimney: true,  flower: false },
  { x: 41, z: -1,  rot: 180, floors: 1, roof: 'gable',  wall: 'wallPlum',  roofC: 'roofRed',   chimney: true,  flower: true },
  { x: 30, z: 2,   rot: 0,   floors: 2, roof: 'flat',   wall: 'wallSlate', roofC: 'roofDark',  chimney: false, flower: true, terrace: true },
  { x: 44, z: -20, rot: -45, floors: 1, roof: 'gable',  wall: 'wallWood',  roofC: 'roofBlue',  chimney: true,  flower: false },
  { x: 28, z: 20,  rot: -90, floors: 1, roof: 'hip',    wall: 'wallCream', roofC: 'roofRed',   chimney: true,  flower: true }, // 河南岸小屋
  { x: -28, z: 20, rot: 90,  floors: 1, roof: 'gable',  wall: 'wallBrick', roofC: 'roofGreen', chimney: true,  flower: true }, // 河南岸小屋
  // 南公园边（夜里听火车的那种房子）
  { x: -44, z: 22, rot: 0,   floors: 1, roof: 'gable',  wall: 'wallCream', roofC: 'roofBlue',  chimney: true,  flower: true },
  { x: 40,  z: 30, rot: 180, floors: 2, roof: 'hip',    wall: 'wallPlum',  roofC: 'roofRed',   chimney: true,  flower: false },
  { x: 34,  z: 6,  rot: -90, floors: 1, roof: 'gable',  wall: 'wallSlate', roofC: 'roofGreen', chimney: false, flower: true }, // 河北岸木匠屋
];

// ------------------------------------------------------------
// 北坡设施
// ------------------------------------------------------------
export const MILL = { x: -26, z: -38, groundY: 5.2 };
export const BARN = { x: -13, z: -36, groundY: 4.2 };
export const WATERTOWER = { x: 30, z: -40, groundY: 5.6 };
export const WHEAT_FIELD = { x0: -42, z0: -46, x1: -6, z1: -30 };  // 麦田矩形（坡上）
export const PAVILION = { x: -22, z: 28 };   // 南公园观星亭
export const SWING = { x: -16, z: 30 };      // 秋千架
export const ORCHARD = { x0: 10, z0: 24, x1: 32, z1: 36, rows: 3, cols: 5 }; // 果树阵列

// 南公园深化（park.js 消费）
export const PARK = {
  vegetable: { x0: -40, z0: 22, x1: -30, z1: 32, rows: 4 }, // 菜畦（稻草人守着）
  scarecrow: { x: -35, z: 26 },
  kite: { anchorX: -6, anchorZ: 30 },       // 风筝（线从这里放飞）
  picnic: [{ x: -12, z: 24 }, { x: 8, z: 28 }], // 野餐垫
  slide: { x: 2, z: 30 },                   // 滑梯
  seesaw: { x: 6, z: 24 },                  // 跷跷板（微摆）
  lamps: [{ x: -25, z: 24 }, { x: -5, z: 32 }, { x: 14, z: 22 }], // 公园路灯
};

// 北坡露营地（campsite.js 消费）：帐篷 ×2 + 篝火 + 柴堆 + 观星垫
export const CAMP = {
  tents: [{ x: 8, z: -34, rot: -18 }, { x: 16.5, z: -36, rot: 30 }],
  fire: { x: 13.5, z: -28.5 },
  logSeat: [{ x: 11, z: -27, rot: 15 }, { x: 15.6, z: -27.4, rot: -20 }],
  woodpile: { x: 18.5, z: -31, rot: 40 },
  stargaze: { x: 7.5, z: -37.5 },             // 观星垫（看流星的野餐布）
  groundY: 3.1,                              // 该区域地形近似高度
};

// ------------------------------------------------------------
// 铁道（南缘 z=40）与道口
// ------------------------------------------------------------
export const RAIL = { z: 40, xFrom: -64, xTo: 64 };
export const CROSSING = { x: 0, z: 36 };    // 主街与铁道交会的道口
export const STATION = { x: -10, z: 36 };   // 小站台

// ------------------------------------------------------------
// 交通路径
// ------------------------------------------------------------
/** 汽车环路折线（圆角矩形近似取样，顺时针） */
export function carLoopPoints() {
  const L = ROADS.loop;
  const r = L.radius;
  const pts = [];
  const push = (x, z) => pts.push(new Object({ x, z }));
  // 直段 + 四角（每角 3 个取样点近似圆弧）
  push(L.xMax, L.zMin + r); push(L.xMax, 0); push(L.xMax, L.zMax - r);
  // 东南角
  push(L.xMax - r * 0.3, L.zMax + r * 0.75); push(L.xMax - r * 0.75, L.zMax + r * 0.3);
  push(L.xMax - r, L.zMax);
  push(r, L.zMax); push(0, L.zMax); push(-r, L.zMax);
  // 西南角
  push(L.xMin + r * 0.3, L.zMax + r * 0.75); push(L.xMin + r * 0.75, L.zMax + r * 0.3);
  push(L.xMin + r, L.zMax);
  push(L.xMin, 0); push(L.xMin, L.zMin + r);
  // 西北角
  push(L.xMin + r * 0.3, L.zMin - r * 0.75); push(L.xMin + r * 0.75, L.zMin - r * 0.3);
  push(L.xMin + r, L.zMin);
  push(-r, L.zMin); push(0, L.zMin); push(r, L.zMin);
  // 东北角
  push(L.xMax - r * 0.3, L.zMin - r * 0.75); push(L.xMax - r * 0.75, L.zMin - r * 0.3);
  push(L.xMax - r, L.zMin);
  return pts;
}

/** 行人巡逻环（广场外圈人行道） */
export const PEDESTRIAN_LOOPS = [
  // 广场环
  [
    { x: -11, z: -13 }, { x: 0, z: -13.5 }, { x: 11, z: -13 },
    { x: 11.5, z: -4 }, { x: 11, z: 5 }, { x: 0, z: 5.5 }, { x: -11, z: 5 }, { x: -11.5, z: -4 },
  ],
  // 主街南段过桥到火车站再回来
  [
    { x: -2, z: -16 }, { x: -2, z: 4 }, { x: -2, z: 18 }, { x: -2, z: 30 },
    { x: 2, z: 30 }, { x: 2, z: 18 }, { x: 2, z: 4 }, { x: 2, z: -16 },
  ],
  // 河岸漫步（北岸）
  [
    { x: -22, z: 8 }, { x: -10, z: 8.2 }, { x: 4, z: 8 }, { x: 16, z: 8.4 },
    { x: 16, z: 9.6 }, { x: 4, z: 9.8 }, { x: -10, z: 9.6 }, { x: -22, z: 9.4 },
  ],
  // 南公园果园
  [
    { x: 12, z: 26 }, { x: 20, z: 26 }, { x: 28, z: 26 }, { x: 28, z: 34 },
    { x: 20, z: 34 }, { x: 12, z: 34 },
  ],
];

// ------------------------------------------------------------
// 建筑名牌注册表（builders 建好后写入；interaction 双击射线拾取用）
// ------------------------------------------------------------
const buildings = [];

export function registerBuilding(b) {
  // b: { name, blurb, cx, cz, y0, y1, halfW, halfD }
  buildings.push(b);
  return b;
}

export function getBuildings() {
  return buildings;
}

/** 按 id 找（少数系统要用，比如钟楼指针） */
export function findBuilding(name) {
  return buildings.find(b => b.name === name);
}
