// 工作区副本异常诊断（复用 diag 模式，指到 8034）
import { spawn } from "node:child_process";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9351;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const edge = spawn(EDGE, [
  "--headless=new", "--disable-gpu",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${process.cwd()}\\.edge-tmp`,
  "--no-first-run", "--window-size=800,600",
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
await send("Page.navigate", { url: "http://127.0.0.1:8034/index.html?v=9" });
await sleep(4500);
const r = await send("Runtime.evaluate", { expression: "!!window.__TOWN__", returnByValue: true });
console.log("hasTown:", r.result.value);
ws.close();
edge.kill();
console.log("DONE");
