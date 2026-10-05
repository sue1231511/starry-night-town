// daynight 诊断：确认 tick 是否在跑、uniform 是否被改
import { spawn } from "node:child_process";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9341;
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
    console.log("[page-exc]", (m.params.exceptionDetails.exception?.description || "").slice(0, 400));
  }
};
await new Promise(r => { ws.onopen = r; });
await send("Page.enable");
await send("Runtime.enable");
await send("Page.navigate", { url: "http://127.0.0.1:8033/index.html?keepbuf=1" });
await sleep(4200);

async function ev(expression) {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true });
  if (r.exceptionDetails) {
    console.log("[eval-fail]", (r.exceptionDetails.exception?.description || r.exceptionDetails.text || "").slice(0, 400));
    return null;
  }
  return r.result.value;
}

await ev(`window.__TOWN__.clock.setTime(12, 0)`);
await sleep(1800);

console.log("diag:", JSON.stringify(await ev(`(() => {
  const T = window.__TOWN__;
  const u = T.sky.skyMats[0].uniforms;
  // 读画面上部像素（GL 坐标 y 从底部起）
  const c = document.querySelector('#stage canvas');
  const gl = c.getContext('webgl2') || c.getContext('webgl');
  const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
  const b = new Uint8Array(w * Math.floor(h*0.25) * 4);
  gl.readPixels(0, Math.floor(h*0.6), w, Math.floor(h*0.25), gl.RGBA, gl.UNSIGNED_BYTE, b);
  let r=0,g=0,bl=0,n=b.length/4;
  for (let i=0;i<b.length;i+=4){r+=b[i];g+=b[i+1];bl+=b[i+2];}
  // 再读最顶部 10%（更接近天顶）
  const b2 = new Uint8Array(w * Math.floor(h*0.1) * 4);
  gl.readPixels(0, Math.floor(h*0.9), w, Math.floor(h*0.1), gl.RGBA, gl.UNSIGNED_BYTE, b2);
  let r2=0,g2=0,bl2=0,n2=b2.length/4;
  for (let i=0;i<b2.length;i+=4){r2+=b2[i];g2+=b2[i+1];bl2+=b2[i+2];}
  return {
    nightLevel: T.daynight.nightLevel(),
    cTop: '#' + u.cTop.value.getHexString(),
    canvasSize: [w,h],
    pixelAvgTop: [Math.round(r/n), Math.round(g/n), Math.round(bl/n)],
    pixelAvgVeryTop: [Math.round(r2/n2), Math.round(g2/n2), Math.round(bl2/n2)],
  };
})()`)));

// 同帧拍一张对照图
{
  const r = await send("Page.captureScreenshot", { format: "png" });
  const { writeFileSync } = await import("node:fs");
  writeFileSync("diag-noon.png", Buffer.from(r.data, "base64"));
  console.log("saved diag-noon.png");
}
ws.close();
edge.kill();
console.log("DONE");
