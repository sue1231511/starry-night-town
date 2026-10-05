// 新系统专项验证 v2（干净模式：每步直接验证，参考 diag 的稳定路径）
// 昼夜 / 四季 / 天气 / 控制台 / 剧情 / 倍速
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9342;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const edge = spawn(EDGE, [
  "--headless=new", "--disable-gpu",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${process.cwd()}\\.edge-tmp`,
  "--no-first-run", "--hide-scrollbars",
  "--window-size=1280,800",
  "about:blank",
], { stdio: "ignore" });

for (let i = 0; i < 60; i++) {
  try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) break; }
  catch (e) { /* retry */ }
  await sleep(200);
}
const nw = await (await fetch(`http://127.0.0.1:${PORT}/json/new`, { method: "PUT" })).json();
const ws = new WebSocket(nw.webSocketDebuggerUrl);
let id = 0; const pending = new Map();
function send(method, params = {}) {
  return new Promise((res, rej) => {
    const msg = { id: ++id, method, params };
    pending.set(msg.id, { res, rej });
    ws.send(JSON.stringify(msg));
  });
}
ws.onmessage = ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { res, rej } = pending.get(m.id); pending.delete(m.id);
    m.error ? rej(new Error(m.error.message)) : res(m.result);
  } else if (m.method === "Runtime.exceptionThrown") {
    console.log("[page-exc]", (m.params.exceptionDetails.exception?.description || "").slice(0, 300));
  }
};
await new Promise(r => { ws.onopen = r; });
await send("Page.enable");
await send("Runtime.enable");
await send("Page.navigate", { url: "http://127.0.0.1:8033/index.html?keepbuf=1" });

async function evalJs(expression) {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) {
    console.log("[eval-fail]", (r.exceptionDetails.exception?.description || r.exceptionDetails.text || "").slice(0, 300));
    return null;
  }
  return r.result.value;
}
async function shot(file) {
  const r = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(file, Buffer.from(r.data, "base64"));
  console.log("saved", file);
}
// 读画面最顶 10%（接近天顶，不含建筑）
const topSky = `(() => {
  const c = document.querySelector('#stage canvas');
  const gl = c.getContext('webgl2') || c.getContext('webgl');
  const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
  const rows = Math.floor(h * 0.1);
  const b = new Uint8Array(w * rows * 4);
  gl.readPixels(0, Math.floor(h * 0.9), w, rows, gl.RGBA, gl.UNSIGNED_BYTE, b);
  let r = 0, g = 0, bl = 0, n = b.length / 4;
  for (let i = 0; i < b.length; i += 4) { r += b[i]; g += b[i+1]; bl += b[i+2]; }
  return [Math.round(r/n), Math.round(g/n), Math.round(bl/n)];
})()`;

await sleep(4200);

// 1) 夜（初始 19:00）
console.log("sky-night:", JSON.stringify(await evalJs(topSky)), JSON.stringify(await evalJs(`window.__TOWN__.daynight.nightLevel()`)));
await shot("v2-1-night.png");

// 2) 正午
await evalJs(`window.__TOWN__.clock.setTime(12, 0)`);
await sleep(1600);
console.log("sky-noon:", JSON.stringify(await evalJs(topSky)), JSON.stringify(await evalJs(`window.__TOWN__.daynight.nightLevel()`)));
await shot("v2-2-noon.png");

// 3) 黄昏 19:00 回来
await evalJs(`window.__TOWN__.clock.setTime(19, 0)`);
await sleep(1400);
console.log("sky-dusk:", JSON.stringify(await evalJs(topSky)), JSON.stringify(await evalJs(`window.__TOWN__.daynight.nightLevel()`)));
await shot("v2-3-dusk.png");

// 4) 控制台 + 冬季 + 雪
console.log("console:", JSON.stringify(await evalJs(`(() => {
  window.__TOWN__.console.open();
  return new Promise(res => setTimeout(() => {
    const p = document.querySelector('.console-panel');
    res({
      open: p.classList.contains('open'),
      quests: p.querySelectorAll('.con-quest').length,
      seasons: [...p.querySelectorAll('.con-seasons button')].map(b => b.textContent),
      weathers: [...p.querySelectorAll('.con-weathers button')].map(b => b.textContent),
    });
  }, 400));
})()`)));

console.log("winter:", JSON.stringify(await evalJs(`(() => {
  const b = [...document.querySelectorAll('.con-seasons button')].find(x => x.textContent === '冬');
  b.click();
  return new Promise(res => setTimeout(() => {
    const s = window.__TOWN__.stats();
    res({ season: s.season });
  }, 1400));
})()`)));

console.log("snow:", JSON.stringify(await evalJs(`(() => {
  const b = [...document.querySelectorAll('.con-weathers button')].find(x => x.textContent === '雪');
  b.click();
  return new Promise(res => setTimeout(() => {
    const s = window.__TOWN__.stats();
    res({ weather: s.weather });
  }, 500));
})()`)));
await evalJs(`window.__TOWN__.clock.setTime(12, 0)`);
await sleep(2000);
await shot("v2-4-winter-snow.png");

// 5) 剧情：22:00 → 观星任务激活 → 图鉴飞行拜访观星亭 → done
console.log("quest:", JSON.stringify(await evalJs(`(() => {
  const T = window.__TOWN__;
  T.clock.setTime(22, 2);
  return new Promise(res => setTimeout(() => {
    const meteor = T.story.questList().find(q => q.id === 'meteor');
    const toast = document.querySelector('.toast');
    res({ hintState: meteor.state, toast: !!toast, text: toast ? toast.textContent.slice(0, 24) : null });
  }, 2500));
})()`)));

console.log("quest-done:", JSON.stringify(await evalJs(`(() => {
  const T = window.__TOWN__;
  T.story.visit('观星亭');
  return T.story.questList().find(q => q.id === 'meteor').state;
})()`)));

// 6) 60x 倍速跨天 + 自动换季
console.log("speed:", JSON.stringify(await evalJs(`(() => {
  const T = window.__TOWN__;
  T.clock.autoSeason();
  T.clock.setTime(23, 0);
  T.clock.setSpeed(60);
  return new Promise(res => setTimeout(() => {
    const s = T.stats();
    T.clock.setSpeed(1);
    res({ time: s.time, day: s.day, season: s.season });
  }, 8000));
})()`)));

// 7) HUD 状态条
console.log("hud:", JSON.stringify(await evalJs(`document.querySelector('.hud-status').textContent`)));

ws.close();
edge.kill();
console.log("DONE");
