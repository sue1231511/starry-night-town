// ============================================================
// builders/vehicles.js — 铁道 / 火车 / 车站 / 道口 / 汽车
// ------------------------------------------------------------
// 静态轨道设施走体素桶；火车/汽车是动态 Group，
// 运动逻辑在本文件 updater 里（traffic.js 只管行人和调度联动）。
// ============================================================
import * as THREE from 'three';
import { vox, dynBoxTo } from '../voxel.js';
import { RAIL, CROSSING, STATION, terrainHeight, carLoopPoints, registerBuilding } from '../layout.js';
import { registerCrossing, notifyTrainNear } from '../systems/schedule.js';

// ------------------------------------------------------------
// 轨道（枕木 + 双轨）
// ------------------------------------------------------------
function layTrack() {
  const z = RAIL.z;
  for (let x = RAIL.xFrom; x < RAIL.xTo; x += 2.4) {
    vox.boxC(x, 0.02, z - 1.7, 1.4, 0.5, 3.6, 'woodMid');    // 枕木（亮木色，夜里认得出）
  }
  // 铁轨（两根长条金属）
  vox.boxC(RAIL.xFrom, 0.52, z - 1.05, RAIL.xTo - RAIL.xFrom, 0.22, 0.22, 'metal');
  vox.boxC(RAIL.xFrom, 0.52, z + 0.83, RAIL.xTo - RAIL.xFrom, 0.22, 0.22, 'metal');
  // 道砟带
  vox.boxC(RAIL.xFrom, -0.15, z - 2.2, RAIL.xTo - RAIL.xFrom, 0.3, 4.4, 'rockDark');
}

// ------------------------------------------------------------
// 车站（小站台 + 雨棚 + 长凳 + 时刻牌）
// ------------------------------------------------------------
function buildStation() {
  const { x, z } = STATION;
  const gy = terrainHeight(x, z);
  vox.pushTransform(x, gy, z, 0);
  // 站台（底部埋进地面，绝不悬空）
  vox.boxC(-6.0, -0.35, -1.6, 12.0, 1.05, 3.6, 'roadLit');
  vox.boxC(-6.0, -0.35, 2.2, 12.0, 1.05, 1.6, 'roadDark'); // 站台边警示带
  // 站台支墩（密一排，侧面看有着落）
  for (const px of [-5.4, -2.7, 0, 2.7, 5.4]) {
    vox.boxC(px - 0.3, -0.35, 1.4, 0.6, 1.05, 0.6, 'rockDark');
  }
  // 雨棚柱 + 棚
  for (const px of [-5.2, 0, 5.2]) {
    vox.boxC(px - 0.2, 0.7, -1.4, 0.4, 3.6, 0.4, 'metal');
  }
  vox.boxC(-6.2, 4.3, -2.2, 12.4, 0.4, 4.4, 'roofBlue');
  vox.boxC(-6.0, 4.7, -2.0, 12.0, 0.25, 4.0, 'roofDark');
  // 棚下吊灯 ×3
  for (const px of [-4.0, 0, 4.0]) {
    vox.windowBox(px, 3.6, -0.6, 0.55, 0.55, 0.55, 'lampGlow');
  }
  // 长凳
  vox.boxC(-2.5, 0.7, -0.9, 2.6, 0.2, 0.9, 'woodMid');
  vox.boxC(-2.5, 0.7, -1.3, 2.6, 0.8, 0.16, 'woodMid');
  vox.boxC(-3.5, 0.7, -0.9, 0.2, 0.7, 0.9, 'metal');
  vox.boxC(-1.5, 0.7, -0.9, 0.2, 0.7, 0.9, 'metal');
  // 站牌（时刻牌）
  vox.boxC(2.5, 0.7, -1.2, 0.2, 2.8, 0.2, 'metal');
  vox.boxC(1.7, 2.2, -1.28, 1.8, 1.2, 0.12, 'awningCream');
  vox.boxC(1.9, 2.85, -1.32, 1.3, 0.18, 0.06, 'roofDark');
  vox.boxC(1.9, 2.45, -1.32, 1.4, 0.14, 0.06, 'roofDark');
  vox.popTransform();

  registerBuilding({
    name: '老站台', blurb: '末班车零点半进站，风里有铁的味道。',
    cx: x, cz: z - 1, y0: gy - 1, y1: gy + 5.4, halfW: 6.4, halfD: 2.4,
  });
}

// ------------------------------------------------------------
// 道口（两侧红绿灯 + 可起落栏杆）
// ------------------------------------------------------------
function buildCrossing(scene, updaters) {
  const { x, z } = CROSSING;
  const gy = terrainHeight(x, z);

  // 路面警示块
  vox.boxC(x - 2.2, 0.05, z - 1.2, 4.4, 0.15, 5.0, 'roadDark');

  // 信号灯柱（两侧一对，落地）
  for (const dx of [-3.2, 3.2]) {
    vox.pushTransform(x + dx, gy, z - 1.8, 0);
    vox.boxC(-0.5, 0, -0.5, 1.0, 0.35, 1.0, 'rockDark');
    vox.boxC(-0.15, 0, -0.15, 0.3, 3.75, 0.3, 'metal');
    vox.boxC(-0.45, 3.75, -0.45, 0.9, 1.3, 0.9, 'metal');
    vox.popTransform();
  }
  // 双色灯（红/绿 各一对，交替闪——entry 注册给 schedule）
  const redA = vox.windowBox(x - 3.2, gy + 4.15, z - 1.35, 0.5, 0.5, 0.25, 'bulbRed');
  const grnA = vox.windowBox(x + 3.2, gy + 3.75, z - 1.35, 0.5, 0.5, 0.25, 'bulbGreen');

  // 栏杆（动态：火车来前放下）
  const barrierPivot = new THREE.Group();
  barrierPivot.position.set(x - 3.6, gy + 1.5, z - 0.6);
  scene.add(barrierPivot);
  dynBoxTo(barrierPivot, 2.1, 0, 0, 4.2, 0.22, 0.22, 'metal');
  dynBoxTo(barrierPivot, 1.2, 0.24, 0, 0.8, 0.5, 0.5, 'carRed');   // 栏杆上的红白标记
  dynBoxTo(barrierPivot, 2.8, 0.24, 0, 0.8, 0.5, 0.5, 'awningCream');
  // 支柱
  vox.boxC(x - 3.85, gy, z - 0.85, 0.5, 1.5, 0.5, 'metal');

  registerCrossing({ redA, grnA, barrierPivot });
}

// ------------------------------------------------------------
// 火车（车头 + 4 节车厢）
// ------------------------------------------------------------
function buildTrain(scene) {
  const train = new THREE.Group();
  scene.add(train);

  // —— 车头（蒸汽小火车头：锅炉 + 驾驶室 + 烟囱 + 排障器）——
  const loco = new THREE.Group();
  train.add(loco);
  dynBoxTo(loco, 0, 1.5, 0, 3.2, 2.0, 2.4, 'trainBody');          // 锅炉
  dynBoxTo(loco, 0, 1.1, 0, 3.4, 0.5, 2.6, 'roofDark');           // 底盘
  dynBoxTo(loco, -2.4, 2.2, 0, 1.8, 2.6, 2.6, 'trainWagon');      // 驾驶室
  dynBoxTo(loco, -2.4, 3.6, 0, 2.1, 0.35, 2.9, 'roofRed');        // 室顶
  dynBoxTo(loco, 0.6, 2.75, 0, 0.7, 0.9, 0.7, 'metal');           // 烟囱
  dynBoxTo(loco, 0.6, 3.35, 0, 0.95, 0.35, 0.95, 'roofDark');     // 烟囱口
  dynBoxTo(loco, 1.75, 0.95, 0, 0.6, 0.7, 2.8, 'metal');          // 排障器
  dynBoxTo(loco, -1.05, 2.1, 1.32, 1.0, 1.0, 0.1, 'winGlow', { glow: true }); // 驾驶室窗
  dynBoxTo(loco, -1.05, 2.1, -1.32, 1.0, 1.0, 0.1, 'winGlow', { glow: true });
  dynBoxTo(loco, 1.7, 0.4, 0, 2.2, 1.0, 1.4, 'metal');            // 轮组挡
  // 车头前灯
  dynBoxTo(loco, 1.65, 1.9, 0, 0.25, 0.6, 0.6, 'lampGlow', { glow: true });

  // —— 车厢 ×4（每节：车厢体 + 亮窗 + 轮挡）——
  const wagons = [];
  for (let i = 0; i < 4; i++) {
    const wg = new THREE.Group();
    wg.position.x = -(4.6 + i * 4.4);
    train.add(wg);
    dynBoxTo(wg, 0, 1.6, 0, 3.6, 2.2, 2.3, i % 2 ? 'trainWagon' : 'trainBody');
    dynBoxTo(wg, 0, 1.1, 0, 3.8, 0.5, 2.5, 'roofDark');
    dynBoxTo(wg, 0, 2.85, 0, 3.4, 0.3, 2.1, 'roofRed');
    dynBoxTo(wg, 0, 0.4, 0, 3.0, 0.9, 1.3, 'metal');
    // 两侧亮窗 ×3
    for (const side of [1, -1]) {
      for (let w = 0; w < 3; w++) {
        dynBoxTo(wg, -1.1 + w * 1.1, 1.9, side * 1.18, 0.7, 0.8, 0.08,
          w === 1 ? 'winWarm' : 'winGlow', { glow: true });
      }
    }
    wagons.push(wg);
  }

  // 火车运动状态（traffic/schedule 联动道口）
  const state = {
    x: RAIL.xTo + 20,        // 从画面外东侧进站
    dir: -1,                  // 向西
    speed: 0,
    parked: true,
    waitTimer: 8,             // 8 秒后首发
  };
  return { train, state, loco, wagons };
}

// ------------------------------------------------------------
// 汽车 ×3（环路行驶）
// ------------------------------------------------------------
function buildCars(scene) {
  const cars = [];
  const specs = [
    { color: 'carRed',    offset: 0 },
    { color: 'carBlue',   offset: 0.42 },
    { color: 'carYellow', offset: 0.78 },
  ];
  for (const sp of specs) {
    const car = new THREE.Group();
    scene.add(car);
    dynBoxTo(car, 0, 0.75, 0, 3.4, 0.8, 1.9, sp.color);       // 车身
    dynBoxTo(car, -0.25, 1.45, 0, 1.9, 0.75, 1.7, sp.color);  // 车顶
    dynBoxTo(car, 0.35, 0.7, 0, 3.3, 0.35, 1.75, 'roofDark'); // 底盘条
    dynBoxTo(car, 0.7, 1.05, 0, 0.35, 0.45, 1.5, 'winGlow', { glow: true });  // 前格栅
    dynBoxTo(car, -1.25, 1.5, 0, 0.15, 0.5, 1.5, 'winGlow', { glow: true });  // 尾灯
    dynBoxTo(car, 1.6, 0.9, 0.5, 0.2, 0.3, 0.3, 'lampGlow', { glow: true });  // 前灯×2
    dynBoxTo(car, 1.6, 0.9, -0.5, 0.2, 0.3, 0.3, 'lampGlow', { glow: true });
    dynBoxTo(car, 0.6, 1.5, 0, 0.15, 0.15, 1.6, 'metal');    // 行李架
    cars.push({ group: car, color: sp.color, progress: sp.offset });
  }
  return cars;
}

// 火车状态（自检/调试口读它确认火车在动）
let _trainState = null;
export function getTrainState() { return _trainState; }

/** 控制台/剧情：立即召唤火车（从东侧进站向西开） */
export function summonTrain() {
  if (!_trainState) return;
  _trainState.parked = false;
  _trainState.waitTimer = 0;
  _trainState.dir = -1;
  _trainState.speed = 9;
  _trainState.x = RAIL.xTo + 10;
}

// ------------------------------------------------------------
// 总装
// ------------------------------------------------------------
export function buildRailway(scene) {
  const updaters = [];
  layTrack();
  buildStation();
  buildCrossing(scene, updaters);

  const train = buildTrain(scene);
  const cars = buildCars(scene);
  _trainState = train.state;

  // —— 汽车沿环路（点列插值）——
  const loopPts = carLoopPoints();
  const loopLen = [];
  let total = 0;
  for (let i = 0; i < loopPts.length; i++) {
    const a = loopPts[i], b = loopPts[(i + 1) % loopPts.length];
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    loopLen.push(d); total += d;
  }
  const posAt = (p) => {
    let dist = p * total;
    for (let i = 0; i < loopPts.length; i++) {
      if (dist <= loopLen[i]) {
        const a = loopPts[i], b = loopPts[(i + 1) % loopPts.length];
        const t = dist / loopLen[i];
        return {
          x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t,
          angle: Math.atan2(b.x - a.x, b.z - a.z),
        };
      }
      dist -= loopLen[i];
    }
    return { x: loopPts[0].x, z: loopPts[0].z, angle: 0 };
  };

  updaters.push((dt) => {
    for (const c of cars) {
      c.progress = (c.progress + dt * 0.016) % 1;
      const at = posAt(c.progress);
      const gy = terrainHeight(at.x, at.z);
      // 过桥段（环路跨河）抬高到桥面
      let y = gy;
      if (Math.abs(at.z - 14) < 5 && Math.abs(at.x) > 20) y = 0.95;
      c.group.position.set(at.x, y, at.z);
      c.group.rotation.y = at.angle;
      // 车身轻微起伏（0.5Hz 慢波，高频颠簸在低分辨率下=噪点跳）
      c.group.position.y += Math.sin(performance.now() * 0.003 + c.progress * 40) * 0.03;
    }
  });

  // —— 火车运动（停站-出发循环 + 道口联动）——
  const S = train.state;
  updaters.push((dt, t) => {
    if (S.parked) {
      S.waitTimer -= dt;
      if (S.waitTimer <= 0) {
        S.parked = false;
        S.speed = 9;
      }
    } else {
      S.x += S.dir * S.speed * dt;
      // 进站减速 / 出站加速
      const distToStation = Math.abs(S.x - STATION.x);
      if (distToStation < 14) S.speed = Math.max(2.2, S.speed - dt * 3.2);
      else S.speed = Math.min(11, S.speed + dt * 2.4);
      if (S.x < RAIL.xFrom + 2) {
        S.dir = 1;
      } else if (S.x > RAIL.xTo - 2) {
        S.dir = -1;
      }
      // 站内停车 12s
      if (S.dir === -1 && S.x <= STATION.x && S.x > STATION.x - 0.5 && S.speed < 3) {
        S.parked = true; S.waitTimer = 12;
      }
      if (S.dir === 1 && S.x >= STATION.x + 4 && S.x < STATION.x + 4.6 && S.speed < 3) {
        S.parked = true; S.waitTimer = 12;
      }
    }
    train.train.position.set(S.x, 0.15, RAIL.z);
    train.train.rotation.y = S.dir === -1 ? 0 : Math.PI;
    // 道口联动：火车接近道口且在行驶 → 放栏杆
    notifyTrainNear(!S.parked && Math.abs(S.x - CROSSING.x) < 30);
  });

  return updaters;
}

