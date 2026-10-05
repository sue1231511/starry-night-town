// ============================================================
// builders/stars.js — 12 颗许愿星：建模 / 摆放 / 收集动画
// ------------------------------------------------------------
// · 星形 = 7 块体素（十字+斜臂），全镇 12 颗共享 1 个 InstancedMesh
//   （体素分桶哲学：~1 个 draw call 渲染全部星星）
// · 防晕铁律：脉动 ±4% 低幅正弦（0.5Hz 级），光晕 opacity 缓变
// · 收集 = 缩小上飘 + 一次性 8 粒小方块抛散（非常驻粒子）
// · 拾取走 Box3 手动相交（interaction 统一通道，不吃 draw call）
// ============================================================
import * as THREE from 'three';
import { glowMat, glowSpriteMat } from '../palette.js';
import { terrainHeight, riverZ, RIVER_HALF_W, PLAZA, DOCK, MILL, PAVILION, ORCHARD, CAMP, WATERTOWER, STATION } from '../layout.js';
import { STARS } from '../systems/game.js';

const WATER = 0.35; // 与 layout WATER_Y 一致（避免循环 import，这里写同值）

// —— 星形的 7 块部件（局部坐标；rotZ 斜臂）——
const PARTS = [
  { pos: [0, 0, 0], size: [0.55, 0.55, 0.2], rotZ: 0 },       // 核心
  { pos: [0, 0.75, 0], size: [0.24, 1.5, 0.18], rotZ: 0 },    // 上下臂
  { pos: [0.75, 0, 0], size: [1.5, 0.24, 0.18], rotZ: 0 },    // 左右臂
  { pos: [0.62, 0.62, 0], size: [0.5, 0.2, 0.16], rotZ: -Math.PI / 4 },
  { pos: [-0.62, 0.62, 0], size: [0.5, 0.2, 0.16], rotZ: Math.PI / 4 },
  { pos: [0.62, -0.62, 0], size: [0.5, 0.2, 0.16], rotZ: Math.PI / 4 },
  { pos: [-0.62, -0.62, 0], size: [0.5, 0.2, 0.16], rotZ: -Math.PI / 4 },
];
const N_PARTS = PARTS.length;

// —— 摆放坐标（对应 STARS 数组顺序；y 全部相对地面/水面抬高）——
// hint 文案在 game.js，坐标在这——两边按 id 对齐。
const PLACEMENTS = {
  // 踏石桥（x=-14）旁的水面上：夜话说"第八块是给月亮的"
  stone8:  { x: -16.5, y: WATER, dynZ: true, rzAt: -16.5 },
  // 主街拱桥桥洞下
  arch:    { x: 0.0, y: WATER + 0.4, dynZ: true, rzAt: 0 },
  // 钟楼尖顶上（广场中心，塔身 11 + 钟室 ~4 + 尖顶）
  tower:   { x: PLAZA.cx, y: terrainHeight(PLAZA.cx, PLAZA.cz) + 17.6, z: PLAZA.cz },
  // 水车磨坊的水轮上方（磨坊贴南岸，轮朝河北）
  wheel:   { x: -38.5, y: terrainHeight(-38, riverZ(-38) + 1) + 5.6, dynZ: true, rzOff: -RIVER_HALF_W + 1.2, rzAt: -38 },
  // 树屋绳梯第三级旁（巨树西侧）
  treehse: { x: 22.6, y: terrainHeight(22.6, -31.4) + 4.2, z: -31.4 },
  // 风车叶片弧顶（MILL 北坡，叶片朝 +z）
  mill:    { x: MILL.x - 4.6, y: MILL.groundY + 8.8, z: MILL.z + 1.6 },
  // 观星亭攒尖顶上
  pavilion:{ x: PAVILION.x, y: terrainHeight(PAVILION.x, PAVILION.z) + 5.2, z: PAVILION.z },
  // 码头栈桥尽头水面上方
  dock:    { x: DOCK.x + 3.4, y: WATER + 0.5, dynZ: true, rzOff: -1.2, rzAt: DOCK.x + 3 },
  // 果园最北排树冠里
  orchard: { x: ORCHARD.x0 + 3.2, y: terrainHeight(ORCHARD.x0 + 3.2, ORCHARD.z0 + 1) + 3.4, z: ORCHARD.z0 + 1 },
  // 篝火上空（火星变星星的呼应）
  camp:    { x: CAMP.fire.x + 0.6, y: CAMP.groundY + 4.6, z: CAMP.fire.z + 0.6 },
  // 水塔顶红灯旁
  watertwr:{ x: WATERTOWER.x + 1.8, y: WATERTOWER.groundY + 7.4, z: WATERTOWER.z },
  // 老站台长椅上方
  station: { x: STATION.x + 1.6, y: terrainHeight(STATION.x + 1.6, STATION.z - 0.6) + 1.5, z: STATION.z - 0.6 },
};

/** 展开坐标：dynZ 的按河道函数求 z */
function placeOf(id) {
  const p = PLACEMENTS[id];
  if (!p) return null;
  if (p.dynZ) {
    return { x: p.x, y: p.y, z: riverZ(p.rzAt) + (p.rzOff || 0) };
  }
  return { x: p.x, y: p.y, z: p.z };
}

// ------------------------------------------------------------
// 收集粒子池：一颗星 = 8 粒小方块抛散（复用一个 InstancedMesh）
// ------------------------------------------------------------
function makeBurstPool(scene) {
  const MAX = 96;
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({ color: 0xffd88a }),
    MAX,
  );
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  scene.add(mesh);
  const parts = new Array(MAX).fill(null).map(() => ({ alive: false }));
  let cursor = 0;
  const _m = new THREE.Matrix4(),
        _q = new THREE.Quaternion(),
        _p = new THREE.Vector3(),
        _s = new THREE.Vector3();
  for (let i = 0; i < MAX; i++) {
    _m.makeScale(0.0001, 0.0001, 0.0001);
    mesh.setMatrixAt(i, _m);
  }
  function burst(x, y, z) {
    for (let i = 0; i < 8; i++) {
      const pt = parts[cursor];
      cursor = (cursor + 1) % MAX;
      const a = (i / 8) * Math.PI * 2 + Math.random() * 0.5;
      pt.alive = true;
      pt.x = x; pt.y = y; pt.z = z;
      pt.vx = Math.cos(a) * (2.2 + Math.random() * 1.2);
      pt.vy = 2.4 + Math.random() * 1.6;
      pt.vz = Math.sin(a) * (2.2 + Math.random() * 1.2);
      pt.age = 0; pt.life = 0.8 + Math.random() * 0.3;
      pt.size = 0.28 + Math.random() * 0.12;
    }
  }
  function tick(dt) {
    let any = false;
    for (let i = 0; i < MAX; i++) {
      const pt = parts[i];
      if (!pt.alive) continue;
      any = true;
      pt.age += dt;
      if (pt.age >= pt.life) {
        pt.alive = false;
        _m.makeScale(0.0001, 0.0001, 0.0001);
        mesh.setMatrixAt(i, _m);
        continue;
      }
      pt.vy -= 5.2 * dt;
      pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.z += pt.vz * dt;
      const k = 1 - pt.age / pt.life;
      _p.set(pt.x, pt.y, pt.z);
      _s.setScalar(pt.size * k);
      _m.compose(_p, _q, _s);
      mesh.setMatrixAt(i, _m);
    }
    if (any) mesh.instanceMatrix.needsUpdate = true;
  }
  return { burst, tick };
}

// ------------------------------------------------------------
// 主入口
// ------------------------------------------------------------
export function buildStars(scene, game, { addPickable, removePickable, onCollect } = {}) {
  const updaters = [];
  const pool = makeBurstPool(scene);
  updaters.push(pool.tick);

  // 待摆的星（已收集的不摆）
  const toPlace = STARS.filter(d => !game.hasStar(d.id) && PLACEMENTS[d.id]);
  if (toPlace.length === 0) return updaters;

  // —— 全镇星星共享 1 个 InstancedMesh（体素分桶：7 块 × N 星 = 1 个 draw call）——
  const starMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    glowMat('starWarm'),
    toPlace.length * N_PARTS,
  );
  starMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  starMesh.frustumCulled = false; // 实例分散全镇，包围盒剔除交给不了它
  scene.add(starMesh);

  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _qYaw = new THREE.Quaternion(),
        _qPart = new THREE.Quaternion(), _e = new THREE.Euler(),
        _p = new THREE.Vector3(), _tmp = new THREE.Vector3(),
        _s = new THREE.Vector3();

  const liveStars = [];
  toPlace.forEach((def, si) => {
    const { x, y, z } = placeOf(def.id);
    // 星面朝外：绕 Y 转向广场方向 + 一点斜角
    const yaw = Math.atan2(x, z) + Math.PI / 4;
    const halo = new THREE.Sprite(glowSpriteMat('starWarm', 0.38).clone());
    halo.position.set(x, y, z);
    halo.scale.setScalar(3.2);
    scene.add(halo);

    const st = {
      def, base: si * N_PARTS, yaw, x, y, z, halo,
      phase: Math.random() * Math.PI * 2,
      collected: false, collectT: 0,
    };
    liveStars.push(st);

    // 拾取盒：中心 ±1.45（比星体大，好点；不吃 draw call）
    const box = new THREE.Box3(
      new THREE.Vector3(x - 1.45, y - 1.45, z - 1.45),
      new THREE.Vector3(x + 1.45, y + 1.45, z + 1.45),
    );
    addPickable({
      id: 'star:' + def.id,
      box,
      onPick: (screenXY) => {
        if (st.collected) return;
        st.collected = true;
        removePickable('star:' + def.id);
        pool.burst(x, y, z);
        onCollect && onCollect(def, screenXY);
      },
    });
  });

  updaters.push((dt, t) => {
    let dirty = false;
    for (const st of liveStars) {
      let s, py, haloOp;
      if (!st.collected) {
        // 低幅脉动：±4% @ ~0.45Hz（防晕：低幅缓变，绝不闪）
        s = 1 + Math.sin(t * 1.4 + st.phase) * 0.04;
        py = st.y;
        haloOp = 0.34 + 0.08 * (0.5 + 0.5 * Math.sin(t * 0.9 + st.phase));
      } else {
        if (st.collectT >= 0.45) continue; // 已收完
        st.collectT += dt;
        const k = Math.max(0, 1 - st.collectT / 0.45);
        s = k * (1 - st.collectT * 0.4);
        py = st.y + (1 - k) * 1.6; // 上飘
        haloOp = 0.38 * k;
        if (st.collectT >= 0.45) {
          st.halo.visible = false;
          s = 0.0001;
        }
      }
      st.halo.material.opacity = haloOp;

      // 写 7 个实例矩阵（星整体 yaw × 部件 rotZ × 脉动缩放）
      _qYaw.setFromEuler(_e.set(0, st.yaw, 0));
      for (let k = 0; k < N_PARTS; k++) {
        const part = PARTS[k];
        _qPart.setFromEuler(_e.set(0, 0, part.rotZ));
        _q.copy(_qYaw).multiply(_qPart);
        _tmp.set(part.pos[0] * s, part.pos[1] * s, part.pos[2] * s).applyQuaternion(_qYaw);
        _p.set(st.x, py, st.z).add(_tmp);
        _s.set(part.size[0] * s, part.size[1] * s, part.size[2] * s);
        _m.compose(_p, _q, _s);
        starMesh.setMatrixAt(st.base + k, _m);
      }
      dirty = true;
    }
    if (dirty) starMesh.instanceMatrix.needsUpdate = true;
  });

  return updaters;
}
