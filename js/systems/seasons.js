// ============================================================
// systems/seasons.js — 四季换装
// ------------------------------------------------------------
// 原理：同一色键的全部方块共享缓存材质，直接给材质换色 =
// 草地/树冠/灌木/麦田整体换季（不用重建几何）。
// 换季有 ~2.5s 的颜色过渡；控制台手动切季 / 每 SEASON_DAYS 天自动换。
// 冬季额外触发天气系统偏向降雪（weather 读 season 判断）。
// ============================================================
import * as THREE from 'three';
import { townClock, SEASONS, SEASON_ZH } from '../clock.js';
import { PAL, getLambertColor } from '../palette.js';

// 各季对色键的重着色（没列出的色键保持默认=夏）
const SEASON_TINTS = {
  spring: {
    treeLite: '#6ab86a', treeDeep: '#4a8a5a', bush: '#5a9a6a',
    grassA: '#5aa06a', grassB: '#4a905c', willow: '#7ac47a',
    fieldWheat: '#7aa860', fieldDark: '#5a8a48',
    flowerRed: '#e88ab0', flowerYel: '#f0d070', flowerBlu: '#9ab4e8',
  },
  summer: {}, // 默认调色板即夏
  autumn: {
    treeLite: '#d4884a', treeDeep: '#a86038', bush: '#8a7a3a',
    grassA: '#9a8a4a', grassB: '#847438', willow: '#b09548',
    fieldWheat: '#d4a94a', fieldDark: '#a8843a',
    flowerRed: '#c46a4a', flowerYel: '#c8a050',
  },
  winter: {
    treeLite: '#dfe8f2', treeDeep: '#b0bece', bush: '#c4cfda',
    grassA: '#c8d4e0', grassB: '#a8b8cc', willow: '#c8d4dc',
    fieldWheat: '#9aa2a8', fieldDark: '#7a848c',
    dirt: '#8a8a92', rock: '#8a92a4',
  },
};

// 需要管理的色键全集（春∪秋∪冬出现过的键）
const MANAGED_KEYS = [...new Set(
  Object.values(SEASON_TINTS).flatMap(s => Object.keys(s)),
)];

export function buildSeasons({ onSeasonChange } = {}) {
  let lastSeason = townClock.season;
  // 目标色快照（每键一个 THREE.Color，tick 里向目标 lerp）
  const targets = new Map();   // key -> Color
  let transition = 0;          // >0 表示正在过渡

  function applyTargets(season) {
    const tints = SEASON_TINTS[season] || {};
    for (const key of MANAGED_KEYS) {
      const hexS = tints[key] || PAL[key]; // 没有则回到默认（夏）
      if (!targets.has(key)) targets.set(key, new THREE.Color(hexS));
      else targets.get(key).set(hexS);
    }
    transition = 1;
  }
  applyTargets(lastSeason);
  // 首次直接到位（开场不播过渡）
  for (const [key, c] of targets) {
    const cur = getLambertColor(key);
    if (cur) cur.copy(c);
  }
  transition = 0;

  function tick(dt) {
    // 季节变化检测（clock 自动轮换或控制台手动都会改 townClock.season）
    if (townClock.season !== lastSeason) {
      lastSeason = townClock.season;
      applyTargets(lastSeason);
      if (onSeasonChange) onSeasonChange(lastSeason);
    }
    // 颜色过渡（指数趋近，~2.5s 收敛）
    if (transition > 0) {
      const k = Math.min(1, dt * 1.4);
      let done = true;
      for (const [key, c] of targets) {
        const cur = getLambertColor(key);
        if (!cur) continue;
        cur.lerp(c, k);
        if (Math.abs(cur.r - c.r) + Math.abs(cur.g - c.g) + Math.abs(cur.b - c.b) > 0.01) done = false;
      }
      if (done) transition = 0;
    }
  }

  return {
    tick,
    /** 手动切季（控制台） */
    setSeason(s) {
      townClock.setSeason(s);
    },
    season() { return lastSeason; },
    seasonZh() { return SEASON_ZH[lastSeason] || ''; },
  };
}
