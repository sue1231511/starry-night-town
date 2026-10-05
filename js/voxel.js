// ============================================================
// voxel.js — 体素引擎：按颜色分桶的 InstancedMesh 收集器
// ------------------------------------------------------------
// 全镇静态几何的唯一入口。所有 builder 调 box()/boxC() 把方块
// 投进「颜色 × 材质类型」的桶里，build() 时每桶合成一个
// InstancedMesh —— 上万个方块也只有几十个 draw call。
// 动态部件（旋转的风车叶、行驶的车）请用 dynBox() 生成普通 Mesh。
// ============================================================
import * as THREE from 'three';
import { matFor, GLOW_KEYS, mat } from './palette.js';

// 全局共享的单位立方体（所有体素都用它 + 矩阵缩放）
let SHARED_GEO = null;
function sharedGeo() {
  if (!SHARED_GEO) SHARED_GEO = new THREE.BoxGeometry(1, 1, 1);
  return SHARED_GEO;
}

export class VoxelWorld {
  constructor() {
    // matKey -> { colorKey, glow, mats: Matrix4[] }
    this.buckets = new Map();
    // 窗灯登记（build 后转成真实引用）：{ colorKey, matrix, ref }
    this.pendingWindows = [];
    this.windowRefs = [];
    this._tmpMat = new THREE.Matrix4();
    this._tmpPos = new THREE.Vector3();
    this._tmpQuat = new THREE.Quaternion();
    this._tmpScale = new THREE.Vector3();
    this._tmpEuler = new THREE.Euler();
    // 变换栈：builder 在局部坐标建模，push 后所有 box 自动变换到世界
    this.transformStack = [];
    this._identity = new THREE.Matrix4();
  }

  /** 压入局部→世界变换：绕 Y 旋转 deg 度后平移到 (tx, ty, tz)，可再抬高 dy */
  pushTransform(tx, ty, tz, deg) {
    const m = new THREE.Matrix4().makeRotationY(deg * Math.PI / 180);
    m.setPosition(tx, ty, tz);
    this.transformStack.push(m);
    return m;
  }

  popTransform() {
    this.transformStack.pop();
  }

  _currentTransform() {
    return this.transformStack.length
      ? this.transformStack[this.transformStack.length - 1]
      : null;
  }

  _key(colorKey, group) {
    const matKey = (GLOW_KEYS.has(colorKey) ? 'g:' : 'l:') + colorKey;
    return group ? `grp:${group}|${matKey}` : matKey;
  }

  /** 中心坐标 + 尺寸放一个方块（opts.group 可挂分组桶，整组可显隐） */
  box(cx, cy, cz, w, h, d, colorKey, opts) {
    return this.placed(cx, cy, cz, w, h, d, colorKey, opts);
  }

  /** 角坐标（x0,z0 为西南角，y0 为底）+ 尺寸，摆体素最顺手 */
  boxC(x0, y0, z0, w, h, d, colorKey, opts) {
    return this.placed(x0 + w / 2, y0 + h / 2, z0 + d / 2, w, h, d, colorKey, opts);
  }

  /** 中心坐标 + 尺寸 + 绕 Y 旋转（度） */
  boxRotY(cx, cy, cz, w, h, d, colorKey, deg) {
    this._tmpEuler.set(0, deg * Math.PI / 180, 0);
    return this._push(cx, cy, cz, w, h, d, colorKey, this._tmpEuler, null);
  }

  placed(cx, cy, cz, w, h, d, colorKey, opts) {
    return this._push(cx, cy, cz, w, h, d, colorKey, null, opts);
  }

  _push(cx, cy, cz, w, h, d, colorKey, euler, opts) {
    const group = opts && opts.group;
    const key = this._key(colorKey, group);
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { colorKey, glow: GLOW_KEYS.has(colorKey), mats: [], group: group || null };
      this.buckets.set(key, bucket);
    }
    const m = new THREE.Matrix4();
    if (euler) {
      this._tmpQuat.setFromEuler(euler);
    } else {
      this._tmpQuat.identity();
    }
    m.compose(
      this._tmpPos.set(cx, cy, cz),
      this._tmpQuat,
      this._tmpScale.set(w, h, d),
    );
    // 应用变换栈（局部 → 世界）
    const tf = this._currentTransform();
    if (tf) m.premultiply(tf);
    bucket.mats.push(m);
    return m;
  }

  /**
   * 发光窗专用：除了放方块，还登记到窗灯调度系统（schedule.js 逐个调明暗）。
   * 返回登记句柄（build 后 ref.mesh/.index 可用）。
   */
  windowBox(cx, cy, cz, w, h, d, colorKey = 'winGlow', opts) {
    const group = opts && opts.group;
    const m = this.placed(cx, cy, cz, w, h, d, colorKey, opts);
    const entry = { colorKey, mesh: null, index: -1, phase: Math.random() * Math.PI * 2 };
    // 记录所在桶，build 后直接按桶回填（分组桶下同色可能多桶）
    const bucket = this.buckets.get(this._key(colorKey, group));
    this.pendingWindows.push({ matrix: m, entry, bucket });
    return entry;
  }

  /** 把所有桶烘焙成 InstancedMesh，挂到 parent 下，返回根组 */
  build(parent) {
    const root = new THREE.Group();
    root.name = 'voxel-static';
    // 发光窗按桶回填索引
    const bucketIndex = new Map(); // bucket -> 已回填个数
    this.groups = new Map(); // groupName -> mesh[]
    for (const [key, bucket] of this.buckets) {
      const n = bucket.mats.length;
      const im = new THREE.InstancedMesh(sharedGeo(), matFor(bucket.colorKey), n);
      for (let i = 0; i < n; i++) im.setMatrixAt(i, bucket.mats[i]);
      im.instanceMatrix.needsUpdate = true;
      im.castShadow = !bucket.glow;
      im.receiveShadow = !bucket.glow;
      im.name = 'bucket-' + key;
      // 发光桶启用 per-instance color（窗灯明暗调度依赖）
      if (bucket.glow) {
        const white = new THREE.Color(1, 1, 1);
        for (let i = 0; i < n; i++) im.setColorAt(i, white);
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
      }
      bucket.mesh = im;
      if (bucket.group) {
        if (!this.groups.has(bucket.group)) this.groups.set(bucket.group, []);
        this.groups.get(bucket.group).push(im);
      }
      root.add(im);
    }
    // 回填窗灯引用（按桶内顺序）
    for (const p of this.pendingWindows) {
      if (!p.bucket) continue;
      const c = bucketIndex.get(p.bucket) || 0;
      bucketIndex.set(p.bucket, c + 1);
      if (p.bucket.mesh && c < p.bucket.mesh.count) {
        p.entry.mesh = p.bucket.mesh;
        p.entry.index = c;
        this.windowRefs.push(p.entry);
      }
    }
    parent.add(root);
    this.root = root;
    return root;
  }

  /** 分组显隐（进屋模式隐藏屋顶用） */
  setGroupVisible(group, visible) {
    const list = this.groups && this.groups.get(group);
    if (list) for (const m of list) m.visible = visible;
  }

  /** 自检统计：桶数 / 总方块数 */
  stats() {
    let total = 0;
    for (const b of this.buckets.values()) total += b.mats.length;
    return { buckets: this.buckets.size, boxes: total, windows: this.pendingWindows.length };
  }
}

// ------------------------------------------------------------
// 动态方块：普通 Mesh（会动的东西用这个，别进静态桶）
// ------------------------------------------------------------
export function dynBox(w, h, d, colorKey, { glow = false } = {}) {
  const m = new THREE.Mesh(sharedGeo(), glow ? matFor(colorKey) : mat(colorKey));
  m.scale.set(w, h, d);
  m.castShadow = !glow;
  m.receiveShadow = !glow;
  return m;
}

/** 快捷：往一个 Group 里塞动态方块（中心坐标） */
export function dynBoxTo(group, cx, cy, cz, w, h, d, colorKey, opts) {
  const m = dynBox(w, h, d, colorKey, opts);
  m.position.set(cx, cy, cz);
  group.add(m);
  return m;
}

/** 世界级单例：全镇 builder 共用 */
export const vox = new VoxelWorld();
