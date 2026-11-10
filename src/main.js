import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Water } from 'three/addons/objects/Water.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const canvas = document.querySelector('#scene');
const root = document.querySelector('#experience');
const loader = document.querySelector('#loader');
const loaderProgress = document.querySelector('#loader-progress');
const loaderStatus = document.querySelector('#loader-status');
const label = document.querySelector('#object-label');
const labelName = document.querySelector('#object-name');
const labelAction = document.querySelector('#object-action');
const toast = document.querySelector('#toast');
const depthValue = document.querySelector('#depth-value');
const depthBar = document.querySelector('#depth-bar');
const energyValue = document.querySelector('#energy-value');
const awakenButton = document.querySelector('#awaken');
const tourButton = document.querySelector('#tour-button');
const paletteButton = document.querySelector('#palette-button');
const resetButton = document.querySelector('#reset-button');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const TAU = Math.PI * 2;
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
let seed = 74291;
function random() {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
}
function range(min, max) { return min + (max - min) * random(); }
function easeOutQuart(t) { return 1 - Math.pow(1 - t, 4); }
function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

function setLoad(percent, message) {
  loaderProgress.style.width = `${percent}%`;
  if (message) loaderStatus.textContent = message;
}

async function boot() {
  setLoad(12, '正在生成玄武岩遗迹');

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  let pixelRatio = Math.min(window.devicePixelRatio, 1.7);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x03070b, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x071017, 0.0125);
  const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 240);
  const homePosition = new THREE.Vector3(13.6, 7.5, 22.5);
  const homeTarget = new THREE.Vector3(0, 4.15, 0);
  camera.position.set(22, 12.5, 35);

  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(homeTarget);
  controls.enableDamping = true;
  controls.dampingFactor = 0.045;
  controls.rotateSpeed = 0.42;
  controls.zoomSpeed = 0.72;
  controls.panSpeed = 0.5;
  controls.minDistance = 8.5;
  controls.maxDistance = 43;
  controls.minPolarAngle = 0.3;
  controls.maxPolarAngle = Math.PI * 0.525;
  controls.autoRotate = !reducedMotion;
  controls.autoRotateSpeed = 0.24;
  controls.zoomToCursor = true;
  controls.update();

  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04);
  scene.environment = environment.texture;
  room.dispose();
  pmrem.dispose();

  const world = new THREE.Group();
  scene.add(world);

  const skyUniforms = {
    uTop: { value: new THREE.Color(0x02050c) },
    uHorizon: { value: new THREE.Color(0x15272c) },
    uBottom: { value: new THREE.Color(0x030608) },
    uTime: { value: 0 },
    uPalette: { value: 0 }
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(150, 48, 32),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: skyUniforms,
      vertexShader: `
        varying vec3 vPosition;
        void main() {
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uTop;
        uniform vec3 uHorizon;
        uniform vec3 uBottom;
        uniform float uTime;
        uniform float uPalette;
        varying vec3 vPosition;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.,0.)), f.x), mix(hash(i + vec2(0.,1.)), hash(i + vec2(1.,1.)), f.x), f.y);
        }
        void main() {
          vec3 d = normalize(vPosition);
          float h = d.y;
          float upper = smoothstep(-0.04, 0.68, h);
          vec3 color = mix(uHorizon, uTop, upper);
          color = mix(uBottom, color, smoothstep(-0.38, 0.02, h));
          float band = exp(-pow((h - 0.13) * 4.2, 2.0));
          float n = noise(d.xz * 5.0 + d.y * 2.0) * noise(d.xz * 13.0 - d.y);
          color += vec3(0.025, 0.05, 0.055) * band * n;
          color += vec3(0.035, 0.018, 0.008) * exp(-pow((h + 0.01) * 14.0, 2.0)) * (1.0 - uPalette);
          gl_FragColor = vec4(color, 1.0);
        }
      `
    })
  );
  scene.add(sky);

  function makeStars(count, minRadius, maxRadius, size, opacity) {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const warm = new THREE.Color(0xe8d4ae);
    const cool = new THREE.Color(0x9ac6d0);
    for (let i = 0; i < count; i++) {
      const theta = random() * TAU;
      const y = range(-0.08, 0.98);
      const r = Math.sqrt(1 - y * y);
      const radius = range(minRadius, maxRadius);
      positions[i * 3] = Math.cos(theta) * r * radius;
      positions[i * 3 + 1] = y * radius;
      positions[i * 3 + 2] = Math.sin(theta) * r * radius;
      const color = cool.clone().lerp(warm, random()).multiplyScalar(range(0.35, 1));
      colors.set([color.r, color.g, color.b], i * 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({
      size, vertexColors: true, transparent: true, opacity,
      depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      sizeAttenuation: true
    });
    const points = new THREE.Points(geometry, material);
    scene.add(points);
    return points;
  }
  const stars = makeStars(1450, 65, 130, 0.12, 0.72);
  const brightStars = makeStars(85, 60, 115, 0.28, 0.75);

  const hemisphere = new THREE.HemisphereLight(0x7896a6, 0x071013, 0.65);
  scene.add(hemisphere);
  const sun = new THREE.DirectionalLight(0xffd7a0, 2.35);
  sun.position.set(-10, 17, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -19;
  sun.shadow.camera.right = 19;
  sun.shadow.camera.top = 20;
  sun.shadow.camera.bottom = -15;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 60;
  sun.shadow.bias = -0.00035;
  scene.add(sun);
  const rimLight = new THREE.DirectionalLight(0x4f9ba9, 2.0);
  rimLight.position.set(10, 8, -12);
  scene.add(rimLight);
  const coreLight = new THREE.PointLight(0xe7b86f, 24, 22, 2);
  coreLight.position.set(-1, 6, 4);
  scene.add(coreLight);
  const underLight = new THREE.PointLight(0x4fabb4, 13, 20, 2);
  underLight.position.set(0, 0.2, 1);
  scene.add(underLight);

  function createWaterNormals(size = 128) {
    const data = new Uint8Array(size * size * 4);
    const height = (x, y) =>
      Math.sin(x * 0.31 + Math.sin(y * 0.13) * 2.1) * 0.46 +
      Math.sin(y * 0.27 - x * 0.09) * 0.3 +
      Math.sin((x + y) * 0.57) * 0.12 +
      Math.sin(Math.sqrt(x * x + y * y) * 0.22) * 0.12;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = height(x + 1, y) - height(x - 1, y);
        const dy = height(x, y + 1) - height(x, y - 1);
        const normal = new THREE.Vector3(-dx * 0.65, -dy * 0.65, 1).normalize();
        const index = (y * size + x) * 4;
        data[index] = (normal.x * 0.5 + 0.5) * 255;
        data[index + 1] = (normal.y * 0.5 + 0.5) * 255;
        data[index + 2] = (normal.z * 0.5 + 0.5) * 255;
        data[index + 3] = 255;
      }
    }
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    return texture;
  }

  const waterNormals = createWaterNormals();
  const water = new Water(new THREE.PlaneGeometry(190, 190), {
    textureWidth: 1024,
    textureHeight: 1024,
    waterNormals,
    sunDirection: sun.position.clone().normalize(),
    sunColor: 0xe3c393,
    waterColor: 0x02090e,
    distortionScale: 0.95,
    fog: true,
    alpha: 1
  });
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.38;
  water.material.uniforms.size.value = 3.2;
  water.material.fragmentShader = water.material.fragmentShader
    .replace('float rf0 = 0.3;', 'float rf0 = 0.46;')
    .replace('sunColor * diffuseLight * 0.3', 'sunColor * diffuseLight * 0.08')
    .replace('( vec3( 0.1 ) + reflectionSample * 0.9 + reflectionSample * specularLight )', '( vec3( 0.008, 0.014, 0.018 ) + reflectionSample * 0.88 + reflectionSample * specularLight )');
  water.userData = { name: '黑潮镜面', action: '点击泛起涟漪', type: 'water' };
  world.add(water);

  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = glowCanvas.height = 256;
  const glowContext = glowCanvas.getContext('2d');
  const glowGradient = glowContext.createRadialGradient(128, 128, 0, 128, 128, 128);
  glowGradient.addColorStop(0, 'rgba(255,255,255,1)');
  glowGradient.addColorStop(0.12, 'rgba(255,255,255,.7)');
  glowGradient.addColorStop(0.42, 'rgba(255,255,255,.16)');
  glowGradient.addColorStop(1, 'rgba(255,255,255,0)');
  glowContext.fillStyle = glowGradient;
  glowContext.fillRect(0, 0, 256, 256);
  const glowTexture = new THREE.CanvasTexture(glowCanvas);

  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture, color: 0x668f91, transparent: true, opacity: 0.3,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false
  }));
  halo.position.set(0, 5, -1.8);
  halo.scale.set(21, 21, 1);
  world.add(halo);
  const warmHalo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture, color: 0xc48c50, transparent: true, opacity: 0.12,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false
  }));
  warmHalo.position.set(-3.2, 8, -2);
  warmHalo.scale.set(14, 14, 1);
  world.add(warmHalo);

  setLoad(35, '正在对齐日蚀星环');
  const portal = new THREE.Group();
  portal.position.y = 5;
  world.add(portal);

  const portalUniforms = {
    uTime: { value: 0 },
    uPulseAge: { value: 10 },
    uEnergy: { value: 0 },
    uPalette: { value: 0 },
    uPointer: { value: new THREE.Vector2() }
  };
  const portalVeil = new THREE.Mesh(
    new THREE.CircleGeometry(4.43, 128),
    new THREE.ShaderMaterial({
      uniforms: portalUniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uPulseAge;
        uniform float uEnergy;
        uniform float uPalette;
        uniform vec2 uPointer;
        varying vec2 vUv;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.,0.)), f.x), mix(hash(i + vec2(0.,1.)), hash(i + vec2(1.,1.)), f.x), f.y);
        }
        float fbm(vec2 p) {
          float v = 0.0, a = 0.5;
          mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
          for (int i = 0; i < 5; i++) { v += a * noise(p); p = r * p * 2.03 + 7.1; a *= 0.5; }
          return v;
        }
        void main() {
          vec2 p = vUv * 2.0 - 1.0;
          float r = length(p);
          if (r > 1.0) discard;
          float a = atan(p.y, p.x);
          vec2 drift = vec2(cos(a), sin(a)) * 0.3 + uPointer * 0.045;
          float n = fbm(p * 3.5 + drift + vec2(uTime * 0.025, -uTime * 0.018));
          float filament = fbm(vec2(a * 2.0, r * 5.0 - uTime * 0.07));
          float rim = smoothstep(0.38, 0.98, r);
          float inner = 1.0 - smoothstep(0.05, 0.9, r);
          float bands = pow(max(0.0, sin(r * 48.0 - uTime * 0.7 + n * 5.0)), 10.0) * 0.07;
          vec3 deep = mix(vec3(0.002, 0.009, 0.018), vec3(0.003, 0.008, 0.028), uPalette);
          vec3 teal = mix(vec3(0.045, 0.21, 0.23), vec3(0.04, 0.13, 0.38), uPalette);
          vec3 gold = mix(vec3(0.5, 0.28, 0.09), vec3(0.12, 0.36, 0.55), uPalette);
          vec3 color = deep + teal * (n * 0.24 + filament * rim * 0.34);
          color += gold * pow(rim, 6.0) * (0.24 + filament * 0.46);
          color += teal * bands * (0.2 + rim);
          color += gold * inner * 0.012;
          float wave = exp(-pow((r - uPulseAge * 0.62) * 13.0, 2.0)) * exp(-uPulseAge * 0.8);
          color += mix(gold, teal, 0.4) * wave * 1.2;
          color += teal * uEnergy * 0.06;
          float alpha = (0.28 + rim * 0.42 + n * 0.08) * smoothstep(1.0, 0.93, r);
          gl_FragColor = vec4(color, alpha);
        }
      `
    })
  );
  portalVeil.position.z = -0.52;
  portal.add(portalVeil);

  const ringGeometry = new THREE.TorusGeometry(5, 0.54, 28, 192);
  const ringPositions = ringGeometry.attributes.position;
  for (let i = 0; i < ringPositions.count; i++) {
    const x = ringPositions.getX(i);
    const y = ringPositions.getY(i);
    const z = ringPositions.getZ(i);
    const angle = Math.atan2(y, x);
    const weather = Math.sin(angle * 17 + z * 8) * 0.025 + Math.sin(angle * 41 - z * 12) * 0.012;
    const radial = new THREE.Vector2(x, y).normalize();
    ringPositions.setXYZ(i, x + radial.x * weather, y + radial.y * weather, z + Math.sin(angle * 23) * 0.018);
  }
  ringGeometry.computeVertexNormals();
  const basaltMaterial = new THREE.MeshStandardMaterial({
    color: 0x171d20, roughness: 0.48, metalness: 0.55, envMapIntensity: 0.75
  });
  const mainRing = new THREE.Mesh(ringGeometry, basaltMaterial);
  mainRing.castShadow = true;
  mainRing.receiveShadow = true;
  mainRing.userData = { name: '日蚀星环', action: '点击激发共振', type: 'portal' };
  portal.add(mainRing);

  const outerBand = new THREE.Mesh(
    new THREE.TorusGeometry(5.05, 0.055, 10, 192),
    new THREE.MeshStandardMaterial({ color: 0x7f7156, metalness: 0.92, roughness: 0.25, emissive: 0x2c1b0b, emissiveIntensity: 0.4 })
  );
  outerBand.position.z = -0.42;
  portal.add(outerBand);
  const innerBand = new THREE.Mesh(
    new THREE.TorusGeometry(4.48, 0.035, 10, 192),
    new THREE.MeshBasicMaterial({ color: 0xf2c685, transparent: true, opacity: 0.82, blending: THREE.AdditiveBlending })
  );
  innerBand.position.z = 0.05;
  portal.add(innerBand);
  const cyanBand = new THREE.Mesh(
    new THREE.TorusGeometry(4.57, 0.015, 8, 192),
    new THREE.MeshBasicMaterial({ color: 0x79c6c7, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending })
  );
  cyanBand.position.z = 0.42;
  portal.add(cyanBand);

  const tickGeometry = new THREE.BoxGeometry(0.025, 0.17, 0.035);
  const tickMaterial = new THREE.MeshBasicMaterial({ color: 0xddbd82, transparent: true, opacity: 0.72 });
  const ticks = new THREE.InstancedMesh(tickGeometry, tickMaterial, 96);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 96; i++) {
    const angle = (i / 96) * TAU;
    dummy.position.set(Math.cos(angle) * 5.03, Math.sin(angle) * 5.03, 0.53);
    dummy.rotation.set(0, 0, angle - Math.PI / 2);
    const major = i % 8 === 0;
    dummy.scale.set(major ? 2.1 : 1, major ? 2.4 : (i % 4 === 0 ? 1.6 : 0.75), 1);
    dummy.updateMatrix();
    ticks.setMatrixAt(i, dummy.matrix);
  }
  portal.add(ticks);

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(2.08, 80, 56),
    new THREE.MeshPhysicalMaterial({
      color: 0x010204, metalness: 0.58, roughness: 0.38,
      clearcoat: 0.12, clearcoatRoughness: 0.35, envMapIntensity: 0.08,
      specularIntensity: 0.28
    })
  );
  core.position.z = 0.32;
  core.castShadow = true;
  core.userData = { name: '引力核心', action: '点击唤醒沉睡恒星', type: 'core' };
  portal.add(core);

  const coreRimUniforms = { uEnergy: { value: 0 }, uPalette: { value: 0 } };
  const coreRim = new THREE.Mesh(
    new THREE.SphereGeometry(2.105, 64, 48),
    new THREE.ShaderMaterial({
      uniforms: coreRimUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vWorld;
        void main() {
          vNormal = normalize(mat3(modelMatrix) * normal);
          vec4 world = modelMatrix * vec4(position, 1.0);
          vWorld = world.xyz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: `
        uniform float uEnergy;
        uniform float uPalette;
        varying vec3 vNormal;
        varying vec3 vWorld;
        void main() {
          vec3 viewDir = normalize(cameraPosition - vWorld);
          float fresnel = pow(1.0 - abs(dot(viewDir, normalize(vNormal))), 4.2);
          float side = pow(max(0.0, dot(normalize(vNormal), normalize(vec3(-0.8, 0.6, 0.3)))), 2.0);
          vec3 warm = mix(vec3(0.95, 0.62, 0.25), vec3(0.25, 0.65, 0.85), uPalette);
          vec3 color = mix(vec3(0.12, 0.36, 0.4), warm, side);
          float alpha = fresnel * (0.48 + side * 0.75 + uEnergy * 0.55);
          gl_FragColor = vec4(color, alpha);
        }
      `
    })
  );
  coreRim.position.copy(core.position);
  portal.add(coreRim);

  const armillary = new THREE.Group();
  armillary.position.z = 0.35;
  portal.add(armillary);
  const orbitMaterial = new THREE.MeshBasicMaterial({ color: 0xbca776, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending });
  const orbitA = new THREE.Mesh(new THREE.TorusGeometry(2.72, 0.012, 6, 160), orbitMaterial);
  orbitA.rotation.set(1.08, 0.28, 0.15);
  armillary.add(orbitA);
  const orbitB = new THREE.Mesh(new THREE.TorusGeometry(2.93, 0.009, 6, 160), orbitMaterial.clone());
  orbitB.material.color.set(0x75afb4);
  orbitB.material.opacity = 0.22;
  orbitB.rotation.set(0.35, 1.14, -0.3);
  armillary.add(orbitB);
  const satellite = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffd693 }));
  armillary.add(satellite);
  const satelliteGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color: 0xf4bd68, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
  satelliteGlow.scale.set(0.7, 0.7, 1);
  satellite.add(satelliteGlow);

  const beamMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color(0x7fb7b5) } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `varying vec2 vUv; uniform vec3 uColor; void main(){ float x=abs(vUv.x-.5)*2.; float a=pow(1.-x,3.)*sin(vUv.y*3.14159)*.055; gl_FragColor=vec4(uColor,a); }`
  });
  for (let i = 0; i < 3; i++) {
    const beam = new THREE.Mesh(new THREE.PlaneGeometry(5 + i * 2, 25), beamMaterial);
    beam.position.set(-4 + i * 3.7, 10, -3.5 - i);
    beam.rotation.z = -0.18 + i * 0.14;
    world.add(beam);
  }

  setLoad(53, '正在铺设黑潮与漂浮遗迹');
  const stoneMaterial = new THREE.MeshStandardMaterial({
    color: 0x151d20, roughness: 0.66, metalness: 0.3, flatShading: true, envMapIntensity: 0.55
  });
  const darkStoneMaterial = stoneMaterial.clone();
  darkStoneMaterial.color.set(0x0c1317);
  const runeMaterial = new THREE.MeshBasicMaterial({ color: 0xbf9d61, transparent: true, opacity: 0.48 });
  const monoliths = [];

  function weatherGeometry(geometry, amount = 0.08) {
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
      const n = Math.sin(x * 12.3 + y * 4.7 + z * 8.1) * amount;
      positions.setXYZ(i, x + n, y + n * 0.25, z - n * 0.6);
    }
    geometry.computeVertexNormals();
    return geometry;
  }

  function createMonolith(x, z, height, radius, tilt = 0, floating = false, rune = false) {
    const group = new THREE.Group();
    const geometry = weatherGeometry(new THREE.CylinderGeometry(radius * 0.76, radius, height, 6, 5, false), 0.07);
    const mesh = new THREE.Mesh(geometry, stoneMaterial);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { name: '远古观测碑', action: '点击读取残存频率', type: 'monolith' };
    group.add(mesh);
    monoliths.push(mesh);
    if (rune) {
      const runeLine = new THREE.Mesh(new THREE.BoxGeometry(0.025, height * 0.42, 0.018), runeMaterial);
      runeLine.position.set(0, height * 0.06, radius * 0.89);
      group.add(runeLine);
      for (let j = 0; j < 3; j++) {
        const collar = new THREE.Mesh(new THREE.TorusGeometry(radius * (0.82 - j * 0.025), 0.018, 6, 6), runeMaterial);
        collar.rotation.x = Math.PI / 2;
        collar.position.y = height * 0.3 + j * 0.12;
        group.add(collar);
      }
    }
    group.position.set(x, floating ? height * 0.5 + range(1, 3) : height * 0.5 - 0.37, z);
    group.rotation.z = tilt;
    group.rotation.y = range(-0.35, 0.35);
    group.userData.baseY = group.position.y;
    group.userData.floatPhase = random() * TAU;
    group.userData.floating = floating;
    world.add(group);
    return group;
  }

  createMonolith(-8.2, 1.2, 8.7, 1.0, -0.09, false, true);
  createMonolith(-10.6, 2.5, 4.5, 0.8, 0.12, false, false);
  createMonolith(-7.1, -3.8, 3.7, 0.62, -0.2, true, false);
  createMonolith(8.5, -1.5, 7.4, 0.9, 0.08, false, true);
  createMonolith(10.6, 1.3, 3.9, 0.75, -0.12, false, false);
  createMonolith(7.4, -6.8, 4.8, 0.72, 0.16, true, true);
  createMonolith(-13.5, -10, 10, 1.2, 0.03, false, false);
  createMonolith(14.8, -12, 12.5, 1.25, -0.04, false, false);
  createMonolith(-18, -20, 15, 1.5, 0.02, false, false);
  createMonolith(20, -24, 18, 1.7, -0.03, false, false);

  const causeway = new THREE.Group();
  world.add(causeway);
  for (let i = 0; i < 8; i++) {
    const z = 2.2 + i * 2.05;
    const geometry = weatherGeometry(new THREE.CylinderGeometry(range(1.35, 1.85), range(1.45, 1.95), range(0.22, 0.42), 7, 1), 0.09);
    const slab = new THREE.Mesh(geometry, i < 3 ? stoneMaterial : darkStoneMaterial);
    slab.position.set(range(-0.24, 0.24), -0.22 + (7 - i) * 0.012, z);
    slab.scale.z = range(0.58, 0.76);
    slab.rotation.y = range(-0.22, 0.22);
    slab.castShadow = true;
    slab.receiveShadow = true;
    slab.userData = { name: '残损朝圣道', action: '点击扰动黑潮', type: 'stone' };
    causeway.add(slab);
    monoliths.push(slab);
    if (i === 2 || i === 5) {
      const seam = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.015, 0.025), runeMaterial);
      seam.position.set(slab.position.x, 0.025, z);
      seam.rotation.y = slab.rotation.y + 0.25;
      world.add(seam);
    }
  }

  const mountainMaterial = new THREE.MeshStandardMaterial({ color: 0x050c11, roughness: 1, metalness: 0, flatShading: true });
  for (let i = 0; i < 34; i++) {
    const angle = range(Math.PI * 0.02, Math.PI * 0.98);
    const distance = range(46, 78);
    const height = range(4, 14);
    const geometry = weatherGeometry(new THREE.ConeGeometry(range(6, 13), height, 7, 4), 0.32);
    const mountain = new THREE.Mesh(geometry, mountainMaterial);
    mountain.position.set(Math.cos(angle) * distance, height * 0.5 - 1.5, -Math.sin(angle) * distance - 9);
    mountain.rotation.y = random() * TAU;
    mountain.scale.x = range(0.85, 1.9);
    world.add(mountain);
  }

  const shardCount = 78;
  const shardGeometry = new THREE.DodecahedronGeometry(0.42, 0);
  const shards = new THREE.InstancedMesh(shardGeometry, stoneMaterial, shardCount);
  shards.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  shards.castShadow = true;
  shards.userData = { name: '失重碎片', action: '点击施加引力扰动', type: 'shard' };
  const shardData = [];
  for (let i = 0; i < shardCount; i++) {
    shardData.push({
      angle: random() * TAU,
      radius: range(6.2, 13.5),
      y: range(0.2, 11.5),
      z: range(-5, 3),
      scale: range(0.12, 0.85),
      speed: range(-0.035, 0.045),
      phase: random() * TAU,
      spin: new THREE.Vector3(random(), random(), random()).multiplyScalar(0.35)
    });
  }
  world.add(shards);

  const emberCount = 34;
  const embers = new THREE.InstancedMesh(
    new THREE.OctahedronGeometry(0.045, 0),
    new THREE.MeshBasicMaterial({ color: 0xe8b967, transparent: true, opacity: 0.75 }),
    emberCount
  );
  embers.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const emberData = [];
  for (let i = 0; i < emberCount; i++) {
    emberData.push({ angle: random() * TAU, radius: range(4.8, 10), y: range(0, 10), speed: range(0.03, 0.09), phase: random() * TAU });
  }
  world.add(embers);

  function createDust(count, spread, vertical, colors, pointScale) {
    const positions = new Float32Array(count * 3);
    const scales = new Float32Array(count);
    const phases = new Float32Array(count);
    const vertexColors = new Float32Array(count * 3);
    const colorA = new THREE.Color(colors[0]);
    const colorB = new THREE.Color(colors[1]);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = range(-spread, spread);
      positions[i * 3 + 1] = range(-0.2, vertical);
      positions[i * 3 + 2] = range(-spread * 0.65, spread * 0.65);
      scales[i] = range(0.35, 1.4) * pointScale;
      phases[i] = random() * TAU;
      const c = colorA.clone().lerp(colorB, random());
      vertexColors.set([c.r, c.g, c.b], i * 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute('color', new THREE.BufferAttribute(vertexColors, 3));
    const uniforms = {
      uTime: { value: 0 }, uEnergy: { value: 0 }, uPixelRatio: { value: pixelRatio },
      uPointer: { value: new THREE.Vector2() }
    };
    const material = new THREE.ShaderMaterial({
      uniforms, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `
        uniform float uTime;
        uniform float uEnergy;
        uniform float uPixelRatio;
        uniform vec2 uPointer;
        attribute float aScale;
        attribute float aPhase;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vec3 p = position;
          float t = uTime * (0.16 + uEnergy * 0.18) + aPhase;
          p.x += sin(t + position.y * 0.28) * (0.32 + uEnergy * 0.28);
          p.z += cos(t * 0.8 + position.x * 0.18) * 0.25;
          p.y += sin(t * 0.7) * 0.38;
          p.x += uPointer.x * 0.08 * (1.0 + aScale);
          p.y += uPointer.y * 0.05;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aScale * uPixelRatio * (75.0 / max(1.0, -mv.z));
          vColor = color;
          vAlpha = 0.28 + 0.5 * sin(aPhase + uTime * 0.3) * sin(aPhase + uTime * 0.3);
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float alpha = smoothstep(0.5, 0.08, d) * vAlpha;
          gl_FragColor = vec4(vColor, alpha);
        }
      `
    });
    const points = new THREE.Points(geometry, material);
    world.add(points);
    return { points, uniforms };
  }
  const dust = createDust(820, 17, 14, [0x7db3b3, 0xd6b779], 1.15);
  const nearDust = createDust(280, 8, 9, [0x7baeb6, 0xf1c880], 1.75);

  const ripples = [];
  function addRipple(position, strength = 1, portalWave = false) {
    const material = new THREE.MeshBasicMaterial({
      color: portalWave ? 0xe6bd7b : 0x8dbfc0,
      transparent: true, opacity: 0.65, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const mesh = new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 96), material);
    mesh.position.copy(position);
    if (!portalWave) {
      mesh.position.y = -0.29;
      mesh.rotation.x = -Math.PI / 2;
    }
    world.add(mesh);
    ripples.push({ mesh, age: 0, duration: portalWave ? 2.4 : 2.8, strength, portalWave });
  }

  const burstCount = 220;
  const burstPositions = new Float32Array(burstCount * 3);
  const burstVelocities = [];
  const burstGeometry = new THREE.BufferGeometry();
  burstGeometry.setAttribute('position', new THREE.BufferAttribute(burstPositions, 3));
  const burstMaterial = new THREE.PointsMaterial({
    color: 0xf0c680, size: 0.105, map: glowTexture, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
  });
  const burst = new THREE.Points(burstGeometry, burstMaterial);
  burst.frustumCulled = false;
  world.add(burst);
  let burstAge = 10;
  function triggerBurst(origin, strength = 1) {
    burstAge = 0;
    burstVelocities.length = 0;
    for (let i = 0; i < burstCount; i++) {
      burstPositions.set([origin.x, origin.y, origin.z], i * 3);
      const angle = random() * TAU;
      const speed = range(0.8, 4.8) * strength;
      burstVelocities.push(new THREE.Vector3(Math.cos(angle) * speed, Math.sin(angle) * speed, range(-1.2, 1.2) * strength));
    }
    burstGeometry.attributes.position.needsUpdate = true;
  }

  setLoad(72, '正在校准光学子系统');
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.72, 0.72, 0.64);
  composer.addPass(bloom);
  const gradePass = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      uTime: { value: 0 },
      uEnergy: { value: 0 },
      uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform float uTime;
      uniform float uEnergy;
      uniform vec2 uResolution;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main() {
        vec2 p = vUv - 0.5;
        float radial = dot(p, p);
        vec2 shift = p * (0.0012 + uEnergy * 0.0008) * radial;
        float r = texture2D(tDiffuse, vUv + shift).r;
        float g = texture2D(tDiffuse, vUv).g;
        float b = texture2D(tDiffuse, vUv - shift).b;
        vec3 color = vec3(r, g, b);
        float vignette = smoothstep(0.82, 0.18, radial);
        color *= mix(0.7, 1.03, vignette);
        color = mix(color, color * vec3(0.96, 1.015, 1.035), 0.32);
        float grain = hash(gl_FragCoord.xy + fract(uTime) * 173.0) - 0.5;
        color += grain * 0.011;
        gl_FragColor = vec4(color, 1.0);
      }
    `
  });
  composer.addPass(gradePass);
  composer.addPass(new OutputPass());

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2(0, 0);
  const pointerSmooth = new THREE.Vector2();
  const interactives = [core, mainRing, shards, ...monoliths];
  let hovered = null;
  let pointerActive = false;
  let pointerClient = { x: 0, y: 0 };
  let pointerDown = null;
  let energy = 0;
  let pulseAge = 10;
  let paletteTarget = 0;
  let paletteCurrent = 0;
  let toastTimer;
  let introActive = !reducedMotion;
  let introTime = 0;
  let viewTween = null;
  let disturbance = 0;
  let lastDepth = '';

  function updatePointer(event) {
    pointerActive = true;
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
    pointerClient = { x: event.clientX, y: event.clientY };
  }

  function showToast(message) {
    toast.querySelector('span').textContent = message;
    toast.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2600);
  }

  function resonate(type = 'portal', point = null) {
    const corePulse = type === 'core' || type === 'portal';
    energy = clamp(energy + (corePulse ? 0.95 : 0.45), 0, 1);
    pulseAge = 0;
    disturbance = Math.min(2, disturbance + (corePulse ? 1 : 0.45));
    const origin = point || new THREE.Vector3(0, 5, 0.5);
    if (corePulse) {
      addRipple(new THREE.Vector3(0, -0.29, 0), 1.5, false);
      addRipple(new THREE.Vector3(0, 5, 0.85), 1, true);
      triggerBurst(origin, 1);
      showToast(type === 'core' ? '恒星已苏醒 · 引力场正在重组' : '共振已记录 · 潮汐回应了你');
    } else {
      addRipple(new THREE.Vector3(origin.x, -0.29, origin.z), 0.65, false);
      triggerBurst(origin, 0.45);
      if (type === 'monolith') showToast('残存频率 432.7 Hz · 碑文仍未消逝');
      if (type === 'shard') showToast('碎片轨道已偏转 · 引力扰动 +0.07');
    }
    awakenButton.classList.remove('is-pulsing');
    void awakenButton.offsetWidth;
    awakenButton.classList.add('is-pulsing');
  }

  function resetView() {
    viewTween = {
      time: 0, duration: reducedMotion ? 0.01 : 1.8,
      fromPosition: camera.position.clone(), toPosition: homePosition.clone(),
      fromTarget: controls.target.clone(), toTarget: homeTarget.clone()
    };
    introActive = false;
    showToast('光学视角已归位 · 观测序列 007');
  }

  function setTour(value) {
    controls.autoRotate = value;
    tourButton.classList.toggle('is-active', value);
    tourButton.setAttribute('aria-label', value ? '暂停自动巡航' : '开启自动巡航');
    showToast(value ? '自动巡航已开启 · 拖曳可随时接管' : '自动巡航已暂停 · 自由观测模式');
  }

  function togglePalette() {
    paletteTarget = paletteTarget > 0.5 ? 0 : 1;
    paletteButton.classList.toggle('is-active', paletteTarget > 0.5);
    document.documentElement.style.setProperty('--accent', paletteTarget > 0.5 ? '#9acbc7' : '#d8ba82');
    showToast(paletteTarget > 0.5 ? '光相 II · 极夜蓝调' : '光相 I · 余晖金');
  }

  canvas.addEventListener('pointermove', (event) => updatePointer(event));
  canvas.addEventListener('pointerdown', (event) => {
    updatePointer(event);
    pointerDown = { x: event.clientX, y: event.clientY, time: performance.now() };
    introActive = false;
    viewTween = null;
  });
  canvas.addEventListener('pointerup', (event) => {
    if (!pointerDown) return;
    const distance = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y);
    const duration = performance.now() - pointerDown.time;
    pointerDown = null;
    if (distance > 6 || duration > 550) return;
    updatePointer(event);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(interactives, false);
    if (hits.length) {
      const hit = hits[0];
      resonate(hit.object.userData.type, hit.point);
      return;
    }
    const waterHit = raycaster.intersectObject(water, false)[0];
    if (waterHit) {
      addRipple(waterHit.point, 0.8, false);
      triggerBurst(waterHit.point.clone().add(new THREE.Vector3(0, 0.15, 0)), 0.25);
      energy = clamp(energy + 0.16, 0, 1);
      disturbance = Math.min(2, disturbance + 0.2);
    }
  });
  canvas.addEventListener('pointerleave', () => {
    hovered = null;
    pointerActive = false;
    label.classList.remove('is-visible');
    canvas.classList.remove('is-hovering');
  });
  canvas.addEventListener('wheel', () => { disturbance = Math.min(2, disturbance + 0.16); }, { passive: true });
  controls.addEventListener('start', () => { introActive = false; viewTween = null; });
  awakenButton.addEventListener('click', () => resonate('core'));
  resetButton.addEventListener('click', resetView);
  document.querySelector('#brand-home').addEventListener('click', (event) => { event.preventDefault(); resetView(); });
  tourButton.addEventListener('click', () => setTour(!controls.autoRotate));
  paletteButton.addEventListener('click', togglePalette);
  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    if (event.code === 'KeyR') resetView();
    if (event.code === 'KeyA') setTour(!controls.autoRotate);
    if (event.code === 'KeyL') togglePalette();
    if (event.code === 'Space') { event.preventDefault(); resonate('core'); }
  });

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    gradePass.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', onResize);

  const clock = new THREE.Clock();
  let elapsed = 0;
  let frames = 0;
  let fpsTime = 0;
  let qualityAdjusted = false;
  const warmSun = new THREE.Color(0xffd7a0);
  const coolSun = new THREE.Color(0x92bfff);
  const warmWater = new THREE.Color(0x02090e);
  const coolWater = new THREE.Color(0x050b1c);
  const warmSky = new THREE.Color(0x15272c);
  const coolSky = new THREE.Color(0x101a35);
  const warmCore = new THREE.Color(0xe7b86f);
  const coolCore = new THREE.Color(0x75aee6);

  function updateHover() {
    if (!pointerActive) return;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(interactives, false);
    const next = hits.length ? hits[0].object : null;
    if (next !== hovered) {
      hovered = next;
      if (hovered) {
        labelName.textContent = hovered.userData.name;
        labelAction.textContent = hovered.userData.action;
        label.classList.add('is-visible');
        canvas.classList.add('is-hovering');
      } else {
        label.classList.remove('is-visible');
        canvas.classList.remove('is-hovering');
      }
    }
    if (hovered) {
      const x = clamp(pointerClient.x, 10, window.innerWidth - 175);
      const y = clamp(pointerClient.y, 10, window.innerHeight - 85);
      label.style.left = `${x}px`;
      label.style.top = `${y}px`;
    }
  }

  function updateInstances(time) {
    for (let i = 0; i < shardCount; i++) {
      const data = shardData[i];
      const angle = data.angle + time * data.speed * (1 + energy * 2);
      const radius = data.radius + Math.sin(time * 0.17 + data.phase) * 0.25 + energy * Math.sin(data.phase) * 0.5;
      dummy.position.set(
        Math.cos(angle) * radius,
        data.y + Math.sin(time * 0.28 + data.phase) * 0.35,
        data.z + Math.sin(angle) * radius * 0.32
      );
      dummy.rotation.set(time * data.spin.x + data.phase, time * data.spin.y, time * data.spin.z);
      dummy.scale.set(data.scale * 0.65, data.scale * rangeStatic(data.phase), data.scale * 0.8);
      dummy.updateMatrix();
      shards.setMatrixAt(i, dummy.matrix);
    }
    shards.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < emberCount; i++) {
      const data = emberData[i];
      const angle = data.angle + time * data.speed * (1 + energy * 2.5);
      dummy.position.set(Math.cos(angle) * data.radius, data.y + Math.sin(time * 0.4 + data.phase) * 0.6, Math.sin(angle) * data.radius * 0.4);
      const scale = 0.6 + Math.sin(time * 2 + data.phase) * 0.35 + energy;
      dummy.scale.setScalar(scale);
      dummy.rotation.set(0, angle, 0);
      dummy.updateMatrix();
      embers.setMatrixAt(i, dummy.matrix);
    }
    embers.instanceMatrix.needsUpdate = true;
  }
  function rangeStatic(phase) { return 1.1 + (Math.sin(phase * 17.3) * 0.5 + 0.5) * 1.8; }

  function animate() {
    const delta = Math.min(clock.getDelta(), 0.05);
    elapsed += delta;
    frames++;
    fpsTime += delta;

    if (introActive) {
      introTime += delta;
      const t = easeOutQuart(clamp(introTime / 4.2, 0, 1));
      camera.position.lerpVectors(new THREE.Vector3(22, 12.5, 35), homePosition, t);
      if (t >= 1) introActive = false;
    }
    if (viewTween) {
      viewTween.time += delta;
      const t = easeInOut(clamp(viewTween.time / viewTween.duration, 0, 1));
      camera.position.lerpVectors(viewTween.fromPosition, viewTween.toPosition, t);
      controls.target.lerpVectors(viewTween.fromTarget, viewTween.toTarget, t);
      if (t >= 1) viewTween = null;
    }

    controls.target.x = clamp(controls.target.x, -9, 9);
    controls.target.y = clamp(controls.target.y, 1.2, 8.5);
    controls.target.z = clamp(controls.target.z, -8, 10);
    controls.update(delta);
    if (camera.position.y < 0.35) camera.position.y = 0.35;

    energy *= Math.exp(-delta * 0.42);
    disturbance *= Math.exp(-delta * 1.6);
    pulseAge += delta;
    paletteCurrent = lerp(paletteCurrent, paletteTarget, 1 - Math.exp(-delta * 2.3));
    pointerSmooth.lerp(pointer, 1 - Math.exp(-delta * 2));

    skyUniforms.uTime.value = elapsed;
    skyUniforms.uPalette.value = paletteCurrent;
    skyUniforms.uHorizon.value.copy(warmSky).lerp(coolSky, paletteCurrent);
    portalUniforms.uTime.value = elapsed;
    portalUniforms.uPulseAge.value = pulseAge;
    portalUniforms.uEnergy.value = energy;
    portalUniforms.uPalette.value = paletteCurrent;
    portalUniforms.uPointer.value.copy(pointerSmooth);
    coreRimUniforms.uEnergy.value = energy;
    coreRimUniforms.uPalette.value = paletteCurrent;
    dust.uniforms.uTime.value = elapsed;
    dust.uniforms.uEnergy.value = energy;
    dust.uniforms.uPointer.value.copy(pointerSmooth);
    nearDust.uniforms.uTime.value = elapsed + 13;
    nearDust.uniforms.uEnergy.value = energy;
    nearDust.uniforms.uPointer.value.copy(pointerSmooth);

    water.material.uniforms.time.value += delta * (0.36 + disturbance * 0.16);
    water.material.uniforms.distortionScale.value = 0.95 + disturbance * 0.75;
    water.material.uniforms.waterColor.value.copy(warmWater).lerp(coolWater, paletteCurrent);
    water.material.uniforms.sunColor.value.copy(warmSun).lerp(coolSun, paletteCurrent);
    sun.color.copy(warmSun).lerp(coolSun, paletteCurrent);
    coreLight.color.copy(warmCore).lerp(coolCore, paletteCurrent);
    coreLight.intensity = 22 + energy * 65;
    underLight.intensity = 12 + energy * 25;
    halo.material.opacity = 0.28 + energy * 0.18 + Math.sin(elapsed * 0.35) * 0.025;
    halo.material.color.set(0x668f91).lerp(new THREE.Color(0x556ea8), paletteCurrent);
    warmHalo.material.opacity = (0.11 + energy * 0.12) * (1 - paletteCurrent * 0.65);
    innerBand.material.opacity = 0.72 + energy * 0.28 + (hovered === mainRing ? 0.15 : 0);
    cyanBand.material.opacity = 0.46 + Math.sin(elapsed * 0.7) * 0.1 + energy * 0.3;
    ticks.material.opacity = 0.58 + Math.sin(elapsed * 0.45) * 0.09 + energy * 0.25;
    basaltMaterial.emissive.set(0x101b1c);
    basaltMaterial.emissiveIntensity = energy * 0.22 + (hovered === mainRing ? 0.12 : 0);
    core.scale.setScalar(1 + Math.sin(elapsed * 0.5) * 0.003 + energy * Math.sin(elapsed * 7) * 0.004);
    coreRim.scale.copy(core.scale);

    armillary.rotation.y = elapsed * 0.055;
    armillary.rotation.z = Math.sin(elapsed * 0.11) * 0.12;
    const satelliteAngle = elapsed * 0.34;
    satellite.position.set(Math.cos(satelliteAngle) * 2.72, Math.sin(satelliteAngle) * 2.72, 0);
    satellite.position.applyEuler(orbitA.rotation);
    stars.rotation.y = elapsed * 0.00065;
    brightStars.rotation.y = -elapsed * 0.0004;

    for (const object of world.children) {
      if (object.userData.floating) {
        object.position.y = object.userData.baseY + Math.sin(elapsed * 0.25 + object.userData.floatPhase) * 0.28;
        object.rotation.y += delta * 0.008;
      }
    }
    updateInstances(elapsed);

    for (let i = ripples.length - 1; i >= 0; i--) {
      const ripple = ripples[i];
      ripple.age += delta;
      const t = ripple.age / ripple.duration;
      const scale = 1 + easeOutQuart(Math.min(t, 1)) * (ripple.portalWave ? 8 : 10) * ripple.strength;
      ripple.mesh.scale.setScalar(scale);
      ripple.mesh.material.opacity = Math.pow(1 - t, 2) * 0.62;
      if (ripple.portalWave) ripple.mesh.quaternion.copy(camera.quaternion);
      if (t >= 1) {
        world.remove(ripple.mesh);
        ripple.mesh.geometry.dispose();
        ripple.mesh.material.dispose();
        ripples.splice(i, 1);
      }
    }

    if (burstAge < 3) {
      burstAge += delta;
      for (let i = 0; i < burstCount; i++) {
        const velocity = burstVelocities[i];
        burstPositions[i * 3] += velocity.x * delta;
        burstPositions[i * 3 + 1] += (velocity.y - burstAge * 0.55) * delta;
        burstPositions[i * 3 + 2] += velocity.z * delta;
        velocity.multiplyScalar(1 - delta * 0.35);
      }
      burstGeometry.attributes.position.needsUpdate = true;
      burstMaterial.opacity = Math.max(0, 1 - burstAge / 2.6) * 0.85;
    } else {
      burstMaterial.opacity = 0;
    }

    updateHover();
    const distance = camera.position.distanceTo(controls.target);
    const depthText = distance.toFixed(1).padStart(4, '0');
    if (depthText !== lastDepth) {
      depthValue.textContent = depthText;
      depthBar.style.height = `${clamp((43 - distance) / 34.5 * 100, 3, 100)}%`;
      lastDepth = depthText;
    }
    energyValue.textContent = Math.round(energy * 100).toString().padStart(2, '0');
    scene.fog.density = lerp(scene.fog.density, 0.009 + distance * 0.00014, 0.03);
    bloom.strength = 0.68 + energy * 0.5 + clamp((18 - distance) / 40, 0, 0.15);
    gradePass.uniforms.uTime.value = elapsed;
    gradePass.uniforms.uEnergy.value = energy;
    renderer.toneMappingExposure = 1.0 + energy * 0.07;

    composer.render();

    if (!qualityAdjusted && fpsTime > 5) {
      const fps = frames / fpsTime;
      if (fps < 38 && pixelRatio > 1.05) {
        pixelRatio = Math.max(1, pixelRatio - 0.35);
        renderer.setPixelRatio(pixelRatio);
        composer.setPixelRatio(pixelRatio);
        dust.uniforms.uPixelRatio.value = pixelRatio;
        nearDust.uniforms.uPixelRatio.value = pixelRatio;
        onResize();
      }
      qualityAdjusted = true;
    }
  }

  setLoad(90, '正在进行最后一次曝光');
  controls.update();
  composer.render();
  renderer.setAnimationLoop(animate);
  setLoad(100, '观测通道已开启');
  window.setTimeout(() => {
    loader.classList.add('is-hidden');
    root.classList.add('is-ready');
  }, 420);

  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    renderer.setAnimationLoop(null);
    document.querySelector('#fallback').hidden = false;
  });
}

boot().catch((error) => {
  console.error('NACRE initialization failed:', error);
  loader.classList.add('is-hidden');
  const fallback = document.querySelector('#fallback');
  fallback.hidden = false;
  fallback.querySelector('p').textContent = '请使用支持 WebGL 2 的最新版 Chrome、Edge 或 Firefox，并确认已开启硬件加速。';
});
