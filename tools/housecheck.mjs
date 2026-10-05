// 进屋模式 + 内景专项验证
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9343;
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
await send("Page.navigate", { url: "http://127.0.0.1:8033/index.html?v=3" });

async function evalJs(expression) {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) {
    console.log("[eval-fail]", (r.exceptionDetails.exception?.description || r.exceptionDetails.text || "").slice(0, 250));
    return null;
  }
  return r.result.value;
}
async function shot(file) {
  const r = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(file, Buffer.from(r.data, "base64"));
  console.log("saved", file);
}

await sleep(4500);

// —— 1) 模拟双击麦香房（直接调 interaction 的进屋路径：射线太麻烦，用图鉴飞+reveal）
// 真实路径：dblclick 画面中心打到钟楼；改用 dispatch dblclick 打麦香房：先飞到正对麦香房的机位
await evalJs(`window.__TOWN__.flyTo(-15, 6, 2, -15, 2, -16)`);
await sleep(2000);
const enterHouse = await evalJs(`(() => {
  const c = document.querySelector('#stage canvas');
  const r = c.getBoundingClientRect();
  c.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: r.left + r.width/2, clientY: r.top + r.height/2 }));
  return new Promise(res => setTimeout(() => {
    // 验证被双击那家店的屋顶组隐藏（按名牌查店名对应组名）
    const T = window.__TOWN__;
    const name = document.querySelector('.plaque .plaque-name')?.textContent;
    const idMap = { '晚风邮局': 'post', '麦香房': 'bakery', '夜航咖啡': 'coffee', '灯塔书店': 'book', '晚香花房': 'flower', '剪刀手安': 'barber', '百宝杂货': 'general', '星子旅馆': 'inn' };
    const gid = idMap[name] || 'post';
    let hidden = 0, total = 0;
    T.scene.traverse(o => {
      if (o.name && o.name.includes('roof-shop-' + gid)) {
        total++;
        if (!o.visible) hidden++;
      }
    });
    res({ shop: name, group: gid, roofBuckets: total, hidden });
  }, 2200));
})()`);
console.log("enter-house:", JSON.stringify(enterHouse));
await shot("house-1-bakery-inside.png");

// —— 2) 点空白处：屋顶恢复 ——
const exitHouse = await evalJs(`(() => {
  const c = document.querySelector('#stage canvas');
  const r = c.getBoundingClientRect();
  c.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: r.left + r.width*0.05, clientY: r.top + r.height*0.95 }));
  return new Promise(res => setTimeout(() => {
    let visible = 0;
    window.__TOWN__.scene.traverse(o => {
      if (o.name && o.name.startsWith('bucket-grp:roof-shop-bakery') && o.visible) visible++;
    });
    res({ roofVisibleAgain: visible > 0 });
  }, 1200));
})()`);
console.log("exit-house:", JSON.stringify(exitHouse));

// —— 3) 水车磨坊 + 树屋视角 ——
await evalJs(`window.__TOWN__.flyTo(-30, 8, 26, -38, 3, 16)`);
await sleep(2200);
await shot("house-2-watermill.png");
await evalJs(`window.__TOWN__.flyTo(36, 18, -24, 26, 12, -33)`);
await sleep(2200);
await shot("house-3-treehouse.png");

// —— 4) 烟花 + 极光 ——
const fx = await evalJs(`(() => {
  const T = window.__TOWN__;
  T.fireworks.show(0, -4, 3);
  T.sky.setAurora(true);
  return new Promise(res => setTimeout(() => res({ ok: true }), 2600));
})()`);
console.log("fx:", JSON.stringify(fx));
await shot("house-4-fireworks.png");

ws.close();
edge.kill();
console.log("DONE");
