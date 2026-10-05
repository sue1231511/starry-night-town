// ============================================================
// systems/weather.js — 天气系统
// ------------------------------------------------------------
// 模式：clear 晴 / cloudy 多云 / rain 雨 / snow 雪 / fog 大雾
// · 自动轮换（90~180s，按季节加权：冬偏雪、夏偏雨）
// · 控制台可手动指定；剧情系统也可触发（如流星雨强制晴天）
// · 雨=细条粒子快速下落；雪=白点慢落摆动；雾=雾距收缩；雨雪云层加厚
// 注意 tick 必须排在 daynight 之后（在其雾/天空基础上做覆盖）。
// ============================================================
import * as THREE from 'three';
import { WORLD, makeRng } from '../layout.js';
import { townClock } from '../clock.js';
import { hexNum } from '../palette.js';

export const WEATHERS = ['clear', 'cloudy', 'rain', 'snow', 'fog'];
export const WEATHER_ZH = { clear: '晴', cloudy: '多云', rain: '雨', snow: '雪', fog: '雾' };

// 季节 × 天气权重
const WEIGHTS = {
  spring: { clear: 4, cloudy: 3, rain: 3, snow: 0.3, fog: 1.5 },
  summer: { clear: 6, cloudy: 2, rain: 3, snow: 0,   fog: 0.6 },
  autumn: { clear: 4, cloudy: 3, rain: 2, snow: 0.6, fog: 2.5 },
  winter: { clear: 3, cloudy: 2.5, rain: 0.6, snow: 4.5, fog: 2 },
};

// 天气对雾距/天空亮度/云的影响系数（雾只在「雾」天变浓，其余保持开阔）
const FX = {
  clear:  { fogK: 1.0,  skyK: 1.0,  cloud: 0.45 },
  cloudy: { fogK: 1.0,  skyK: 0.88, cloud: 1.0 },
  rain:   { fogK: 0.85, skyK: 0.62, cloud: 1.35 },
  snow:   { fogK: 0.88, skyK: 0.8,  cloud: 1.2 },
  fog:    { fogK: 0.38, skyK: 0.75, cloud: 0.8 },
};

export function buildWeather({ onWeatherChange, daynightEnv } = {}) {
  const rng = makeRng(777001);
  let mode = 'clear';
  let fx = { ...FX.clear };
  let autoTimer = 100 + rng() * 80; // 秒后第一次换天气
  let manual = false;

  // —— 雨粒子池 ——
  const RAIN_N = 220;
  const rainGeo = new THREE.BoxGeometry(0.12, 1.4, 0.12);
  const rainMat = new THREE.MeshBasicMaterial({ color: 0x9ab8d8, transparent: true, opacity: 0.55 });
  const rain = new THREE.InstancedMesh(rainGeo, rainMat, RAIN_N);
  rain.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  rain.visible = false;
  daynightEnv.scene.add(rain);
  const drops = [];
  for (let i = 0; i < RAIN_N; i++) {
    drops.push({
      x: (rng() - 0.5) * 2 * (WORLD.HALF + 6), y: rng() * 30, z: (rng() - 0.5) * 2 * (WORLD.HALF + 6),
      v: 24 + rng() * 10,
    });
  }

  // —— 雪粒子池 ——
  const SNOW_N = 150;
  const snowGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
  const snowMat = new THREE.MeshBasicMaterial({ color: 0xe8f0fa, transparent: true, opacity: 0.9 });
  const snow = new THREE.InstancedMesh(snowGeo, snowMat, SNOW_N);
  snow.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  snow.visible = false;
  daynightEnv.scene.add(snow);
  const flakes = [];
  for (let i = 0; i < SNOW_N; i++) {
    flakes.push({
      x: (rng() - 0.5) * 2 * (WORLD.HALF + 6), y: rng() * 26, z: (rng() - 0.5) * 2 * (WORLD.HALF + 6),
      v: 1.0 + rng() * 1.0, sway: rng() * Math.PI * 2, sw: 0.4 + rng() * 0.8,
    });
  }

  const _m = new THREE.Matrix4();
  const _q = new THREE.Quaternion();
  const _p = new THREE.Vector3();
  const _s = new THREE.Vector3(1, 1, 1);

  function setMode(next, { silent = false } = {}) {
    if (!WEATHERS.includes(next) || next === mode) return;
    mode = next;
    fx = { ...FX[mode] };
    rain.visible = mode === 'rain';
    snow.visible = mode === 'snow';
    autoTimer = 90 + rng() * 90;
    if (onWeatherChange && !silent) onWeatherChange(mode);
  }

  function tick(dt, t) {
    // —— 自动轮换（未手动锁定时）——
    if (!manual) {
      autoTimer -= dt;
      if (autoTimer <= 0) {
        const w = WEIGHTS[townClock.season] || WEIGHTS.summer;
        const entries = WEATHERS.filter(k => (w[k] || 0) > 0).map(k => [k, w[k]]);
        let total = entries.reduce((a, [k, p]) => a + p, 0);
        let roll = rng() * total;
        for (const [k, p] of entries) {
          roll -= p;
          if (roll <= 0) { setMode(k); break; }
        }
      }
    }

    // —— 覆盖 daynight 的天空/雾（此系统在其后 tick）——
    const fog = daynightEnv.scene.fog;
    if (fog) {
      fog.near *= fx.fogK;
      fog.far *= fx.fogK;
    }
    for (const m of daynightEnv.skyMats) {
      m.uniforms.cTop.value.multiplyScalar(fx.skyK);
      m.uniforms.cMid.value.multiplyScalar(fx.skyK);
      m.uniforms.cLow.value.multiplyScalar(fx.skyK);
    }
    // 云：加厚/提亮
    for (const c of daynightEnv.clouds) {
      c.g.scale.setScalar(1);
      c.g.traverse(o => {
        if (o.material) o.material.opacity = Math.min(1, o.material.userData.baseOpacity ?? 0.6) * fx.cloud;
      });
    }

    // —— 雨粒子 ——
    if (rain.visible) {
      _q.identity();
      for (let i = 0; i < RAIN_N; i++) {
        const d = drops[i];
        d.y -= d.v * dt;
        d.x += dt * 2.2; // 微风斜落
        if (d.y < 0) {
          d.y = 26 + rng() * 6;
          d.x = (rng() - 0.5) * 2 * (WORLD.HALF + 6);
          d.z = (rng() - 0.5) * 2 * (WORLD.HALF + 6);
        }
        _p.set(d.x, d.y, d.z);
        _m.compose(_p, _q, _s);
        rain.setMatrixAt(i, _m);
      }
      rain.instanceMatrix.needsUpdate = true;
    }

    // —— 雪粒子 ——
    if (snow.visible) {
      _q.identity();
      for (let i = 0; i < SNOW_N; i++) {
        const f = flakes[i];
        f.y -= f.v * dt;
        f.x += Math.sin(t * f.sw + f.sway) * dt * 0.8;
        f.z += Math.cos(t * f.sw * 0.7 + f.sway) * dt * 0.5;
        if (f.y < 0) {
          f.y = 24 + rng() * 6;
          f.x = (rng() - 0.5) * 2 * (WORLD.HALF + 6);
          f.z = (rng() - 0.5) * 2 * (WORLD.HALF + 6);
        }
        _p.set(f.x, f.y, f.z);
        _s.setScalar(0.7 + 0.5 * Math.sin(t * 2 + f.sway)); // 防晕：缓变不快闪
        _m.compose(_p, _q, _s);
        snow.setMatrixAt(i, _m);
      }
      _s.setScalar(1);
      snow.instanceMatrix.needsUpdate = true;
    }
  }

  return {
    tick,
    setMode: (m) => { manual = true; setMode(m); },
    auto: () => { manual = false; },
    mode: () => mode,
    modeZh: () => WEATHER_ZH[mode],
    isManual: () => manual,
  };
}
