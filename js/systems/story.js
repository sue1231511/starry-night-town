// ============================================================
// systems/story.js — 小镇剧情与触发
// ------------------------------------------------------------
// · 夜话：整点/半点推送小镇角色的短语录（toast）
// · 任务链 3 条（时间触发提示 → 双击指定地点完成 → 世界效果）：
//   观星之约（22:00→观星亭→流星雨）
//   面包房的早晨（06:00→麦香房→烟囱加倍）
//   午夜列车（00:30→老站台→…）
// interaction 双击建筑时调 story.visit(name) 推进任务。
// ============================================================
import { townClock } from '../clock.js';
import { boostChimneys } from './effects.js';

// —— 夜话语录（整点轮播）——
const NIGHT_LINES = [
  { who: '守夜人', text: '钟楼顶的灯每整点会眨眼，那是它在报时。' },
  { who: '邮差', text: '今晚的风向东，信会走得慢一点。' },
  { who: '面包师', text: '炉子明早六点生火，隔着两条街都能闻到。' },
  { who: '旅店老板', text: '屋顶那只猫不归我管，它归月亮管。' },
  { who: '守夜人', text: '北坡的篝火不许灭，火星升上去会变成星星。' },
  { who: '邮差', text: '稻草人一晚上转三次身，都在没人看的时候。' },
  { who: '面包师', text: '河对岸的踏石只数到七，第八块是给月亮的。' },
  { who: '旅店老板', text: '末班列车零点半进站，想看就去老站台。' },
];

// —— 任务链定义 ——
const QUESTS = [
  {
    id: 'meteor',
    name: '观星之约',
    hintAt: 22.0,
    hintText: '守夜人：听说今晚有流星雨——去南公园的观星亭等着。',
    target: '观星亭',
    doneText: '一颗、两颗、三颗……流星真的来了。你悄悄许了个愿。',
    effect: 'meteorBurst',
  },
  {
    id: 'bakery',
    name: '面包房的早晨',
    hintAt: 6.0,
    hintText: '面包师：炉子生火了！来广场边的麦香房看看今天的第一炉。',
    target: '麦香房',
    doneText: '窗里透出蜂蜜色的光，新面包的香气穿过屏幕飘了出来。',
    effect: 'chimneyBoost',
  },
  {
    id: 'train',
    name: '午夜列车',
    hintAt: 0.5,
    hintText: '旅店老板：末班列车零点半进站，站台的风里有铁的味道。',
    target: '老站台',
    doneText: '车窗一格格亮着，像一条发光的鱼游进夜里。它今晚也晚安。',
    effect: 'summonTrain',
  },
  {
    id: 'campfire',
    name: '篝火故事',
    hintAt: 20.5,
    hintText: '守夜人：北坡的篝火点起来了，今晚有火星和故事。',
    target: '篝火营地',
    doneText: '火星一颗颗升上去。守夜人说：最亮的那颗，会变成明年的流星。',
    effect: null,
  },
  {
    id: 'mill',
    name: '水车巡礼',
    hintAt: 15.0,
    hintText: '磨坊主：河湾的水车今天转得格外欢，来看看它磨的月光粉。',
    target: '水车磨坊',
    doneText: '水轮把河水和灯光一起扬起来，碎成一片一片的银。',
    effect: null,
  },
  {
    id: 'treehouse',
    name: '树屋的房客',
    hintAt: 17.5,
    hintText: '守夜人：北坡的大树上住着一位不肯下楼的房客，替我去看看？',
    target: '树屋',
    doneText: '绳梯晃了晃。窗里的灯亮着，桌上摆着两杯茶——像是早知道你要来。',
    effect: 'fireworks',
  },
];

// ------------------------------------------------------------
// toast 队列（DOM）
// ------------------------------------------------------------
function makeToasts() {
  const root = document.createElement('div');
  root.className = 'toasts';
  document.getElementById('ui').appendChild(root);
  const queue = [];
  let showing = false;

  function push(who, text, ms = 5200) {
    queue.push({ who, text, ms });
    if (!showing) next();
  }
  function next() {
    const item = queue.shift();
    if (!item) { showing = false; return; }
    showing = true;
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<span class="toast-who"></span><span class="toast-text"></span>`;
    el.querySelector('.toast-who').textContent = item.who;
    el.querySelector('.toast-text').textContent = item.text;
    root.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => { el.remove(); next(); }, 350);
    }, item.ms);
  }
  return { push };
}

// ------------------------------------------------------------
// 剧情系统
// ------------------------------------------------------------
export function buildStory({ sky, daynight, fireworks, summonTrain, onQuestDone } = {}) {
  const toast = makeToasts();

  // 任务状态：pending(等时间) → active(已提示等拜访) → done
  const state = new Map(QUESTS.map(q => [q.id, 'pending']));
  let lineIdx = 0;
  let lastHourAnnounced = -1;

  /** 世界效果钩子 */
  const fx = {
    meteorBurst() { if (sky && sky.burstMeteors) sky.burstMeteors(16, 3.5); },
    chimneyBoost() { boostChimneys(1.8, 40); },
    summonTrain() { if (summonTrain) summonTrain(); },
    fireworks() { if (fireworks) fireworks.show(0, -4, 4); },
  };

  function tick(dt) {
    const h = townClock.hourFloat();

    // —— 夜话：每个整点推一条（白天也推，换个说法）——
    const hourNow = Math.floor(h);
    if (hourNow !== lastHourAnnounced) {
      lastHourAnnounced = hourNow;
      const line = NIGHT_LINES[lineIdx % NIGHT_LINES.length];
      lineIdx++;
      // 任务提示优先级更高：同一小时有任务提示就跳过闲聊
      const questNow = QUESTS.find(q => state.get(q.id) === 'pending' && Math.abs(q.hintAt - h) < 1);
      if (!questNow) {
        setTimeout(() => toast.push(line.who, line.text), 1200);
      }
    }

    // —— 任务触发提示 ——
    for (const q of QUESTS) {
      if (state.get(q.id) !== 'pending') continue;
      // hintAt 时刻过后（含跨天：比如 0.5 的午夜任务）即激活
      const hit = Math.abs(h - q.hintAt) < 1;
      if (hit) {
        state.set(q.id, 'active');
        toast.push('任务 · ' + q.name, q.hintText, 8000);
      }
    }
  }

  /** 双击建筑回调（interaction 调用）：推进任务 */
  function visit(name) {
    for (const q of QUESTS) {
      if (state.get(q.id) === 'active' && q.target === name) {
        state.set(q.id, 'done');
        toast.push('完成 · ' + q.name, q.doneText, 8000);
        if (q.effect && fx[q.effect]) fx[q.effect]();
        if (onQuestDone) onQuestDone(q);
        return q;
      }
    }
    return null;
  }

  function questList() {
    return QUESTS.map(q => ({ ...q, state: state.get(q.id) }));
  }

  return { tick, visit, questList };
}
