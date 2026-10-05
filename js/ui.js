// ============================================================
// ui.js — 界面：HUD（标题/时钟/提示）/ 建筑名牌 / 加载过场 / 重置按钮
// ------------------------------------------------------------
// 全部 DOM 实现，样式在 css/style.css。加载过场为像素块拼合动画：
// 8×5 网格方块随机顺序亮起 → 全亮后揭幕。
// ============================================================
import { townClock } from './clock.js';
import { getBuildings } from './layout.js';

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
  };
}
