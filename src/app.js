import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.159.0/build/three.module.js";
import { PointerLockControls } from "https://cdn.jsdelivr.net/npm/three@0.159.0/examples/jsm/controls/PointerLockControls.js";

const sceneRoot = document.querySelector("#scene");

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
sceneRoot.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x3b4b6b, 0.025);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 6, 14);

const controls = new PointerLockControls(camera, renderer.domElement);
scene.add(controls.getObject());

const ambient = new THREE.AmbientLight(0x9bb3d1, 0.35);
scene.add(ambient);

const moon = new THREE.DirectionalLight(0xb9d6ff, 1.2);
moon.position.set(20, 30, 15);
moon.castShadow = true;
moon.shadow.mapSize.set(2048, 2048);
moon.shadow.camera.near = 1;
moon.shadow.camera.far = 120;
moon.shadow.camera.left = -50;
moon.shadow.camera.right = 50;
moon.shadow.camera.top = 50;
moon.shadow.camera.bottom = -50;
scene.add(moon);

const skyGeometry = new THREE.SphereGeometry(160, 64, 64);
const skyMaterial = new THREE.ShaderMaterial({
  uniforms: {
    topColor: { value: new THREE.Color(0x101c33) },
    bottomColor: { value: new THREE.Color(0x4a6a91) },
    offset: { value: 10 },
    exponent: { value: 0.5 },
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

const textureLoader = new THREE.TextureLoader();
const textures = {
  grass: textureLoader.load("https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=512&q=60"),
  stone: textureLoader.load("https://images.unsplash.com/photo-1523419409543-77f8d2d7ce67?auto=format&fit=crop&w=512&q=60"),
  sand: textureLoader.load("https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=512&q=60"),
};

Object.values(textures).forEach((texture) => {
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1);
  texture.anisotropy = 8;
});

const voxelGroup = new THREE.Group();
scene.add(voxelGroup);

const boxGeometry = new THREE.BoxGeometry(1, 1, 1);

const materials = {
  grass: new THREE.MeshStandardMaterial({ map: textures.grass, roughness: 0.9, metalness: 0.1 }),
  stone: new THREE.MeshStandardMaterial({ map: textures.stone, roughness: 0.95, metalness: 0.05 }),
  sand: new THREE.MeshStandardMaterial({ map: textures.sand, roughness: 0.8, metalness: 0.05 }),
};

const noise = (x, z) => {
  const value = Math.sin(x * 0.3) * 0.6 + Math.cos(z * 0.2) * 0.4 + Math.sin((x + z) * 0.1) * 0.9;
  return (value + 2) / 4;
};

const buildWorld = () => {
  voxelGroup.clear();
  const size = 24;
  for (let x = -size; x <= size; x += 1) {
    for (let z = -size; z <= size; z += 1) {
      const height = Math.floor(noise(x, z) * 6 + 2);
      const baseMaterial = height > 6 ? materials.stone : height > 4 ? materials.grass : materials.sand;

      for (let y = 0; y <= height; y += 1) {
        const isTop = y === height;
        const material = isTop ? baseMaterial : materials.stone;
        const voxel = new THREE.Mesh(boxGeometry, material);
        voxel.position.set(x, y, z);
        voxel.castShadow = true;
        voxel.receiveShadow = true;
        voxelGroup.add(voxel);
      }
    }
  }
};

buildWorld();

const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0x1e2a38 }));
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.6;
floor.receiveShadow = true;
scene.add(floor);

const keys = new Set();
let velocity = new THREE.Vector3();
const walkSpeed = 10;

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

window.addEventListener("keydown", (event) => {
  if (event.code === "KeyR") {
    buildWorld();
  }
});

const clock = new THREE.Clock();

const animate = () => {
  const delta = clock.getDelta();
  velocity.set(0, 0, 0);
  if (keys.has("KeyW")) velocity.z -= 1;
  if (keys.has("KeyS")) velocity.z += 1;
  if (keys.has("KeyA")) velocity.x -= 1;
  if (keys.has("KeyD")) velocity.x += 1;
  if (keys.has("Space")) velocity.y += 1;
  if (keys.has("ShiftLeft")) velocity.y -= 1;

  velocity.normalize().multiplyScalar(walkSpeed * delta);

  controls.moveRight(velocity.x);
  controls.moveForward(velocity.z);
  controls.getObject().position.y += velocity.y;

  controls.getObject().position.y = Math.max(2, controls.getObject().position.y);

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
};

animate();
