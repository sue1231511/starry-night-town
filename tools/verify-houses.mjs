// ============================================================
// tools/verify-houses.mjs — 住宅区改造专项自检（CDP 无头）
// ------------------------------------------------------------
// 1) 无 JS 报错；2) 体素统计；3) 西片住宅区鸟瞰截图
// 4) 程序化揭顶一间 cozy 民居 + 俯视截图（看内景）
// ============================================================
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9335;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const edge = spawn(EDGE, [
  "--headless=new", "--disable-gpu",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${process.cwd()}\\.edge-tmp4`,
  "--no-first-run", "--hide-scrollbars",
  "--disk-cache-size=1", "--media-cache-size=1",
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
const errors = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.method === "Runtime.exceptionThrown") {
    errors.push(m.params.exceptionDetails.text + " " + (m.params.exceptionDetails.exception?.description || "").slice(0, 300));
  }
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id); pending.delete(m.id);
    m.error ? p.rej(new Error(m.error.message)) : p.res(m.result);
  }
};
await new Promise(r => ws.onopen = r);
await send("Runtime.enable");
await send("Page.enable");
await send("Page.navigate", { url: "http://127.0.0.1:8033/?nocache=" + Date.now() });
await sleep(6500);

const evalJS = async (expr) => {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error("eval failed: " + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result.value;
};

const results = {};
results.stats = await evalJS("JSON.stringify(window.__TOWN__.stats())");

// 调到正午：白天光线下门口/院子/内景细节才可审（夜景截图全黑是取景问题不是 bug）
await evalJS("window.__TOWN__.clock.setTime(12, 0)");
await sleep(1200);

// 西片住宅鸟瞰（中心约 -40,-13，高一点俯视）
await evalJS("window.__TOWN__.flyTo(-40, 34, 6, -40, 2, -13)");
await sleep(2300);
let shot = await send("Page.captureScreenshot", {});
writeFileSync("shot-houses-west.png", Buffer.from(shot.data, "base64"));

// 河南邨（从南侧看北，河在画面上部）
await evalJS("window.__TOWN__.flyTo(39, 16, 44, 37, 2, 16)");
await sleep(2300);
shot = await send("Page.captureScreenshot", {});
writeFileSync("shot-houses-river.png", Buffer.from(shot.data, "base64"));

// 门口近景：走玩家双击的真实路径 flyToBuilding（西2 = (-44,-17)）
await evalJS("(function(){ const b = window.__TOWN__.getBuildings().find(b => Math.abs(b.cx - (-44)) < 1 && Math.abs(b.cz - (-17)) < 1); window.__TOWN__.interaction.flyToBuilding(b); return b ? b.name : 'NOT FOUND'; })()");
await sleep(2300);
results.camDoor = await evalJS("JSON.stringify([window.__TOWN__.camera.position.toArray().map(v=>+v.toFixed(1)), window.__TOWN__.controls.target.toArray().map(v=>+v.toFixed(1))])");
shot = await send("Page.captureScreenshot", {});
writeFileSync("shot-house-door.png", Buffer.from(shot.data, "base64"));

// 揭顶西2（桶名精确 grp:houseroof-1|）+ 室内补光 + 用 flyToBuilding 的玩家视角俯一点
results.hidden = await evalJS("(async function(){ const T=window.__TOWN__; const THREE=await import('three'); let n=0; T.scene.traverse(o=>{ if(o.name && o.name.includes('grp:houseroof-1|')){ o.visible=false; n++; } }); const L=new THREE.PointLight(0xffd8a0, 10, 26, 1.4); L.position.set(-44, 6, -17); T.scene.add(L); const b=T.getBuildings().find(b=>Math.abs(b.cx+44)<1&&Math.abs(b.cz+17)<1); T.interaction.flyToBuilding(b); return n; })()");
await sleep(2600);
results.camInt = await evalJS("JSON.stringify([window.__TOWN__.camera.position.toArray().map(v=>+v.toFixed(1)), window.__TOWN__.controls.target.toArray().map(v=>+v.toFixed(1))])");
shot = await send("Page.captureScreenshot", {});
writeFileSync("shot-house-interior.png", Buffer.from(shot.data, "base64"));

console.log(JSON.stringify({ errors, results }, null, 2));
ws.close(); edge.kill();
process.exit(0);
