// ============================================================
// clock.js — 小镇时间：一天 24h / 四季轮换 / 可暂停倍速
// ------------------------------------------------------------
// 1 现实秒 = speed 个小镇分钟。默认 1x；控制台可 0(暂停)/10x/60x。
// 每过 24:00 天数 +1；每 SEASON_DAYS 天自动换季（也可控制台手动）。
// daynight/seasons/story/console 全读这里。
// ============================================================

export const SEASONS = ['summer', 'autumn', 'winter', 'spring']; // day1 从夏开始轮换
export const SEASON_DAYS = 3; // 一个季节的天数（自动轮换用）
export const SEASON_ZH = { spring: '春', summer: '夏', autumn: '秋', winter: '冬' };

export const townClock = {
  minutes: 19 * 60,   // 从 19:00 的夜开始
  day: 1,
  season: 'summer',
  speed: 1,           // 小镇分钟 / 现实秒；0 = 暂停
  manualSeason: false, // 控制台手动定季后停自动轮换

  advance(dt) {
    if (this.speed <= 0) return;
    this.minutes += dt * this.speed;
    // 跨天
    if (this.minutes >= 24 * 60) {
      this.minutes -= 24 * 60;
      this.day += 1;
      if (!this.manualSeason) {
        this.season = SEASONS[Math.floor((this.day - 1) / SEASON_DAYS) % 4];
      }
    }
  },

  /** 当前小时（浮点 0~24） */
  hourFloat() {
    return (this.minutes / 60) % 24;
  },

  hhmm() {
    const h = Math.floor(this.minutes / 60) % 24;
    const m = Math.floor(this.minutes % 60);
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  },

  setSpeed(s) { this.speed = s; },

  /** 直接设时刻（hh 0~23, mm 0~59），用于控制台滑杆 */
  setTime(hh, mm = 0) {
    this.minutes = hh * 60 + mm;
  },

  setSeason(s) {
    if (!SEASONS.includes(s)) return;
    this.season = s;
    this.manualSeason = true;
  },

  autoSeason() { // 恢复自动轮换
    this.manualSeason = false;
    this.season = SEASONS[Math.floor((this.day - 1) / SEASON_DAYS) % 4];
  },
};
