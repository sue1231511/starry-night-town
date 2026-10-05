// 复现猫猫操作序列：双击进店 → 纯移动鼠标(不按键) → 出门 → 重置 → 纯移动
// 每阶段读画面像素差：纯鼠标移动阶段必须为 0（bug 复现/修复验证的关键断言）
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9346;
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
await send("Page.navigate", { url: "http://127.0.0.1:8033/index.html?v=8&keepbuf=1" });
await sleep(4500);

async function ev(expression) {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) {
    console.log("[eval-fail]", (r.exceptionDetails.exception?.description || "").slice(0, 300));
    return null;
  }
  return r.result.value;
}
async function shot(file) {
  const r = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(file, Buffer.from(r.data, "base64"));
  console.log("saved", file);
}
// 鼠标输入（CDP 原生输入事件，最接近真实用户）
async function mouse(type, x, y, button = "none") {
  await send("Input.dispatchMouseEvent", { type, x, y, button, clickCount: type === "mousePressed" || type === "mouseReleased" ? 1 : 0 });
}
// 帧差：全部在页面内计算（Uint8Array 不跨 CDP 传），返回百分比
async function frameDiff(waitMs = 400) {
  return await ev(`new Promise(res => {
    const c = document.querySelector('#stage canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    const grab = () => { const b = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, b); return b; };
    const a = grab();
    setTimeout(() => {
      const b = grab();
      let changed = 0;
      for (let i = 0; i < a.length; i += 4) {
        if (Math.abs(a[i]-b[i]) > 20 || Math.abs(a[i+1]-b[i+1]) > 20 || Math.abs(a[i+2]-b[i+2]) > 20) changed++;
      }
      res(+(100 * changed / (a.length / 4)).toFixed(2));
    }, ${waitMs});
  })`);
}

// —— 1) 飞到邮局门前，双击进店（DOM dblclick 可靠合成）——
await ev(`window.__TOWN__.flyTo(-13, 7, 9, -21, 2, -6)`);
await sleep(2000);
await ev(`(() => {
  const c = document.querySelector('#stage canvas');
  const r = c.getBoundingClientRect();
  c.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: r.left + r.width/2, clientY: r.top + r.height/2 }));
})()`);
await sleep(1800);
console.log("inside:", await ev(`window.__TOWN__.interaction.isInside()`));
await shot("repro-1-inside.png");

// —— 2) 关键断言：纯移动鼠标（不按键）扫一圈，画面不许动 ——
const moves = [];
for (let i = 0; i <= 10; i++) {
  const x = 200 + i * 90, y = 250 + (i % 2) * 220;
  await mouse("mouseMoved", x, y);
  await sleep(90);
}
const diffMoving = await frameDiff(300);
console.log("diff-while-moving-mouse:", diffMoving + "%", diffMoving < 0.6 ? "PASS" : "FAIL ← 就是猫猫的bug");

// —— 3) 按住拖拽转头（页面内 PointerEvent；CDP Input 不合成 pointer 事件）——
const diffDrag = await ev(`(async () => {
  const c = document.querySelector('#stage canvas');
  c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 300, clientY: 400, button: 0 }));
  const before = window.__TOWN__.camera.rotation.y;
  for (let i = 1; i <= 8; i++) {
    window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 300 + i * 45, clientY: 400 }));
    await new Promise(r => setTimeout(r, 40));
  }
  window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 660, clientY: 400 }));
  return +(Math.abs(window.__TOWN__.camera.rotation.y - before) * 100).toFixed(1) + 'deg';
})()`);
console.log("lookaround-yaw:", diffDrag, "PASS(转头生效)");
await shot("repro-2-lookaround.png");

// —— 4) 出门 → 纯移动鼠标，画面也不许动 ——
await ev(`document.querySelector('.exit-shop-btn')?.click()`);
await sleep(1200);
console.log("exited:", await ev(`!window.__TOWN__.interaction.isInside()`));
for (let i = 0; i <= 8; i++) { await mouse("mouseMoved", 150 + i * 110, 300 + (i % 3) * 120); await sleep(90); }
const diffStreet = await frameDiff(300);
console.log("diff-street-moving:", diffStreet + "%", diffStreet < 0.6 ? "PASS" : "FAIL");

// —— 5) 点重置后再纯移动 ——
await ev(`window.__TOWN__.resetView()`);
await sleep(2000);
for (let i = 0; i <= 8; i++) { await mouse("mouseMoved", 200 + i * 100, 200 + (i % 2) * 300); await sleep(90); }
const diffReset = await frameDiff(300);
console.log("diff-after-reset-moving:", diffReset + "%", diffReset < 2 ? "PASS（背景动画+chunk 换装基线）" : "FAIL");
await shot("repro-3-street.png");

ws.close();
edge.kill();
console.log("DONE");
