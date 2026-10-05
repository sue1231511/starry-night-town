// ============================================================
// world.js — 地形总装：铺地、开河、亮灯、把全镇 builder 串起来
// ------------------------------------------------------------
// buildTown(scene) 是唯一入口，main.js 只调它。
// 各 builder 返回 updater（每帧调用的动画函数），这里统一收集。
// ============================================================
import * as THREE from 'three';
import { PAL, hexNum } from './palette.js';
import { vox } from './voxel.js';
import {
  WORLD, terrainHeight, riverZ, riverDist, RIVER_HALF_W, WATER_Y,
  onRoad, PLAZA, makeRng,
  HILL_START,
} from './layout.js';

import { buildHouses } from './builders/house.js';
import { buildYards } from './builders/yard.js';
import { buildShops } from './builders/shops.js';
import { buildTower } from './builders/tower.js';
import { buildWindmillArea } from './builders/windmill.js';
import { buildBridges, buildDock } from './builders/bridges.js';
import { buildFountain } from './builders/fountain.js';
import { buildProps } from './builders/props.js';
import { buildNature } from './builders/nature.js';
import { buildPark } from './builders/park.js';
import { buildCampsite } from './builders/campsite.js';
import { buildWaterMill, buildTreehouse } from './builders/landmarks.js';
import { buildRailway, getTrainState, summonTrain } from './builders/vehicles.js';
import { buildBoats, buildBalloon } from './builders/boats.js';
import { buildNpcs, buildRoofCat, buildTownCats } from './builders/npc.js';

import { buildSky } from './systems/sky.js';
import { buildWater } from './systems/water.js';
import { buildAmbientFx } from './systems/effects.js';
import { buildScheduleSystem, bindDaynight } from './systems/schedule.js';
import { buildTraffic } from './systems/traffic.js';
import { buildLeaves } from './systems/leaves.js';
import { buildDaynight } from './systems/daynight.js';
import { buildSeasons } from './systems/seasons.js';
import { buildWeather } from './systems/weather.js';
import { buildStory } from './systems/story.js';
import { buildFireworks } from './systems/fireworks.js';
import { buildGame } from './systems/game.js';
import { sfx } from './systems/sound.js';
import { buildStars } from './builders/stars.js';
import { buildHiddenCats, spawnParadeCats } from './builders/hiddenCats.js';
import { townClock } from './clock.js';

// 全局时钟在 clock.js（builders 直接 import），此处 re-export 方便外部取
export { townClock } from './clock.js';

// ------------------------------------------------------------
// 铺地面：2×2 体素格，高度场采样，阶梯化北坡
// ------------------------------------------------------------
function layGround(rng) {
  const HALF = WORLD.HALF;
  const cell = 2;
  for (let gx = -HALF; gx < HALF; gx += cell) {
    for (let gz = -HALF; gz < HALF; gz += cell) {
      const cx = gx + cell / 2, cz = gz + cell / 2;
      const rd = riverDist(cx, cz);

      // 河道中段跳过（水面系统自铺），只铺河床边缘
      if (rd < RIVER_HALF_W - 0.4) continue;

      const h = terrainHeight(cx, cz);
      const checker = ((gx + gz) / cell) % 2 === 0;

      // —— 选色：路面 > 广场 > 河滩 > 麦田 > 草地 ——
      let colorKey;
      const inPlaza = Math.abs(cx - PLAZA.cx) <= PLAZA.half && Math.abs(cz - PLAZA.cz) <= PLAZA.half;
      if (onRoad(cx, cz)) {
        colorKey = checker ? 'roadLit' : 'roadDark';
      } else if (inPlaza) {
        // 广场石板： finer 棋盘 + 边缘一圈镶边
        const edge = Math.abs(cx - PLAZA.cx) > PLAZA.half - 2 || Math.abs(cz - PLAZA.cz) > PLAZA.half - 2;
        colorKey = edge ? 'roadDark' : (checker ? 'roadLit' : 'roadDark');
      } else if (rd < RIVER_HALF_W + 2.4) {
        colorKey = checker ? 'dirt' : 'rockDark'; // 河滩
      } else if (cz < HILL_START && cx >= -42 && cx <= -6) {
        colorKey = checker ? 'fieldWheat' : 'fieldDark'; // 北坡麦田
      } else {
        colorKey = checker ? 'grassA' : 'grassB';
      }

      // 注：不做草地随机撒点了——高频色点在低分辨率下是满屏闪烁源（晕动症）

      vox.boxC(gx, h - 3, gz, cell, 3, cell, colorKey);
    }
  }

  // 浮空岛裙边：世界四周一圈暗岩剖面，像一座悬在夜空里的岛
  const skirtH = 8;
  for (let g = -HALF; g < HALF; g += cell) {
    // 南北边
    vox.boxC(g, terrainHeight(g + 1, -HALF + 1) - skirtH, -HALF, cell, skirtH, cell, 'rockDark');
    vox.boxC(g, terrainHeight(g + 1, HALF - 1) - skirtH, HALF - cell, cell, skirtH, cell, 'rockDark');
    // 东西边
    vox.boxC(-HALF, terrainHeight(-HALF + 1, g + 1) - skirtH, g, cell, skirtH, cell, 'rockDark');
    vox.boxC(HALF - cell, terrainHeight(HALF - 1, g + 1) - skirtH, g, cell, skirtH, cell, 'rockDark');
  }
  // 底岩：整块暗底兜住河床下方
  vox.boxC(-HALF, -skirtH - 2, -HALF, WORLD.SIZE, 2, WORLD.SIZE, 'rockDark');
}

// ------------------------------------------------------------
// 灯光：月光平行光（硬阴影贴像素风）+ 半球夜环境光
// ------------------------------------------------------------
function setupLights(scene) {
  const hemi = new THREE.HemisphereLight(
    new THREE.Color(hexNum('skyLow')), // 天光
    new THREE.Color(hexNum('grassB')), // 地面反光
    0.62,
  );
  scene.add(hemi);

  const moon = new THREE.DirectionalLight(hexNum('moon'), 1.05);
  moon.position.set(-38, 60, -30);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.camera.left = -60;
  moon.shadow.camera.right = 60;
  moon.shadow.camera.top = 60;
  moon.shadow.camera.bottom = -60;
  moon.shadow.camera.near = 10;
  moon.shadow.camera.far = 160;
  moon.shadow.bias = -0.0005;
  // 像素风硬阴影（不开 PCF 软化）
  moon.shadow.camera.updateProjectionMatrix();
  scene.add(moon);
  scene.add(moon.target);

  // 广场一个真实暖点光（全镇真实点光预算 ≤3）
  const plazaLight = new THREE.PointLight(hexNum('lampGlow'), 26, 34, 1.8);
  plazaLight.position.set(0, 7, -4);
  scene.add(plazaLight);

  // 夜雾：拉近一点，远处细节融掉（远距高频细节=相机转动时的闪烁雪崩）
  scene.fog = new THREE.Fog(hexNum('skyMid'), 82, 165);

  return { moon, hemi, plazaLight };
}

// ------------------------------------------------------------
// 总装
// ------------------------------------------------------------
export function buildTown(scene) {
  const rng = makeRng();
  const updaters = [];

  layGround(rng);
  const lights = setupLights(scene);

  // —— 建筑 ——
  updaters.push(...buildHouses(scene));
  updaters.push(...buildYards(scene)); // 民宅院子（小径/花圃/栅栏/风格点缀）
  updaters.push(...buildShops(scene));
  updaters.push(...buildTower(scene));
  updaters.push(...buildWindmillArea(scene));
  updaters.push(...buildFountain(scene));
  updaters.push(...buildBridges(scene));
  updaters.push(...buildDock(scene));
  const propsRet = buildProps(scene, rng);
  updaters.push(...propsRet.updaters);
  const treeTops = buildNature(scene, rng);
  updaters.push(...buildPark(scene));
  updaters.push(...buildCampsite(scene, rng));
  updaters.push(...buildWaterMill(scene, { x: -38 }));
  updaters.push(...buildTreehouse(scene, { x: 26, z: -33 }));

  // —— 动的东西 ——
  // 镇猫的注册请求先攒着（游戏层在后面才建，见 buildHiddenCats 的 npcCatHook）
  const pendingNpcCats = [];
  updaters.push(...buildRailway(scene));
  updaters.push(...buildBoats(scene));
  updaters.push(...buildBalloon(scene));
  updaters.push(...buildNpcs(scene));
  updaters.push(...buildRoofCat(scene, { onCat: (id, g) => pendingNpcCats.push([id, g]) }));
  updaters.push(...buildTownCats(scene, { onCat: (id, g) => pendingNpcCats.push([id, g]) }));

  // —— 系统（顺序重要：sky → daynight → weather 覆盖链）——
  const sky = buildSky(scene);
  updaters.push(sky.tick);
  updaters.push(buildWater(scene));
  updaters.push(buildAmbientFx(scene, rng, treeTops));
  const schedule = buildScheduleSystem(scene);
  updaters.push(schedule.tick);

  // 昼夜循环（接管 sky 材质 / 灯光 / 雾 / 路灯光斑 / 星月）
  const daynight = buildDaynight({
    sun: lights.moon, hemi: lights.hemi, plazaLight: lights.plazaLight,
    skyMats: sky.skyMats, starMats: sky.starMats,
    moonGroup: sky.moonGroup, sunDisc: sky.sunDisc, clouds: sky.clouds,
    scene, lampSprites: propsRet.lampGlows,
  });
  updaters.push(daynight.tick);
  bindDaynight(daynight); // 窗灯昼灭夜亮联动

  // 天气（在 daynight 后 tick：对天空/雾做覆盖）
  const weather = buildWeather({ daynightEnv: {
    scene, skyMats: sky.skyMats, clouds: sky.clouds,
  } });
  updaters.push(weather.tick);

  // 四季换装
  const seasons = buildSeasons();
  updaters.push(seasons.tick);

  // 烟花（控制台按钮 / 午夜自动 / 任务奖励；story 也要用，先建）
  // onLaunch/onBurst：程序化音效（WebAudio 合成，见 systems/sound.js）
  const fireworks = buildFireworks(scene, {
    onLaunch: () => sfx.fwLaunch(),
    onBurst: () => sfx.fwBurst(),
  });
  updaters.push(fireworks.tick);

  // 剧情与触发（任务完成配一声上行三音）
  const story = buildStory({
    sky, daynight, fireworks, summonTrain,
    onQuestDone: () => sfx.questDone(),
  });
  updaters.push(story.tick);

  // —— 游戏层：许愿星 / 猫咪图鉴 / 星光等级（存档在 localStorage）——
  // 拾取通道：main 里 interaction 建好后 flushPickables 接上（buildTown 先于 interaction）
  let pickSink = null;
  const pendingPicks = [];
  const addPickable = (p) => { if (pickSink) pickSink.add(p); else pendingPicks.push(p); };
  const removePickable = (id) => {
    if (pickSink) { pickSink.remove(id); return; }
    const i = pendingPicks.findIndex((x) => x.id === id);
    if (i >= 0) pendingPicks.splice(i, 1);
  };

  const game = buildGame({
    fireworks, sky,
    spawnParadeCats: () => updaters.push(...spawnParadeCats(scene)), // Lv3 奖励
  });
  updaters.push(game.tick);
  game.reapplyRewards(); // 读档时补发已解锁的被动奖励

  updaters.push(...buildStars(scene, game, {
    addPickable, removePickable,
    onCollect: (def, screenXY) => game.collectStar(def.id, screenXY),
  }));
  updaters.push(...buildHiddenCats(scene, game, {
    addPickable,
    npcCatHook: (register) => { for (const [id, g] of pendingNpcCats) register(id, g); },
  }));

  function flushPickables(interaction) {
    pickSink = { add: interaction.addPickable, remove: interaction.removePickable };
    for (const p of pendingPicks) pickSink.add(p);
    pendingPicks.length = 0;
  }

  // 极光自动逻辑：冬夜（20 点后）大概率亮起，天亮淡出；其余季节保持关
  let auroraDecidedDay = -1;
  updaters.push((dt) => {
    const h = townClock.hourFloat();
    if (townClock.season === 'winter' && h > 20.5 || (townClock.season === 'winter' && h < 4)) {
      // 每晚只决定一次（手动开过就不覆盖）
      if (auroraDecidedDay !== townClock.day) {
        auroraDecidedDay = townClock.day;
        if (Math.random() < 0.65 && !sky.auroraOn()) sky.setAurora(true);
      }
    } else if (h > 6 && h < 18 && sky.auroraOn()) {
      sky.setAurora(false); // 白天淡出
    }
  });

  // 午夜 0:00 自动来一轮小烟花（跨年气氛）
  let lastFireworkDay = -1;
  updaters.push(() => {
    const h = townClock.hourFloat();
    if (h < 0.5 && lastFireworkDay !== townClock.day) {
      lastFireworkDay = townClock.day;
      fireworks.show(0, -4, 4);
    }
  });

  // 跨系统事件（整点报时等）
  updaters.push(buildTraffic(scene));
  updaters.push(buildLeaves(scene));

  // 烘焙静态体素（所有 builder 的 box 都在 vox 桶里）
  vox.build(scene);

  return {
    updaters,
    schedule,
    sky, daynight, weather, seasons, story, fireworks, game,
    flushPickables,
    stats: () => vox.stats(),
  };
}
