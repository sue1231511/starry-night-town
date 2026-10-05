// ============================================================
// interaction.js — 相机交互：环视 / 缩放 / 双击飞近 / 空闲自转 / 重置
// ------------------------------------------------------------
// OrbitControls 带阻尼与角度限制；双击用射线打建筑 hitbox
// （layout.getBuildings 的 AABB，手动 ray-box，不依赖 mesh）；
// 飞近用缓动插值（不锁 OrbitControls，冲突时以用户操作为准）。
// ============================================================
import * as THREE from 'three';
import { getBuildings } from './layout.js';
import { vox } from './voxel.js';

export function setupInteraction({ scene, camera, renderer, controls, showPlaque, hidePlaque, onBuildingVisit }) {
  const raycaster = new THREE.Raycaster();

  // 进屋模式：当前揭开屋顶的建筑（同一时间只揭一家）
  let openRoofGroup = null;
  let insideShop = null;     // 真·店内模式：相机在店内
  let savedView = null;      // 进店前的相机状态
  let exitBtn = null;
  let keyboardEnabledRef = null; // main 注入（进店时关 WASD）
  let shopLight = null;          // 室内主暖灯（进店亮/出门挪走）
  let shopLight2 = null;         // 门口补光
  let shopYaw = 0, shopPitch = 0;      // 店内自写转头角度
  let shopDrag = null;                // 店内拖拽状态 {x, y}

  function revealInterior(b) {
    // 恢复上一家
    if (openRoofGroup) vox.setGroupVisible(openRoofGroup, true);
    openRoofGroup = b.roofGroup || null;
    if (openRoofGroup) vox.setGroupVisible(openRoofGroup, false);
    // 民居揭顶配一盏室内灯：家具在月光阴影里会黑成一团（像素 Lara 全靠它）
    aimInteriorLight(b);
  }
  function closeInterior() {
    if (openRoofGroup) vox.setGroupVisible(openRoofGroup, true);
    openRoofGroup = null;
    if (shopLight) shopLight.position.set(0, -100, 0);   // 挪走=熄灯
    if (shopLight2) shopLight2.position.set(0, -100, 0);
  }

  /** 室内灯：建一次、永远挪着用（真进店/揭顶共用） */
  function ensureInteriorLights() {
    if (!shopLight) {
      shopLight = new THREE.PointLight(0xffd8a0, 13, 18, 1.6);
      scene.add(shopLight);
      shopLight2 = new THREE.PointLight(0xffe8c0, 7, 12, 1.8);
      scene.add(shopLight2);
    }
  }
  /** 按建筑高度把灯挪到室内中央（民居没存朝向，居中即可照亮） */
  function aimInteriorLight(b) {
    ensureInteriorLights();
    const h = (b.y1 ?? 6) - (b.y0 ?? 0);
    shopLight.position.set(b.cx, (b.y0 ?? 0) + h * 0.45, b.cz);
    shopLight2.position.set(b.cx, (b.y0 ?? 0) + h * 0.75, b.cz);
  }

  /** 真·进店：站门口、看店内陈设；按住拖拽转头（自写，绕开 OrbitControls——
   *  极近距离下 controls 的旋转惯性会放大成疯抖/穿模，绝不让它碰店内相机）*/
  function enterShop(b) {
    if (insideShop) return;
    revealInterior(b);
    savedView = {
      pos: camera.position.clone(),
      tgt: controls.target.clone(),
      minD: controls.minDistance, maxD: controls.maxDistance,
    };
    controls.enabled = false; // 店内完全脱离 OrbitControls
    const yaw0 = (b._rot ?? 0) * Math.PI / 180;
    const doorDir = new THREE.Vector3(Math.sin(yaw0), 0, Math.cos(yaw0));
    // 机位：门内侧一点（不贴门框），看店深处的柜台
    const eye = new THREE.Vector3(b.cx, b.y0 + 1.95, b.cz).addScaledVector(doorDir, 1.8);
    camera.position.copy(eye);
    // 初始朝向 = 看店深处
    shopYaw = yaw0 + Math.PI;
    shopPitch = -0.06;
    applyShopLook();
    if (keyboardEnabledRef) keyboardEnabledRef(false);
    // 室内暖灯×2（真进店 / 揭顶共用；按建筑高度居中照亮）
    ensureInteriorLights();
    const h = (b.y1 ?? 6) - (b.y0 ?? 0);
    const doorDirX = Math.sin(yaw0);
    const doorDirZ = Math.cos(yaw0);
    shopLight.position.set(b.cx, b.y0 + h * 0.45, b.cz);
    shopLight2.position.set(
      b.cx + doorDirX * (Math.abs(doorDirX) > 0.01 ? 3.4 : 0),
      b.y0 + h * 0.75,
      b.cz + doorDirZ * (Math.abs(doorDirZ) > 0.01 ? 3.4 : 0),
    );
    insideShop = b;
    if (!exitBtn) {
      exitBtn = document.createElement('button');
      exitBtn.className = 'exit-shop-btn';
      exitBtn.type = 'button';
      exitBtn.textContent = '← 出门（ESC）';
      exitBtn.addEventListener('click', exitShop);
      document.getElementById('ui').appendChild(exitBtn);
      const tip = document.createElement('div');
      tip.className = 'shop-tip';
      tip.textContent = '按住左键拖拽可环视店内';
      document.getElementById('ui').appendChild(tip);
    }
  }

  /** 店内视角应用（yaw/pitch 欧拉） */
  function applyShopLook() {
    camera.rotation.order = 'YXZ';
    camera.rotation.set(shopPitch, shopYaw, 0);
  }

  function exitShop() {
    if (!insideShop) return;
    controls.enabled = true;
    if (keyboardEnabledRef) keyboardEnabledRef(true);
    if (savedView) {
      camera.position.copy(savedView.pos);
      controls.target.copy(savedView.tgt);
    }
    // 烧掉 OrbitControls 残留的旋转惯性（damping delta），
    // 否则出门后几秒内画面会自己漂
    for (let i = 0; i < 40; i++) controls.update();
    if (shopLight) shopLight.position.set(0, -100, 0); // 挪走=熄灯
    if (shopLight2) shopLight2.position.set(0, -100, 0);
    closeInterior();
    insideShop = null;
    if (exitBtn) { exitBtn.remove(); exitBtn = null; }
    const tip = document.querySelector('.shop-tip');
    if (tip) tip.remove();
  }

  // ESC 出门
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && insideShop) exitShop();
  });

  // 相机缓动飞行（双击建筑）
  const fly = {
    active: false,
    t: 0, dur: 1.4,
    fromPos: new THREE.Vector3(), toPos: new THREE.Vector3(),
    fromTgt: new THREE.Vector3(), toTgt: new THREE.Vector3(),
  };

  function flyTo(target, lookAt) {
    fly.active = true;
    fly.t = 0;
    fly.fromPos.copy(camera.position);
    fly.toPos.copy(target);
    fly.fromTgt.copy(controls.target);
    fly.toTgt.copy(lookAt);
  }

  function resetView() {
    hidePlaque();
    if (insideShop) exitShop();
    closeInterior(); // 重置视角时盖回屋顶
    flyTo(new THREE.Vector3(46, 38, 58), new THREE.Vector3(0, 4, -2));
  }

  /** 飞近某建筑（双击与图鉴共用） */
  function flyToBuilding(hit) {
    const cx = hit.cx, cz = hit.cz;
    const dx = camera.position.x - cx, dz = camera.position.z - cz;
    const len = Math.max(6, Math.hypot(dx, dz));
    const target = new THREE.Vector3(
      cx + (dx / (len || 1)) * 18,
      Math.min(hit.y1 + 9, 26),
      cz + (dz / (len || 1)) * 18,
    );
    flyTo(target, new THREE.Vector3(cx, (hit.y0 + hit.y1) / 2, cz));
  }

  // —— 拾取物注册表（星星/猫：Box3 手动相交，同建筑判定路数）——
  const pickables = new Map(); // id -> { id, box, onPick }
  function addPickable(p) { pickables.set(p.id, p); }
  function removePickable(id) { pickables.delete(id); }
  function clearPickables() { pickables.clear(); }

  /** 单击拾取：星星/猫（命中返回 true，优先于收名牌） */
  function raycastPickables(ray, e) {
    let best = null, bestT = Infinity;
    const hitP = new THREE.Vector3();
    for (const p of pickables.values()) {
      if (ray.intersectBox(p.box, hitP)) {
        const t = hitP.distanceTo(ray.origin);
        if (t < bestT) { bestT = t; best = p; }
      }
    }
    if (!best) return false;
    best.onPick({ x: e.clientX, y: e.clientY });
    return true;
  }

  // —— 指针事件 ——
  const dom = renderer.domElement;
  let downX = 0, downY = 0, downT = 0;

  // 店内转头：按住左键拖才转；纯移动鼠标绝对不动画面（防晕铁律）
  dom.addEventListener('pointerdown', (e) => {
    if (!insideShop || e.button !== 0) return;
    shopDrag = { x: e.clientX, y: e.clientY };
  });
  window.addEventListener('pointermove', (e) => {
    if (!insideShop || !shopDrag) return;
    const dx = e.clientX - shopDrag.x;
    const dy = e.clientY - shopDrag.y;
    shopDrag.x = e.clientX; shopDrag.y = e.clientY;
    shopYaw -= dx * 0.004;
    shopPitch = THREE.MathUtils.clamp(shopPitch - dy * 0.003, -0.9, 0.9);
    applyShopLook();
  });
  window.addEventListener('pointerup', () => { shopDrag = null; });

  dom.addEventListener('pointerdown', (e) => {
    downX = e.clientX; downY = e.clientY; downT = performance.now();
  });

  dom.addEventListener('pointerup', (e) => {
    // 移动超过阈值不算点击
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return;
    if (performance.now() - downT > 400) return;
    if (e.button !== 0) return;
    // 先试拾取物（星星/猫），命中优先；没中再收名牌
    const rect = dom.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera);
    if (raycastPickables(raycaster.ray, e)) return;
    // 单击空白处收起名牌（双击判定放 dblclick）
    hidePlaque();
  });

  dom.addEventListener('dblclick', (e) => {
    // NDC 坐标
    const rect = dom.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera);

    const hit = raycastBuildings(raycaster.ray);
    if (hit) {
      showPlaque(hit);
      if (onBuildingVisit) onBuildingVisit(hit); // 剧情任务推进
      if (hit.hasInterior) {
        // 真·进店：站到店内看四周
        enterShop(hit);
      } else {
        // 民居：揭顶飞近看内景（roofGroup 由 house.js 注册；再点空白盖回）
        if (hit.roofGroup) revealInterior(hit);
        flyToBuilding(hit);
      }
    } else {
      hidePlaque();
      if (insideShop) exitShop(); // 店内点空白=出门
      else closeInterior();       // 街上看屋=盖回屋顶
    }
  });

  /** 射线 vs 建筑 AABB（世界坐标 box） */
  function raycastBuildings(ray) {
    let best = null, bestT = Infinity;
    const box = new THREE.Box3();
    const hitP = new THREE.Vector3();
    for (const b of getBuildings()) {
      box.min.set(b.cx - b.halfW, b.y0, b.cz - b.halfD);
      box.max.set(b.cx + b.halfW, b.y1, b.cz + b.halfD);
      if (ray.intersectBox(box, hitP)) {
        const t = hitP.distanceTo(ray.origin);
        if (t < bestT) { bestT = t; best = b; }
      }
    }
    return best;
  }

  // —— 每帧：缓动飞行（静止即完全静止）——
  // 用户开始拖拽时取消进行中的飞行动画
  controls.addEventListener('start', () => { fly.active = false; });

  function tick(dt) {
    // 缓动飞行
    if (fly.active) {
      fly.t += dt / fly.dur;
      const k = fly.t >= 1 ? 1 : 1 - Math.pow(1 - fly.t, 3); // easeOutCubic
      camera.position.lerpVectors(fly.fromPos, fly.toPos, k);
      controls.target.lerpVectors(fly.fromTgt, fly.toTgt, k);
      if (fly.t >= 1) fly.active = false;
    }

    // 空闲自动环绕已移除：像素风画面静止时必须完全静止，
    // 常驻自转会让整屏低分辨率细节持续闪烁（晕动症来源）。
    // 想看全景请拖拽，或点图鉴/重置按钮飞行。
  }

  return { tick, resetView, flyTo, flyToBuilding, enterShop, exitShop, setKeyboardHook: (fn) => { keyboardEnabledRef = fn; }, isInside: () => !!insideShop, addPickable, removePickable, clearPickables };
}
