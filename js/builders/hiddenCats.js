// ============================================================
// builders/hiddenCats.js — 猫咪图鉴的拾取层 + 4 只隐藏猫 + 猫巡游
// ------------------------------------------------------------
// · 4 只镇猫（npc.js 摆）在这里统一注册拾取盒
// · 4 只隐藏猫新花色：麦芒(橘) / 阁楼(白) / 末班(灰) / 稻草(三花)
// · 单击猫 = 喵一声 + 开心小跳（一次性 0.35s，防晕安全）
// · spawnParadeCats()：星光 Lv3 奖励，三只小猫加入广场巡逻
// ============================================================
import * as THREE from 'three';
import { makeCatAt } from './npc.js';
import { dynBoxTo } from '../voxel.js';
import { terrainHeight, WHEAT_FIELD, STATION, PARK, PEDESTRIAN_LOOPS } from '../layout.js';
import { CATS } from '../systems/game.js';

// 隐藏猫摆放（id 对齐 game.js 的 CATS）
const HIDDEN = [
  // 麦芒：北坡麦田深处（橘猫趴在麦浪里）
  { id: 'wheat', color: 'catOrange', x: WHEAT_FIELD.x0 + 18, z: WHEAT_FIELD.z0 + 8, rot: 160, extra: null },
  // 阁楼：树屋巨树东侧树冠层（白猫坐在树冠边缘）
  { id: 'loft', color: 'catWhite', x: 28.8, z: -31.2, rot: -120, extra: 'crown' },
  // 末班：老站台长椅下的阴影里（灰猫）
  { id: 'lasttrain', color: 'catGray', x: STATION.x + 1.2, z: STATION.z - 0.8, rot: 200, extra: null },
  // 稻草：南公园稻草人肩上（三花，橘底+白斑）
  { id: 'scarecrow', color: 'catCalico', x: PARK.scarecrow.x + 0.55, z: PARK.scarecrow.z - 0.2, rot: -60, extra: 'calico' },
];

export function buildHiddenCats(scene, game, { addPickable, npcCatHook } = {}) {
  const updaters = [];

  // —— 开心小跳（一次性抛物线，全镇猫共用一个处理队列）——
  const jumps = new Map(); // group -> { baseY, t }
  function makeJump(group) {
    if (!jumps.has(group)) jumps.set(group, { baseY: group.position.y, t: 0.0001 });
  }
  updaters.push((dt) => {
    for (const [g, j] of jumps) {
      j.t += dt;
      const k = j.t / 0.35;
      if (k >= 1) {
        g.position.y = j.baseY;
        jumps.delete(g);
        continue;
      }
      g.position.y = j.baseY + Math.sin(k * Math.PI) * 0.34;
    }
  });

  // —— 拾取盒注册（猫比星星矮，盒子略扁）——
  function registerCat(id, g) {
    const p = g.position;
    const box = new THREE.Box3(
      new THREE.Vector3(p.x - 1.3, p.y - 0.4, p.z - 1.3),
      new THREE.Vector3(p.x + 1.3, p.y + 1.7, p.z + 1.3),
    );
    addPickable({
      id: 'cat:' + id,
      box,
      onPick: () => {
        game.petCat(id);
        makeJump(g);
      },
    });
  }

  // npc.js 的 4 只镇猫从这里注册（buildTownCats/buildRoofCat 的 onCat 回调转发过来）
  if (npcCatHook) npcCatHook(registerCat);

  // —— 4 只隐藏猫 ——
  for (const h of HIDDEN) {
    if (game.hasCat(h.id)) {
      // 已登记过也要摆猫（猫不会消失，图鉴只是登记）
    }
    const gy = h.id === 'loft'
      ? terrainHeight(h.x, h.z) + 11.5  // 树冠第二层顶（挨着树屋小木屋）
      : h.id === 'scarecrow'
        ? terrainHeight(h.x, h.z) + 3.0 // 稻草人肩膀
        : terrainHeight(h.x, h.z);
    const cat = makeCatAt(scene, h.x, gy, h.z, h.rot, Math.random() * 10, h.color);
    updaters.push(cat.tick);

    // 三花的白斑 / 白猫的小皇冠等点缀
    if (h.extra === 'calico') {
      dynBoxTo(cat.g, 0.18, 0.42, 0.15, 0.3, 0.24, 0.4, 'catWhite');
    } else if (h.extra === 'crown') {
      // 阁楼戴一枚星星发卡（呼应收集主题）
      dynBoxTo(cat.g, 0, 1.18, 0.42, 0.3, 0.14, 0.1, 'starWarm', { glow: true });
    }

    registerCat(h.id, cat.g);
  }

  return updaters;
}

// ------------------------------------------------------------
// 猫巡游（星光 Lv3 奖励）：三只小猫沿广场环溜达
// 走 PEDESTRIAN_LOOPS[0]，速度比行人慢、步子小
// ------------------------------------------------------------
export function spawnParadeCats(scene) {
  const loop = PEDESTRIAN_LOOPS[0];
  const colors = ['catOrange', 'catWhite', 'catCalico'];
  const updaters = [];

  // 环长预计算（同 npc.js 行人的参数化走法）
  const segs = [];
  let loopLen = 0;
  for (let k = 0; k < loop.length; k++) {
    const a = loop[k], b = loop[(k + 1) % loop.length];
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    segs.push({ a, b, d }); loopLen += d;
  }

  for (let i = 0; i < 3; i++) {
    const cat = makeCatAt(scene, 0, 0, 0, 0, Math.random() * 10, colors[i]);
    const speed = 0.32 + i * 0.06; // 猫步慢悠悠
    const startT = i / 3;
    const phase = Math.random() * Math.PI * 2;

    updaters.push((dt, t) => {
      let p = ((startT + t * speed / loopLen) % 1 + 1) % 1;
      let dist = p * loopLen;
      let cur = segs[0];
      for (const s of segs) {
        if (dist <= s.d) { cur = s; break; }
        dist -= s.d;
      }
      const tt = dist / cur.d;
      const x = cur.a.x + (cur.b.x - cur.a.x) * tt;
      const z = cur.a.z + (cur.b.z - cur.a.z) * tt;
      cat.g.position.set(x, terrainHeight(x, z), z);
      cat.g.rotation.y = Math.atan2(cur.b.x - cur.a.x, cur.b.z - cur.a.z);
      // 溜达的起伏（低频 0.5Hz 级，防晕约定）
      cat.g.position.y += Math.abs(Math.sin(t * 3 + phase)) * 0.05;
      cat.g.children[0].rotation.z = Math.sin(t * 1.6 + phase) * 0.04;
      cat.tick(dt, t);
    });
  }
  return updaters;
}
