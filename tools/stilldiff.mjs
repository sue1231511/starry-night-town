// 静止画面帧差验证：相机静止时连拍两帧，量化差异像素占比
// （防晕动症回归指标：动画收敛后静止帧差应很低）
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9336;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const edge = spawn(EDGE, [
  "--headless=new", "--disable-gpu",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${process.cwd()}\\.edge-tmp`,
  "--no-first-run", "--hide-scrollbars",
  "--window-size=1600,900",
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

// 帧差采样：等 damping/飞行全停稳后，间隔 120ms 用 readPixels 抓两帧比较
// （WebGL canvas 不能 getContext('2d')，必须走 readPixels + preserveDrawingBuffer）
const diff = await evalJs(`new Promise((resolve, reject) => {
  try {
    const c = document.querySelector('#stage canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    const grab = () => {
      const b = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, b);
      return b;
    };
    setTimeout(() => {
      const a = grab();
      setTimeout(() => {
        const b = grab();
        let changed = 0, total = w * h;
        for (let i = 0; i < a.length; i += 4) {
          if (Math.abs(a[i] - b[i]) > 24 || Math.abs(a[i+1] - b[i+1]) > 24 || Math.abs(a[i+2] - b[i+2]) > 24) changed++;
        }
        resolve({ canvasW: w, canvasH: h, changedPct: +(100 * changed / total).toFixed(2) });
      }, 120);
    }, 2600);
  } catch (e) { reject(String(e)); }
})`);
console.log("still-frame-diff:", JSON.stringify(diff));

await shot("shot-still.png");

// 常规回归：fps + 名牌
console.log("stats:", JSON.stringify(await evalJs(`window.__TOWN__.stats()`)));
const plaque = await evalJs(`(() => {
  const c = document.querySelector('#stage canvas');
  const r = c.getBoundingClientRect();
  c.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: r.left + r.width/2, clientY: r.top + r.height/2 }));
  return new Promise(res => setTimeout(() => {
    res({ shown: document.querySelector('.plaque').classList.contains('show') });
  }, 400));
})()`);
console.log("plaque:", JSON.stringify(plaque));

ws.close();
edge.kill();
console.log("DONE");
