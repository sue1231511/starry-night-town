// ============================================================
// systems/daynight.js — 昼夜循环
// ------------------------------------------------------------
// 按 townClock 的小时在关键帧之间插值：
// 天空三色 / 太阳光(颜色·强度·位置·阴影) / 环境光 / 星星淡入淡出 /
// 太阳月亮升落 / 雾色雾距 / 窗灯路灯开关 / 广场点光。
// 白天调色为像素风天蓝系（不追写实），夜里沿用星夜深蓝。
// ============================================================
import * as THREE from 'three';
import { townClock } from '../clock.js';

// —— 颜色 util ——
const C = (hex) => new THREE.Color(hex);

// 关键帧（h=小时，其余为该时刻的世界状态）
// night: 星夜深蓝 / day: 像素白天天蓝 / dawn & dusk: 金色过渡
const KF = [
  { h: 0.0,  night: 1.0, skyTop: '#0b1026', skyMid: '#16204a', skyLow: '#2b3a67',
    sunI: 0.0, sunC: '#e8f0ff', hemiI: 0.62, fog: '#16204a', fogN: 150, fogF: 420, stars: 1.0 },
  { h: 4.5,  night: 1.0, skyTop: '#0b1026', skyMid: '#16204a', skyLow: '#2b3a67',
    sunI: 0.0, sunC: '#e8f0ff', hemiI: 0.60, fog: '#16204a', fogN: 150, fogF: 420, stars: 1.0 },
  { h: 6.0,  night: 0.6, skyTop: '#1a2a55', skyMid: '#3a4a7a', skyLow: '#c4885a',
    sunI: 0.35, sunC: '#ffb87a', hemiI: 0.68, fog: '#5a5a78', fogN: 150, fogF: 440, stars: 0.35 },
  { h: 7.5,  night: 0.0, skyTop: '#3a6aa8', skyMid: '#6a9ad0', skyLow: '#a8c8e8',
    sunI: 1.15, sunC: '#ffe8c0', hemiI: 0.92, fog: '#8aa8c8', fogN: 220, fogF: 560, stars: 0.0 },
  { h: 11.0, night: 0.0, skyTop: '#4a7ab8', skyMid: '#7aa8d8', skyLow: '#b8d8ee',
    sunI: 1.25, sunC: '#fff2d8', hemiI: 0.98, fog: '#a0bcd8', fogN: 260, fogF: 640, stars: 0.0 },
  { h: 16.5, night: 0.0, skyTop: '#3a6aa8', skyMid: '#7aa0cc', skyLow: '#c8b898',
    sunI: 1.1, sunC: '#ffe0b0', hemiI: 0.9, fog: '#9aabc0', fogN: 240, fogF: 600, stars: 0.0 },
  { h: 19.0, night: 0.5, skyTop: '#20244a', skyMid: '#4a3f66', skyLow: '#c88a5a',
    sunI: 0.4, sunC: '#ffb070', hemiI: 0.7, fog: '#5a4a68', fogN: 160, fogF: 460, stars: 0.4 },
  { h: 20.5, night: 1.0, skyTop: '#0b1026', skyMid: '#16204a', skyLow: '#2b3a67',
    sunI: 0.0, sunC: '#e8f0ff', hemiI: 0.62, fog: '#16204a', fogN: 150, fogF: 420, stars: 1.0 },
  { h: 24.0, night: 1.0, skyTop: '#0b1026', skyMid: '#16204a', skyLow: '#2b3a67',
    sunI: 0.0, sunC: '#e8f0ff', hemiI: 0.62, fog: '#16204a', fogN: 150, fogF: 420, stars: 1.0 },
];

const _cA = new THREE.Color(), _cB = new THREE.Color(), _cOut = new THREE.Color();
function lerpHex(a, b, t) {
  _cA.set(a); _cB.set(b);
  return _cOut.copy(_cA).lerp(_cB, t);
}

/** 两关键帧插值出一个完整状态 */
function sampleKF(h) {
  let i = 0;
  while (i < KF.length - 2 && h > KF[i + 1].h) i++;
  const a = KF[i], b = KF[i + 1];
  const t = THREE.MathUtils.clamp((h - a.h) / Math.max(0.001, b.h - a.h), 0, 1);
  return {
    night: THREE.MathUtils.lerp(a.night, b.night, t),
    sunI: THREE.MathUtils.lerp(a.sunI, b.sunI, t),
    hemiI: THREE.MathUtils.lerp(a.hemiI, b.hemiI, t),
    stars: THREE.MathUtils.lerp(a.stars, b.stars, t),
    fogN: THREE.MathUtils.lerp(a.fogN, b.fogN, t),
    fogF: THREE.MathUtils.lerp(a.fogF, b.fogF, t),
    skyTop: lerpHex(a.skyTop, b.skyTop, t).clone(),
    skyMid: lerpHex(a.skyMid, b.skyMid, t).clone(),
    skyLow: lerpHex(a.skyLow, b.skyLow, t).clone(),
    sunC: lerpHex(a.sunC, b.sunC, t).clone(),
    fogC: lerpHex(a.fog, b.fog, t).clone(),
  };
}

/**
 * @param env 世界引用集合：
 *  sun(平行光) hemi(半球光) plazaLight skyMats[穹顶] starMats[星层]
 *  moonGroup(月亮+晕) sunDisc(太阳盘) clouds[] scene(雾挂在 scene.fog)
 *  lampSprites[]（路灯假光斑）
 */
export function buildDaynight(env) {
  const { sun, hemi, plazaLight, skyMats, starMats, moonGroup, sunDisc, clouds, scene, lampSprites } = env;
  const fog = scene.fog;

  // 平滑器：突变状态（路灯开关）加 0.5s 过渡
  let lampK = 1; // 1=夜(亮) 0=昼(灭)

  function tick(dt, t) {
    const h = townClock.hourFloat();
    const s = sampleKF(h);

    // —— 天空穹顶 ——
    for (const m of skyMats) {
      m.uniforms.cTop.value.copy(s.skyTop);
      m.uniforms.cMid.value.copy(s.skyMid);
      m.uniforms.cLow.value.copy(s.skyLow);
    }

    // —— 星星淡入淡出 ——
    for (const m of starMats) m.uniforms.uFade.value = s.stars;

    // —— 太阳轨迹（6~18 点东升西落）——
    const dayT = THREE.MathUtils.clamp((h - 6) / 12, 0, 1); // 0 日出 → 1 日落
    const sunAng = Math.PI * (1 - dayT); // 东(0)→天顶→西(π)
    const sunX = Math.cos(sunAng) * 120; // 东 = +x
    const sunY = Math.sin(sunAng) * 100 + 4;
    if (dayT > 0.02 && dayT < 0.98) {
      sunDisc.visible = true;
      sunDisc.position.set(sunX, sunY, -60);
      sunDisc.lookAt(0, 8, 0);
    } else {
      sunDisc.visible = false;
    }

    // —— 光源：白天跟太阳走（南天，符合北半球；朝南的门窗被照亮），夜里换月光位 ——
    if (s.night < 0.5) {
      sun.position.set(sunX * 0.7, Math.max(sunY, 22), 45);
    } else {
      sun.position.set(-38, 60, -30); // 月光位（原设计）
    }
    sun.intensity = Math.max(0.06, s.sunI); // 夜里保留极弱冷光避免死黑
    sun.color.copy(s.sunC);
    hemi.intensity = s.hemiI;
    hemi.color.copy(s.skyLow);      // 天光颜色跟天空走
    hemi.groundColor.copy(s.fogC);

    // —— 月亮 / 太阳盘透明度 ——
    moonGroup.visible = s.night > 0.15;
    if (moonGroup.visible) {
      const k = Math.min(1, s.night * 1.6);
      moonGroup.children.forEach(ch => { ch.material.opacity = k; ch.material.transparent = true; });
    }

    // —— 云：白天白亮，夜里暗 ——
    for (const c of clouds) {
      c.g.traverse(o => {
        if (o.material) {
          o.material.color.copy(s.night > 0.5 ? s.skyLow : s.skyMid).lerp(_cA.set('#ffffff'), 1 - s.night * 0.7);
        }
      });
    }

    // —— 雾 ——
    fog.color.copy(s.fogC);
    fog.near = s.fogN;
    fog.far = s.fogF;

    // —— 路灯假光斑：夜亮昼灭（0.6s 平滑）——
    const lampTarget = s.night > 0.4 ? 1 : 0;
    lampK += (lampTarget - lampK) * Math.min(1, dt * 3);
    for (const sp of lampSprites) sp.visible = lampK > 0.05;

    // —— 广场点光：夜里暖光，白天关闭 ——
    plazaLight.intensity = 26 * Math.max(0, s.night - 0.25) / 0.75;
  }

  return {
    tick,
    /** 夜晚程度 0~1（schedule 窗灯、story 剧情用） */
    nightLevel() { return sampleKF(townClock.hourFloat()).night; },
    isNight() { return sampleKF(townClock.hourFloat()).night > 0.5; },
  };
}
