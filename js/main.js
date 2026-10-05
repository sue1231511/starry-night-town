// ============================================================
// main.js — 入口：渲染器 / 相机 / 像素化管线 / 主循环
// ------------------------------------------------------------
// 像素化核心：内部渲染高度锁定 270px（updateStyle=false），
// canvas 由 CSS 拉满全屏 + image-rendering: pixelated。
// ============================================================
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildTown } from './world.js';
import { townClock } from './clock.js';
import { setupInteraction } from './interaction.js';
import { buildUI } from './ui.js';
import { buildConsolePanel } from './console.js';
import { getTrainState, summonTrain } from './builders/vehicles.js';
import { buildInfinite } from './systems/infinite.js';

// ------------------------------------------------------------
// 渲染器与场景
// ------------------------------------------------------------
const stage = document.getElementById('stage');
// preserveDrawingBuffer 仅在 ?keepbuf=1 时开（自检帧分析用；常开会损 fps）
const keepBuf = new URLSearchParams(location.search).get('keepbuf') === '1';
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: keepBuf });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.BasicShadowMap; // 硬边阴影贴像素风
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1026);

const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 1400);
camera.position.set(46, 38, 58);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 4, -2);
controls.enableDamping = true;
controls.dampingFactor = 0.16; // 收敛快一点：拖完尽快停稳（持续微滑=整屏闪烁）
controls.rotateSpeed = 0.5;    // 转速减半：低分辨率下转得快=边缘爬动雪崩（晕动主源）
controls.zoomSpeed = 0.6;
// 平移自由：右键拖拽平移（上下左右看全景），滚轮缩放，左键旋转
controls.enablePan = true;
controls.screenSpacePanning = false; // 沿地面平移（体素世界的直觉方向）
controls.mouseButtons = {
  LEFT: THREE.MOUSE.ROTATE,
  MIDDLE: THREE.MOUSE.DOLLY,
  RIGHT: THREE.MOUSE.PAN,
};
controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
controls.minDistance = 9;    // 可以贴近看内景
controls.maxDistance = 380;  // 可以拉远看旷野
controls.maxPolarAngle = Math.PI * 0.485; // 不许钻到地下
controls.minPolarAngle = Math.PI * 0.08;  // 几乎可以俯视全图
controls.keyPanSpeed = 14;

// —— 键盘平移（WASD/方向键，进店时禁用）——
const keys = new Set();
window.addEventListener('keydown', (e) => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
  keys.add(e.key.toLowerCase());
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
let keyboardEnabled = true; // 进店模式会暂时关掉

function tickKeyboardPan(dt) {
  if (!keyboardEnabled || keys.size === 0) return;
  // 按相机到目标的距离定步长（越远移得越快，手感一致）
  const dist = camera.position.distanceTo(controls.target);
  const step = Math.min(60, dist * 0.55) * dt;
  let dx = 0, dz = 0;
  if (keys.has('w') || keys.has('arrowup')) dz -= 1;
  if (keys.has('s') || keys.has('arrowdown')) dz += 1;
  if (keys.has('a') || keys.has('arrowleft')) dx -= 1;
  if (keys.has('d') || keys.has('arrowright')) dx += 1;
  if (dx === 0 && dz === 0) return;
  // 沿相机水平朝向平移（不是世界轴），符合拖拽方向直觉
  const fwd = new THREE.Vector3();
  camera.getWorldDirection(fwd);
  fwd.y = 0; fwd.normalize();
  const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
  const move = new THREE.Vector3()
    .addScaledVector(fwd, -dz * step)
    .addScaledVector(right, dx * step);
  camera.position.add(move);
  controls.target.add(move);
}

// ------------------------------------------------------------
// 像素完美相机（防晕核心）：
// 把相机方位/俯仰/距离量化到固定小步长，转动时画面「整格跳动」，
// 不做连续重采样——连续重采样会让所有几何边缘逐帧爬动（蚂蚁线），
// 是低分辨率 3D 转动时最大的晕动来源。
// ------------------------------------------------------------
const SNAP_YAW = THREE.MathUtils.degToRad(0.4);  // 水平步长
const SNAP_PITCH = THREE.MathUtils.degToRad(0.3); // 垂直步长
const SNAP_DIST = 0.9;                             // 缩放步长（体素格）
const SNAP_PAN = 0.9;                              // 平移步长（体素格，防晕同理由）
const _snapOff = new THREE.Vector3();

function snapCameraToPixelGrid() {
  // 平移量化：target 落格（带动相机一起对齐）
  const tx = Math.round(controls.target.x / SNAP_PAN) * SNAP_PAN;
  const tz = Math.round(controls.target.z / SNAP_PAN) * SNAP_PAN;
  if (tx !== controls.target.x || tz !== controls.target.z) {
    const ox = tx - controls.target.x, oz = tz - controls.target.z;
    controls.target.x = tx; controls.target.z = tz;
    camera.position.x += ox; camera.position.z += oz;
  }
  _snapOff.copy(camera.position).sub(controls.target);
  const dist = _snapOff.length();
  const yaw = Math.atan2(_snapOff.x, _snapOff.z);
  const pitch = Math.asin(THREE.MathUtils.clamp(_snapOff.y / dist, -1, 1));
  const yawS = Math.round(yaw / SNAP_YAW) * SNAP_YAW;
  const pitchS = Math.round(pitch / SNAP_PITCH) * SNAP_PITCH;
  const distS = Math.round(dist / SNAP_DIST) * SNAP_DIST;
  if (yawS === yaw && pitchS === pitch && distS === dist) return;
  const flat = Math.cos(pitchS) * distS;
  camera.position.set(
    controls.target.x + Math.sin(yawS) * flat,
    controls.target.y + Math.sin(pitchS) * distS,
    controls.target.z + Math.cos(yawS) * flat,
  );
  camera.lookAt(controls.target);
}

// ------------------------------------------------------------
// 像素化：内部高度（默认 200，控制台滑杆可运行时热调）
// ------------------------------------------------------------
let TARGET_H = (() => {
  const q = new URLSearchParams(location.search).get('px');
  const v = q ? parseInt(q, 10) : 200;
  return Math.min(360, Math.max(120, v));
})();
let pixelScale = 1;

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  pixelScale = Math.max(1, Math.ceil(h / TARGET_H));
  const rw = Math.ceil(w / pixelScale), rh = Math.ceil(h / pixelScale);
  renderer.setSize(rw, rh, false);          // 不改 style，交给 CSS 拉伸
  renderer.setPixelRatio(1);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

/** 运行时调像素颗粒粗细（控制台滑杆） */
function setPixelHeight(h) {
  TARGET_H = Math.min(360, Math.max(120, Math.round(h)));
  resize();
}
function getPixelHeight() { return TARGET_H; }

// ------------------------------------------------------------
// UI + 交互
// ------------------------------------------------------------
// UI 先建（onReset/onFlyToBuilding 走事件桥或延迟调用，interaction 建好后接住）
const ui = buildUI({
  onReset: () => interaction && interaction.resetView(),
  onFlyToBuilding: (b) => window.dispatchEvent(new CustomEvent('guide-fly', { detail: b })),
});

// ------------------------------------------------------------
// 小镇
// ------------------------------------------------------------
const town = buildTown(scene);
const stats = town.stats();
console.log('[starville] 体素统计:', JSON.stringify(stats));

const interaction = setupInteraction({
  scene, camera, renderer, controls,
  showPlaque: ui.showPlaque,
  hidePlaque: ui.hidePlaque,
  onBuildingVisit: (b) => town.story.visit(b.name), // 剧情任务推进
});
// 进店时暂停 WASD 平移（防止人还在店里地图跑了）
interaction.setKeyboardHook((on) => { keyboardEnabled = on; });
// 游戏层拾取通道接上（星星/猫的 Box3 在 buildTown 里攒着）
town.flushPickables(interaction);
// 星光图鉴 / HUD 计数 / 音效开关绑定
ui.bindGame(town.game);
// 图鉴点击 → 飞向建筑
window.addEventListener('guide-fly', (e) => interaction.flyToBuilding(e.detail));
// 控制台「重置视角」
window.addEventListener('guide-reset', () => interaction.resetView());

// —— 控制台（上帝面板）——
const con = buildConsolePanel({
  clock: townClock,
  seasons: town.seasons,
  weather: town.weather,
  story: town.story,
  game: town.game,
  sky: town.sky,
  fireworks: town.fireworks,
  summonTrain,
  onFlyToBuilding: (b) => interaction.flyToBuilding(b),
  setPixelHeight,
  getPixelHeight,
  statsGetter: () => ({
    fps, drawCalls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    ...town.stats(), pixelScale,
    trainX: getTrainState()?.x ?? null,
    trainParked: getTrainState()?.parked ?? false,
  }),
});

// —— 无限旷野（chunk 流式生成，主城外随便走）——
const infinite = buildInfinite(scene);
infinite._setCam(camera);

// HUD 状态条（季节/天气/天数）注入
ui.setStatusProvider({
  season: () => town.seasons.seasonZh(),
  weather: () => town.weather.modeZh(),
  day: () => townClock.day,
});

// ------------------------------------------------------------
// 主循环
// ------------------------------------------------------------
const clock = new THREE.Clock();
let frames = 0, fpsAcc = 0, fps = 0;
let running = true;

document.addEventListener('visibilitychange', () => {
  running = !document.hidden; // 后台标签暂停（省电；IAB 节流场景友好）
});

function loop() {
  requestAnimationFrame(loop);
  if (!running) return;

  const dt = Math.min(clock.getDelta(), 0.1); // 防切后台回来 dt 爆炸
  const t = clock.elapsedTime;

  townClock.advance(dt);
  tickKeyboardPan(dt);
  // 店内模式不跑 OrbitControls（残留惯性会疯抖），转头由 interaction 自写
  if (!interaction.isInside()) {
    controls.update();
    snapCameraToPixelGrid(); // 像素完美：控制收敛后立刻对齐像素网格
  }

  for (const fn of town.updaters) fn(dt, t);
  interaction.tick(dt);
  ui.tick(dt);
  con.tick(dt);
  infinite.tick(dt, t);

  renderer.render(scene, camera);

  // fps 采样（调试口）
  frames++; fpsAcc += dt;
  if (fpsAcc >= 1) { fps = frames / fpsAcc; frames = 0; fpsAcc = 0; }
}

// ------------------------------------------------------------
// 启动：加载过场 → 揭幕
// ------------------------------------------------------------
ui.playBoot(() => {
  ui.dismissBoot();
});

loop();

// ------------------------------------------------------------
// 调试口（自检脚本用）
// ------------------------------------------------------------
window.__TOWN__ = {
  clock: townClock,
  camera, controls, renderer, scene,
  weather: town.weather,
  seasons: town.seasons,
  story: town.story,
  game: town.game,
  daynight: town.daynight,
  sky: town.sky,
  fireworks: town.fireworks,
  infinite,
  interaction,
  console: con,
  stats: () => ({
    ...town.stats(),
    drawCalls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    fps,
    pixelScale,
    canvasSize: [renderer.domElement.width, renderer.domElement.height],
    time: townClock.hhmm(),
    day: townClock.day,
    season: townClock.season,
    weather: town.weather.mode(),
    trainX: getTrainState()?.x ?? null,
    trainParked: getTrainState()?.parked ?? null,
  }),
  resetView: () => interaction.resetView(),
  flyTo: (x, y, z, tx, ty, tz) => interaction.flyTo(
    new THREE.Vector3(x, y, z), new THREE.Vector3(tx ?? 0, ty ?? 4, tz ?? -2)),
};
