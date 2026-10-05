// ============================================================
// systems/water.js — 河面：沿河条带网格 + 顶点波动 + 波光碎闪
// ------------------------------------------------------------
// 河是蜿蜒的（riverZ 随 x 变化），水面按 x 分段、每段贴河心铺条带。
// 顶点每帧做两组正弦叠加波动；波光是随机闪的发光小面片。
// ============================================================
import * as THREE from 'three';
import { hexNum } from '../palette.js';
import { WORLD, riverZ, RIVER_HALF_W, WATER_Y, makeRng } from '../layout.js';

export function buildWater(scene) {
  const rng = makeRng(5555);

  // ------------------------------------------------------------
  // 1. 河面条带网格（沿 x 每 1.5 一段，横向 5 排顶点）
  // ------------------------------------------------------------
  const SEG = 1.5;
  const cols = Math.ceil(WORLD.SIZE / SEG) + 1;
  const rows = 5;
  const x0 = -WORLD.HALF;

  const posArr = new Float32Array(cols * rows * 3);
  const index = [];
  // 顶点：col 沿 x，row 沿河宽
  const rowW = [];
  for (let r = 0; r < rows; r++) rowW.push((r / (rows - 1) - 0.5) * 2 * RIVER_HALF_W);
  for (let c = 0; c < cols; c++) {
    const x = x0 + c * SEG;
    const cz = riverZ(x + SEG / 2);
    for (let r = 0; r < rows; r++) {
      const i = (c * rows + r) * 3;
      posArr[i] = x;
      posArr[i + 1] = WATER_Y;
      posArr[i + 2] = cz + rowW[r];
    }
  }
  for (let c = 0; c < cols - 1; c++) {
    for (let r = 0; r < rows - 1; r++) {
      const a = c * rows + r, b = (c + 1) * rows + r, d = a + 1, e = b + 1;
      index.push(a, b, d, b, e, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({
    color: hexNum('waterFace'),
    emissive: hexNum('waterDeep'),
    emissiveIntensity: 0.35,
  });
  const surface = new THREE.Mesh(geo, mat);
  surface.receiveShadow = true;
  scene.add(surface);

  // 河底暗带（比水面低一截的宽条，防止侧面看穿帮）
  const bed = new THREE.Mesh(
    new THREE.BoxGeometry(WORLD.SIZE + 4, 1.2, RIVER_HALF_W * 2 + 1.6),
    new THREE.MeshLambertMaterial({ color: hexNum('waterDeep') }),
  );
  // 河底分段贴河心太贵，用整体近似 + 波动段
  bed.position.set(0, WATER_Y - 0.75, riverZ(0));
  bed.visible = false; // 地面 voxel 已铺河滩剖面，这里只在必要时启用
  scene.add(bed);

  // ------------------------------------------------------------
  // 2. 波光碎闪（发光小面片：additive、随机相位明灭 + 微移）
  // ------------------------------------------------------------
  const glintMat = new THREE.MeshBasicMaterial({
    color: hexNum('waterGlint'),
    transparent: true,
    opacity: 0.75,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const glintGeo = new THREE.PlaneGeometry(0.9, 0.28);
  const glints = [];
  const N = 46;
  for (let i = 0; i < N; i++) {
    const m = new THREE.Mesh(glintGeo, glintMat.clone());
    const gx = (rng() - 0.5) * 2 * (WORLD.HALF - 2);
    const gz = riverZ(gx) + (rng() - 0.5) * 2 * (RIVER_HALF_W - 0.8);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = rng() * Math.PI;
    m.position.set(gx, WATER_Y + 0.06, gz);
    scene.add(m);
    glints.push({ m, phase: rng() * Math.PI * 2, speed: 1.2 + rng() * 2.4, drift: rng() < 0.5 ? 1 : -1 });
  }

  // ------------------------------------------------------------
  // 更新：顶点波动 + 波光明灭
  // ------------------------------------------------------------
  const base = posArr.slice(); // 底稿
  return function tickWater(dt, t) {
    const attr = geo.attributes.position;
    const arr = attr.array;
    for (let c = 0; c < cols; c++) {
      const x = x0 + c * SEG;
      // 沿河岸的行波 + 横向涟漪
      const wave = Math.sin(x * 0.35 + t * 1.6) * 0.09 + Math.sin(x * 0.12 - t * 0.7) * 0.06;
      for (let r = 0; r < rows; r++) {
        const i = (c * rows + r) * 3 + 1;
        const edge = Math.abs(r / (rows - 1) - 0.5) * 2; // 0 中心 → 1 岸边
        arr[i] = base[i] + wave * (1 - edge * 0.5) + Math.sin(t * 2.3 + r * 1.4 + c * 0.5) * 0.03;
      }
    }
    attr.needsUpdate = true;

    for (const g of glints) {
      // 闪烁改为低幅缓变（0.42~0.68）：大幅快闪在低分辨率下是噪点跳
      const k = 0.5 + 0.5 * Math.sin(t * g.speed + g.phase);
      g.m.material.opacity = 0.55 + 0.13 * Math.sin(t * 0.6 + g.phase);
      g.m.scale.setScalar(0.7 + k * 0.4);
      g.m.position.x += g.drift * dt * 0.25;
      if (Math.abs(g.m.position.x) > WORLD.HALF - 1) g.drift *= -1;
    }
  };
}
