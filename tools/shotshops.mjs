// 八家店逐间截图（进店机位），看室内质感
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9347;
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
await send("Page.navigate", { url: "http://127.0.0.1:8033/index.html?v=9" });
await sleep(4500);

async function ev(expression) {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) return null;
  return r.result.value;
}
async function shot(file) {
  const r = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(file, Buffer.from(r.data, "base64"));
  console.log("saved", file);
}

// 逐家：飞到门口→双击进店→截图→出门
const shops = [
  ['bakery', '麦香房', -15, -16],
  ['coffee', '夜航咖啡', -5, -16],
  ['book', '灯塔书店', 5, -16],
  ['flower', '晚香花房', 15, -16],
  ['post', '晚风邮局', -21, -6],
  ['barber', '剪刀手安', 21, -6],
  ['general', '百宝杂货', 12, 0],
  ['inn', '星子旅馆', -12, 0],
];
for (const [id, name, x, z] of shops) {
  // 站在店面正前方 7 格看门，双击画面中心偏下（打门/橱窗 hitbox）
  await ev(`window.__TOWN__.flyTo(${x}, 4, ${z + 8}, ${x}, 2, ${z})`);
  await sleep(2100);
  await ev(`(() => {
    const c = document.querySelector('#stage canvas');
    const r = c.getBoundingClientRect();
    c.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: r.left + r.width/2, clientY: r.top + r.height*0.62 }));
  })()`);
  await sleep(1500);
  const inside = await ev(`window.__TOWN__.interaction.isInside()`);
  console.log(name, inside ? 'inside ✓' : 'MISS ✗');
  await shot(`shop-${id}.png`);
  await ev(`window.__TOWN__.interaction.exitShop()`);
  await sleep(700);
}

ws.close();
edge.kill();
console.log("DONE");
