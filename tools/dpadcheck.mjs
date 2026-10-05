// D-pad + 进店环视验证
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9345;
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
    console.log("[page-exc]", (m.params.exceptionDetails.exception?.description || "").slice(0, 300));
  }
};
await new Promise(r => { ws.onopen = r; });
await send("Page.enable");
await send("Runtime.enable");
await send("Page.navigate", { url: "http://127.0.0.1:8033/index.html?v=7" });
await sleep(4500);

async function ev(expression) {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) {
    console.log("[eval-fail]", (r.exceptionDetails.exception?.description || "").slice(0, 300));
    return null;
  }
  return r.result.value;
}

// 1) D-pad 按住走：模拟 pointerdown 1.5s，看相机位移
const dpad = await ev(`(() => {
  const btn = document.querySelector('.dpad .dpad-up');
  const before = window.__TOWN__.camera.position.clone();
  btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  return new Promise(res => setTimeout(() => {
    btn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    const after = window.__TOWN__.camera.position;
    res({ moved: +Math.hypot(after.x - before.x, after.z - before.z).toFixed(1) });
  }, 1500));
})()`);
console.log("dpad:", JSON.stringify(dpad));

// 2) 进店：站门口看店内 + 暖灯 + 环视（rotate on、zoom/pan off）
await ev(`window.__TOWN__.flyTo(-14, 8, 12, -21, 2, -6)`);
await sleep(1800);
const shop = await ev(`(() => {
  const c = document.querySelector('#stage canvas');
  const r = c.getBoundingClientRect();
  c.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: r.left + r.width/2, clientY: r.top + r.height/2 }));
  return new Promise(res => setTimeout(() => {
    const T = window.__TOWN__;
    res({
      inside: T.interaction.isInside(),
      zoom: T.controls.enableZoom, pan: T.controls.enablePan, rotate: T.controls.enableRotate,
      tip: !!document.querySelector('.shop-tip'),
    });
  }, 1600));
})()`);
console.log("shop:", JSON.stringify(shop));
const r2 = await send("Page.captureScreenshot", { format: "png" });
writeFileSync("dpad-shop.png", Buffer.from(r2.data, "base64"));
console.log("saved dpad-shop.png");
ws.close();
edge.kill();
console.log("DONE");
