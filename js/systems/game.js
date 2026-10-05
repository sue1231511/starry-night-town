// ============================================================
// systems/game.js — 游戏层状态中枢：许愿星 / 猫咪图鉴 / 星光等级 / 存档
// ------------------------------------------------------------
// · 12 颗许愿星（builders/stars.js 摆放，单击收集）
// · 8 只猫（4 只镇猫 + 4 只隐藏猫，单击登记图鉴）
// · 星光值 = 星 + 猫，等级 1~5，升级解锁全镇奖励
// · 进度存 localStorage（下次打开不清零）
// · 整点报时钟声也挂这里（sky/traffic 只管视觉）
// ============================================================
import { townClock } from '../clock.js';
import { sfx } from './sound.js';

const SAVE_KEY = 'starville-game-v1';

// —— 星光等级：达到该分值升级 ——
export const LEVELS = [
  { level: 1, at: 0,  name: '过路的旅人' },
  { level: 2, at: 3,  name: '点灯人',     reward: '金辉烟花 · 夜空多了金色的花' },
  { level: 3, at: 7,  name: '寻星者',     reward: '猫巡游 · 三只小猫加入广场巡逻' },
  { level: 4, at: 12, name: '守夜人',     reward: '流星之夜 · 流星来得更勤了' },
  { level: 5, at: 16, name: '摘星人',     reward: '星之大礼 · 集满后的谢礼' },
];
const MAX_SCORE = 20; // 12 星 + 8 猫

// —— 8 只猫（4 镇猫由 npc.js 摆，4 隐藏猫由 hiddenCats.js 摆）——
export const CATS = [
  { id: 'plaza',    name: '布丁', where: '广场喷泉边打盹',        hint: '水声最大的地方，有一坨黑的。', hidden: false },
  { id: 'dock',     name: '鱼干', where: '南岸码头守鱼',           hint: '它守的不是船，是水里游的东西。', hidden: false },
  { id: 'camp',     name: '火星', where: '北坡篝火旁烤火',         hint: '最暖和的那圈石头边上。', hidden: false },
  { id: 'roof',     name: '月亮', where: '星子旅馆屋脊看星星',     hint: '它不归旅店老板管，它归月亮管。', hidden: false },
  { id: 'wheat',    name: '麦芒', where: '？？？',                 hint: '北坡的麦浪里，有一穗会动。', hidden: true },
  { id: 'loft',     name: '阁楼', where: '？？？',                 hint: '树屋的房客说楼上还有位住客。', hidden: true },
  { id: 'lasttrain', name: '末班', where: '？？？',                hint: '末班车走了以后，长椅下面还坐着谁。', hidden: true },
  { id: 'scarecrow', name: '稻草', where: '？？？',                hint: '稻草人整晚站着不累吗？有人替它站了一会儿。', hidden: true },
];

// —— 12 颗许愿星（builders/stars.js 按坐标摆放；hint 是图鉴线索诗）——
export const STARS = [
  { id: 'stone8',  name: '第八块踏石', hint: '河心的踏石只数到七——第八块短了半截，它去月亮那里了。' },
  { id: 'arch',    name: '桥洞回声',   hint: '主街拱桥的桥洞里住着回声，回声枕着一颗星睡觉。' },
  { id: 'tower',   name: '不走时星',   hint: '全镇最守时的房子，头顶别着一枚不走的星。' },
  { id: 'wheel',   name: '轮辐之间',   hint: '水车转了一整夜，星光卡在轮辐之间。' },
  { id: 'treehse', name: '绳梯第三级', hint: '树屋的绳梯一共五级，有颗星挂在第三级边上。' },
  { id: 'mill',    name: '磨风的星',   hint: '风车把风磨成粉，偶尔也磨出一颗卡在叶片上的星。' },
  { id: 'pavilion', name: '看星星的星', hint: '观星的人都在看天上，只有一颗星在看他们。' },
  { id: 'dock',    name: '水下的星',   hint: '码头的猫一直盯着栈桥尽头——原来那里也有一颗星在发光。' },
  { id: 'orchard', name: '没熟的星',   hint: '果园最北那排的树冠里，藏着一颗没熟透的星。' },
  { id: 'camp',    name: '变了一半',   hint: '守夜人说火星会变成星星——有一颗已经变了一半。' },
  { id: 'watertwr', name: '加班的星',  hint: '水塔顶的红灯旁边，还有一颗不闪的星在加班。' },
  { id: 'station', name: '忘带走的',   hint: '末班车走了以后，站台长椅上总留着一点亮，像谁忘了带走。' },
];

// ------------------------------------------------------------
// 存档
// ------------------------------------------------------------
function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || typeof d !== 'object') return null;
    return {
      stars: Array.isArray(d.stars) ? d.stars : [],
      cats: Array.isArray(d.cats) ? d.cats : [],
    };
  } catch { return null; }
}

export function buildGame({ fireworks, sky, spawnParadeCats } = {}) {
  const save = loadSave() || { stars: [], cats: [] };
  const starsFound = new Set(save.stars);
  const catsFound = new Set(save.cats);

  const listeners = { star: [], cat: [], level: [] };
  const levelCallbacks = []; // 升级奖励钩子（world 注册）

  function score() { return starsFound.size + catsFound.size; }
  function levelFor(s) {
    let lv = LEVELS[0];
    for (const l of LEVELS) if (s >= l.at) lv = l;
    return lv;
  }
  let level = levelFor(score());

  function persist() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        stars: [...starsFound], cats: [...catsFound],
      }));
    } catch { /* 隐私模式忽略 */ }
  }

  let finaleDone = score() >= MAX_SCORE;

  /** 升级检查（收集后调） */
  function checkLevel() {
    const lv = levelFor(score());
    if (lv.level > level.level) {
      const from = level;
      level = lv;
      sfx.levelUp();
      applyReward(lv);
      for (const fn of levelCallbacks) fn(lv, from);
      for (const fn of listeners.level) fn(lv);
    }
    // 全收集终章（12 星 + 8 猫 = 20 分）：一次性大礼
    if (score() >= MAX_SCORE && !finaleDone) {
      finaleDone = true;
      sfx.finale();
      if (fireworks) fireworks.show(0, -4, 10);
      for (const fn of listeners.level) fn({ level: 6, name: '星夜守望者', reward: '12 颗星 + 8 只猫全部点亮——小镇把今晚所有的烟花都送给你。' });
    }
  }

  // —— 升级奖励（world 注入的句柄在这里兑现）——
  function applyReward(lv) {
    if (lv.level === 2 && fireworks && fireworks.setGolden) fireworks.setGolden(true);
    if (lv.level === 3 && spawnParadeCats) spawnParadeCats();
    if (lv.level === 4 && sky && sky.setMeteorRate) sky.setMeteorRate(0.3);
    if (lv.level === 5 && fireworks) fireworks.show(0, -4, 8);
  }

  // ------------------------------------------------------------
  // 公开操作
  // ------------------------------------------------------------
  function collectStar(id, screenXY) {
    if (starsFound.has(id)) return false;
    starsFound.add(id);
    persist();
    sfx.pickStar();
    for (const fn of listeners.star) fn(id, screenXY);
    checkLevel();
    return true;
  }

  function petCat(id) {
    const isNew = !catsFound.has(id);
    if (isNew) {
      catsFound.add(id);
      persist();
      const c = CATS.find(c => c.id === id);
      if (c) setTimeout(() => sfx.catFound(), 220); // 喵完再给登记音
      for (const fn of listeners.cat) fn(id);
      checkLevel();
    } else {
      sfx.meow();
    }
    return isNew;
  }

  // —— 整点钟声（视觉报时在 traffic.js，声音在这）——
  let lastChimeHour = -1;

  function tick() {
    const h = townClock.hourFloat();
    const hh = Math.floor(h);
    if (hh !== lastChimeHour) {
      lastChimeHour = hh;
      sfx.chime(hh);
    }
  }

  // —— 查询接口（图鉴 / HUD 用）——
  function starList() {
    return STARS.map(s => ({ ...s, found: starsFound.has(s.id) }));
  }
  function catList() {
    return CATS.map(c => ({ ...c, found: catsFound.has(c.id) }));
  }
  function progress() {
    return {
      stars: starsFound.size, starsTotal: STARS.length,
      cats: catsFound.size, catsTotal: CATS.length,
      score: score(), maxScore: MAX_SCORE,
      level: level.level, levelName: level.name,
      nextAt: LEVELS.find(l => l.at > score())?.at ?? null,
      levels: LEVELS.map(l => ({ ...l, unlocked: score() >= l.at })),
    };
  }

  /** 重置全部进度（控制台按钮） */
  function resetAll() {
    starsFound.clear();
    catsFound.clear();
    level = LEVELS[0];
    persist();
    for (const fn of listeners.star) fn(null);
    for (const fn of listeners.cat) fn(null);
    for (const fn of listeners.level) fn(LEVELS[0]);
  }

  return {
    tick, collectStar, petCat, resetAll,
    starList, catList, progress,
    hasStar: (id) => starsFound.has(id),
    hasCat: (id) => catsFound.has(id),
    on: (ev, fn) => { if (listeners[ev]) listeners[ev].push(fn); },
    onLevelReward: (fn) => levelCallbacks.push(fn),
    // 重开档时把已解锁奖励一次性补发（读档路径）
    reapplyRewards() {
      if (level.level >= 2 && fireworks && fireworks.setGolden) fireworks.setGolden(true);
      if (level.level >= 4 && sky && sky.setMeteorRate) sky.setMeteorRate(0.3);
      // 猫巡游不补发（读档时世界刚建好，由 applyLevel 补也行——简单起见升级瞬间才有）
    },
  };
}
