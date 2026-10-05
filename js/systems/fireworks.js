// ============================================================
// systems/fireworks.js — 节日烟花
// ------------------------------------------------------------
// 一发烟花 = 升空亮点（尾迹）→ 空中爆开成 N 个粒子（重力抛物散开
// + 渐隐）。像素风：粒子全是发光小方块，颜色取调色板。
// 触发：控制台「放烟花」按钮 / 午夜 0:00 自动小规模 / 任务奖励。
// 防晕约束：爆发是低频事件（不是常驻闪烁），粒子明暗走缓变。
// ============================================================
import * as THREE from 'three';
import { makeRng } from '../layout.js';

const COLORS = [0xffd88a, 0xff6a5a, 0x7ad4a0, 0x7a9ad4, 0xffb85c, 0xe88ab0, 0xaad4ff];
const MAX_P = 260; // 全池上限

export function buildFireworks(scene, { onLaunch } = {}) {
  const rng = makeRng(31415);

  const _m = new THREE.Matrix4();
  const _q = new THREE.Quaternion();
  const _p = new THREE.Vector3();
  const _s = new THREE.Vector3();

  // —— 粒子池（单 InstancedMesh，per-instance color）——
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const mesh = new THREE.InstancedMesh(geo, mat, MAX_P);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(mesh);
  const _c = new THREE.Color();
  for (let i = 0; i < MAX_P; i++) {
    _c.setHex(0xffffff);
    mesh.setColorAt(i, _c);
    // 初始全藏（缩放 0）
    _m.makeScale(0.0001, 0.0001, 0.0001);
    mesh.setMatrixAt(i, _m);
  }

  // 粒子状态池
  const parts = new Array(MAX_P).fill(null).map(() => ({ alive: false }));
  let cursor = 0;
  function spawn(x, y, z, vx, vy, vz, color, life, size) {
    const p = parts[cursor];
    cursor = (cursor + 1) % MAX_P;
    p.alive = true;
    p.x = x; p.y = y; p.z = z;
    p.vx = vx; p.vy = vy; p.vz = vz;
    p.life = life; p.age = 0;
    p.size = size;
    p.color = color;
  }

  // 待发射的烟花（升空阶段）
  const rockets = [];

  /** 发射一发：cx/cz 地面坐标附近，爆高随机 */
  function launch(cx, cz) {
    rockets.push({
      x: cx + (rng() - 0.5) * 6, z: cz + (rng() - 0.5) * 6,
      y: 2, vy: 16 + rng() * 5,
      burstY: 20 + rng() * 10,
      color: COLORS[Math.floor(rng() * COLORS.length)],
    });
    if (onLaunch) onLaunch();
  }

  /** 一轮小型演出：3~5 发 */
  function show(cx = 0, cz = -4, count = 4) {
    for (let i = 0; i < count; i++) {
      setTimeout(() => launch(cx, cz), i * (700 + rng() * 500));
    }
  }

  function burst(x, y, z, color) {
    const n = 26 + Math.floor(rng() * 12);
    for (let i = 0; i < n; i++) {
      // 球面均匀方向
      const u = rng() * 2 - 1;
      const a = rng() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const speed = 5.5 + rng() * 4;
      spawn(x, y, z, s * Math.cos(a) * speed, u * speed, s * Math.sin(a) * speed * 0.7,
        color, 1.6 + rng() * 0.8, 0.5 + rng() * 0.3);
    }
    // 少量金色余烬（慢速、更久）
    for (let i = 0; i < 8; i++) {
      const a = rng() * Math.PI * 2;
      spawn(x, y, z, Math.cos(a) * 2.2, 2 + rng() * 2, Math.sin(a) * 1.6,
        0xffd88a, 2.4 + rng(), 0.36);
    }
  }

  function tick(dt, t) {
    // —— 升空段 ——
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i];
      const dy = r.vy * dt;
      r.y += dy;
      // 尾迹小粒子
      if (rng() < 0.7) spawn(r.x, r.y, r.z, (rng() - 0.5) * 0.8, -1.2, (rng() - 0.5) * 0.8, 0xffe8c0, 0.5, 0.3);
      if (r.y >= r.burstY) {
        burst(r.x, r.y, r.z, r.color);
        rockets.splice(i, 1);
      }
    }

    // —— 粒子积分 + 写矩阵 ——
    for (let i = 0; i < MAX_P; i++) {
      const p = parts[i];
      if (!p.alive) continue;
      p.age += dt;
      if (p.age >= p.life) {
        p.alive = false;
        _m.makeScale(0.0001, 0.0001, 0.0001);
        mesh.setMatrixAt(i, _m);
        continue;
      }
      p.vy -= 4.5 * dt;              // 重力
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const k = 1 - p.age / p.life;  // 生命周期 → 渐小（像素式渐隐）
      _p.set(p.x, p.y, p.z);
      _s.setScalar(p.size * k);
      _m.compose(_p, _q, _s);
      mesh.setMatrixAt(i, _m);
      _c.setHex(p.color);
      mesh.setColorAt(i, _c);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  return { tick, launch, show };
}
