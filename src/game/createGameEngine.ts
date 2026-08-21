import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import GUI from 'lil-gui';
import {
  GLB_MODEL_PATH,
  LEVEL_COLORS,
  LEVEL_DEV_KEY,
  LEVEL_LABELS,
  LEVEL_ROUTE,
  LEVEL_ZONE_WEIGHT,
  MODEL_POSITION_OFFSET,
  P1_CAM,
  P1_TGT,
  PIN_KEY,
  applyModelOffset,
  isDevMode,
} from './constants.ts';

export interface GameEngineCallbacks {
  onLoadProgress?: (receivedBytes: number) => void;
  onLoadComplete?: () => void;
  onLoadError?: (error: unknown) => void;
}

export interface GameEngine {
  dispose(): void;
  flyToLevel(levelId: number, onComplete?: () => void): void;
  playOutroCelebration(): void;
  completeLevel(levelId: number): boolean;
  resetLevelProgress(): void;
  returnToLobby(): void;
  applyPanelAwareCamera(panelVisible: boolean, panelWidth: number): void;
  applyHandOrbit(deltaAzimuth: number, deltaPolar: number): boolean;
  applyHandZoom(deltaDistance: number): boolean;
  isModelReady(): boolean;
  getProgress(): number[];
}

interface LevelSlot {
  id: number;
  label: string;
  pos: [number, number, number] | null;
  cam: [number, number, number] | null;
  tgt: [number, number, number] | null;
  marker: THREE.Group | null;
}

interface MeshZone {
  mesh: THREE.Mesh;
  levelIdx: number;
  materials: THREE.MeshStandardMaterial[];
  origColors: THREE.Color[];
}

interface ColorAnimation {
  type: 'color';
  material: THREE.MeshStandardMaterial;
  from: THREE.Color;
  to: THREE.Color;
  start: number;
  duration: number;
}

interface ShockwaveAnimation {
  type: 'shockwave';
  mesh: THREE.Mesh;
  parent: THREE.Object3D;
  start: number;
  duration: number;
}

interface MarkerPopAnimation {
  type: 'markerPop';
  marker: THREE.Group;
  gem: THREE.Mesh | undefined;
  baseScale: number;
  start: number;
  duration: number;
}

interface BeamFlashAnimation {
  type: 'beamFlash';
  marker: THREE.Group;
  start: number;
  duration: number;
}

type LevelAnimation =
  | ColorAnimation
  | ShockwaveAnimation
  | MarkerPopAnimation
  | BeamFlashAnimation;

interface CameraFlyAnim {
  fromCam: THREE.Vector3;
  toCam: THREE.Vector3;
  fromTgt: THREE.Vector3;
  toTgt: THREE.Vector3;
  start: number;
  duration: number;
  levelIdx: number;
  onComplete: (() => void) | null;
}

interface PinEntry {
  label: string;
  pos: number[];
  tgt: number[];
}

interface MarkerUserData {
  levelNum: number;
  colorHex: string;
  pulseRing: THREE.Mesh;
  gem: THREE.Mesh;
  halo: THREE.Mesh;
  badge: THREE.Sprite;
  bobPhase: number;
  baseScale?: number;
}

interface BadgeUserData {
  badgeCanvas: HTMLCanvasElement;
  badgeCtx: CanvasRenderingContext2D;
  badgeSize: number;
}

function vec3Arr(v: THREE.Vector3): [number, number, number] {
  return [+v.x.toFixed(4), +v.y.toFixed(4), +v.z.toFixed(4)];
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

export function createGameEngine(
  container: HTMLElement,
  callbacks: GameEngineCallbacks = {},
): GameEngine {
  const DEV_MODE = isDevMode();
  if (DEV_MODE) document.body.classList.add('dev-mode');

  let model: THREE.Group | null = null;
  let routeGroup: THREE.Group | null = null;
  let routeLine: THREE.Line | null = null;
  let showRouteLine = true;
  let activeLevelIdx = 0;
  let modelMeshZones: MeshZone[] = [];
  const completedLevels = new Set<number>();
  let cameraFlyAnim: CameraFlyAnim | null = null;
  let panelVisible = false;
  let panelWidth = 0;
  let disposed = false;
  let rafId = 0;
  let _lastTick = performance.now();

  const levelSlots: LevelSlot[] = LEVEL_LABELS.map((label, i) => ({
    id: i + 1,
    label,
    pos: null,
    cam: null,
    tgt: null,
    marker: null,
  }));

  const levelAnimations: LevelAnimation[] = [];
  const _meshBox = new THREE.Box3();
  const _meshCenter = new THREE.Vector3();
  const _levelPoint = new THREE.Vector3();
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();

  let bgTex: THREE.CanvasTexture | null = null;
  function makeGradientBg(baseHex: string): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 1024;
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('2D canvas context unavailable');
    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, 1024, 1024);
    const glow = ctx.createRadialGradient(512, 620, 60, 512, 620, 820);
    glow.addColorStop(0.0, 'rgba(252, 253, 254, 1.00)');
    glow.addColorStop(0.35, 'rgba(238, 241, 244, 0.55)');
    glow.addColorStop(0.75, 'rgba(214, 218, 222, 0.10)');
    glow.addColorStop(1.0, 'rgba(214, 218, 222, 0.00)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 1024, 1024);
    const haze = ctx.createLinearGradient(0, 0, 0, 1024);
    haze.addColorStop(0.0, 'rgba(150, 158, 166, 0.18)');
    haze.addColorStop(0.45, 'rgba(150, 158, 166, 0.00)');
    haze.addColorStop(1.0, 'rgba(255, 255, 255, 0.06)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, 1024, 1024);
    if (!bgTex) {
      bgTex = new THREE.CanvasTexture(c);
      bgTex.colorSpace = THREE.SRGBColorSpace;
      bgTex.minFilter = THREE.LinearFilter;
      bgTex.magFilter = THREE.LinearFilter;
    } else {
      bgTex.image = c;
      bgTex.needsUpdate = true;
    }
    return bgTex;
  }
  scene.background = makeGradientBg('#d1d1d1');

  const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 2000);
  camera.position.set(7, 5, 9);
  camera.lookAt(0, 0, 0);

  const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.86);
  scene.add(hemi);

  const ambient = new THREE.AmbientLight(0xffffff, 0.29);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xffffff, 4.05);
  key.position.set(40, 100, 50);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 400;
  key.shadow.bias = -0.0009;
  key.shadow.radius = 1;
  key.shadow.blurSamples = 25;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xffffff, 0.29);
  fill.position.set(-60, 40, -30);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffffff, 0.0);
  rim.position.set(-30, 60, -80);
  scene.add(rim);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0;

  const gui = new GUI({ title: '⚙ lighting', width: 280 });
  gui.domElement.style.zIndex = '9999';
  gui.domElement.style.position = 'fixed';
  gui.domElement.style.top = '60px';
  gui.domElement.style.right = '14px';
  gui.hide();

  const params = {
    bgColor: '#d1d1d1',
    ambientIntensity: 0.29,
    ambientColor: '#ffffff',
    hemiIntensity: 0.86,
    hemiSky: '#ffffff',
    hemiGround: '#ffffff',
    keyIntensity: 4.05,
    keyColor: '#ffffff',
    keyShadowRadius: 1,
    keyShadowBias: -0.0009,
    fillIntensity: 0.29,
    fillColor: '#ffffff',
    rimIntensity: 0.0,
    rimColor: '#ffffff',
    envIntensity: 0,
    autoRotate: !DEV_MODE,
    reset: () => {
      Object.assign(params, defaults);
      gui.controllersRecursive().forEach((c) => c.updateDisplay());
      applyAll();
    },
  };
  const defaults = { ...params };

  function applyAll() {
    scene.background = makeGradientBg(params.bgColor);
    ambient.intensity = params.ambientIntensity;
    ambient.color.set(params.ambientColor);
    hemi.intensity = params.hemiIntensity;
    hemi.color.set(params.hemiSky);
    hemi.groundColor.set(params.hemiGround);
    key.intensity = params.keyIntensity;
    key.color.set(params.keyColor);
    key.shadow.radius = params.keyShadowRadius;
    key.shadow.bias = params.keyShadowBias;
    fill.intensity = params.fillIntensity;
    fill.color.set(params.fillColor);
    rim.intensity = params.rimIntensity;
    rim.color.set(params.rimColor);
    scene.environmentIntensity = params.envIntensity;
  }

  const fBg = gui.addFolder('Background');
  fBg.addColor(params, 'bgColor').onChange(() => {
    scene.background = makeGradientBg(params.bgColor);
  });

  const fAmb = gui.addFolder('Ambient');
  fAmb.add(params, 'ambientIntensity', 0, 3, 0.01).onChange((v: number) => {
    ambient.intensity = v;
  });
  fAmb.addColor(params, 'ambientColor').onChange((c: string) => ambient.color.set(c));

  const fHemi = gui.addFolder('Hemisphere');
  fHemi.add(params, 'hemiIntensity', 0, 3, 0.01).onChange((v: number) => {
    hemi.intensity = v;
  });
  fHemi.addColor(params, 'hemiSky').onChange((c: string) => hemi.color.set(c));
  fHemi.addColor(params, 'hemiGround').onChange((c: string) => hemi.groundColor.set(c));

  const fKey = gui.addFolder('Key Light (主光)');
  fKey.add(params, 'keyIntensity', 0, 6, 0.05).onChange((v: number) => {
    key.intensity = v;
  });
  fKey.addColor(params, 'keyColor').onChange((c: string) => key.color.set(c));
  fKey.add(params, 'keyShadowRadius', 0, 20, 0.5).onChange((v: number) => {
    key.shadow.radius = v;
  });
  fKey.add(params, 'keyShadowBias', -0.01, 0.01, 0.0001).onChange((v: number) => {
    key.shadow.bias = v;
  });

  const fFill = gui.addFolder('Fill Light (补光)');
  fFill.add(params, 'fillIntensity', 0, 3, 0.01).onChange((v: number) => {
    fill.intensity = v;
  });
  fFill.addColor(params, 'fillColor').onChange((c: string) => fill.color.set(c));

  const fRim = gui.addFolder('Rim Light (背光)');
  fRim.add(params, 'rimIntensity', 0, 3, 0.01).onChange((v: number) => {
    rim.intensity = v;
  });
  fRim.addColor(params, 'rimColor').onChange((c: string) => rim.color.set(c));

  const fEnv = gui.addFolder('Environment');
  fEnv.add(params, 'envIntensity', 0, 3, 0.01).onChange((v: number) => {
    scene.environmentIntensity = v;
  });

  gui.add(params, 'autoRotate').name('🔄 Auto Rotate');
  gui.add(params, 'reset').name('↺ Reset All');

  let pinList: PinEntry[] = [];
  try {
    pinList = JSON.parse(localStorage.getItem(PIN_KEY) || '[]') as PinEntry[];
  } catch {
    pinList = [];
  }
  if (pinList.length === 0) {
    pinList.push({ label: 'P1', pos: applyModelOffset(P1_CAM), tgt: applyModelOffset(P1_TGT) });
  }

  function savePinList() {
    try {
      localStorage.setItem(PIN_KEY, JSON.stringify(pinList));
    } catch {
      /* ignore quota errors */
    }
  }

  const fPin = gui.addFolder('📍 视角');
  fPin.add(
    {
      pin: () => {
        const pos = camera.position.toArray();
        const tgt = controls.target.toArray();
        const label = `P${pinList.length + 1}`;
        pinList.push({
          label,
          pos: pos.map((v) => +v.toFixed(4)),
          tgt: tgt.map((v) => +v.toFixed(4)),
        });
        savePinList();
        console.log(
          `📍 Pinned ${label}: cam=[${pos.map((v) => v.toFixed(2)).join(', ')}], tgt=[${tgt.map((v) => v.toFixed(2)).join(', ')}]`,
        );
      },
    },
    'pin',
  ).name('📍 记下当前视角');
  fPin.add(
    {
      goP1: () => {
        if (pinList.length === 0) {
          console.warn('📍 no pinned views yet');
          return;
        }
        const p = pinList[0];
        camera.position.set(p.pos[0], p.pos[1], p.pos[2]);
        controls.target.set(p.tgt[0], p.tgt[1], p.tgt[2]);
        camera.updateProjectionMatrix();
        controls.update();
      },
    },
    'goP1',
  ).name('↩ 回到 P1');
  fPin.add(
    {
      clear: () => {
        pinList = [];
        savePinList();
      },
    },
    'clear',
  ).name('🗑 清空序列');

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 0, 0);
  controls.minDistance = 4;
  controls.maxDistance = 600;

  function devFlash(msg: string) {
    console.log(`[dev] ${msg}`);
  }

  function loadLevelDevState(): boolean {
    try {
      const raw = localStorage.getItem(LEVEL_DEV_KEY);
      if (!raw) return false;
      const saved = JSON.parse(raw) as Array<{
        pos?: [number, number, number];
        cam?: [number, number, number];
        tgt?: [number, number, number];
      }>;
      if (!Array.isArray(saved)) return false;
      saved.forEach((entry, i) => {
        if (!levelSlots[i] || !entry) return;
        levelSlots[i].pos = entry.pos ? [...entry.pos] : null;
        levelSlots[i].cam = entry.cam ? [...entry.cam] : null;
        levelSlots[i].tgt = entry.tgt ? [...entry.tgt] : null;
      });
      return levelSlots.some((slot) => slot.pos);
    } catch (e) {
      console.warn('level dev load failed', e);
      return false;
    }
  }

  function applyLevelRouteDefaults() {
    LEVEL_ROUTE.forEach((entry, i) => {
      if (!levelSlots[i]) return;
      levelSlots[i].pos = entry.pos ? [...entry.pos] : null;
      levelSlots[i].cam = entry.cam ? [...entry.cam] : null;
      levelSlots[i].tgt = entry.tgt ? [...entry.tgt] : null;
    });
  }

  function loadLevelRouteData() {
    if (DEV_MODE && loadLevelDevState()) return;
    applyLevelRouteDefaults();
  }

  function cloneMeshMaterials(mesh: THREE.Mesh): THREE.MeshStandardMaterial[] {
    if (!mesh.material) return [];
    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map((m) => m.clone());
      return mesh.material as THREE.MeshStandardMaterial[];
    }
    mesh.material = mesh.material.clone();
    return [mesh.material as THREE.MeshStandardMaterial];
  }

  function isWhiteMembraneMaterial(material: THREE.Material): boolean {
    const std = material as THREE.MeshStandardMaterial;
    if (!std.color) return false;
    const { r, g, b } = std.color;
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    return lum > 0.72 && r > 0.65 && g > 0.65 && b > 0.65;
  }

  function nearestLevelIndex(localCenter: THREE.Vector3): number {
    let best = 0;
    let bestDist = Infinity;
    levelSlots.forEach((slot, i) => {
      if (!slot.pos) return;
      _levelPoint.set(slot.pos[0], slot.pos[1], slot.pos[2]);
      const weight = LEVEL_ZONE_WEIGHT[i] ?? 1;
      const d = localCenter.distanceToSquared(_levelPoint) * weight;
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    return best;
  }

  function indexModelMeshZones() {
    modelMeshZones = [];
    if (!model) return;

    model.updateMatrixWorld(true);
    model.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const materials = cloneMeshMaterials(o);
      _meshBox.setFromObject(o);
      _meshCenter.copy(_meshBox.getCenter(_meshCenter));
      model!.worldToLocal(_meshCenter);

      const paintableMaterials = materials.filter(isWhiteMembraneMaterial);
      if (!paintableMaterials.length) return;

      modelMeshZones.push({
        mesh: o,
        levelIdx: nearestLevelIndex(_meshCenter),
        materials: paintableMaterials,
        origColors: paintableMaterials.map((m) => m.color.clone()),
      });
    });
  }

  function updateLevelMarkerState(levelIdx: number) {
    const slot = levelSlots[levelIdx];
    if (!slot?.marker) return;
    const done = completedLevels.has(levelIdx + 1);
    const color = new THREE.Color(done ? '#ffffff' : LEVEL_COLORS[levelIdx]);
    const accent = new THREE.Color(LEVEL_COLORS[levelIdx]);

    slot.marker.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || !o.material || o.name === 'badge') return;
      const mat = o.material as THREE.MeshStandardMaterial;
      if (o.name === 'gem') {
        mat.color.copy(done ? accent : color);
        mat.emissive.copy(done ? accent : color);
        mat.emissiveIntensity = done ? 1.1 : 0.85;
        return;
      }
      if (mat.color) mat.color.copy(done ? accent : color);
    });

    refreshMarkerBadge(slot, levelIdx);
  }

  function paintLevelZone(levelId: number, { animate = false } = {}) {
    const idx = levelId - 1;
    if (idx < 0 || idx >= levelSlots.length) return;

    if (animate) {
      return paintLevelZoneAnimated(levelId);
    }

    const color = new THREE.Color(LEVEL_COLORS[idx]);
    let painted = 0;

    modelMeshZones.forEach((entry) => {
      if (entry.levelIdx !== idx) return;
      entry.materials.forEach((material) => {
        material.color.copy(color);
        material.needsUpdate = true;
        painted++;
      });
    });

    updateLevelMarkerState(idx);
    console.log(`🎨 ${LEVEL_LABELS[idx]} zone painted (${painted} materials)`);
    return painted;
  }

  function playLevelCompleteMarkerFx(levelIdx: number) {
    const slot = levelSlots[levelIdx];
    if (!slot?.marker) return;

    const color = new THREE.Color(LEVEL_COLORS[levelIdx]);
    const shockwave = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.78, 56),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    shockwave.rotation.x = -Math.PI / 2;
    shockwave.position.y = 0.14;
    shockwave.renderOrder = 15;
    slot.marker.add(shockwave);

    const userData = slot.marker.userData as MarkerUserData;
    levelAnimations.push({
      type: 'shockwave',
      mesh: shockwave,
      parent: slot.marker,
      start: performance.now(),
      duration: 1300,
    });

    levelAnimations.push({
      type: 'markerPop',
      marker: slot.marker,
      gem: userData.gem,
      baseScale: userData.baseScale ?? slot.marker.scale.x,
      start: performance.now(),
      duration: 780,
    });

    levelAnimations.push({
      type: 'beamFlash',
      marker: slot.marker,
      start: performance.now(),
      duration: 900,
    });
  }

  function paintLevelZoneAnimated(levelId: number) {
    const idx = levelId - 1;
    const color = new THREE.Color(LEVEL_COLORS[idx]);
    const slot = levelSlots[idx];
    const anchor = slot?.pos ? new THREE.Vector3(...slot.pos) : null;
    let painted = 0;

    modelMeshZones.forEach((entry) => {
      if (entry.levelIdx !== idx) return;
      entry.materials.forEach((material, mi) => {
        let delay = 0;
        if (anchor && model) {
          _meshBox.setFromObject(entry.mesh);
          _meshCenter.copy(_meshBox.getCenter(_meshCenter));
          model.worldToLocal(_meshCenter);
          delay = _meshCenter.distanceTo(anchor) * 7.5;
        }
        levelAnimations.push({
          type: 'color',
          material,
          from: entry.origColors[mi].clone(),
          to: color.clone(),
          start: performance.now() + delay,
          duration: 950,
        });
        painted++;
      });
    });

    playLevelCompleteMarkerFx(idx);
    updateLevelMarkerState(idx);
    console.log(`🎨 ${LEVEL_LABELS[idx]} zone animating (${painted} materials)`);
    return painted;
  }

  function updateLevelAnimations(now: number) {
    for (let i = levelAnimations.length - 1; i >= 0; i--) {
      const anim = levelAnimations[i];
      const elapsed = now - anim.start;
      if (elapsed < 0) continue;

      const t = Math.min(1, elapsed / anim.duration);

      if (anim.type === 'color') {
        anim.material.color.copy(anim.from).lerp(anim.to, easeOutCubic(t));
        anim.material.needsUpdate = true;
        if (t >= 1) levelAnimations.splice(i, 1);
        continue;
      }

      if (anim.type === 'shockwave') {
        const e = easeOutCubic(t);
        const s = 1 + e * 5.2;
        anim.mesh.scale.set(s, s, 1);
        (anim.mesh.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - e);
        if (t >= 1) {
          anim.parent.remove(anim.mesh);
          anim.mesh.geometry.dispose();
          (anim.mesh.material as THREE.Material).dispose();
          levelAnimations.splice(i, 1);
        }
        continue;
      }

      if (anim.type === 'markerPop') {
        const pop = 1 + Math.sin(Math.min(t, 1) * Math.PI) * 0.42;
        anim.marker.scale.setScalar(anim.baseScale * easeOutBack(Math.min(t * 1.15, 1)) * pop);
        const gemMat = anim.gem?.material as THREE.MeshStandardMaterial | undefined;
        if (gemMat) {
          gemMat.emissiveIntensity = 0.85 + Math.sin(t * Math.PI) * 1.35;
        }
        if (t >= 1) {
          anim.marker.scale.setScalar(anim.baseScale);
          if (gemMat) gemMat.emissiveIntensity = 1.1;
          levelAnimations.splice(i, 1);
        }
        continue;
      }

      if (anim.type === 'beamFlash') {
        const beam = anim.marker.children.find(
          (c) => c instanceof THREE.Mesh && c.geometry?.type === 'CylinderGeometry',
        ) as THREE.Mesh | undefined;
        const beamMat = beam?.material as THREE.MeshBasicMaterial | undefined;
        if (beamMat) {
          beamMat.opacity = 0.11 + Math.sin(t * Math.PI) * 0.38;
        }
        if (t >= 1) {
          if (beamMat) beamMat.opacity = 0.11;
          levelAnimations.splice(i, 1);
        }
      }
    }
  }

  function cancelLevelAnimations() {
    levelAnimations.forEach((anim) => {
      if (anim.type === 'shockwave') {
        anim.parent.remove(anim.mesh);
        anim.mesh.geometry.dispose();
        (anim.mesh.material as THREE.Material).dispose();
      }
    });
    levelAnimations.length = 0;
  }

  function updateCameraFly(now: number): boolean {
    if (!cameraFlyAnim) return false;

    const { fromCam, toCam, fromTgt, toTgt, start, duration, levelIdx, onComplete } = cameraFlyAnim;
    const t = Math.min(1, (now - start) / duration);
    const e = easeInOutCubic(t);

    camera.position.copy(fromCam).lerp(toCam, e);
    controls.target.copy(fromTgt).lerp(toTgt, e);
    camera.lookAt(controls.target);
    camera.updateProjectionMatrix();

    if (t >= 1) {
      const cb = onComplete;
      cameraFlyAnim = null;

      const landedDist = camera.position.distanceTo(controls.target);
      controls.minDistance = Math.min(controls.minDistance, landedDist * 0.92);

      controls.enabled = true;
      controls.update();
      const slot = levelSlots[levelIdx];
      const gem = (slot?.marker?.userData as MarkerUserData | undefined)?.gem;
      const gemMat = gem?.material as THREE.MeshStandardMaterial | undefined;
      if (gemMat) {
        gemMat.emissiveIntensity = completedLevels.has(levelIdx + 1) ? 1.1 : 0.85;
      }
      cb?.();
    }

    return t < 1;
  }

  function restoreLevelZone(levelId: number) {
    const idx = levelId - 1;
    modelMeshZones.forEach((entry) => {
      if (entry.levelIdx !== idx) return;
      entry.materials.forEach((material, i) => {
        material.color.copy(entry.origColors[i]);
        material.needsUpdate = true;
      });
    });
    updateLevelMarkerState(idx);
  }

  function completeLevel(levelId: number): boolean {
    if (levelId < 1 || levelId > levelSlots.length) return false;
    if (completedLevels.has(levelId)) return true;

    completedLevels.add(levelId);
    paintLevelZone(levelId, { animate: true });
    return true;
  }

  function resetLevelProgress() {
    cancelCameraFly();
    cancelLevelAnimations();
    [...completedLevels].forEach((id) => restoreLevelZone(id));
    completedLevels.clear();
    levelSlots.forEach((_, i) => updateLevelMarkerState(i));
  }

  function returnToLobby() {
    resetLevelProgress();
    if (!model) {
      setAutoRotate(!DEV_MODE);
      return;
    }
    flyToView(applyModelOffset(P1_CAM), applyModelOffset(P1_TGT), {
      duration: 1400,
      onComplete: () => setAutoRotate(!DEV_MODE),
    });
  }

  function applySavedLevelColors() {
    [...completedLevels].sort().forEach((id) => paintLevelZone(id, { animate: false }));
  }

  function computeLevelFlyView(posArr: [number, number, number]) {
    if (!model || !posArr) return null;

    const anchor = new THREE.Vector3(posArr[0], posArr[1], posArr[2]);
    model.localToWorld(anchor);
    const box = new THREE.Box3().setFromObject(model);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const center = sphere.center;
    const r = sphere.radius;

    const dist = Math.max(r * 0.18, 35);

    const outward = anchor.clone().sub(center);
    outward.y = 0;
    if (outward.lengthSq() < 4) outward.set(-0.85, 0, 0.42);
    outward.normalize();

    const size = box.getSize(new THREE.Vector3()).length();
    const s = Math.max(size * 0.011, 0.72);
    const badgeY = 4.85 * s;

    const cam = new THREE.Vector3(
      anchor.x + outward.x * dist,
      anchor.y + badgeY + dist * 0.55,
      anchor.z + outward.z * dist,
    );

    return {
      cam: [+cam.x.toFixed(4), +cam.y.toFixed(4), +cam.z.toFixed(4)] as [number, number, number],
      tgt: [+anchor.x.toFixed(4), +(anchor.y + badgeY).toFixed(4), +anchor.z.toFixed(4)] as [
        number,
        number,
        number,
      ],
    };
  }

  function setAutoRotate(enabled: boolean) {
    params.autoRotate = enabled;
    gui.controllersRecursive().forEach((c) => {
      if (c.property === 'autoRotate') c.updateDisplay();
    });
  }

  let handControlActive = false;
  let handControlIdleTimer: ReturnType<typeof window.setTimeout> | null = null;
  const handOrbitOffset = new THREE.Vector3();
  const handOrbitSpherical = new THREE.Spherical();
  const HAND_CONTROL_IDLE_MS = 5000;

  function scheduleHandControlIdle() {
    if (handControlIdleTimer) window.clearTimeout(handControlIdleTimer);
    handControlIdleTimer = window.setTimeout(() => {
      handControlActive = false;
      handControlIdleTimer = null;
      if (!cameraFlyAnim && !DEV_MODE) setAutoRotate(true);
    }, HAND_CONTROL_IDLE_MS);
  }

  function markHandControlActive() {
    handControlActive = true;
    setAutoRotate(false);
    scheduleHandControlIdle();
  }

  function applyHandOrbit(deltaAzimuth: number, deltaPolar: number): boolean {
    if (cameraFlyAnim || !model) return false;
    markHandControlActive();

    handOrbitOffset.subVectors(camera.position, controls.target);
    handOrbitSpherical.setFromVector3(handOrbitOffset);
    handOrbitSpherical.theta -= deltaAzimuth;
    handOrbitSpherical.phi = THREE.MathUtils.clamp(
      handOrbitSpherical.phi - deltaPolar,
      0.05,
      Math.PI - 0.05,
    );
    handOrbitOffset.setFromSpherical(handOrbitSpherical);
    camera.position.copy(controls.target).add(handOrbitOffset);
    camera.lookAt(controls.target);
    return true;
  }

  function applyHandZoom(deltaDistance: number): boolean {
    if (cameraFlyAnim || !model) return false;
    markHandControlActive();

    handOrbitOffset.subVectors(camera.position, controls.target);
    const dist = handOrbitOffset.length();
    // Multiplicative zoom — feels closer to scroll-wheel / pinch behavior.
    const factor = Math.exp(-deltaDistance);
    const nextDist = THREE.MathUtils.clamp(dist * factor, controls.minDistance, controls.maxDistance);
    handOrbitOffset.setLength(nextDist);
    camera.position.copy(controls.target).add(handOrbitOffset);
    return true;
  }

  function cancelCameraFly() {
    cameraFlyAnim = null;
    controls.enabled = true;
  }

  function flyToView(
    cam: [number, number, number],
    tgt: [number, number, number],
    options: { duration?: number; levelIdx?: number; onComplete?: () => void } = {},
  ) {
    setAutoRotate(false);
    cameraFlyAnim = {
      fromCam: camera.position.clone(),
      toCam: new THREE.Vector3(cam[0], cam[1], cam[2]),
      fromTgt: controls.target.clone(),
      toTgt: new THREE.Vector3(tgt[0], tgt[1], tgt[2]),
      start: performance.now(),
      duration: options.duration ?? 1400,
      levelIdx: options.levelIdx ?? -1,
      onComplete: options.onComplete ?? null,
    };
    controls.enabled = false;
  }

  function flyToLevel(levelId: number, onComplete?: () => void) {
    const slot = levelSlots[levelId - 1];
    if (!slot?.pos) return;

    const view = computeLevelFlyView(slot.pos);
    if (!view) return;
    if (slot.cam) view.cam = slot.cam;
    if (slot.tgt) view.tgt = slot.tgt;

    flyToView(view.cam, view.tgt, {
      levelIdx: levelId - 1,
      onComplete,
    });
  }

  function playOutroCelebration() {
    if (!model) return;
    flyToView(applyModelOffset(P1_CAM), applyModelOffset(P1_TGT), {
      duration: 2000,
      onComplete: () => setAutoRotate(true),
    });
  }

  function saveLevelDevState() {
    const payload = levelSlots.map(({ id, label, pos, cam, tgt }) => ({ id, label, pos, cam, tgt }));
    try {
      localStorage.setItem(LEVEL_DEV_KEY, JSON.stringify(payload));
    } catch {
      /* ignore quota errors */
    }
  }

  function disposeMarker(marker: THREE.Group | null) {
    if (!marker) return;
    marker.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Sprite) {
        const mat = o.material as THREE.Material & { map?: THREE.Texture };
        mat.map?.dispose();
        o.geometry?.dispose();
        mat.dispose();
      }
    });
    marker.parent?.remove(marker);
  }

  function drawLevelBadge(
    ctx: CanvasRenderingContext2D,
    size: number,
    levelNum: number,
    accentHex: string,
    completed: boolean,
  ) {
    const r = size * 0.5;
    ctx.clearRect(0, 0, size, size);

    ctx.save();
    ctx.shadowColor = 'rgba(0, 20, 200, 0.45)';
    ctx.shadowBlur = size * 0.08;
    ctx.shadowOffsetY = size * 0.03;

    ctx.beginPath();
    ctx.arc(r, r, r * 0.78, 0, Math.PI * 2);
    ctx.fillStyle = completed ? '#ffffff' : '#0014c8';
    ctx.fill();

    ctx.lineWidth = size * 0.055;
    ctx.strokeStyle = accentHex;
    ctx.stroke();
    ctx.restore();

    ctx.beginPath();
    ctx.arc(r, r, r * 0.58, 0, Math.PI * 2);
    ctx.fillStyle = completed ? accentHex : 'rgba(255, 255, 255, 0.12)';
    ctx.fill();

    ctx.fillStyle = completed ? '#0014c8' : '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${size * 0.38}px "Segoe UI", system-ui, sans-serif`;
    ctx.fillText(completed ? '✓' : String(levelNum), r, r + size * 0.02);
  }

  function makeLevelBadgeSprite(levelNum: number, accentHex: string, completed = false) {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context unavailable');
    drawLevelBadge(ctx, size, levelNum, accentHex, completed);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(3.4, 3.4, 1);
    sprite.renderOrder = 30;
    const badgeData = sprite.userData as BadgeUserData;
    badgeData.badgeCanvas = canvas;
    badgeData.badgeCtx = ctx;
    badgeData.badgeSize = size;
    return sprite;
  }

  function refreshMarkerBadge(slot: LevelSlot, levelIdx: number) {
    const badge = (slot.marker?.userData as MarkerUserData | undefined)?.badge;
    if (!badge) return;
    const done = completedLevels.has(levelIdx + 1);
    const badgeData = badge.userData as BadgeUserData;
    drawLevelBadge(
      badgeData.badgeCtx,
      badgeData.badgeSize,
      levelIdx + 1,
      LEVEL_COLORS[levelIdx],
      done,
    );
    (badge.material as THREE.SpriteMaterial).map!.needsUpdate = true;
  }

  function makeLevelMarker(colorHex: string, label: string, levelNum: number) {
    const group = new THREE.Group();
    group.name = `level-marker-${label}`;
    const color = new THREE.Color(colorHex);

    const glowMat = (opacity: number, extra: Partial<THREE.MeshBasicMaterialParameters> = {}) =>
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        side: THREE.DoubleSide,
        depthWrite: false,
        ...extra,
      });

    const pad = new THREE.Mesh(new THREE.CircleGeometry(2.1, 64), glowMat(0.14));
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = 0.04;
    pad.renderOrder = 8;
    group.add(pad);

    const pulseRing = new THREE.Mesh(new THREE.RingGeometry(1.45, 1.72, 64), glowMat(0.42));
    pulseRing.rotation.x = -Math.PI / 2;
    pulseRing.position.y = 0.06;
    pulseRing.renderOrder = 9;
    pulseRing.name = 'pulse-ring';
    group.add(pulseRing);

    const innerRing = new THREE.Mesh(
      new THREE.RingGeometry(0.62, 0.78, 48),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.88,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    innerRing.rotation.x = -Math.PI / 2;
    innerRing.position.y = 0.08;
    innerRing.renderOrder = 10;
    group.add(innerRing);

    const anchorDot = new THREE.Mesh(
      new THREE.CircleGeometry(0.18, 24),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
      }),
    );
    anchorDot.rotation.x = -Math.PI / 2;
    anchorDot.position.y = 0.1;
    anchorDot.renderOrder = 11;
    group.add(anchorDot);

    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.42, 3.6, 20, 1, true),
      glowMat(0.11),
    );
    beam.position.y = 1.8;
    beam.renderOrder = 7;
    group.add(beam);

    const gem = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.52, 0),
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.85,
        metalness: 0.45,
        roughness: 0.18,
        transparent: true,
        opacity: 0.96,
        depthWrite: false,
      }),
    );
    gem.position.y = 3.55;
    gem.name = 'gem';
    gem.renderOrder = 12;
    group.add(gem);

    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.045, 10, 48), glowMat(0.55));
    halo.rotation.x = Math.PI / 2;
    halo.position.y = 3.55;
    halo.name = 'halo';
    group.add(halo);

    const badge = makeLevelBadgeSprite(levelNum, colorHex, false);
    badge.position.y = 4.85;
    badge.name = 'badge';
    group.add(badge);

    const userData = group.userData as MarkerUserData;
    userData.levelNum = levelNum;
    userData.colorHex = colorHex;
    userData.pulseRing = pulseRing;
    userData.gem = gem;
    userData.halo = halo;
    userData.badge = badge;
    userData.bobPhase = levelNum * 1.7;
    return group;
  }

  function animateLevelMarkers(now: number) {
    if (!routeGroup) return;
    const t = now * 0.001;
    routeGroup.children.forEach((child) => {
      if (!child.name?.startsWith('level-marker-')) return;
      const { pulseRing, gem, halo, badge, bobPhase, levelNum } = child.userData as MarkerUserData;
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.4 + bobPhase);
      const flyBoost =
        cameraFlyAnim?.levelIdx === levelNum - 1
          ? Math.sin(Math.min(1, (now - cameraFlyAnim.start) / cameraFlyAnim.duration) * Math.PI)
          : 0;

      if (pulseRing) {
        const ringScale = 0.92 + pulse * 0.14 + flyBoost * 0.55;
        (pulseRing.material as THREE.MeshBasicMaterial).opacity = 0.22 + pulse * 0.38 + flyBoost * 0.45;
        pulseRing.scale.set(ringScale, ringScale, 1);
      }
      if (gem) {
        gem.position.y = 3.55 + Math.sin(t * 1.8 + bobPhase) * 0.18;
        gem.rotation.y = t * 0.9;
        gem.rotation.x = Math.sin(t * 1.1 + bobPhase) * 0.25;
        const gemMat = gem.material as THREE.MeshStandardMaterial;
        if (gemMat) {
          gemMat.emissiveIntensity = 0.85 + flyBoost * 1.15;
        }
      }
      if (halo) {
        halo.position.y = gem.position.y;
        halo.rotation.z = t * (0.65 + flyBoost * 2.2);
      }
      if (badge) {
        badge.position.y = gem.position.y + 1.3;
        const badgeScale = 3.4 + flyBoost * 0.55;
        badge.scale.set(badgeScale, badgeScale, 1);
      }
    });
  }

  function scaleMarkersToModel() {
    if (!model || !routeGroup) return;
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3()).length();
    const s = Math.max(size * 0.011, 0.72);
    routeGroup.children.forEach((child) => {
      if (child.name?.startsWith('level-marker-')) {
        child.scale.setScalar(s);
        (child.userData as MarkerUserData).baseScale = s;
      }
    });
    if (routeLine) routeLine.scale.setScalar(1);
  }

  function rebuildRouteLine() {
    if (!routeGroup) return;
    if (routeLine) {
      routeGroup.remove(routeLine);
      routeLine.geometry.dispose();
      (routeLine.material as THREE.Material).dispose();
      routeLine = null;
    }
    if (!showRouteLine) return;

    const pts = levelSlots.filter((s) => s.pos).map((s) => new THREE.Vector3(...s.pos!));
    if (pts.length < 2) return;

    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.35);
    const geom = new THREE.BufferGeometry().setFromPoints(curve.getPoints(96));
    routeLine = new THREE.Line(
      geom,
      new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.38,
        depthWrite: false,
      }),
    );
    routeLine.name = 'level-route-line';
    routeGroup.add(routeLine);
  }

  function rebuildLevelMarkers() {
    if (!routeGroup) return;
    levelSlots.forEach((slot) => {
      disposeMarker(slot.marker);
      slot.marker = null;
    });
    levelSlots.forEach((slot, i) => {
      if (!slot.pos) return;
      const marker = makeLevelMarker(LEVEL_COLORS[i], slot.label, i + 1);
      marker.position.set(slot.pos[0], slot.pos[1], slot.pos[2]);
      routeGroup!.add(marker);
      slot.marker = marker;
      updateLevelMarkerState(i);
    });
    scaleMarkersToModel();
    rebuildRouteLine();
  }

  function setActiveLevel(idx: number) {
    activeLevelIdx = Math.max(0, Math.min(3, idx));
    devFlash(`Active: ${LEVEL_LABELS[activeLevelIdx]} — Shift+click model to place`);
  }

  function placeActiveLevel(localPoint: THREE.Vector3) {
    const slot = levelSlots[activeLevelIdx];
    slot.pos = vec3Arr(localPoint);
    slot.cam = vec3Arr(camera.position);
    slot.tgt = vec3Arr(controls.target);
    saveLevelDevState();
    rebuildLevelMarkers();
    indexModelMeshZones();
    applySavedLevelColors();
    console.log(
      `📍 ${slot.label} pos=[${slot.pos.join(', ')}], cam=[${slot.cam.join(', ')}], tgt=[${slot.tgt.join(', ')}]`,
    );
    devFlash(`${slot.label} saved · pos + camera pinned`);
  }

  function clearActiveLevel() {
    const slot = levelSlots[activeLevelIdx];
    slot.pos = null;
    slot.cam = null;
    slot.tgt = null;
    saveLevelDevState();
    rebuildLevelMarkers();
    indexModelMeshZones();
    applySavedLevelColors();
    devFlash(`${slot.label} cleared`);
  }

  function clearAllLevels() {
    levelSlots.forEach((slot) => {
      slot.pos = null;
      slot.cam = null;
      slot.tgt = null;
    });
    saveLevelDevState();
    rebuildLevelMarkers();
    indexModelMeshZones();
    applySavedLevelColors();
    devFlash('All level points cleared');
  }

  function exportLevelDevJson() {
    return levelSlots.map(({ id, label, pos, cam, tgt }) => ({ id, label, pos, cam, tgt }));
  }

  function copyLevelDevJson() {
    const json = JSON.stringify(exportLevelDevJson(), null, 2);
    navigator.clipboard.writeText(json).then(
      () => devFlash('JSON copied to clipboard'),
      () => {
        console.log(json);
        devFlash('Copy failed — JSON logged to console');
      },
    );
  }

  function initLevelDevMode() {
    if (!DEV_MODE) return;

    loadLevelRouteData();
    setActiveLevel(0);

    const onPointerDown = (e: PointerEvent) => {
      if (!model || !routeGroup || !e.shiftKey || e.button !== 0) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObject(model, true);
      if (!hits.length) {
        devFlash('No hit — click mesh surface');
        return;
      }
      const local = hits[0].point.clone();
      model.worldToLocal(local);
      placeActiveLevel(local);
      e.preventDefault();
      e.stopPropagation();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }
      if (e.key >= '1' && e.key <= '4') {
        setActiveLevel(Number(e.key) - 1);
        return;
      }
      if (e.key === 'e' || e.key === 'E') {
        copyLevelDevJson();
        return;
      }
      if (e.key === 'c' || e.key === 'C') {
        clearActiveLevel();
        return;
      }
      if (e.key === 'r' || e.key === 'R') {
        showRouteLine = !showRouteLine;
        rebuildRouteLine();
        devFlash(showRouteLine ? 'Route line on' : 'Route line off');
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    devCleanup.push(() => {
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    });

    const fDev = gui.addFolder('🛠 Route Dev');
    fDev.add({ exportJson: copyLevelDevJson }, 'exportJson').name('📋 Copy JSON');
    fDev.add({ logJson: () => console.log(exportLevelDevJson()) }, 'logJson').name('🖨 Log JSON');
    fDev.add({ clearActive: clearActiveLevel }, 'clearActive').name('🗑 Clear active Lv');
    fDev.add({ clearAll: clearAllLevels }, 'clearAll').name('🗑 Clear all');
    fDev.add({ routeLine: true }, 'routeLine').name('Show route line').onChange((v: boolean) => {
      showRouteLine = v;
      rebuildRouteLine();
    });
    gui.show();
  }

  const fLevels = gui.addFolder('🎮 Levels');
  fLevels.add({ completeLv1: () => completeLevel(1) }, 'completeLv1').name('✓ Complete Lv1');
  fLevels.add({ completeLv2: () => completeLevel(2) }, 'completeLv2').name('✓ Complete Lv2');
  fLevels.add({ completeLv3: () => completeLevel(3) }, 'completeLv3').name('✓ Complete Lv3');
  fLevels.add({ completeLv4: () => completeLevel(4) }, 'completeLv4').name('✓ Complete Lv4');
  fLevels.add({ clearComplete: resetLevelProgress }, 'clearComplete').name('🗑 Clear complete');
  fLevels.add({ flyLv1: () => flyToLevel(1) }, 'flyLv1').name('📷 Fly to Lv1');
  fLevels.add({ flyLv2: () => flyToLevel(2) }, 'flyLv2').name('📷 Fly to Lv2');
  fLevels.add({ flyLv3: () => flyToLevel(3) }, 'flyLv3').name('📷 Fly to Lv3');
  fLevels.add({ flyLv4: () => flyToLevel(4) }, 'flyLv4').name('📷 Fly to Lv4');

  function fitToObject(obj: THREE.Object3D, padding = 1.45) {
    const box = new THREE.Box3().setFromObject(obj);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const center = sphere.center;
    const r = sphere.radius;

    const fov = camera.fov * (Math.PI / 180);
    const dist = (r / Math.sin(fov / 2)) * padding;

    camera.position.set(
      center.x + dist * 0.85,
      center.y + dist * 0.30,
      center.z + dist * 0.42,
    );
    camera.near = Math.max(0.05, dist / 200);
    camera.far = dist * 40;
    camera.updateProjectionMatrix();

    controls.target.copy(center);
    controls.minDistance = dist * 0.25;
    controls.maxDistance = dist * 6;
    controls.update();

    const s = r * 1.6;
    key.shadow.camera.left = -s;
    key.shadow.camera.right = s;
    key.shadow.camera.top = s;
    key.shadow.camera.bottom = -s;
    key.shadow.camera.near = Math.max(0.1, dist / 10);
    key.shadow.camera.far = dist * 6;
    key.shadow.camera.updateProjectionMatrix();
  }

  function applyPanelAwareCamera(visible: boolean, width: number) {
    panelVisible = visible;
    panelWidth = width;
    const panelW = panelVisible ? panelWidth : 0;
    const visibleW = Math.max(1, window.innerWidth - panelW);

    if (panelW > 0) {
      camera.setViewOffset(window.innerWidth, window.innerHeight, panelW / 2, 0, window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setViewport(0, 0, visibleW, window.innerHeight);
      renderer.setScissor(0, 0, visibleW, window.innerHeight);
      renderer.setScissorTest(true);
    } else {
      camera.clearViewOffset();
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
      renderer.setScissor(0, 0, window.innerWidth, window.innerHeight);
      renderer.setScissorTest(false);
    }
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function applyModel(gltf: { scene: THREE.Group }) {
    model = gltf.scene;
    model.rotation.y = 0;
    model.position.set(...MODEL_POSITION_OFFSET);
    model.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        const mat = o.material as THREE.MeshStandardMaterial;
        if (mat) mat.envMapIntensity = 0;
      }
    });
    scene.add(model);
    fitToObject(model);

    loadLevelRouteData();
    routeGroup = new THREE.Group();
    routeGroup.name = 'levelRoute';
    model.add(routeGroup);
    rebuildLevelMarkers();
    indexModelMeshZones();

    const [p1CamX, p1CamY, p1CamZ] = applyModelOffset(P1_CAM);
    const [p1TgtX, p1TgtY, p1TgtZ] = applyModelOffset(P1_TGT);
    camera.position.set(p1CamX, p1CamY, p1CamZ);
    controls.target.set(p1TgtX, p1TgtY, p1TgtZ);
    controls.update();
    camera.updateProjectionMatrix();

    requestAnimationFrame(() => {
      callbacks.onLoadComplete?.();
    });
  }

  async function loadModel() {
    callbacks.onLoadProgress?.(0);

    let blobUrl: string | null = null;
    try {
      const r = await fetch(GLB_MODEL_PATH);
      if (!r.ok || !r.body) throw new Error(`HTTP ${r.status}`);
      const reader = r.body.getReader();
      const chunks: BlobPart[] = [];
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value as BlobPart);
        received += value.byteLength;
        callbacks.onLoadProgress?.(received);
      }
      blobUrl = URL.createObjectURL(new Blob(chunks, { type: 'model/gltf-binary' }));
    } catch (e) {
      console.warn('fetch+stream failed, falling back to direct GLTFLoader.load', e);
    }

    const src = blobUrl || GLB_MODEL_PATH;
    new GLTFLoader().load(
      src,
      (gltf) => {
        if (blobUrl) URL.revokeObjectURL(blobUrl);
        applyModel(gltf);
      },
      undefined,
      (err) => {
        console.error('GLB load failed:', err);
        callbacks.onLoadError?.(err);
      },
    );
  }

  const devCleanup: Array<() => void> = [];

  function onResize() {
    applyPanelAwareCamera(panelVisible, panelWidth);
  }

  function tick() {
    if (disposed) return;
    const now = performance.now();
    const dt = Math.min(0.1, (now - _lastTick) / 1000);
    _lastTick = now;

    const flying = updateCameraFly(now);
    if (!flying) controls.update();
    animateLevelMarkers(now);
    updateLevelAnimations(now);
    if (params.autoRotate && model && !handControlActive) {
      model.rotation.y += dt * 0.06;
    }
    renderer.render(scene, camera);
    rafId = requestAnimationFrame(tick);
  }

  window.addEventListener('resize', onResize);

  applyPanelAwareCamera(false, 0);
  initLevelDevMode();
  loadModel();
  tick();

  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      devCleanup.forEach((fn) => fn());
      cancelLevelAnimations();
      levelSlots.forEach((slot) => disposeMarker(slot.marker));
      if (model) {
        scene.remove(model);
        model.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            o.geometry.dispose();
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            mats.forEach((m) => m.dispose());
          }
        });
      }
      pmrem.dispose();
      renderer.dispose();
      gui.destroy();
      container.removeChild(renderer.domElement);
    },

    flyToLevel,
    playOutroCelebration,
    completeLevel,
    resetLevelProgress,
    returnToLobby,
    applyPanelAwareCamera,
    applyHandOrbit,
    applyHandZoom,
    isModelReady: () => !!model,
    getProgress: () => [...completedLevels].sort((a, b) => a - b),
  };
}
