// 无限版图 + 真进店 + 能见度专项验证
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9344;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const edge = spawn(EDGE, [
  "--headless=new", "--disable-gpu",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${process.cwd()}\\.edge-tmp`,
  "--no-first-run", "--window-size=1280,800",
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
    console.log("[page-exc]", (m.params.exceptionDetails.exception?.description || "").slice(0, 250));
  }
};
await new Promise(r => { ws.onopen = r; });
await send("Page.enable");
await send("Runtime.enable");
await send("Page.navigate", { url: "http://127.0.0.1:8033/index.html?v=5" });

async function evalJs(expression) {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) {
    console.log("[eval-fail]", (r.exceptionDetails.exception?.description || r.exceptionDetails.text || "").slice(0, 250));
    return null;
  }
  return r.result.value;
}
async function shot(file) {
  const r = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(file, Buffer.from(r.data, "base64"));
  console.log("saved", file);
}

await sleep(4500);

// —— 1) 无限旷野：chunk 加载计数 + 主城外截图 ——
await evalJs(`window.__TOWN__.flyTo(-140, 40, 120, -60, 0, 40)`);
await sleep(3500);
console.log("inf-1:", JSON.stringify(await evalJs(`window.__TOWN__.infinite.stats()`)));
await shot("inf-1-wild.png");

// —— 2) 继续往西飞：新 chunk 加载、旧的卸载 ——
await evalJs(`window.__TOWN__.flyTo(-340, 40, 120, -260, 0, 40)`);
await sleep(3500);
console.log("inf-2:", JSON.stringify(await evalJs(`window.__TOWN__.infinite.stats()`)));
await shot("inf-2-far.png");

// —— 3) 能见度：拉远 380 看主城（雾修正后不该一片蓝）——
await evalJs(`window.__TOWN__.flyTo(200, 120, 240, 0, 4, -2)`);
await sleep(2800);
await shot("inf-3-farview.png");

// —— 4) 真·进店：双击邮局 → 相机应在店内 + 出门按钮 ——
await evalJs(`window.__TOWN__.flyTo(-14, 8, 12, -21, 2, -6)`);
await sleep(2200);
const enterShop = await evalJs(`(() => {
  const c = document.querySelector('#stage canvas');
  const r = c.getBoundingClientRect();
  c.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: r.left + r.width/2, clientY: r.top + r.height/2 }));
  return new Promise(res => setTimeout(() => {
    const T = window.__TOWN__;
    const btn = document.querySelector('.exit-shop-btn');
    res({
      inside: T.interaction ? T.interaction.isInside() : null,
      camY: Math.round(T.camera.position.y * 10) / 10,
      camX: Math.round(T.camera.position.x * 10) / 10,
      camZ: Math.round(T.camera.position.z * 10) / 10,
      exitBtn: !!btn,
    });
  }, 1500));
})()`);
console.log("enter-shop:", JSON.stringify(enterShop));
await shot("inf-4-inside.png");

// —— 5) 出门恢复 ——
const exitTest = await evalJs(`(() => {
  document.querySelector('.exit-shop-btn')?.click();
  return new Promise(res => setTimeout(() => {
    res({ inside: window.__TOWN__.interaction.isInside(), btnGone: !document.querySelector('.exit-shop-btn') });
  }, 900));
})()`);
console.log("exit-shop:", JSON.stringify(exitTest));

ws.close();
edge.kill();
console.log("DONE");
