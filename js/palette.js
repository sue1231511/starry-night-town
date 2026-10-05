// ============================================================
// palette.js — 星夜像素小镇 · 全局调色板与材质工厂
// ------------------------------------------------------------
// 规则：全场景只允许从这里取颜色/材质，保证限色统一（设计说明 §1.2）。
// 材质全部缓存复用；发光（窗/灯）与漫反射分桶，供 voxel.js 分桶合批。
// ============================================================
import * as THREE from 'three';

export const PAL = {
  // —— 夜空 ——
  skyTop:    '#0b1026', // 天顶深蓝
  skyMid:    '#16204a', // 天空中层
  skyLow:    '#2b3a67', // 地平线附近微亮
  star:      '#e8f0ff', // 星点冷白
  starWarm:  '#ffd88a', // 少量暖色亮星
  moon:      '#f4f7ff', // 月盘
  moonGlow:  '#aabaff', // 月晕

  // —— 建筑墙面 ——
  wallCream:  '#d8c8b0', // 奶油墙
  wallBrick:  '#b5766a', // 砖红墙
  wallWood:   '#6f4a3a', // 深木墙
  wallPlum:   '#4a3b5f', // 灰紫墙
  wallSlate:  '#8a8fa8', // 青灰墙（公共建筑）

  // —— 屋顶 ——
  roofRed:    '#7a3b4f', // 暗红屋顶
  roofBlue:   '#3b4a7a', // 暗蓝屋顶
  roofGreen:  '#3f5f4a', // 墨绿屋顶
  roofDark:   '#2f3350', // 深夜色屋顶（阴影重的）

  // —— 木作 / 细节 ——
  woodLight:  '#a8845f', // 浅木（栈道、桥板）
  woodMid:    '#7d5f44', // 中木（招牌、栏杆）
  woodDark:   '#4a3826', // 深木（框架、枕木）
  awningRed:  '#c46a5a', // 遮阳篷红条
  awningCream:'#e8dcc8', // 遮阳篷白条
  metal:      '#9aa2b8', // 金属（灯柱、水塔）

  // —— 窗 / 灯（发光桶） ——
  winGlow:    '#ffd88a', // 亮窗暖黄
  winWarm:    '#ffb85c', // 暖橙窗
  lampGlow:   '#ffbe6a', // 路灯光
  bulbRed:    '#ff6a5a', // 道口红/水塔障碍灯
  bulbGreen:  '#7ad4a0', // 道口绿灯

  // —— 地面 ——
  roadLit:    '#5a5f78', // 石板亮面
  roadDark:   '#3f4360', // 石板暗面
  grassA:     '#3f6d5a', // 草地亮
  grassB:     '#35604f', // 草地暗
  dirt:       '#5f4a3a', // 土路/田埂
  fieldWheat: '#b89a5f', // 麦田
  fieldDark:  '#8a7444', // 麦田暗波

  // —— 自然 ——
  treeDeep:   '#2f5d46', // 树冠深
  treeLite:   '#3f7a58', // 树冠浅
  trunk:      '#5a4636', // 树干
  willow:     '#4a7a5f', // 柳树垂条
  bush:       '#37664c', // 灌木
  flowerRed:  '#d46a6a', // 花·红
  flowerYel:  '#e8c86a', // 花·黄
  flowerBlu:  '#7a9ad4', // 花·蓝
  rock:       '#6a7088', // 石头
  rockDark:   '#4a4f66', // 石头暗面

  // —— 水 ——
  waterDeep:  '#2a4a7a', // 河底
  waterFace:  '#3f6daa', // 河面
  waterGlint: '#aad4ff', // 波光高光（发光桶）

  // —— 车辆 / NPC 点缀 ——
  carRed:     '#c46a6a',
  carBlue:    '#6a8ac4',
  carYellow:  '#d4a94a',
  trainBody:  '#8a5a4a', // 车头
  trainWagon: '#9aa2b8', // 车厢
  npcSkin:    '#e8b890',
  clothA:     '#c47a6a',
  clothB:     '#6a8ac4',
  clothC:     '#7aad8a',
  clothD:     '#c4a96a',
  catBlack:   '#2a2c3a',
  catOrange:  '#d4956a', // 麦田橘猫「麦芒」
  catWhite:   '#e8e4da', // 树屋白猫「阁楼」
  catGray:    '#8a8fa8', // 站台灰猫「末班」
  catCalico:  '#e0b48a', // 稻草人肩三花「稻草」（橘底，白斑用 catWhite 叠）
};

// 发光色集合：这些颜色默认走「发光材质桶」（emissive）
export const GLOW_KEYS = new Set([
  'winGlow', 'winWarm', 'lampGlow', 'bulbRed', 'bulbGreen',
  'waterGlint', 'star', 'starWarm', 'moon',
]);

// ------------------------------------------------------------
// 材质工厂（强缓存）
// ------------------------------------------------------------
const lambertCache = new Map();
const glowCache = new Map();

/** 普通漫反射材质（受月光/环境光影响，投影良好）。
 *  DoubleSide：真·进店模式从室内看墙/屋顶时背面不被剔除。 */
export function mat(colorKey) {
  if (!lambertCache.has(colorKey)) {
    lambertCache.set(colorKey, new THREE.MeshLambertMaterial({
      color: PAL[colorKey],
      side: THREE.DoubleSide,
    }));
  }
  return lambertCache.get(colorKey);
}

/** 发光材质：自发光外观 + 轻微参与光照，用于窗/灯/波光 */
export function glowMat(colorKey) {
  if (!glowCache.has(colorKey)) {
    glowCache.set(colorKey, new THREE.MeshBasicMaterial({
      color: PAL[colorKey],
    }));
  }
  return glowCache.get(colorKey);
}

// ------------------------------------------------------------
// 季节重着色（seasons.js 消费）
// 直接改缓存材质的颜色：同色键的所有方块一起变（草/树/麦田换季）。
// 只作用于 lambert 漫反射桶，发光桶（窗/灯）不受季节影响。
// ------------------------------------------------------------
export function retintLambert(colorKey, hexColor) {
  const m = lambertCache.get(colorKey);
  if (m) m.color.set(hexColor);
}
export function getLambertColor(colorKey) {
  const m = lambertCache.get(colorKey);
  return m ? m.color : null;
}

/** 按颜色 key 取材质：发光色自动走发光桶 */
export function matFor(colorKey) {
  return GLOW_KEYS.has(colorKey) ? glowMat(colorKey) : mat(colorKey);
}

/** 加色混合的假光斑材质（路灯月晕等 billboard 用） */
const spriteCache = new Map();
export function glowSpriteMat(colorKey, opacity = 0.5) {
  const k = colorKey + '|' + opacity;
  if (!spriteCache.has(k)) {
    spriteCache.set(k, new THREE.SpriteMaterial({
      color: PAL[colorKey],
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
  }
  return spriteCache.get(k);
}

// 常用十六进制（供 shader / 顶点色等非材质场景直接取值）
export function hex(colorKey) {
  return PAL[colorKey];
}
export function hexNum(colorKey) {
  return parseInt(PAL[colorKey].slice(1), 16);
}
