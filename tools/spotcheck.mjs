// 专项验证：图鉴面板 / 篝火营地 / 手机视口
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
  "--window-size=390,760", // 手机竖屏
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
  } else if (m.method === "Runtime.exceptionThrown") {
    console.log("[exception]", m.params.exceptionDetails?.exception?.description);
  }
};
await new Promise(r => { ws.onopen = r; });
await send("Page.enable");
await send("Runtime.enable");
await send("Page.navigate", { url: "http://127.0.0.1:8033/index.html" });

async function evalJs(expression) {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error("eval failed: " + JSON.stringify(r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result.value;
}
async function shot(file) {
  const r = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(file, Buffer.from(r.data, "base64"));
  console.log("saved", file);
}

await sleep(4200);

// —— 手机视口：像素化 + 初始画面 ——
console.log("mobile:", JSON.stringify(await evalJs(`window.__TOWN__.stats()`)));
await shot("shot-9-mobile.png");

// —— 图鉴：打开 → 数量 → 点击一个条目 → 相机移动 ——
const guide = await evalJs(`(() => {
  const btn = document.querySelector('.guide-btn');
  btn.click();
  return new Promise(res => setTimeout(() => {
    const panel = document.querySelector('.guide');
    const items = panel.querySelectorAll('.guide-item');
    res({
      open: panel.classList.contains('open'),
      count: items.length,
      first: items[0]?.querySelector('.guide-item-name').textContent,
    });
  }, 300));
})()`);
console.log("guide:", JSON.stringify(guide));

const flyResult = await evalJs(`(() => {
  const item = document.querySelector('.guide-item:nth-child(3)');
  const name = item.querySelector('.guide-item-name').textContent;
  const before = window.__TOWN__.camera.position.clone();
  item.click();
  return new Promise(res => setTimeout(() => {
    const after = window.__TOWN__.camera.position;
    const moved = Math.hypot(after.x - before.x, after.y - before.y, after.z - before.z) > 4;
    const plaque = document.querySelector('.plaque').classList.contains('show');
    const guideClosed = !document.querySelector('.guide').classList.contains('open');
    res({ name, moved, plaque, guideClosed });
  }, 1800));
})()`);
console.log("guide-fly:", JSON.stringify(flyResult));
await shot("shot-10-guide-fly.png");

// —— 篝火营地 ——
await evalJs(`window.__TOWN__.flyTo(24, 10, -14, 12.5, 4, -30)`);
await sleep(2200);
await shot("shot-11-campfire.png");

ws.close();
edge.kill();
console.log("DONE");
