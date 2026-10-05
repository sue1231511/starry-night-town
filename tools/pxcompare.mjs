// 像素档位对比：?px=160 / 210 / 270 三档截图
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9335;
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
  }
};
await new Promise(r => { ws.onopen = r; });
await send("Page.enable");
await send("Runtime.enable");

async function evalJs(expression) {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails.exception?.description));
  return r.result.value;
}
async function shot(file) {
  const r = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(file, Buffer.from(r.data, "base64"));
  console.log("saved", file);
}

for (const px of [160, 210, 270]) {
  await send("Page.navigate", { url: `http://127.0.0.1:8033/index.html?px=${px}` });
  await sleep(4200);
  // 同一视角（广场低角）公平对比
  await evalJs(`window.__TOWN__.flyTo(24, 12, 34, 0, 6, -4)`);
  await sleep(2000);
  await shot(`cmp-px${px}.png`);
}

ws.close();
edge.kill();
console.log("DONE");
