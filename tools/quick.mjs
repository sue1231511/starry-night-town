// 工作区副本快速验证（双副本同步后防手误）
import { spawn } from "node:child_process";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9350;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const edge = spawn(EDGE, [
  "--headless=new", "--disable-gpu",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${process.cwd()}\\.edge-tmp`,
  "--no-first-run", "--window-size=1000,700",
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
await send("Page.navigate", { url: "http://127.0.0.1:8034/index.html" });
await sleep(4500);

async function ev(expression) {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true });
  if (r.exceptionDetails) {
    console.log("[eval-fail]", (r.exceptionDetails.exception?.description || "").slice(0, 250));
    return null;
  }
  return r.result.value;
}
console.log("workspace:", JSON.stringify(await ev(`window.__TOWN__.stats()`)));
console.log("daynight:", JSON.stringify(await ev(`window.__TOWN__.daynight.nightLevel()`)));
ws.close();
edge.kill();
console.log("DONE");
