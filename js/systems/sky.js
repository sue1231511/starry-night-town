// ============================================================
// systems/sky.js — 夜空：穹顶渐变 / 星星 / 月亮 / 云 / 飞鸟 / 流星
// ------------------------------------------------------------
// 穹顶用大球 + 三阶纵向渐变 shader；星星两层 Points 自定义 shader
// 逐星闪烁；云是体素方块组缓慢漂移；流星/飞鸟按概率偶发。
// ============================================================
import * as THREE from 'three';
import { hexNum, glowSpriteMat } from '../palette.js';
import { makeRng } from '../layout.js';

const SKY_R = 620; // 穹顶要罩住 maxDistance 380 + 雾远端（相机拉到最远也在天内）

export function buildSky(scene) {
  const rng = makeRng(1314);

  // ------------------------------------------------------------
  // 1. 夜空穹顶（三阶渐变：天顶深→地平线微亮）
  // ------------------------------------------------------------
  const skyGeo = new THREE.SphereGeometry(SKY_R, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      cTop: { value: new THREE.Color(hexNum('skyTop')) },
      cMid: { value: new THREE.Color(hexNum('skyMid')) },
      cLow: { value: new THREE.Color(hexNum('skyLow')) },
    },
    vertexShader: /* glsl */`
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 cTop; uniform vec3 cMid; uniform vec3 cLow;
      varying vec3 vPos;
      void main() {
        float h = normalize(vPos).y;          // -1 地平线以下 → 1 天顶
        vec3 col;
        if (h > 0.25) {
          col = mix(cMid, cTop, smoothstep(0.25, 0.9, h));
        } else {
          col = mix(cLow, cMid, smoothstep(-0.05, 0.25, h));
        }
        // 细微色温抖动（模拟限色带的夜空纹理，避免大平色）
        col += (fract(sin(dot(vPos.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.012;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));

  // ------------------------------------------------------------
  // 2. 星星（两层：远层多而暗 / 近层少而亮，逐星闪烁）
  // ------------------------------------------------------------
  function makeStarLayer(count, size, warmRatio) {
    const pos = new Float32Array(count * 3);
    const phase = new Float32Array(count);
    const speed = new Float32Array(count);
    const tint = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      // 均匀撒半球
      const u = rng(), v = rng();
      const theta = u * Math.PI * 2;
      const phi = Math.acos(1 - v * 0.92); // 偏天顶
      const r = SKY_R * 0.94;
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.cos(phi) * 0.85 + 12;
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      phase[i] = rng() * Math.PI * 2;
      speed[i] = 0.25 + rng() * 0.85; // 慢闪：快闪在低分辨率下就是噪点跳
      tint[i] = rng() < warmRatio ? 1.0 : 0.0;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    geo.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));
    geo.setAttribute('aTint', new THREE.BufferAttribute(tint, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uFade: { value: 1.0 }, // 昼夜：白天整体淡出（daynight 控制）
        cStar: { value: new THREE.Color(hexNum('star')) },
        cWarm: { value: new THREE.Color(hexNum('starWarm')) },
        uSize: { value: size },
      },
      vertexShader: /* glsl */`
        attribute float aPhase; attribute float aSpeed; attribute float aTint;
        uniform float uTime; uniform float uSize;
        varying float vGlow; varying float vTint;
        void main() {
          // 闪烁幅度压低（0.72~1.0）：低分辨率下大幅闪烁=满屏噪点跳
          vGlow = 0.72 + 0.28 * (0.5 + 0.5 * sin(uTime * aSpeed + aPhase));
          vTint = aTint;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = uSize * (0.82 + 0.18 * vGlow);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */`
        uniform vec3 cStar; uniform vec3 cWarm; uniform float uFade;
        varying float vGlow; varying float vTint;
        void main() {
          // 像素方点（硬边，贴合画风）
          vec2 d = abs(gl_PointCoord - 0.5);
          if (max(d.x, d.y) > 0.5) discard;
          vec3 col = mix(cStar, cWarm, vTint);
          gl_FragColor = vec4(col, vGlow * uFade);
        }
      `,
    });
    const pts = new THREE.Points(geo, mat);
    scene.add(pts);
    return mat;
  }
  const starMatFar = makeStarLayer(300, 2.0, 0.08); // 数量收敛：星空过密=闪烁源过密
  const starMatNear = makeStarLayer(90, 3.4, 0.22);

  // ------------------------------------------------------------
  // 3. 月亮（发光圆盘 + 光晕 sprite，光晕呼吸）
  // ------------------------------------------------------------
  const moonPos = new THREE.Vector3(-95, 118, -150);
  const moon = new THREE.Mesh(
    new THREE.CircleGeometry(11, 8), // 8 边形：像素感圆
    new THREE.MeshBasicMaterial({ color: hexNum('moon'), fog: false }),
  );
  moon.position.copy(moonPos);
  moon.lookAt(0, 10, 0);
  scene.add(moon);
  // 月面陨石坑（三个暗斑，贴在盘前）
  const craters = new THREE.Group();
  moon.add(craters);
  const craterMat = new THREE.MeshBasicMaterial({ color: hexNum('skyMid'), fog: false });
  for (const [cx, cy, s] of [[-3, 2.5, 2.2], [3.5, -1, 1.6], [-1, -4, 1.3]]) {
    const c = new THREE.Mesh(new THREE.CircleGeometry(s, 6), craterMat);
    c.position.set(cx, cy, 0.3);
    craters.add(c);
  }
  const moonHalo = new THREE.Sprite(glowSpriteMat('moonGlow', 0.3));
  moonHalo.position.copy(moonPos);
  moonHalo.scale.set(44, 44, 1);
  scene.add(moonHalo);

  // 月亮打包（daynight 整组控制昼隐夜显）
  const moonGroup = new THREE.Group();
  scene.remove(moon); scene.remove(moonHalo);
  moonGroup.add(moon); moonGroup.add(moonHalo);
  scene.add(moonGroup);

  // ------------------------------------------------------------
  // 3.5 太阳盘（白天东升西落，8 边形像素太阳 + 光晕）
  // ------------------------------------------------------------
  const sunDisc = new THREE.Group();
  const sunCore = new THREE.Mesh(
    new THREE.CircleGeometry(10, 8),
    new THREE.MeshBasicMaterial({ color: hexNum('flowerYel'), fog: false }),
  );
  const sunHalo = new THREE.Sprite(glowSpriteMat('winWarm', 0.35));
  sunHalo.scale.set(38, 38, 1);
  sunDisc.add(sunCore); sunDisc.add(sunHalo);
  sunDisc.visible = false;
  scene.add(sunDisc);

  // ------------------------------------------------------------
  // 4. 像素云 ×4（方块蓬松组，缓慢东→西漂）
  // ------------------------------------------------------------
  const clouds = [];
  const cloudBoxes = [
    [0, 0, 0, 6, 2, 4], [4, -0.6, 1, 4, 1.6, 3], [-4, -0.4, -1, 3.6, 1.4, 3],
    [1.5, 1.6, 0, 4.4, 1.4, 3.4], [-1.5, -1.2, 0.5, 3, 1.2, 2.6],
  ];
  for (let i = 0; i < 4; i++) {
    const cloud = new THREE.Group();
    const shade = i % 2 ? 'moonGlow' : 'star';
    for (const [bx, by, bz, w, h, d] of cloudBoxes) {
      const baseOpacity = shade === 'star' ? 0.5 : 0.62;
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshBasicMaterial({
          color: hexNum(shade), fog: false,
          transparent: true, opacity: baseOpacity,
        }),
      );
      m.material.userData.baseOpacity = baseOpacity; // weather 云量控制基准
      m.position.set(bx, by, bz);
      cloud.add(m);
    }
    const s = 0.9 + rng() * 0.9;
    cloud.scale.set(s, s * 0.8, s);
    cloud.position.set(
      (rng() - 0.5) * 300,  // x
      58 + rng() * 26,      // y
      (rng() - 0.5) * 260,  // z
    );
    scene.add(cloud);
    clouds.push({ g: cloud, speed: 0.7 + rng() * 0.9 });
  }

  // ------------------------------------------------------------
  // 5. 飞鸟编队（偶发横穿：V 字 5 只，翅膀两方块拍动）
  // ------------------------------------------------------------
  const flock = new THREE.Group();
  scene.add(flock);
  flock.visible = false;
  const birdMat = new THREE.MeshBasicMaterial({ color: hexNum('skyTop'), fog: false });
  const birds = [];
  for (let i = 0; i < 5; i++) {
    const b = new THREE.Group();
    const row = Math.ceil(i / 2), side = i === 0 ? 0 : (i % 2 ? 1 : -1);
    b.position.set(-side * 7 * Math.abs(row), -row * 2.2, -row * 4);
    const wl = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.4, 1.1), birdMat);
    const wr = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.4, 1.1), birdMat);
    wl.position.x = -1.7; wr.position.x = 1.7;
    b.add(wl); b.add(wr);
    flock.add(b);
    birds.push({ g: b, wl, wr, phase: rng() * Math.PI * 2 });
  }
  let flockState = { active: false, t: 0, nextAt: 14 + rng() * 18, y: 60, speed: 26 };

  // ------------------------------------------------------------
  // 6. 流星（偶发斜落，亮头 + 渐隐尾）
  // ------------------------------------------------------------
  const meteor = new THREE.Group();
  scene.add(meteor);
  meteor.visible = false;
  const meteorHead = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 1.6, 1.6),
    new THREE.MeshBasicMaterial({ color: hexNum('star'), fog: false }),
  );
  const meteorTail = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.9, 16),
    new THREE.MeshBasicMaterial({ color: hexNum('starWarm'), fog: false, transparent: true, opacity: 0.55 }),
  );
  meteorTail.position.z = 8.5;
  meteor.add(meteorHead); meteor.add(meteorTail);
  let meteorState = { active: false, t: 0, nextAt: 18 + rng() * 20, dur: 1.1 };
  // 流星雨（剧情触发）：burstUntil 内每颗流星结束立即接下一颗
  let burstUntil = -1;

  /** 剧情流星雨：seconds 秒内流星密集连发 */
  function burstMeteors(count = 12, seconds = 4) {
    burstUntil = clockT + seconds;
    meteorState.nextAt = 0.2; // 立即开始
  }
  let clockT = 0; // tick 累计时间（burst 计时用）

  // ------------------------------------------------------------
  // 7. 极光（冬夜限定）：北天两道波浪光带，缓慢流动（防晕：低频缓变）
  // ------------------------------------------------------------
  const auroraMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0.0 }, // 0 隐藏 → 1 全显（淡入淡出）
      uHueA: { value: new THREE.Color('#7ad4a0') }, // 极光绿
      uHueB: { value: new THREE.Color('#7a9ad4') }, // 冷蓝紫边
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uTime; uniform float uOpacity;
      uniform vec3 uHueA; uniform vec3 uHueB;
      varying vec2 vUv;
      void main() {
        // 两道正弦垂幕（uv.x 横向，uv.y 从天顶向下垂）
        float wave1 = sin(vUv.x * 6.2831 + uTime * 0.10) * 0.5 + 0.5;
        float wave2 = sin(vUv.x * 9.42 - uTime * 0.06 + 1.7) * 0.5 + 0.5;
        float band = smoothstep(0.35, 0.9, 1.0 - abs(vUv.y - wave1 * 0.28 - 0.30) * 3.2);
        float band2 = smoothstep(0.4, 1.0, 1.0 - abs(vUv.y - wave2 * 0.22 - 0.62) * 2.6) * 0.7;
        float a = (band + band2) * smoothstep(0.0, 0.15, vUv.y) * smoothstep(1.0, 0.75, vUv.y);
        // 像素量化（粗颗粒光带，贴画风）
        a = floor(a * 5.0) / 5.0;
        vec3 col = mix(uHueA, uHueB, vUv.y);
        gl_FragColor = vec4(col, a * 0.55 * uOpacity);
      }
    `,
  });
  const aurora = new THREE.Mesh(new THREE.PlaneGeometry(340, 120, 1, 1), auroraMat);
  aurora.position.set(0, 85, -170);
  aurora.visible = false;
  scene.add(aurora);
  let auroraTarget = 0; // 0 关 1 开

  /** 极光开关（冬夜/控制台/剧情） */
  function setAurora(on) { auroraTarget = on ? 1 : 0; }
  function auroraOn() { return auroraTarget > 0.5; }

  // ------------------------------------------------------------
  // 总更新器
  // ------------------------------------------------------------
  const tmpV = new THREE.Vector3();
  function tickSky(dt, t) {
    clockT = t;
    starMatFar.uniforms.uTime.value = t;
    starMatNear.uniforms.uTime.value = t;

    // 极光淡入淡出 + 波动
    auroraMat.uniforms.uTime.value = t;
    const cur = auroraMat.uniforms.uOpacity.value;
    auroraMat.uniforms.uOpacity.value = cur + (auroraTarget - cur) * Math.min(1, dt * 0.5);
    aurora.visible = auroraMat.uniforms.uOpacity.value > 0.02;

    // 月晕呼吸
    const breathe = 0.85 + 0.15 * Math.sin(t * 0.4);
    moonHalo.material.opacity = 0.3 * breathe;
    moonHalo.scale.set(44 * breathe, 44 * breathe, 1);

    // 云漂移（东→西，出界回绕）
    for (const c of clouds) {
      c.g.position.x -= c.speed * dt;
      if (c.g.position.x < -190) {
        c.g.position.x = 190;
        c.g.position.z = (rng() - 0.5) * 260;
      }
    }

    // 飞鸟状态机
    if (!flockState.active) {
      flockState.nextAt -= dt;
      if (flockState.nextAt <= 0) {
        flockState.active = true;
        flockState.t = 0;
        flockState.y = 52 + rng() * 22;
        flock.visible = true;
        flock.position.set(200, flockState.y, (rng() - 0.5) * 160);
        flock.rotation.y = Math.PI / 2 + (rng() - 0.5) * 0.8;
      }
    } else {
      flockState.t += dt;
      flock.position.x -= flockState.speed * dt;
      for (const b of birds) {
        const flap = Math.sin(t * 11 + b.phase);
        b.wl.rotation.z = flap * 0.55;
        b.wr.rotation.z = -flap * 0.55;
        b.g.position.y += Math.sin(t * 2.2 + b.phase) * dt * 1.4;
      }
      if (flock.position.x < -220) {
        flock.visible = false;
        flockState.active = false;
        flockState.nextAt = 16 + rng() * 22;
      }
    }

    // 流星状态机
    if (!meteorState.active) {
      meteorState.nextAt -= dt;
      if (meteorState.nextAt <= 0) {
        meteorState.active = true;
        meteorState.t = 0;
        meteor.visible = true;
        // 从天顶随机方向斜落
        const ang = rng() * Math.PI * 2;
        const sx = Math.cos(ang) * 130, sz = Math.sin(ang) * 130;
        meteor.position.set(sx, 95 + rng() * 40, sz);
        tmpV.set(-sx * 0.6, -70, -sz * 0.6).normalize();
        meteor.lookAt(meteor.position.clone().add(tmpV));
      }
    } else {
      meteorState.t += dt;
      meteor.position.addScaledVector(tmpV, 95 * dt);
      const k = Math.max(0, 1 - meteorState.t / meteorState.dur);
      meteorHead.scale.setScalar(0.4 + k);
      meteorTail.material.opacity = 0.55 * k;
      meteorTail.scale.z = 0.3 + k;
      if (meteorState.t >= meteorState.dur) {
        meteor.visible = false;
        meteorState.active = false;
        // 流星雨中：连发；平时：长间隔
        meteorState.nextAt = (clockT < burstUntil) ? 0.25 + rng() * 0.5 : 14 + rng() * 24;
      }
    }
  }

  // 对象化返回：daynight/weather/story 拿引用
  return {
    tick: tickSky,
    skyMats: [skyMat],
    starMats: [starMatFar, starMatNear],
    moonGroup,
    sunDisc,
    clouds,
    burstMeteors,
    setAurora,
    auroraOn,
  };
}
