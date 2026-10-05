// ============================================================
// systems/sound.js — 程序化音效（WebAudio 合成，无外部文件）
// ------------------------------------------------------------
// 全部音效实时合成：收集叮 / 猫叫 / 升级琶音 / 烟花 / 整点钟声。
// · AudioContext 惰性创建（浏览器手势策略：首次交互后才出声）
// · 静音开关存 localStorage，masterGain 统一音量
// · 所有音符节点 stop 后自动 GC，不攒节点
// ============================================================

const MUTE_KEY = 'starville-muted';

let ctx = null;
let master = null;
let noiseBuf = null;

function ensureCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = isMuted() ? 0 : 0.5;
    master.connect(ctx.destination);
    // 预生成 1s 白噪声（烟花/海浪类音色用）
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function isMuted() {
  try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; }
}

export function setMuted(m) {
  try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch { /* 隐私模式忽略 */ }
  if (master) master.gain.value = m ? 0 : 0.5;
}

/** 通用音符：osc 振荡器 + 指数衰减包络 */
function tone({ freq, dur = 0.3, type = 'sine', vol = 0.5, delay = 0, slideTo = null, attack = 0.005 }) {
  if (!ensureCtx()) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur * 0.85);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g); g.connect(master);
  osc.start(t0); osc.stop(t0 + dur + 0.05);
}

/** 噪声爆裂（烟花）：白噪声 + 低通 + 包络 */
function noiseBurst({ dur = 0.5, vol = 0.4, freq = 900, delay = 0, sweepTo = null }) {
  if (!ensureCtx()) return;
  const t0 = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const filt = ctx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.setValueAtTime(freq, t0);
  if (sweepTo) filt.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filt); filt.connect(g); g.connect(master);
  src.start(t0); src.stop(t0 + dur + 0.05);
}

// ------------------------------------------------------------
// 具体音色
// ------------------------------------------------------------
export const sfx = {
  /** 拾取许愿星：双音叮铃（高八度泛音） */
  pickStar() {
    tone({ freq: 880, dur: 0.35, type: 'sine', vol: 0.4 });
    tone({ freq: 1318.5, dur: 0.45, type: 'sine', vol: 0.3, delay: 0.07 });
    tone({ freq: 2637, dur: 0.3, type: 'sine', vol: 0.12, delay: 0.07 });
  },

  /** 猫叫：频率滑音模拟「喵——」（起音高→滑落→轻颤收尾） */
  meow() {
    if (!ensureCtx()) return;
    tone({ freq: 760, slideTo: 420, dur: 0.34, type: 'sawtooth', vol: 0.12, attack: 0.04 });
    tone({ freq: 1520, slideTo: 840, dur: 0.3, type: 'sine', vol: 0.1, attack: 0.04 });
  },

  /** 登记新猫咪：轻快两声 */
  catFound() {
    tone({ freq: 660, dur: 0.18, type: 'triangle', vol: 0.35 });
    tone({ freq: 990, dur: 0.25, type: 'triangle', vol: 0.3, delay: 0.12 });
  },

  /** 星光升级：五声音阶琶音（宫商角徵羽） */
  levelUp() {
    const seq = [523.25, 587.33, 659.25, 783.99, 1046.5];
    seq.forEach((f, i) => tone({ freq: f, dur: 0.5, type: 'triangle', vol: 0.32, delay: i * 0.09 }));
    // 收尾闪亮
    tone({ freq: 1568, dur: 0.7, type: 'sine', vol: 0.18, delay: 0.55 });
  },

  /** 任务完成：三音上行 */
  questDone() {
    tone({ freq: 587.33, dur: 0.22, type: 'triangle', vol: 0.3 });
    tone({ freq: 783.99, dur: 0.22, type: 'triangle', vol: 0.3, delay: 0.1 });
    tone({ freq: 1046.5, dur: 0.4, type: 'triangle', vol: 0.32, delay: 0.2 });
  },

  /** 烟花升空：细噪声上扫 */
  fwLaunch() {
    noiseBurst({ dur: 0.55, vol: 0.1, freq: 500, sweepTo: 2600 });
  },

  /** 烟花爆开：低频闷响 + 高频碎裂 */
  fwBurst() {
    noiseBurst({ dur: 0.7, vol: 0.28, freq: 1400, sweepTo: 180 });
    tone({ freq: 90, slideTo: 45, dur: 0.5, type: 'sine', vol: 0.3 });
  },

  /** 整点钟声：基音 + 泛音长衰减（钟楼质感） */
  chime(hour = 0) {
    const times = ((Math.floor(hour) % 12) || 12);
    for (let i = 0; i < Math.min(times, 4); i++) {
      const d = i * 0.75;
      tone({ freq: 392, dur: 1.8, type: 'sine', vol: 0.2, delay: d });
      tone({ freq: 588, dur: 1.4, type: 'sine', vol: 0.08, delay: d });
      tone({ freq: 986, dur: 0.9, type: 'sine', vol: 0.05, delay: d });
    }
  },

  /** 终极全收集：和弦钟声排 */
  finale() {
    const chords = [[392, 494, 587], [440, 554, 659], [523, 659, 784], [587, 740, 880]];
    chords.forEach((ch, i) => {
      ch.forEach(f => tone({ freq: f, dur: 1.6, type: 'sine', vol: 0.14, delay: i * 0.6 }));
    });
  },

  /** 解锁提示：短促两声「叮咚」 */
  unlock() {
    tone({ freq: 987.77, dur: 0.15, type: 'sine', vol: 0.3 });
    tone({ freq: 1318.5, dur: 0.3, type: 'sine', vol: 0.28, delay: 0.1 });
  },
};
