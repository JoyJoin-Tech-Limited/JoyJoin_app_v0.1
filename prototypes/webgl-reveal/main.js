// JoyJoin WebGL Reveal Spike — "命格凝成" land moment (~2.6s)
// Beats: drum decel → white flash + GPU particle burst → card ejects w/ dolly → foil settle + name.
// Query params: ?t=SECONDS (freeze frame, deterministic) · ?bloom=0 · ?hud=1
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

const Q = new URLSearchParams(location.search);
const FREEZE = Q.has('t') ? parseFloat(Q.get('t')) : null;
const USE_BLOOM = Q.get('bloom') !== '0';
const SHOW_HUD = Q.get('hud') === '1' || FREEZE !== null;

// ---- brand ----
const ACCENT = new THREE.Color('#CB9268');   // corgi warm tan (packages/shared archetypeColors)
const GOLD = new THREE.Color('#E8B45A');
const CREAM = new THREE.Color('#F5EAD9');
const BG = new THREE.Color('#140e18');

// ---- seeded rng (deterministic frames for the audit) ----
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rand = mulberry32(20260719);

// ---- timeline (seconds) ----
const T = { drumEnd: 0.9, flash: 0.9, burst: 0.9, cardIn: 0.9, cardSettle: 1.7, nameStart: 1.75, end: 2.6 };
const easeOutCubic = x => 1 - Math.pow(1 - x, 3);
const easeInOut = x => x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
const spring = x => 1 + 2.2 * Math.exp(-4.5 * x) * Math.sin(x * 12) * -1 + 0; // overshoot settle 0→1
const clamp01 = x => Math.min(1, Math.max(0, x));

// ---- renderer / scene ----
const stage = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = BG;
scene.fog = new THREE.Fog(BG, 12, 26);

const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 60);
camera.position.set(0, 0.4, 14);

// ---- post: bloom ----
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.45, 0.5, 0.85);
if (USE_BLOOM) composer.addPass(bloom);

// ---- textures ----
const loader = new THREE.TextureLoader();
const tex = p => new Promise(res => loader.load(p, t => { t.colorSpace = THREE.SRGBColorSpace; res(t); }));
const cardTex = await Promise.all(['corgi', 'fox', 'cat', 'owl', 'koala', 'dolphin_calm']
  .map(n => tex(`./assets/archetype-${n}.webp`)));

// ---- drum: 12 cards on a ring (cover-fit UVs — textures are 694×663, planes are portrait) ----
const TEX_ASPECT = 694 / 663;
const coverMat = (map, w, h) => new THREE.ShaderMaterial({
  uniforms: { uMap: { value: map }, uFit: { value: (w / h) / TEX_ASPECT } },
  transparent: true, side: THREE.DoubleSide,
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D uMap; uniform float uFit; varying vec2 vUv;
    void main() {
      vec2 uv = vec2((vUv.x - .5) * uFit + .5, vUv.y);   // cover-crop sides
      gl_FragColor = texture2D(uMap, uv);
    }`,
});
const drum = new THREE.Group();
const R = 4.6;
for (let i = 0; i < 12; i++) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(1.8, 2.4),
    coverMat(cardTex[i % cardTex.length], 1.8, 2.4)
  );
  const a = (i / 12) * Math.PI * 2;
  m.position.set(Math.sin(a) * R, 0, Math.cos(a) * R - 2);
  m.lookAt(0, 0, -2);
  drum.add(m);
}
scene.add(drum);

// ---- hero card (corgi) with foil shader ----
// ---- hero card: Pokémon-style frame drawn on a 2D canvas (same technique as prod poster gen) ----
// Layout gist: accent outer frame · name banner + typicality pill · framed art window (holo zone)
// · blend flavor line · keyword pills · set/rarity footer. 744×1039 (63:88 card ratio).
function makeCardTexture(img, { name, badge, keywords, blendLine, accent, index }) {
  const W = 744, H = 1039;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const x = cv.getContext('2d');
  const rr = (x0, y0, w, h, r) => { x.beginPath(); x.roundRect(x0, y0, w, h, r); };

  // body + outer accent frame + inner gold hairline
  rr(4, 4, W - 8, H - 8, 46); x.fillStyle = '#F7EFE3'; x.fill();
  x.lineWidth = 20; x.strokeStyle = accent; x.stroke();
  rr(30, 30, W - 60, H - 60, 30); x.lineWidth = 3; x.strokeStyle = 'rgba(203,146,104,.45)'; x.stroke();

  // header: name + typicality pill
  x.fillStyle = '#3A2A1E'; x.font = '800 74px "PingFang SC", sans-serif';
  x.textBaseline = 'middle';
  x.fillText(name, 58, 108);
  const pw = 150;
  rr(W - 58 - pw, 76, pw, 64, 32); x.fillStyle = accent; x.fill();
  x.fillStyle = '#FFF8EE'; x.font = '700 36px "PingFang SC", sans-serif'; x.textAlign = 'center';
  x.fillText(badge, W - 58 - pw / 2, 110);
  x.textAlign = 'left';
  x.fillStyle = 'rgba(58,42,30,.5)'; x.font = '400 27px "PingFang SC", sans-serif';
  x.fillText('J O Y J O I N · 命 格 卡', 60, 166);

  // art window (the holo zone)
  const ax = 58, ay = 200, aw = W - 116, ah = 620;
  rr(ax, ay, aw, ah, 26); x.save(); x.clip();
  // cover-crop the 694×663 art into the window
  const s = Math.max(aw / img.width, ah / img.height);
  x.drawImage(img, ax + (aw - img.width * s) / 2, ay + (ah - img.height * s) / 2, img.width * s, img.height * s);
  x.restore();
  rr(ax, ay, aw, ah, 26); x.lineWidth = 10; x.strokeStyle = accent; x.stroke();

  // blend flavor line
  x.fillStyle = 'rgba(58,42,30,.62)'; x.font = 'italic 400 34px "PingFang SC", sans-serif'; x.textAlign = 'center';
  x.fillText(blendLine, W / 2, 884);

  // keyword pills
  x.font = '600 32px "PingFang SC", sans-serif';
  const kwW = 168, gap = 24, total = keywords.length * kwW + (keywords.length - 1) * gap;
  keywords.forEach((k, i) => {
    const kx = (W - total) / 2 + i * (kwW + gap);
    rr(kx, 916, kwW, 62, 31); x.strokeStyle = accent; x.lineWidth = 3; x.stroke();
    x.fillStyle = '#6B4F35'; x.fillText(k, kx + kwW / 2, 948);
  });

  // footer: set info + rarity star
  x.fillStyle = 'rgba(58,42,30,.45)'; x.font = '400 26px monospace'; x.textAlign = 'left';
  x.fillText(`JOYJOIN · No.${String(index).padStart(2, '0')}/12`, 58, 1008);
  x.fillStyle = accent; x.font = '400 34px sans-serif'; x.textAlign = 'right';
  x.fillText('★', W - 58, 1008);

  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const corgiImg = await new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = './assets/archetype-corgi.webp'; });
const cardFaceTex = makeCardTexture(corgiImg, {
  name: '开心柯基', badge: '典型', keywords: ['热情', '治愈', '社交'],
  blendLine: '隐约有狐狸的影子', accent: '#CB9268', index: 1,
});

const foilUniforms = {
  uMap: { value: cardFaceTex },
  uTime: { value: 0 },
  uTilt: { value: new THREE.Vector2(0, 0) },
  uGlow: { value: 0 },
};
const foilMat = new THREE.ShaderMaterial({
  uniforms: foilUniforms,
  transparent: true,
  vertexShader: /* glsl */`
    varying vec2 vUv; varying vec3 vN; varying vec3 vV;
    void main() {
      vUv = uv;
      vN = normalize(normalMatrix * normal);
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vV = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */`
    uniform sampler2D uMap; uniform float uTime; uniform vec2 uTilt; uniform float uGlow;
    varying vec2 vUv; varying vec3 vN; varying vec3 vV;
    vec3 rainbow(float x) { return .5 + .5 * cos(6.2831 * (x + vec3(0, .33, .67))); }
    void main() {
      vec4 tex = texture2D(uMap, vUv);
      // holo sheen concentrated in the art window (canvas layout: x .078-.922, y .193-.789 → v .211-.807)
      float inArt = step(.078, vUv.x) * step(vUv.x, .922) * step(.211, vUv.y) * step(vUv.y, .807);
      float fres = pow(1.0 - abs(dot(normalize(vV), normalize(vN))), 1.6);
      // moving specular band, driven by time + tilt
      float band = smoothstep(.0, .28, .28 - abs(vUv.x + vUv.y * .6 - fract(uTime * .18 + uTilt.x * .5) * 1.6));
      vec3 iri = rainbow(vUv.x * .7 + vUv.y * .4 + uTilt.y * .3);
      vec3 col = tex.rgb * 0.88 + iri * (fres * .10 + band * (.03 + .11 * inArt)) + vec3(1.0, .9, .75) * uGlow * 0.45;
      gl_FragColor = vec4(col, tex.a);
    }`,
});
const hero = new THREE.Group();
const heroFace = new THREE.Mesh(new THREE.PlaneGeometry(3.06, 4.27), foilMat); // 63:88 card ratio
hero.add(heroFace);
hero.position.set(0, 0, -2); // starts inside drum
hero.scale.setScalar(0.6);
scene.add(hero);

// ---- GPU particle burst (time-driven, zero CPU per frame) ----
const COUNT = 2200;
const pGeo = new THREE.BufferGeometry();
{
  const pos = new Float32Array(COUNT * 3);
  const dir = new Float32Array(COUNT * 3);
  const rnd = new Float32Array(COUNT * 4); // speed, size, life offset, colorMix
  for (let i = 0; i < COUNT; i++) {
    // radial disc-ish explosion biased toward camera plane
    const th = rand() * Math.PI * 2, ph = Math.acos(2 * rand() - 1);
    const v = new THREE.Vector3(Math.sin(ph) * Math.cos(th), Math.sin(ph) * Math.sin(th), Math.cos(ph) * 0.45).normalize();
    dir.set([v.x, v.y, v.z], i * 3);
    rnd.set([1.5 + rand() * 6.5, 0.5 + rand() * 1.6, rand() * 0.25, rand()], i * 4);
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  pGeo.setAttribute('aDir', new THREE.BufferAttribute(dir, 3));
  pGeo.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 4));
}
const pUniforms = {
  uT: { value: -1 },                 // seconds since burst; <0 = hidden
  uAccent: { value: ACCENT },
  uGold: { value: GOLD },
  uCream: { value: CREAM },
};
const pMat = new THREE.ShaderMaterial({
  uniforms: pUniforms,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: /* glsl */`
    attribute vec3 aDir; attribute vec4 aRnd;
    uniform float uT;
    varying float vFade; varying float vMix;
    void main() {
      float t = max(uT - aRnd.z, 0.0);
      float speed = aRnd.x;
      vec3 p = aDir * speed * t * exp(-t * 0.9);          // drag
      p += vec3(sin(t * 5.0 + aRnd.w * 40.0), cos(t * 4.0 + aRnd.w * 31.0), 0.0) * 0.12 * t; // turbulence
      p.y += t * t * -0.55;                               // gravity
      vFade = exp(-t * 1.5) * step(0.0, uT);
      vMix = aRnd.w;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = aRnd.y * 9.0 * (10.0 / -mv.z) * vFade;
    }`,
  fragmentShader: /* glsl */`
    uniform vec3 uAccent; uniform vec3 uGold; uniform vec3 uCream;
    varying float vFade; varying float vMix;
    void main() {
      vec2 c = gl_PointCoord - .5;
      float d = smoothstep(.5, .05, length(c));
      vec3 col = vMix < .45 ? uAccent : (vMix < .8 ? uGold : uCream);
      gl_FragColor = vec4(col * 1.25, d * vFade);
    }`,
});
const burst = new THREE.Points(pGeo, pMat);
burst.position.set(0, 0, 3.2);
burst.frustumCulled = false;
scene.add(burst);

// ---- ambient dust (always-on depth cue) ----
const DUST = 260;
const dGeo = new THREE.BufferGeometry();
{
  const pos = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST; i++) pos.set([(rand() - .5) * 18, (rand() - .5) * 12, (rand() - .5) * 10 + 2], i * 3);
  dGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
}
const dust = new THREE.Points(dGeo, new THREE.PointsMaterial({
  color: 0x9a7fb0, size: 0.035, transparent: true, opacity: 0.5, depthWrite: false,
}));
scene.add(dust);

// ---- DOM: flash + name ----
const flashEl = document.getElementById('flash');
const nameEl = document.getElementById('name');
nameEl.innerHTML =
  [...'开心柯基'].map((c, i) => `<span class="ch" style="animation-delay:${i * 0.09}s">${c}</span>`).join('') +
  `<div class="sub" style="animation-delay:.45s">典 型 命 格</div>`;

// ---- tilt (mouse = gyro stand-in) ----
const tilt = new THREE.Vector2();
addEventListener('pointermove', e => {
  tilt.set((e.clientX / innerWidth - .5) * 2, (e.clientY / innerHeight - .5) * 2);
});

// ---- per-frame timeline evaluation ----
function applyTime(t) {
  // drum: fast spin decelerating, then gone
  const spinP = clamp01(t / T.drumEnd);
  drum.rotation.y = -Math.PI * 4 * (1 - easeOutCubic(spinP));
  const drumFade = 1 - clamp01((t - T.cardIn) / 0.45);
  drum.children.forEach(c => c.material.opacity = drumFade);
  drum.visible = drumFade > 0;

  // camera dolly
  const camP = easeInOut(clamp01(t / T.end));
  camera.position.z = 14 - camP * 5.0;
  camera.position.y = 0.4 - camP * 0.4;

  // hero card: eject from drum → spring settle at z≈3.2
  const cp = clamp01((t - T.cardIn) / (T.cardSettle - T.cardIn));
  hero.visible = cp > 0;
  if (cp > 0) {
    const s = spring(cp);
    hero.position.z = -2 + easeOutCubic(cp) * 4.0;
    hero.scale.setScalar(0.6 + 0.12 * easeOutCubic(cp) * (1 + 0.12 * (1 - cp) * Math.sin(cp * 9)));
    hero.rotation.z = (1 - cp) * 0.35 * Math.sin(cp * 6);
    hero.rotation.y = (1 - cp) * -0.6;
  }
  // idle float + tilt after settle
  const settle = clamp01((t - T.cardSettle) / 0.3);
  hero.rotation.y += settle * tilt.x * 0.22;
  hero.rotation.x = settle * -tilt.y * 0.16;
  hero.position.y = settle * Math.sin(t * 1.4) * 0.05;

  // foil uniforms
  foilUniforms.uTime.value = t;
  foilUniforms.uTilt.value.lerp(tilt, 0.08);
  foilUniforms.uGlow.value = t < T.flash ? 0 : Math.exp(-(t - T.flash) * 3.2) * 0.9; // hot at flash, cools

  // particles
  pUniforms.uT.value = t - T.burst;

  // bloom pulse on flash, then relax
  bloom.strength = USE_BLOOM ? 0.4 + Math.exp(-Math.max(0, t - T.flash) * 2.6) * 0.85 : 0;

  // dust drift
  dust.rotation.y = t * 0.02;

  // DOM: flash + name
  flashEl.style.opacity = t < T.flash ? 0 : Math.exp(-(t - T.flash) * 5.5) * 0.85;
  const nameOn = t >= T.nameStart;
  nameEl.style.visibility = nameOn ? 'visible' : 'hidden';
  if (nameOn && FREEZE !== null) {
    // deterministic frozen CSS animations: negative delay = already progressed
    const local = t - T.nameStart;
    nameEl.querySelectorAll('.ch,.sub').forEach(el => {
      el.style.animationPlayState = 'paused';
      const base = parseFloat(el.style.animationDelay) || 0;
      el.style.animationDelay = `${base - local}s`;
    });
  }
}

// ---- HUD / fps ----
const hud = document.getElementById('hud');
let frames = 0, fpsT0 = performance.now(), fps = 0;

function render(t) {
  applyTime(t);
  if (USE_BLOOM) composer.render(); else renderer.render(scene, camera);
}

if (FREEZE !== null) {
  render(FREEZE);
  hud.textContent = SHOW_HUD ? `freeze t=${FREEZE}s  bloom=${USE_BLOOM}` : '';
} else {
  const clock = new THREE.Clock();
  const LOOP = T.end + 1.2; // hold final frame a moment, then replay
  renderer.setAnimationLoop(() => {
    const t = clock.getElapsedTime() % LOOP;
    render(t);
    frames++;
    const now = performance.now();
    if (now - fpsT0 >= 1000) { fps = frames; frames = 0; fpsT0 = now; }
    if (SHOW_HUD) hud.textContent = `t=${t.toFixed(2)}s  fps=${fps}  dpr=${renderer.getPixelRatio()}`;
  });
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});

// ---- contact-sheet mode: ?grid=0.2,0.5,0.85,... renders beats into one 2D canvas ----
if (Q.has('grid')) {
  const times = Q.get('grid').split(',').map(Number);
  const cols = 3, cw = 280, ch = 560;
  const rows = Math.ceil(times.length / cols);
  const sheet = document.createElement('canvas');
  sheet.width = cols * cw; sheet.height = rows * ch;
  sheet.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;object-fit:contain;background:#140e18';
  const ctx = sheet.getContext('2d');
  renderer.setSize(cw, ch);
  composer.setSize(cw, ch);
  camera.aspect = cw / ch;
  camera.updateProjectionMatrix();
  times.forEach((t, i) => {
    applyTime(t);
    if (USE_BLOOM) composer.render(); else renderer.render(scene, camera);
    ctx.drawImage(renderer.domElement, (i % cols) * cw, Math.floor(i / cols) * ch, cw, ch);
    ctx.fillStyle = '#8f8496'; ctx.font = '14px monospace';
    ctx.fillText(`t=${t}s`, (i % cols) * cw + 8, Math.floor(i / cols) * ch + 18);
  });
  document.body.appendChild(sheet);
  renderer.domElement.style.display = 'none';
}
