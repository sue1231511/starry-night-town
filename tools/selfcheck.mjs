// ============================================================
// tools/selfcheck.mjs — CDP 无头自检
// ------------------------------------------------------------
// 真实时间流逝 + 截图 + evaluate 程序化验证：
// 1) 页面无 JS 报错（console 收集）
// 2) 像素化生效（canvas 内部尺寸 < 屏幕）
// 3) 体素统计 / draw call / fps 达标
// 4) 多视角截图（初始 / 低角 / 双击飞近模拟 / 火车等待）
// ============================================================
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9333;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const edge = spawn(EDGE, [
  "--headless=new", "--disable-gpu",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${process.cwd()}\\.edge-tmp`,
  "--no-first-run", "--hide-scrollbars",
  "--window-size=1280,800",
  "about:blank",
], { stdio: "ignore" });

async function waitReady() {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) return; }
    catch (e) { /* retry */ }
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
  } else if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
    console.log("[console.error]", m.params.args.map(a => a.value ?? a.description).join(" "));
  } else if (m.method === "Runtime.exceptionThrown") {
    console.log("[exception]", m.params.exceptionDetails?.exception?.description || JSON.stringify(m.params.exceptionDetails));
  }
};
await new Promise(r => { ws.onopen = r; });

await send("Page.enable");
await send("Runtime.enable");
await send("Page.navigate", { url: "http://127.0.0.1:8033/index.html" });

async function evalJs(expression) {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error("page eval failed: " + JSON.stringify(r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result.value;
}
async function shot(file) {
  const r = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(file, Buffer.from(r.data, "base64"));
  console.log("saved", file);
}

// —— 1) 加载 + 过场播完 ——
await sleep(4500);
console.log("boot:", JSON.stringify(await evalJs(`(() => ({
  bootGone: !document.querySelector('.boot-overlay'),
  hasTown: !!window.__TOWN__,
  stats: window.__TOWN__ ? window.__TOWN__.stats() : null,
}))()`)));

// —— 2) 等一会让动画跑起来，采样 fps ——
await sleep(2500);
console.log("stats-1:", JSON.stringify(await evalJs(`window.__TOWN__.stats()`)));
await shot("shot-1-initial.png");

// —— 3) 换个角度：低角度看广场 ——
await evalJs(`window.__TOWN__.flyTo(24, 14, 34, 0, 5, -4)`);
await sleep(2200);
await shot("shot-2-plaza-low.png");

// —— 4) 河岸视角 ——
await evalJs(`window.__TOWN__.flyTo(-30, 10, 22, 0, 2, 14)`);
await sleep(2200);
await shot("shot-3-river.png");

// —— 5) 高空全景 ——
await evalJs(`window.__TOWN__.flyTo(70, 60, 80, 0, 0, 0)`);
await sleep(2400);
console.log("stats-2:", JSON.stringify(await evalJs(`window.__TOWN__.stats()`)));
await shot("shot-4-overview.png");

// —— 6) 双击建筑 → 名牌弹出验证（朝钟楼方向双击画面中心）——
await evalJs(`window.__TOWN__.flyTo(20, 16, 28, 0, 10, -4)`);
await sleep(2200);
const plaqueState = await evalJs(`(() => {
  const c = document.querySelector('#stage canvas');
  const r = c.getBoundingClientRect();
  c.dispatchEvent(new MouseEvent('dblclick', {
    bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2,
  }));
  return new Promise(res => setTimeout(() => {
    const p = document.querySelector('.plaque');
    res({
      shown: p && p.classList.contains('show'),
      name: p ? p.querySelector('.plaque-name').textContent : null,
      blurb: p ? p.querySelector('.plaque-blurb').textContent : null,
    });
  }, 350));
})()`);
console.log("plaque:", JSON.stringify(plaqueState));
await shot("shot-6-plaque.png");

// —— 7) 南公园新内容视角 ——
await evalJs(`window.__TOWN__.flyTo(-24, 16, 44, -20, 2, 26)`);
await sleep(2200);
await shot("shot-7-park.png");

// —— 8) 等火车进站画面（轮询 trainX 进入镜头范围再截）——
await evalJs(`window.__TOWN__.flyTo(-10, 9, 54, -10, 3, 40)`);
await sleep(1600);
const trainSnap = await evalJs(`new Promise(res => {
  const t0 = performance.now();
  const iv = setInterval(() => {
    const s = window.__TOWN__.stats();
    if (s.trainX !== null && Math.abs(s.trainX - (-10)) < 22) {
      clearInterval(iv);
      res({ caught: true, trainX: s.trainX, parked: s.trainParked, waited: Math.round((performance.now() - t0) / 1000) + 's' });
    } else if (performance.now() - t0 > 40000) {
      clearInterval(iv);
      res({ caught: false, trainX: s.trainX, parked: s.trainParked });
    }
  }, 400);
})`);
console.log("train:", JSON.stringify(trainSnap));
await shot("shot-8-rail.png");

ws.close();
edge.kill();
console.log("DONE");
