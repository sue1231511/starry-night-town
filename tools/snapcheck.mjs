// 像素完美相机验证：
// 1) 微转 < 步长 → 画面应完全不变（snap 吸收，无爬动）
// 2) 名牌/常规回归
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9337;
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
  } else if (m.method === "Runtime.exceptionThrown") {
    console.log("[exception]", m.params.exceptionDetails?.exception?.description);
  }
};
await new Promise(r => { ws.onopen = r; });
await send("Page.enable");
await send("Runtime.enable");
await send("Page.navigate", { url: "http://127.0.0.1:8033/index.html?keepbuf=1" });

async function evalJs(expression) {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails.exception?.description));
  return r.result.value;
}
async function shot(file) {
  const r = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(file, Buffer.from(r.data, "base64"));
  console.log("saved", file);
}

await sleep(4200);

// 微转测试：绕 target 转 0.1°（1/4 步长，远离 round 边界）→ 帧差应≈0
const microTest = await evalJs(`new Promise((resolve, reject) => {
  try {
    const T = window.__TOWN__;
    const c = T.camera;
    const gl = document.querySelector('#stage canvas').getContext('webgl2') || document.querySelector('#stage canvas').getContext('webgl');
    const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    const grab = () => { const b = new Uint8Array(w*h*4); gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,b); return b; };
    // 记录当前精确位置（已被 snap 过）
    const tgt = T.controls.target.clone();
    const off = c.position.clone().sub(tgt);
    const yaw0 = Math.atan2(off.x, off.z);
    const dist = off.length(), pitch0 = Math.asin(off.y / dist);
    // 等 1 帧稳定
    requestAnimationFrame(() => setTimeout(() => {
      const a = grab();
      // 手动微转 0.1°（模拟一次极小的拖拽增量）
      const yaw = yaw0 + 0.1 * Math.PI / 180;
      const flat = Math.cos(pitch0) * dist;
      c.position.set(tgt.x + Math.sin(yaw)*flat, tgt.y + Math.sin(pitch0)*dist, tgt.z + Math.cos(yaw)*flat);
      c.lookAt(tgt);
      // 下一帧 snap 后抓
      requestAnimationFrame(() => setTimeout(() => {
        const b = grab();
        let changed = 0;
        for (let i = 0; i < a.length; i += 4) {
          if (Math.abs(a[i]-b[i]) > 8 || Math.abs(a[i+1]-b[i+1]) > 8 || Math.abs(a[i+2]-b[i+2]) > 8) changed++;
        }
        resolve({ microTurnDeg: 0.1, changedPct: +(100*changed/(w*h)).toFixed(3) });
      }, 60));
    }, 60));
  } catch (e) { reject(String(e)); }
})`);
console.log("micro-turn:", JSON.stringify(microTest));

// 常规回归
console.log("stats:", JSON.stringify(await evalJs(`window.__TOWN__.stats()`)));
await shot("shot-snap.png");

ws.close();
edge.kill();
console.log("DONE");
