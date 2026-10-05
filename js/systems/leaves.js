// ============================================================
// systems/leaves.js — 夜风落叶
// ------------------------------------------------------------
// 从树上方向东飘的发光小叶片：两三档深浅的绿色 + 偶尔一片暖黄。
// 出界或落水即换新起点（永续循环）。InstancedMesh 单批渲染。
// ============================================================
import * as THREE from 'three';
import { WORLD, riverZ, RIVER_HALF_W, WATER_Y, terrainHeight, makeRng } from '../layout.js';
import { hexNum } from '../palette.js';

export function buildLeaves(scene) {
  const rng = makeRng(20261005);
  // 数量克制：低分辨率下满天落叶=满屏闪烁噪点（晕动源），只留一点点氛围
  const COUNT = 12;

  // 一个 InstancedMesh：per-instance color 分三档叶色
  const geo = new THREE.BoxGeometry(0.42, 0.1, 0.3);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const mesh = new THREE.InstancedMesh(geo, mat, COUNT);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const leafColors = [hexNum('treeLite'), hexNum('treeDeep'), hexNum('fieldWheat'), hexNum('flowerYel')];
  const c = new THREE.Color();
  for (let i = 0; i < COUNT; i++) {
    c.setHex(leafColors[Math.floor(rng() * leafColors.length)]);
    mesh.setColorAt(i, c);
  }
  scene.add(mesh);

  // 叶片状态
  const leaves = [];
  const respawn = (L) => {
    L.x = (rng() - 0.5) * 2 * (WORLD.HALF - 2);
    L.z = -WORLD.HALF + 2 + rng() * (WORLD.SIZE - 6);
    L.y = 2.5 + rng() * 6;
    L.vx = 0.4 + rng() * 0.7;          // 夜风向东（慢速，防闪）
    L.vy = -(0.12 + rng() * 0.18);
    L.vz = (rng() - 0.5) * 0.25;
    L.spin = (rng() - 0.5) * 1.5;
    L.rot = rng() * Math.PI * 2;
    L.wobble = rng() * Math.PI * 2;
  };
  for (let i = 0; i < COUNT; i++) {
    const L = {};
    respawn(L);
    // 初始随机进度（铺满空域）
    L.x = (rng() - 0.5) * 2 * WORLD.HALF;
    L.y = 1 + rng() * 6;
    leaves.push(L);
  }

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const sVec = new THREE.Vector3(1, 1, 1);
  const pVec = new THREE.Vector3();

  return function tickLeaves(dt, t) {
    for (let i = 0; i < leaves.length; i++) {
      const L = leaves[i];
      // 漂移 + 上下摆（叶片的飘忽感）
      L.x += L.vx * dt;
      L.y += L.vy * dt + Math.sin(t * 2.2 + L.wobble) * 0.35 * dt;
      L.z += L.vz * dt + Math.cos(t * 1.7 + L.wobble) * 0.2 * dt;
      L.rot += L.spin * dt;

      // 落地 / 落水 / 出界 → 换新
      const gy = terrainHeight(L.x, L.z);
      const onWater = Math.abs(L.z - riverZ(L.x)) < RIVER_HALF_W;
      const floor = onWater ? WATER_Y : gy;
      if (L.y <= floor + 0.1 || L.x > WORLD.HALF || Math.abs(L.z) > WORLD.HALF) {
        respawn(L);
      }

      e.set(0, L.rot, Math.sin(t * 1.4 + L.wobble) * 0.6);
      q.setFromEuler(e);
      pVec.set(L.x, L.y, L.z);
      m.compose(pVec, q, sVec);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
}
