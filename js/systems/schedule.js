// ============================================================
// systems/schedule.js — 灯光作息与调度
// ------------------------------------------------------------
// · 窗灯明灭：每扇窗独立状态机（亮 20~60s / 灭 2~8s，像有人在家）
// · 信标：水塔障碍灯等方波闪烁
// · 道口：火车接近时红灯快闪 + 栏杆放下（vehicles 调 notifyTrainNear）
// 整点报时在 traffic.js（跨系统事件归它管）。
// ============================================================
import * as THREE from 'three';
import { vox } from '../voxel.js';

// —— 模块级登记表（builders 建模期写入，tick 闭包消费）——
const beacons = [];      // { entry, period }
const crossings = [];    // { redA, grnA, barrierPivot }
let trainNear = false;
let _daynight = null;    // world 建好 daynight 后注入（窗灯昼灭夜亮联动）

export function registerBeacon(b) { beacons.push(b); }
export function registerCrossing(c) { crossings.push(c); }
export function notifyTrainNear(near) { trainNear = near; }
export function bindDaynight(d) { _daynight = d; }

const _c = new THREE.Color();

export function buildScheduleSystem(scene) {
  // 窗灯状态（延迟到首帧 snapshot：vox.build 之后 windowRefs 才回填）
  let windows = null;
  function ensureWindows() {
    if (!windows) {
      windows = vox.windowRefs.map(w => ({
        entry: w,
        on: true,
        applied: -1,   // 上次写入的亮度（值不变不重写 buffer）
        nextAt: 3 + Math.random() * 50,
      }));
    }
  }

  function setWindowColor(entry, k) {
    if (!entry.mesh) return;
    _c.setScalar(k);
    entry.mesh.setColorAt(entry.index, _c);
    entry.mesh.instanceColor.needsUpdate = true;
  }

  /** 值变化才写（避免每帧全量 instanceColor 上传） */
  function applyWindowColor(w, k) {
    if (Math.abs(w.applied - k) < 0.01) return;
    w.applied = k;
    setWindowColor(w.entry, k);
  }

  function tick(dt, t) {
    ensureWindows();

    // —— 窗灯作息 ——
    // 白天（_daynight 注入后）：整楼熄灯；夜里：亮久灭短的作息节奏
    const nightK = _daynight ? _daynight.nightLevel() : 1;
    for (const w of windows) {
      w.nextAt -= dt;
      if (w.nextAt <= 0) {
        w.on = !w.on;
        // 亮得久、灭得短：像屋里人偶尔关灯睡觉
        w.nextAt = w.on ? 20 + Math.random() * 42 : 2 + Math.random() * 7;
      }
      // 昼夜调制：白天目标灭，夜里按作息（值变化才写 buffer）
      const targetOn = w.on && nightK > 0.45;
      // 亮窗的微弱呼吸（限频，白天不呼吸）
      const breath = targetOn && (t * 2 + w.entry.phase) % 3 < 0.06
        ? 0.92 + 0.08 * Math.sin(t * 2 + w.entry.phase)
        : null;
      applyWindowColor(w, breath ?? (targetOn ? 1 : 0.06));
    }

    // —— 信标缓变闪烁（正弦，不做满幅方波——低分辨率下方波跳变扎眼）——
    for (const b of beacons) {
      const s = 0.5 + 0.5 * Math.sin(t * (Math.PI * 2 / b.period) + 1.2);
      setWindowColor(b.entry, 0.15 + 0.85 * s);
    }

    // —— 道口联动 ——
    for (const cr of crossings) {
      if (trainNear) {
        // 红灯交替快闪（每 0.4s 换相）
        const ph = Math.floor(t / 0.4) % 2 === 0;
        setWindowColor(cr.redA, ph ? 1 : 0.05);
        setWindowColor(cr.grnA, 0.03);
        // 栏杆放下
        cr.barrierPivot.rotation.z = THREE.MathUtils.lerp(cr.barrierPivot.rotation.z, 0, dt * 2.2);
      } else {
        setWindowColor(cr.redA, 0.05);
        setWindowColor(cr.grnA, 0.85);
        cr.barrierPivot.rotation.z = THREE.MathUtils.lerp(cr.barrierPivot.rotation.z, 1.25, dt * 1.6);
      }
    }
  }

  return { tick };
}
