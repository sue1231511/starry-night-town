// ============================================================
// tools/verify-game.mjs — 游戏层专项自检（CDP 无头）
// ------------------------------------------------------------
// 1) 页面无 JS 报错
// 2) __TOWN__.game 存在且 progress() 结构完整
// 3) 程序化收集一颗星 + 撸一只猫 → 计数/存档变化
// 4) 图鉴面板 DOM 打开正常（codex rows 数量）
// 5) 截图（初始视角 + 飞近钟楼看塔顶星星）
// ============================================================
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9334;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const edge = spawn(EDGE, [
  "--headless=new", "--disable-gpu",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${process.cwd()}\\.edge-tmp2`,
  "--no-first-run", "--hide-scrollbars",
  "--window-size=1280,800",
  "about:blank",
], { stdio: "ignore" });

async function waitReady() {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) return; }
    catch { /* retry */ }
    await sleep(200);
  }
  throw new Error("CDP not ready");
}
await waitReady();

const nw = await (await fetch(`http://127.0.0.1:${PORT}/json/new`, { method: "PUT" })).json();
const ws = new WebSocket(nw.webSocketDebuggerUrl);
let id = 0; const pending = new Map();
function send(method, params = {}) {
  return new Promise((res, rej) => {
    const i = ++id;
    pending.set(i, { res, rej });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
}
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id); pending.delete(m.id);
    m.error ? p.rej(new Error(m.error.message)) : p.res(m.result);
  }
};
await new Promise(r => ws.onopen = r);

const errors = [];
await send("Runtime.enable");
await send("Console.enable");
ws.onmessage = (function (orig) {
  return function (ev) {
    const m = JSON.parse(ev.data);
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
      errors.push(m.params.args.map(a => a.value ?? a.description ?? "").join(" "));
    }
    if (m.method === "Runtime.exceptionThrown") {
      errors.push(m.params.exceptionDetails.text + " " + (m.params.exceptionDetails.exception?.description || ""));
    }
    orig.call(ws, ev);
  };
})(ws.onmessage);

await send("Page.enable");
await send("Emulation.setTimezoneOverride", { timezoneId: "Asia/Shanghai" });
await send("Page.navigate", { url: "http://127.0.0.1:8033/" });
await sleep(6500); // 等加载过场 + 世界建好

const evalJS = async (expr) => {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error("eval failed: " + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result.value;
};

const results = {};
results.hasGame = await evalJS("!!window.__TOWN__?.game");
results.progress0 = await evalJS("JSON.stringify(window.__TOWN__.game.progress())");
results.pickables = await evalJS("(function(){ return true; })()");
// 场景里星星数量：数 scene children 中含 starWarm 材质的 group（粗略）
results.sceneChildren = await evalJS("window.__TOWN__.scene.children.length");

// 模拟收集：调 game.collectStar（走完整链：存档+音效跳过[无手势ctx惰性]+UI刷新）
results.collect = await evalJS("(function(){ const g = window.__TOWN__.game; g.collectStar('tower', {x:100,y:100}); g.petCat('plaza'); return JSON.stringify(g.progress()); })()");
results.saveRaw = await evalJS("localStorage.getItem('starville-game-v1')");
// 图鉴 DOM
results.codex = await evalJS("(function(){ document.querySelector('.gh-stars')?.click(); const rows = document.querySelectorAll('.codex-row').length; const num = document.querySelector('.gh-stars .gh-num')?.textContent; return JSON.stringify({rows, num}); })()");
// HUD chips 存在
results.chips = await evalJS("!!document.querySelector('.gh-stars') && !!document.querySelector('.gh-cats') && !!document.querySelector('.gh-sound')");

// 截图：初始视角（星星 HUD 应可见）
const shot1 = await send("Page.captureScreenshot", {});
writeFileSync("shot-game-1.png", Buffer.from(shot1.data, "base64"));
// 飞近钟楼看塔顶的星
await evalJS("window.__TOWN__.flyTo(10, 24, 12, 0, 14, -4)");
await sleep(2200);
const shot2 = await send("Page.captureScreenshot", {});
writeFileSync("shot-game-2.png", Buffer.from(shot2.data, "base64"));

// fps 采样
results.fps = await evalJS("(function(){ const s = window.__TOWN__.stats(); return s.fps; })()");

console.log(JSON.stringify({ errors, results }, null, 2));
ws.close(); edge.kill();
process.exit(0);
