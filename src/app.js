import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.159.0/build/three.module.js";
import { PointerLockControls } from "https://cdn.jsdelivr.net/npm/three@0.159.0/examples/jsm/controls/PointerLockControls.js";

const sceneRoot = document.querySelector("#scene");

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0x0b111c, 1);
sceneRoot.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x3b4b6b, 0.022);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 240);
camera.position.set(0, 10, 20);

const controls = new PointerLockControls(camera, renderer.domElement);
scene.add(controls.getObject());

const ambient = new THREE.AmbientLight(0x9bb3d1, 0.35);
scene.add(ambient);

const hemi = new THREE.HemisphereLight(0x6b87b5, 0x1e2c41, 0.35);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xf5f3e8, 1.4);
sun.position.set(30, 40, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 160;
sun.shadow.camera.left = -60;
sun.shadow.camera.right = 60;
sun.shadow.camera.top = 60;
sun.shadow.camera.bottom = -60;
scene.add(sun);

const skyGeometry = new THREE.SphereGeometry(180, 64, 64);
const skyMaterial = new THREE.ShaderMaterial({
  uniforms: {
    topColor: { value: new THREE.Color(0x0a1631) },
    bottomColor: { value: new THREE.Color(0x5c88b8) },
    offset: { value: 10 },
    exponent: { value: 0.6 },
  },
  vertexShader: `
    varying vec3 vWorldPosition;
    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 topColor;
    uniform vec3 bottomColor;
    uniform float offset;
    uniform float exponent;
    varying vec3 vWorldPosition;
    void main() {
      float h = normalize(vWorldPosition + offset).y;
      gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
    }
  `,
  side: THREE.BackSide,
});
const sky = new THREE.Mesh(skyGeometry, skyMaterial);
scene.add(sky);

const createVoxelTexture = (options) => {
  const { base, accent, noise } = options;
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 4200; i += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const radius = Math.random() * 2 + 0.5;
    ctx.fillStyle = Math.random() > 0.5 ? accent : noise;
    ctx.globalAlpha = Math.random() * 0.6 + 0.2;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  for (let i = 0; i < 60; i += 1) {
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.2;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(Math.random() * size, Math.random() * size);
    ctx.lineTo(Math.random() * size, Math.random() * size);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1);
  texture.anisotropy = 8;
  return texture;
};

const textures = {
  grass: createVoxelTexture({ base: "#3e6b3b", accent: "#5f8c4d", noise: "#2f4b2e" }),
  dirt: createVoxelTexture({ base: "#6b4e32", accent: "#845a3c", noise: "#4d3522" }),
  stone: createVoxelTexture({ base: "#6b6f74", accent: "#8b9096", noise: "#52565a" }),
  sand: createVoxelTexture({ base: "#c7b17e", accent: "#dfc792", noise: "#a8925f" }),
  wood: createVoxelTexture({ base: "#6f4c2f", accent: "#8d623e", noise: "#573621" }),
  leaf: createVoxelTexture({ base: "#2f5f3a", accent: "#3d7a4c", noise: "#214627" }),
};

const materials = {
  grass: new THREE.MeshStandardMaterial({ map: textures.grass, roughness: 0.9, metalness: 0.05 }),
  dirt: new THREE.MeshStandardMaterial({ map: textures.dirt, roughness: 0.95, metalness: 0.02 }),
  stone: new THREE.MeshStandardMaterial({ map: textures.stone, roughness: 0.9, metalness: 0.05 }),
  sand: new THREE.MeshStandardMaterial({ map: textures.sand, roughness: 0.85, metalness: 0.02 }),
  wood: new THREE.MeshStandardMaterial({ map: textures.wood, roughness: 0.8, metalness: 0.05 }),
  leaf: new THREE.MeshStandardMaterial({ map: textures.leaf, roughness: 0.9, metalness: 0.05, transparent: true, opacity: 0.95 }),
};

const voxelGroup = new THREE.Group();
scene.add(voxelGroup);

const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
const blocks = new Map();

const keyFor = (x, y, z) => `${x},${y},${z}`;

const addBlock = (x, y, z, material) => {
  const key = keyFor(x, y, z);
  if (blocks.has(key)) return;
  const voxel = new THREE.Mesh(boxGeometry, material);
  voxel.position.set(x, y, z);
  voxel.castShadow = true;
  voxel.receiveShadow = true;
  voxelGroup.add(voxel);
  blocks.set(key, voxel);
};

const removeBlock = (x, y, z) => {
  const key = keyFor(x, y, z);
  const voxel = blocks.get(key);
  if (!voxel) return;
  voxelGroup.remove(voxel);
  voxel.geometry.dispose();
  blocks.delete(key);
};

const noise = (x, z) => {
  const value = Math.sin(x * 0.25) * 0.6 + Math.cos(z * 0.2) * 0.4 + Math.sin((x + z) * 0.12) * 0.9;
  return (value + 2) / 4;
};

const buildTree = (x, y, z) => {
  const height = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < height; i += 1) {
    addBlock(x, y + i, z, materials.wood);
  }
  for (let lx = -2; lx <= 2; lx += 1) {
    for (let lz = -2; lz <= 2; lz += 1) {
      for (let ly = 0; ly <= 2; ly += 1) {
        if (Math.abs(lx) + Math.abs(lz) + ly > 5) continue;
        addBlock(x + lx, y + height - 1 + ly, z + lz, materials.leaf);
      }
    }
  }
};

const buildWorld = () => {
  voxelGroup.clear();
  blocks.clear();
  const size = 30;

  for (let x = -size; x <= size; x += 1) {
    for (let z = -size; z <= size; z += 1) {
      const height = Math.floor(noise(x, z) * 7 + 2);
      const topMaterial = height > 7 ? materials.stone : height > 4 ? materials.grass : materials.sand;
      const fillMaterial = height > 4 ? materials.dirt : materials.sand;

      for (let y = 0; y <= height; y += 1) {
        const isTop = y === height;
        const material = isTop ? topMaterial : fillMaterial;
        addBlock(x, y, z, material);
      }

      if (topMaterial === materials.grass && Math.random() > 0.92) {
        buildTree(x, height + 1, z);
      }
    }
  }
};

buildWorld();

const floor = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), new THREE.MeshStandardMaterial({ color: 0x1e2a38 }));
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.6;
floor.receiveShadow = true;
scene.add(floor);

const keys = new Set();
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
const walkSpeed = 12;
let verticalVelocity = 0;
const gravity = -28;
const jumpVelocity = 11;
const playerHeight = 2;

const handleKey = (event, pressed) => {
  if (["KeyW", "KeyA", "KeyS", "KeyD", "Space", "ShiftLeft"].includes(event.code)) {
    event.preventDefault();
  }
  if (pressed) {
    keys.add(event.code);
  } else {
    keys.delete(event.code);
  }
};

document.addEventListener("keydown", (event) => handleKey(event, true));
document.addEventListener("keyup", (event) => handleKey(event, false));

document.addEventListener("keydown", (event) => {
  if (event.code === "KeyR") {
    buildWorld();
  }
});

renderer.domElement.addEventListener("click", () => {
  if (!controls.isLocked) {
    controls.lock();
  }
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(0, 0);

const handlePointerAction = (event) => {
  if (!controls.isLocked) return;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(voxelGroup.children, false);
  if (hits.length === 0) return;

  const hit = hits[0];
  const target = hit.object.position.clone();

  if (event.button === 0) {
    removeBlock(target.x, target.y, target.z);
  }

  if (event.button === 2) {
    const normal = hit.face?.normal.clone() ?? new THREE.Vector3(0, 1, 0);
    const placement = target.add(normal);
    addBlock(placement.x, placement.y, placement.z, materials.stone);
  }
};

renderer.domElement.addEventListener("mousedown", handlePointerAction);
renderer.domElement.addEventListener("contextmenu", (event) => event.preventDefault());

const clock = new THREE.Clock();
let hasRendered = false;

const animate = () => {
  const delta = Math.min(clock.getDelta(), 0.05);
  velocity.set(0, 0, 0);
  direction.set(0, 0, 0);

  if (keys.has("KeyW")) direction.z -= 1;
  if (keys.has("KeyS")) direction.z += 1;
  if (keys.has("KeyA")) direction.x -= 1;
  if (keys.has("KeyD")) direction.x += 1;

  direction.normalize();
  velocity.x = direction.x * walkSpeed * delta;
  velocity.z = direction.z * walkSpeed * delta;

  controls.moveRight(velocity.x);
  controls.moveForward(velocity.z);

  verticalVelocity += gravity * delta;
  if (keys.has("Space") && Math.abs(verticalVelocity) < 0.1) {
    verticalVelocity = jumpVelocity;
  }

  const nextY = controls.getObject().position.y + verticalVelocity * delta;
  const floorHeight = playerHeight;
  if (nextY <= floorHeight) {
    controls.getObject().position.y = floorHeight;
    verticalVelocity = 0;
  } else {
    controls.getObject().position.y = nextY;
  }

  renderer.render(scene, camera);
  if (!hasRendered) {
    window.__candecraftReady = true;
    hasRendered = true;
  }
  requestAnimationFrame(animate);
};

animate();
