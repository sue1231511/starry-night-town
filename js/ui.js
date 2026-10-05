// ============================================================
// ui.js — 界面：HUD（标题/时钟/提示）/ 建筑名牌 / 加载过场 / 重置按钮
// ------------------------------------------------------------
// 全部 DOM 实现，样式在 css/style.css。加载过场为像素块拼合动画：
// 8×5 网格方块随机顺序亮起 → 全亮后揭幕。
// ============================================================
import { townClock } from './clock.js';
import { getBuildings } from './layout.js';
import * as sound from './systems/sound.js';

export function buildUI({ onReset, onFlyToBuilding }) {
  const root = document.getElementById('ui');

  // —— HUD：标题 + 时钟 + 操作提示 ——
  const hud = document.createElement('div');
  hud.className = 'hud';
  hud.innerHTML = `
    <div class="hud-title">
      <span class="hud-zh">星夜小镇</span>
      <span class="hud-en">STARVILLE</span>
    </div>
    <div class="hud-clock">
      <span class="hud-clock-icon"></span>
      <span id="hud-time">19:00</span>
    </div>
    <div class="hud-hints">
      <span>左键拖拽环视 · 滚轮缩放</span>
      <span>右键拖拽 / WASD / 方向键 移动</span>
      <span>双击建筑进门看故事</span>
      <span>单击拾取星星 · 撸猫</span>
    </div>
  `;
  root.appendChild(hud);
  const timeEl = document.getElementById('hud-time');

  // —— 屏幕方向键（D-pad）：按住移动，松开停 ——
  const dpad = document.createElement('div');
  dpad.className = 'dpad';
  dpad.innerHTML = `
    <span class="dpad-gap"></span>
    <button class="dpad-btn dpad-up" type="button" data-k="w" aria-label="前进">
      <svg viewBox="0 0 12 12" width="12" height="12"><path d="M6 2 L10 9 L2 9 Z" fill="currentColor"/></svg>
    </button>
    <span class="dpad-gap"></span>
    <button class="dpad-btn dpad-left" type="button" data-k="a" aria-label="左移">
      <svg viewBox="0 0 12 12" width="12" height="12"><path d="M2 6 L9 2 L9 10 Z" fill="currentColor"/></svg>
    </button>
    <button class="dpad-btn dpad-down" type="button" data-k="s" aria-label="后退">
      <svg viewBox="0 0 12 12" width="12" height="12"><path d="M6 10 L2 3 L10 3 Z" fill="currentColor"/></svg>
    </button>
    <button class="dpad-btn dpad-right" type="button" data-k="d" aria-label="右移">
      <svg viewBox="0 0 12 12" width="12" height="12"><path d="M10 6 L3 2 L3 10 Z" fill="currentColor"/></svg>
    </button>
  `;
  root.appendChild(dpad);
  // 按住=持续移动：pointerdown 发 keydown，pointerup/leave/cancel 发 keyup
  // （走 main 的键盘监听通道，进店时自动被禁用）
  for (const btn of dpad.querySelectorAll('.dpad-btn')) {
    const k = btn.dataset.k;
    const press = (e) => { e.preventDefault(); btn.classList.add('on'); window.dispatchEvent(new KeyboardEvent('keydown', { key: k })); };
    const release = () => { btn.classList.remove('on'); window.dispatchEvent(new KeyboardEvent('keyup', { key: k })); };
    btn.addEventListener('pointerdown', press);
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointerleave', release);
    btn.addEventListener('pointercancel', release);
    // 阻止触摸长按弹菜单
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // HUD 状态条（第 N 天 · 季节 · 天气），main 注入 provider
  const statusEl = document.createElement('div');
  statusEl.className = 'hud-status';
  statusEl.textContent = '第 1 天 · 夏 · 晴';
  hud.querySelector('.hud-clock').after(statusEl);
  let statusProvider = null;

  // —— 重置视角按钮（手绘 SVG 图标 + 文字）——
  const resetBtn = document.createElement('button');
  resetBtn.className = 'reset-btn';
  resetBtn.type = 'button';
  resetBtn.title = '重置视角';
  resetBtn.innerHTML = `
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path d="M8 3 a5 5 0 1 1 -4.7 3.3" fill="none" stroke="currentColor" stroke-width="2"/>
      <path d="M3 2 v4.5 h4.5" fill="none" stroke="currentColor" stroke-width="2"/>
    </svg>
    <span>重置视角</span>
  `;
  resetBtn.addEventListener('click', onReset);
  root.appendChild(resetBtn);

  // —— 建筑名牌 ——
  const plaque = document.createElement('div');
  plaque.className = 'plaque';
  plaque.innerHTML = `
    <div class="plaque-name"></div>
    <div class="plaque-blurb"></div>
    <div class="plaque-tip">点击空白处收起</div>
  `;
  root.appendChild(plaque);
  const plaqueName = plaque.querySelector('.plaque-name');
  const plaqueBlurb = plaque.querySelector('.plaque-blurb');

  function showPlaque(b) {
    plaqueName.textContent = b.name;
    plaqueBlurb.textContent = b.blurb;
    plaque.classList.add('show');
  }
  function hidePlaque() {
    plaque.classList.remove('show');
  }

  // —— 加载过场：8×5 像素块拼合 ——
  const overlay = document.createElement('div');
  overlay.className = 'boot-overlay';
  const grid = document.createElement('div');
  grid.className = 'boot-grid';
  overlay.appendChild(grid);
  const cells = [];
  const COLS = 8, ROWS = 5;
  for (let i = 0; i < COLS * ROWS; i++) {
    const c = document.createElement('div');
    c.className = 'boot-cell';
    grid.appendChild(c);
    cells.push(c);
  }
  const bootTitle = document.createElement('div');
  bootTitle.className = 'boot-title';
  bootTitle.textContent = 'STARVILLE';
  overlay.appendChild(bootTitle);
  document.body.appendChild(overlay);

  function playBoot(done) {
    // 随机顺序亮块
    const order = cells.map((c, i) => i).sort(() => Math.random() - 0.5);
    const start = performance.now();
    const total = 900;
    let shown = 0;
    function frame() {
      const k = Math.min(1, (performance.now() - start) / total);
      const want = Math.floor(k * order.length);
      while (shown < want) cells[order[shown++]].classList.add('on');
      if (k < 1) requestAnimationFrame(frame);
      else setTimeout(done, 260); // 全亮停顿一拍
    }
    requestAnimationFrame(frame);
  }
  function dismissBoot() {
    overlay.classList.add('done');
    setTimeout(() => overlay.remove(), 700);
  }

  // —— 小镇图鉴（面板列出全部建筑，点击条目飞过去）——
  const guideBtn = document.createElement('button');
  guideBtn.className = 'guide-btn';
  guideBtn.type = 'button';
  guideBtn.title = '小镇图鉴';
  guideBtn.innerHTML = `
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path d="M2 2 h4.5 v4.5 h-4.5 z" fill="currentColor"/>
      <path d="M9.5 2 h4.5 v4.5 h-4.5 z" fill="currentColor" opacity="0.6"/>
      <path d="M2 9.5 h4.5 v4.5 h-4.5 z" fill="currentColor" opacity="0.6"/>
      <path d="M9.5 9.5 h4.5 v4.5 h-4.5 z" fill="currentColor"/>
    </svg>
    <span>小镇图鉴</span>
  `;
  root.appendChild(guideBtn);

  const guide = document.createElement('div');
  guide.className = 'guide';
  guide.innerHTML = `
    <div class="guide-head">
      <span class="guide-title">小镇图鉴</span>
      <button class="guide-close" type="button" title="收起">×</button>
    </div>
    <div class="guide-list"></div>
    <div class="guide-foot">共 <span class="guide-count">0</span> 处 · 点击拜访</div>
  `;
  root.appendChild(guide);
  const guideList = guide.querySelector('.guide-list');
  const guideCount = guide.querySelector('.guide-count');

  function fillGuide() {
    guideList.innerHTML = '';
    // 同名建筑（如民居）合并为一条，飞向第一栋
    const seen = new Set();
    const bs = getBuildings().filter(b => {
      if (seen.has(b.name)) return false;
      seen.add(b.name);
      return true;
    });
    guideCount.textContent = bs.length;
    for (const b of bs) {
      const item = document.createElement('button');
      item.className = 'guide-item';
      item.type = 'button';
      item.innerHTML = `<span class="guide-item-name"></span><span class="guide-item-blurb"></span>`;
      item.querySelector('.guide-item-name').textContent = b.name;
      item.querySelector('.guide-item-blurb').textContent = b.blurb;
      item.addEventListener('click', () => {
        if (onFlyToBuilding) onFlyToBuilding(b);
        showPlaque(b);
        closeGuide();
      });
      guideList.appendChild(item);
    }
  }
  function openGuide() { guide.classList.add('open'); }
  function closeGuide() { guide.classList.remove('open'); }
  guideBtn.addEventListener('click', () => {
    if (!guide.classList.contains('open')) fillGuide();
    guide.classList.toggle('open');
  });
  guide.querySelector('.guide-close').addEventListener('click', closeGuide);

  // ============================================================
  // 游戏层 UI：星光 HUD / 星光图鉴 / 飞星动画 / 成就 toast / 音效开关
  // （图标全部手绘 SVG，禁止 emoji 代替图形）
  // ============================================================
  const SVG_STAR = (cls) => `<svg class="${cls}" viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
    <path d="M10 1.5 L12.4 7.2 L18.5 7.8 L14 11.9 L15.3 18 L10 14.9 L4.7 18 L6 11.9 L1.5 7.8 L7.6 7.2 Z"/>
  </svg>`;
  const SVG_STAR_DIM = `<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" class="dim">
    <path d="M10 1.5 L12.4 7.2 L18.5 7.8 L14 11.9 L15.3 18 L10 14.9 L4.7 18 L6 11.9 L1.5 7.8 L7.6 7.2 Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-dasharray="2.5 2"/>
  </svg>`;
  const SVG_PAW = (cls) => `<svg class="${cls}" viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
    <ellipse cx="10" cy="13" rx="4.4" ry="3.6"/>
    <ellipse cx="4.6" cy="8.6" rx="1.9" ry="2.5" transform="rotate(-18 4.6 8.6)"/>
    <ellipse cx="8.4" cy="5.9" rx="1.9" ry="2.7"/>
    <ellipse cx="11.9" cy="5.9" rx="1.9" ry="2.7"/>
    <ellipse cx="15.5" cy="8.6" rx="1.9" ry="2.5" transform="rotate(18 15.5 8.6)"/>
  </svg>`;
  const SVG_CATFACE = (fill, dim = false) => `<svg viewBox="0 0 20 20" width="22" height="22" aria-hidden="true" ${dim ? 'class="dim"' : ''}>
    <path d="M4 8 L4 2.5 L8.4 5.6" fill="${fill}" stroke="${fill}"/>
    <path d="M16 8 L16 2.5 L11.6 5.6" fill="${fill}" stroke="${fill}"/>
    <rect x="3.5" y="5.5" width="13" height="12" rx="4.5" fill="${fill}"/>
    ${dim ? '' : `<rect x="6.4" y="10" width="1.9" height="2.4" rx="0.8" fill="#ffd88a"/>
    <rect x="11.7" y="10" width="1.9" height="2.4" rx="0.8" fill="#ffd88a"/>
    <rect x="9.2" y="13" width="1.6" height="1.2" rx="0.5" fill="#2a2c3a"/>`}
  </svg>`;

  // —— 星光 HUD（左上，时钟下方）：星 chip + 猫 chip + 音效开关 ——
  const gameHud = document.createElement('div');
  gameHud.className = 'game-hud';
  gameHud.innerHTML = `
    <button class="gh-chip gh-stars" type="button" title="许愿星收集进度">
      ${SVG_STAR('gh-ic')}
      <span class="gh-num">0/12</span>
    </button>
    <button class="gh-chip gh-cats" type="button" title="猫咪图鉴进度">
      ${SVG_PAW('gh-ic')}
      <span class="gh-num">0/8</span>
    </button>
    <button class="gh-chip gh-sound" type="button" title="音效开关" aria-label="音效开关">
      <svg class="gh-ic gh-sound-on" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <path d="M2 6 h2.6 L8.6 2.6 v10.8 L4.6 10 H2 Z" fill="currentColor"/>
        <path d="M10.6 5.4 a3.4 3.4 0 0 1 0 5.2" fill="none" stroke="currentColor" stroke-width="1.4"/>
        <path d="M12.4 3.4 a6 6 0 0 1 0 9.2" fill="none" stroke="currentColor" stroke-width="1.4"/>
      </svg>
      <svg class="gh-ic gh-sound-off" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <path d="M2 6 h2.6 L8.6 2.6 v10.8 L4.6 10 H2 Z" fill="currentColor"/>
        <path d="M10.4 6 L14.4 10 M14.4 6 L10.4 10" stroke="currentColor" stroke-width="1.5"/>
      </svg>
    </button>
  `;
  hud.appendChild(gameHud);
  const starChip = gameHud.querySelector('.gh-stars');
  const catChip = gameHud.querySelector('.gh-cats');
  const soundChip = gameHud.querySelector('.gh-sound');
  const starNum = starChip.querySelector('.gh-num');
  const catNum = catChip.querySelector('.gh-num');

  // —— 星光图鉴面板 ——
  const codex = document.createElement('div');
  codex.className = 'codex';
  codex.innerHTML = `
    <div class="codex-head">
      <span class="codex-title">星光图鉴</span>
      <button class="codex-close" type="button" title="收起">×</button>
    </div>
    <div class="codex-tabs">
      <button class="codex-tab on" data-tab="stars" type="button">许愿星</button>
      <button class="codex-tab" data-tab="cats" type="button">猫咪</button>
      <button class="codex-tab" data-tab="achv" type="button">成就</button>
    </div>
    <div class="codex-body"></div>
    <div class="codex-foot">单击镇上的星星和猫 · 进度自动保存</div>
  `;
  root.appendChild(codex);
  const codexBody = codex.querySelector('.codex-body');
  let codexTab = 'stars';
  let codexGame = null;

  function fillCodex() {
    if (!codexGame) return;
    codexBody.innerHTML = '';
    if (codexTab === 'stars') {
      for (const s of codexGame.starList()) {
        const row = document.createElement('div');
        row.className = 'codex-row' + (s.found ? ' found' : '');
        row.innerHTML = `
          <span class="codex-ic">${s.found ? SVG_STAR('gl') : SVG_STAR_DIM}</span>
          <span class="codex-name"></span>
          <span class="codex-hint"></span>
        `;
        row.querySelector('.codex-name').textContent = s.found ? s.name : '？？？';
        row.querySelector('.codex-hint').textContent = s.found ? '已找到' : s.hint;
        codexBody.appendChild(row);
      }
    } else if (codexTab === 'cats') {
      const CAT_COLORS = { plaza: '#2a2c3a', dock: '#2a2c3a', camp: '#2a2c3a', roof: '#2a2c3a',
        wheat: '#d4956a', loft: '#e8e4da', lasttrain: '#8a8fa8', scarecrow: '#e0b48a' };
      for (const c of codexGame.catList()) {
        const row = document.createElement('div');
        row.className = 'codex-row' + (c.found ? ' found' : '');
        row.innerHTML = `
          <span class="codex-ic">${c.found ? SVG_CATFACE(CAT_COLORS[c.id] || '#2a2c3a') : SVG_CATFACE('#4a4f66', true)}</span>
          <span class="codex-name"></span>
          <span class="codex-hint"></span>
        `;
        row.querySelector('.codex-name').textContent = c.found ? c.name : '？？？';
        row.querySelector('.codex-hint').textContent = c.found ? c.where : c.hint;
        codexBody.appendChild(row);
      }
    } else {
      const p = codexGame.progress();
      const bar = document.createElement('div');
      bar.className = 'codex-bar';
      bar.innerHTML = `
        <div class="codex-bar-head">
          <span>星光等级 ${p.level} · ${p.levelName}</span>
          <span>${p.score} / ${p.maxScore}</span>
        </div>
        <div class="codex-bar-track"><div class="codex-bar-fill" style="width:${(p.score / p.maxScore) * 100}%"></div></div>
        ${p.nextAt !== null ? `<div class="codex-bar-next">再得 ${p.nextAt - p.score} 分升级</div>` : `<div class="codex-bar-next">全部点亮，小镇感谢你</div>`}
      `;
      codexBody.appendChild(bar);
      for (const l of p.levels) {
        if (l.level === 1) continue;
        const row = document.createElement('div');
        row.className = 'codex-row' + (l.unlocked ? ' found' : '');
        row.innerHTML = `
          <span class="codex-ic">${l.unlocked ? SVG_STAR('gl') : SVG_STAR_DIM}</span>
          <span class="codex-name">Lv${l.level} ${l.name}</span>
          <span class="codex-hint"></span>
        `;
        row.querySelector('.codex-hint').textContent = l.unlocked ? l.reward : `${l.at} 分解锁 · ${l.reward}`;
        codexBody.appendChild(row);
      }
    }
  }

  function openCodex() {
    codex.classList.add('open');
    fillCodex();
  }
  function closeCodex() { codex.classList.remove('open'); }
  starChip.addEventListener('click', () => { codex.classList.toggle('open'); if (codex.classList.contains('open')) { codexTab = 'stars'; syncTabs(); fillCodex(); } });
  catChip.addEventListener('click', () => { codex.classList.toggle('open'); if (codex.classList.contains('open')) { codexTab = 'cats'; syncTabs(); fillCodex(); } });
  codex.querySelector('.codex-close').addEventListener('click', closeCodex);
  function syncTabs() {
    for (const t of codex.querySelectorAll('.codex-tab')) t.classList.toggle('on', t.dataset.tab === codexTab);
  }
  for (const t of codex.querySelectorAll('.codex-tab')) {
    t.addEventListener('click', () => { codexTab = t.dataset.tab; syncTabs(); fillCodex(); });
  }

  function updateCounters() {
    if (!codexGame) return;
    const p = codexGame.progress();
    starNum.textContent = `${p.stars}/${p.starsTotal}`;
    catNum.textContent = `${p.cats}/${p.catsTotal}`;
    if (codex.classList.contains('open')) fillCodex();
  }

  // —— 收集飞星：DOM 星星从点击处飞向 HUD 星 chip（UI 层动画，不动相机）——
  function flyStarToHud(xy) {
    const r = starChip.getBoundingClientRect();
    if (!r.width) return;
    const el = document.createElement('div');
    el.className = 'fly-star';
    el.innerHTML = SVG_STAR('gl');
    el.style.left = (xy ? xy.x : r.left) + 'px';
    el.style.top = (xy ? xy.y : r.top) + 'px';
    document.body.appendChild(el);
    const dx = r.left + r.width / 2 - (xy ? xy.x : r.left);
    const dy = r.top + r.height / 2 - (xy ? xy.y : r.top);
    requestAnimationFrame(() => {
      el.style.transform = `translate(${dx}px, ${dy}px) scale(0.35)`;
      el.style.opacity = '0.15';
    });
    setTimeout(() => {
      el.remove();
      starChip.classList.remove('pulse');
      void starChip.offsetWidth; // 重启动画
      starChip.classList.add('pulse');
    }, 640);
  }

  // —— 成就 toast（右下角，区别于剧情语录的左下 toasts）——
  function achievementToast(title, text) {
    const el = document.createElement('div');
    el.className = 'ach-toast';
    el.innerHTML = `
      <span class="ach-ic">${SVG_STAR('gl')}</span>
      <div class="ach-body"><div class="ach-title"></div><div class="ach-text"></div></div>
    `;
    el.querySelector('.ach-title').textContent = title;
    el.querySelector('.ach-text').textContent = text;
    root.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 400);
    }, 4600);
  }

  // —— 音效开关 ——
  function syncSound() {
    const muted = sound.isMuted();
    soundChip.classList.toggle('muted', muted);
    soundChip.title = muted ? '音效：关（点我打开）' : '音效：开（点我关掉）';
  }
  soundChip.addEventListener('click', () => {
    sound.setMuted(!sound.isMuted());
    if (!sound.isMuted()) sound.sfx.unlock(); // 打开时给一声反馈
    syncSound();
  });
  syncSound();

  /** 游戏层绑定（main 在 town 建好后调一次） */
  function bindGame(game) {
    codexGame = game;
    updateCounters();
    game.on('star', (id, xy) => {
      updateCounters();
      if (xy) flyStarToHud(xy);
    });
    game.on('cat', (id) => {
      updateCounters();
      if (!id) return;
      const c = game.catList().find(c => c.id === id);
      if (c) {
        achievementToast(`猫咪登记 · ${c.name}`, c.hidden ? `隐藏猫「${c.name}」加入了图鉴 · ${c.where}` : `「${c.name}」加入了图鉴`);
      }
    });
    game.on('level', (lv) => {
      if (lv && lv.level > 1) achievementToast(`星光升级 Lv${lv.level} · ${lv.name}`, lv.reward);
    });
  }

  // —— 每帧刷新时钟/状态（限频 1s）——
  let clockAcc = 0;
  function tick(dt) {
    clockAcc += dt;
    if (clockAcc >= 1) {
      clockAcc = 0;
      timeEl.textContent = townClock.hhmm();
      if (statusProvider) {
        statusEl.textContent = `第 ${statusProvider.day()} 天 · ${statusProvider.season()} · ${statusProvider.weather()}`;
      }
    }
  }

  return {
    tick, showPlaque, hidePlaque, playBoot, dismissBoot,
    setStatusProvider(p) { statusProvider = p; },
    bindGame,
  };
}
