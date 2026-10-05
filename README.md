# 星夜像素小镇 · STARVILLE

一座深夜里亮着暖黄窗灯的 3D 体素小镇。深蓝夜幕 × 暖黄灯火，悬浮在夜空里的岛上：
中央钟楼的指针在走、火车定时穿过南缘铁道、风车在北坡慢慢转、篝火营地火星升上天空——
有些变成了星星。

**小镇是活的**：有昼夜循环（太阳东升西落、窗灯昼熄夜亮）、四季轮换（春粉/夏绿/秋橙/冬雪，
每 3 天自动换季）、天气系统（晴/多云/雨/雪/雾按季节加权轮换）、烟花（午夜自动/控制台点放）、
冬夜极光，6 条寻访任务（整点夜话推送 + 时间触发提示 + 双击地点完成 + 世界效果奖励）。

**可以进屋**：八家商铺全部是空心建筑——橱窗里就能看到室内（烤炉/咖啡吧台/书架/花台/
镜柜/货架/旅馆大堂壁炉），**双击任意商铺会揭开屋顶**飞到门口看完整内景，点空白处盖回。
河边有水车磨坊（水轮真的在转）、北坡有巨树树屋（绳梯+天桥+望远镜）、四只镇猫各守一角。

**上帝控制台**（` 或 C 键）：时间滑杆、倍速 0~60x、季节、天气、放烟花/单发、极光开关、
召唤列车、像素粗细热调、隐藏界面、地点瞬移、任务列表、实时调试信息（fps/drawcall/体素/火车位置）。

纯静态站（无构建），Three.js + 体素分桶渲染，部署在 Zeabur。

---

## 在本地跑

```bash
cd pixel-town
python -m http.server 8033
# 浏览器打开 http://127.0.0.1:8033
```

> 不能直接双击 index.html：ES modules + importmap 要求 http 服务。
> 用完记得杀掉 http.server（它会锁住所在目录）。

## 部署到 Zeabur

1. 把 `pixel-town` 目录推到一个 Git 仓库（GitHub / Zeabur Git 都行）；
2. Zeabur 控制台 → Create Project → **Git** → 选该仓库；
3. Service 类型选 **Static Website**（静态网站）；
4. 设置：
   - **Root Directory**：`/`（仓库根就是本目录的话）或 `pixel-town`
   - **Build Command**：留空
   - **Output Directory**：`/`（或留空）
5. Deploy，完事。没有构建步骤，就是原样托管 `index.html + css/ + js/`。

> 也可以用 Zeabur CLI：`zeabur deploy`（同样按静态站处理）。
> 页面依赖 jsdelivr CDN 的 three@0.161 和 Google Fonts（Press Start 2P），
> 访客网络需要能访问公网 CDN。

---

## 文件结构（改哪儿看这儿）

```
pixel-town/
├── index.html              入口（importmap 引 CDN three）
├── css/style.css           HUD / 名牌 / 图鉴 / 加载过场样式
├── js/
│   ├── main.js             渲染器 / 相机 / 像素化管线 / 主循环 / 调试口
│   ├── clock.js            小镇时间（天/四季轮换/倍速暂停）
│   ├── console.js          上帝控制台（时间/倍速/季节/天气/传送/任务/调试）
│   ├── palette.js          全部颜色和材质（改色只动这里）
│   ├── voxel.js            体素引擎：按颜色分桶 InstancedMesh（性能核心）
│   ├── layout.js           ★ 布局数据：地块/路网/河流/铁道/文案（挪建筑改这）
│   ├── world.js            地形铺装 / 灯光 / 全镇总装
│   ├── interaction.js      环视缩放 / 双击建筑 / 图鉴飞行（含剧情推进回调）
│   ├── ui.js               HUD / 名牌 / 图鉴 / 加载过场
│   ├── builders/           参数化建模（加内容改这里）
│   │   ├── house.js        住宅生成器（尖顶/四坡/平顶露台）
│   │   ├── shops.js        8 家商铺（★空心建筑：内景+分组屋顶可揭）
│   │   ├── interior.js     ★ 室内家具库（烤炉/书架/壁炉/床/吊灯/座钟…）
│   │   ├── landmarks.js    ★ 水车磨坊（水轮动态）+ 北坡树屋
│   │   ├── tower.js        钟楼（指针联动小镇时钟）
│   │   ├── windmill.js     风车 / 谷仓 / 干草垛 / 麦田栅栏
│   │   ├── bridges.js      拱桥 / 木桥 / 踏石 / 码头
│   │   ├── fountain.js     广场喷泉（托星星的小人雕像）
│   │   ├── props.js        路灯 / 长椅 / 水塔 / 观星亭 / 秋千 / 水井
│   │   ├── nature.js       树×4种 / 灌木 / 花 / 石头 / 果园 / 散布算法
│   │   ├── vehicles.js     铁道 / 火车 / 车站 / 道口 / 汽车（含召唤列车）
│   │   ├── boats.js        小船 / 热气球
│   │   ├── npc.js          行人×8 / 遛狗 / 镇猫×4（广场/码头/篝火/屋顶）
│   │   ├── park.js         菜畦 / 稻草人 / 风筝 / 滑梯 / 跷跷板 / 野餐
│   │   └── campsite.js     帐篷 / 篝火（火焰+火星+点光）/ 柴堆 / 观星垫
│   └── systems/            动效系统
│       ├── sky.js          夜空 shader / 双层星 / 日月 / 云 / 飞鸟 / 流星(含流星雨) / 极光
│       ├── daynight.js     ★ 昼夜循环：天空/日光/星月/雾/窗灯路灯全联动
│       ├── seasons.js      ★ 四季：调色板重着色换季（春粉/夏绿/秋橙/冬白）
│       ├── weather.js      ★ 天气：晴/多云/雨/雪/雾 + 季节加权自动轮换
│       ├── story.js        ★ 剧情：整点夜话 toast + 6 条寻访任务链
│       ├── fireworks.js    ★ 烟花：升空+爆开粒子（午夜自动/控制台/任务奖励）
│       ├── water.js        河面波动 / 波光碎闪
│       ├── effects.js      烟囱烟 / 喷泉水花 / 萤火虫（全 InstancedMesh）
│       ├── leaves.js       夜风落叶
│       ├── schedule.js     窗灯作息(昼熄夜亮) / 信标 / 道口灯
│       └── traffic.js      整点报时（钟楼顶灯脉冲）
└── tools/                  自检脚本（不参与部署逻辑）
    ├── selfcheck.mjs       全量：多视角截图 + fps/像素化/名牌/火车
    ├── spotcheck.mjs       专项：图鉴 / 篝火 / 手机视口
    ├── pxcompare.mjs       像素档位对比（?px=160/210/270）
    └── stilldiff.mjs       静止帧差（防晕动回归指标）
```

### 常改需求速查

| 想改什么 | 动哪里 |
|---|---|
| 挪房子 / 加房子 | `layout.js` 的 `HOUSES` 加一行（参数化） |
| 商铺位置和文案 | `layout.js` 的 `SHOPS`（blurb 就是名牌那句） |
| 商铺室内摆设 | `builders/shops.js` 各家 `xxxExtra` 里的 `I.xxx` 家具调用 |
| 新家具 | `builders/interior.js` 加一个函数，然后在任一 extra 里摆 |
| 配色 | `palette.js` 的 `PAL`（全场景锁这套 ~40 色） |
| 像素颗粒粗细 | 控制台滑杆直接调，或地址栏 `?px=130` |
| 相机初始视角 | `main.js` 的 `camera.position` + `interaction.js` 的 `resetView` |
| 火车班次 | `builders/vehicles.js` 里 `waitTimer` / 折返点 |
| 小镇时间流速 | `clock.js` 的 `speed`（控制台也能切 0/1x/10x/60x） |
| 昼夜节奏 | `systems/daynight.js` 的 `KF` 关键帧表（几点天亮/天黑/什么色） |
| 四季配色 | `systems/seasons.js` 的 `SEASON_TINTS` |
| 天气规则 | `systems/weather.js` 的 `WEIGHTS`（季节×天气权重）和 `FX`（雾距/云量） |
| 剧情和任务 | `systems/story.js` 的 `NIGHT_LINES`（语录）和 `QUESTS`（任务链） |
| 烟花样式 | `systems/fireworks.js` 的 `COLORS` / `burst` 粒子参数 |

## 调试参数（地址栏加在 `index.html` 后）

| 参数 | 作用 |
|---|---|
| `?px=130` | 像素颗粒粗细（默认 160，数字越小像素越大，范围 120~360） |
| `?keepbuf=1` | 保留绘制缓冲（帧分析用；常开损 fps，别当默认） |

## 防晕设计约定（重要，别改回去）

低分辨率像素风的 3D，「相机一动整屏像素跟着晃」= 晕动症。约定：**画面静止时必须完全静止，转动时必须整格跳动**——

- ✅ **像素完美相机**（`main.js` 的 `snapCameraToPixelGrid`）：相机方位/俯仰/距离
  量化到固定步长（0.4°/0.3°/0.9 格），转动是干净跳格而不是连续重采样。
  实测微转 0.1° 画面零变化（吸收），这是防「边缘蚂蚁线爬动」的核心。
- ✅ 转速减半（`rotateSpeed 0.5`）、缩放减速（`zoomSpeed 0.6`）
- ❌ 不要恢复「空闲自动环绕」（曾因整屏闪烁被猫猫抓包）
- ❌ 不要加满屏高频粒子（落叶 42→12、萤火虫 34→18、喷泉水花 26→16 都是这个原因）
- ✅ 闪烁一律低幅缓变：星星 0.72~1.0、波光 0.42~0.68、信标用正弦不用方波
- ✅ 拖拽阻尼收敛要快（dampingFactor 0.16），别让画面拖完还在滑
- ✅ 雾适度拉近（82~165）：远处细节融掉，转动时闪烁雪崩减半
- ✅ 汽车/NPC 只做低频起伏（0.5Hz），不做高频颠簸
- 内部分辨率默认 200（颗粒与细节的平衡；160 颗粒更大但混叠更强更晕）

验证：`tools/stilldiff.mjs` 静止帧差 **0.31%**；`tools/snapcheck.mjs` 微转吸收 **0.264%**。

---

## 性能（实测）

| 指标 | 值（桌面 headless 实测） | 预算 |
|---|---|---|
| fps | **58~60** | 60 |
| 静态方块 | 4417 个 → **44 桶** InstancedMesh | — |
| draw call | ~330（含动态件/粒子） | 无硬预算，帧率达标即可 |
| 三角形 | ~5.9 万 | <20 万 |
| 手机视口 390×760 | **60fps**（内部渲染 168×222） | 30+ |

已知事项（远景观感，非 bug）：
- 270p 像素化下，铁道枕木在远距离会融进道砟（拉近可见）；
- 站台/建筑在逆光侧的底边阴影较重（夜色设计取向）。

## 自检（交付前跑）

```bash
python -m http.server 8033 &          # 需要先起服务
node tools/selfcheck.mjs              # 截图存 ./shot-*.png，console 看 JSON
node tools/spotcheck.mjs
```

验证点：无 JS 异常、像素化生效（canvas 内部尺寸 ≈ 屏幕/3）、fps≥55、
双击名牌弹出、图鉴点击飞行、火车进站画面、手机视口正常。

## 技术要点（给未来的自己）

- **像素化**：`renderer.setSize(w/3, h/3, false)` + CSS `image-rendering: pixelated`，
  关 MSAA，硬边阴影（BasicShadowMap）。
- **体素分桶**：全部静态方块按「颜色×材质」进桶，build 时每桶一个 InstancedMesh；
  窗灯走 per-instance color（`setColorAt`），作息调度不拆实例。
- **动态件**（车/人/火焰等）是普通 Group + 共享几何的 Mesh；
  粒子（烟/萤火虫/水花/落叶）各用一个 InstancedMesh 单批。
- **灯光预算**：1 平行光（月光+阴影）+ 1 半球光 + 2 个真实点光
  （广场 / 篝火），其余发光全是 emissive 方块 + additive sprite 假光斑。
