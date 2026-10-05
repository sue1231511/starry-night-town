// ============================================================
// console.js — 小镇控制台（上帝面板）
// ------------------------------------------------------------
// 快捷键 ` 或 C 开关，或左下角按钮。
// 时间滑杆 / 倍速 / 季节 / 天气 / 建筑传送 / 任务列表 / 调试信息。
// ============================================================
import { townClock, SEASONS, SEASON_ZH } from './clock.js';
import { WEATHERS, WEATHER_ZH } from './systems/weather.js';
import { getBuildings } from './layout.js';

export function buildConsolePanel({ clock, seasons, weather, story, sky, fireworks, summonTrain, onFlyToBuilding, setPixelHeight, getPixelHeight, statsGetter }) {
  const root = document.getElementById('ui');

  // —— 开关按钮 ——
  const btn = document.createElement('button');
  btn.className = 'console-btn';
  btn.type = 'button';
  btn.title = '小镇控制台（快捷键 ` 或 C）';
  btn.innerHTML = `
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <rect x="1" y="3" width="14" height="10" fill="none" stroke="currentColor" stroke-width="1.6"/>
      <path d="M4 7 l2.5 2 L4 11" fill="none" stroke="currentColor" stroke-width="1.6"/>
      <path d="M8.5 11 h3.5" stroke="currentColor" stroke-width="1.6"/>
    </svg>
    <span>控制台</span>
  `;
  root.appendChild(btn);

  // —— 面板 ——
  const panel = document.createElement('div');
  panel.className = 'console-panel';
  panel.innerHTML = `
    <div class="con-head">
      <span class="con-title">小镇控制台</span>
      <button class="con-close" type="button" title="收起">×</button>
    </div>
    <div class="con-body">
      <section class="con-sec">
        <div class="con-label">时间 <b class="con-time"></b> · 第 <b class="con-day"></b> 天</div>
        <input class="con-slider" type="range" min="0" max="24" step="0.25" />
        <div class="con-speed">
          <button data-s="0">暂停</button>
          <button data-s="1">1x</button>
          <button data-s="10">10x</button>
          <button data-s="60">60x</button>
        </div>
      </section>
      <section class="con-sec">
        <div class="con-label">季节 <b class="con-season-mode"></b></div>
        <div class="con-grid con-seasons"></div>
      </section>
      <section class="con-sec">
        <div class="con-label">天气 <b class="con-weather-mode"></b></div>
        <div class="con-grid con-weathers"></div>
      </section>
      <section class="con-sec">
        <div class="con-label">演出</div>
        <div class="con-grid">
          <button class="fw-show">放烟花</button>
          <button class="fw-one">单发</button>
          <button class="aurora-tg">极光</button>
          <button class="train-sum">召唤列车</button>
        </div>
      </section>
      <section class="con-sec">
        <div class="con-label">画面</div>
        <input class="px-slider" type="range" min="120" max="360" step="10" />
        <div class="con-grid">
          <button class="ui-tg">隐藏界面</button>
          <button class="view-reset">重置视角</button>
        </div>
      </section>
      <section class="con-sec">
        <div class="con-label">前往</div>
        <select class="con-teleport"><option value="">—— 选择地点 ——</option></select>
      </section>
      <section class="con-sec">
        <div class="con-label">小镇任务</div>
        <ul class="con-quests"></ul>
      </section>
      <section class="con-sec con-debug">
        <div class="con-label">调试</div>
        <div class="con-stats"></div>
      </section>
    </div>
  `;
  root.appendChild(panel);

  const $ = (sel) => panel.querySelector(sel);
  const timeEl = $('.con-time'), dayEl = $('.con-day'), slider = $('.con-slider');
  const seasonMode = $('.con-season-mode'), weatherMode = $('.con-weather-mode');

  // —— 季节按钮 ——
  const seasonBtns = new Map();
  const seasonsGrid = $('.con-seasons');
  for (const s of SEASONS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = SEASON_ZH[s];
    b.addEventListener('click', () => { seasons.setSeason(s); refreshSoon(); });
    seasonsGrid.appendChild(b);
    seasonBtns.set(s, b);
  }
  const seasonAuto = document.createElement('button');
  seasonAuto.type = 'button';
  seasonAuto.className = 'con-auto';
  seasonAuto.textContent = '自动';
  seasonAuto.addEventListener('click', () => { clock.autoSeason(); refreshSoon(); });
  seasonsGrid.appendChild(seasonAuto);

  // —— 天气按钮 ——
  const weatherBtns = new Map();
  const weatherGrid = $('.con-weathers');
  for (const w of WEATHERS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = WEATHER_ZH[w];
    b.addEventListener('click', () => { weather.setMode(w); refreshSoon(); });
    weatherGrid.appendChild(b);
    weatherBtns.set(w, b);
  }
  const weatherAuto = document.createElement('button');
  weatherAuto.type = 'button';
  weatherAuto.className = 'con-auto';
  weatherAuto.textContent = '自动';
  weatherAuto.addEventListener('click', () => { weather.auto(); refreshSoon(); });
  weatherGrid.appendChild(weatherAuto);

  // —— 倍速 ——
  const speedBtns = [...panel.querySelectorAll('.con-speed button')];
  for (const b of speedBtns) {
    b.addEventListener('click', () => { clock.setSpeed(parseFloat(b.dataset.s)); refreshSoon(); });
  }

  // —— 时间滑杆 ——
  let sliding = false;
  slider.addEventListener('input', () => {
    sliding = true;
    const h = parseFloat(slider.value);
    clock.setTime(Math.floor(h), (h % 1) * 60);
  });
  slider.addEventListener('change', () => { sliding = false; });

  // —— 演出：烟花 / 极光 / 列车 ——
  panel.querySelector('.fw-show').addEventListener('click', () => {
    if (fireworks) fireworks.show(0, -4, 5);
  });
  panel.querySelector('.fw-one').addEventListener('click', () => {
    if (fireworks) fireworks.launch(0, -4);
  });
  const auroraBtn = panel.querySelector('.aurora-tg');
  auroraBtn.addEventListener('click', () => {
    if (sky) sky.setAurora(!sky.auroraOn());
    refreshNow();
  });
  panel.querySelector('.train-sum').addEventListener('click', () => {
    if (summonTrain) summonTrain();
  });

  // —— 画面：像素粗细热调 / 隐藏界面 / 重置视角 ——
  const pxSlider = panel.querySelector('.px-slider');
  if (getPixelHeight) pxSlider.value = String(getPixelHeight());
  pxSlider.addEventListener('input', () => {
    if (setPixelHeight) setPixelHeight(parseInt(pxSlider.value, 10));
  });
  let uiHidden = false;
  panel.querySelector('.ui-tg').addEventListener('click', () => {
    uiHidden = !uiHidden;
    document.querySelectorAll('#ui > *:not(.console-panel)').forEach(el => {
      el.style.display = uiHidden ? 'none' : '';
    });
  });
  panel.querySelector('.view-reset').addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('guide-reset'));
  });

  // —— 传送 ——
  const tpSel = $('.con-teleport');
  const seen = new Set();
  for (const b of getBuildings()) {
    if (seen.has(b.name)) continue;
    seen.add(b.name);
    const opt = document.createElement('option');
    opt.value = b.name;
    opt.textContent = b.name;
    tpSel.appendChild(opt);
  }
  tpSel.addEventListener('change', () => {
    const b = getBuildings().find(x => x.name === tpSel.value);
    if (b && onFlyToBuilding) onFlyToBuilding(b);
    tpSel.value = '';
  });

  // —— 开关 ——
  function open() { panel.classList.add('open'); refreshNow(); }
  function close() { panel.classList.remove('open'); }
  function toggle() { panel.classList.toggle('open'); refreshNow(); }
  btn.addEventListener('click', toggle);
  $('.con-close').addEventListener('click', close);
  window.addEventListener('keydown', (e) => {
    if (e.key === '`' || e.key === 'c' || e.key === 'C') {
      // 不拦截输入场景
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
      toggle();
    }
  });

  // —— 刷新 ——
  const questsEl = $('.con-quests');
  const statsEl = $('.con-stats');
  let refreshTimer = null;
  function refreshSoon() { if (refreshTimer) return; refreshTimer = setTimeout(() => { refreshTimer = null; refreshNow(); }, 120); }

  function refreshNow() {
    timeEl.textContent = clock.hhmm();
    dayEl.textContent = clock.day;
    if (!sliding) slider.value = String(Math.round(clock.hourFloat() * 4) / 4);
    // 高亮当前状态
    for (const [s, b] of seasonBtns) b.classList.toggle('on', clock.season === s);
    seasonAuto.classList.toggle('on', !clock.manualSeason);
    seasonMode.textContent = SEASON_ZH[clock.season] + (clock.manualSeason ? '（手动）' : '（自动）');
    for (const [w, b] of weatherBtns) b.classList.toggle('on', weather.mode() === w);
    weatherAuto.classList.toggle('on', !weather.isManual());
    weatherMode.textContent = WEATHER_ZH[weather.mode()] + (weather.isManual() ? '（手动）' : '（自动）');
    for (const b of speedBtns) b.classList.toggle('on', parseFloat(b.dataset.s) === clock.speed);
    // 任务
    questsEl.innerHTML = '';
    for (const q of story.questList()) {
      const li = document.createElement('li');
      li.className = 'con-quest ' + q.state;
      li.innerHTML = `<span class="q-name"></span><span class="q-state"></span><span class="q-desc"></span>`;
      li.querySelector('.q-name').textContent = q.name;
      li.querySelector('.q-state').textContent = q.state === 'done' ? '✓ 完成' : q.state === 'active' ? '→ ' + q.target : '待触发';
      li.querySelector('.q-desc').textContent = q.hintText;
      questsEl.appendChild(li);
    }
    // 调试
    if (statsGetter) {
      const s = statsGetter();
      const train = s.trainX === null ? '—' : `x${Math.round(s.trainX)}${s.trainParked ? '(停站)' : ''}`;
      statsEl.innerHTML =
        `fps ${s.fps?.toFixed(0)} · draw ${s.drawCalls} · tri ${(s.triangles / 1000).toFixed(1)}k<br>` +
        `体素 ${s.boxes} / ${s.buckets} 桶 · 窗 ${s.windows} 盏<br>` +
        `像素 ${s.pixelScale}x（内部高 ${getPixelHeight ? getPixelHeight() : '?'}）· 火车 ${train}` +
        (sky && sky.auroraOn() ? `<br>极光 · 亮起中` : '');
    }
  }

  let acc = 0;
  function tick(dt) {
    acc += dt;
    if (acc >= 0.5) { acc = 0; if (panel.classList.contains('open')) refreshNow(); }
  }

  return { tick, open, close, toggle };
}
