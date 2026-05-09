import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { WeaponSystem } from './weapons.js';
import { DroneManager } from './drones.js';
import { WaveManager } from './waves.js';
import { HUD } from './hud.js';
import { AudioManager } from './audio.js';

// Detect mobile
const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || ('ontouchstart' in window && window.innerWidth < 1024);

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.Fog(0x87CEEB, 300, 700);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.7, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// Lighting
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const sun = new THREE.DirectionalLight(0xffffff, 1);
sun.position.set(50, 80, 30);
sun.castShadow = true;
scene.add(sun);

// Ground
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(1000, 1000),
  new THREE.MeshLambertMaterial({ color: 0xD2B48C })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Sandbags
function addSandbags(x, z, rotY) {
  const g = new THREE.Group();
  for (let row = 0; row < 2; row++) {
    const count = row === 0 ? 3 : 2;
    for (let i = 0; i < count; i++) {
      const bag = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.25, 0.3),
        new THREE.MeshLambertMaterial({ color: 0x8B7355 })
      );
      bag.position.set(i * 0.55 - (count - 1) * 0.275, 0.125 + row * 0.25, 0);
      bag.castShadow = true;
      g.add(bag);
    }
  }
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  scene.add(g);
}
addSandbags(2, 0, 0);
addSandbags(-2, 0, 0);
addSandbags(0, 2, Math.PI / 2);
addSandbags(0, -2, Math.PI / 2);

// Game state
const game = { state: 'menu', score: 0, wave: 0, camera, scene, controls: null, won: false };

// Systems
const audio = new AudioManager();
const weapons = new WeaponSystem(game, scene, camera, audio);
const drones = new DroneManager(scene);
const waves = new WaveManager(game, drones);
const hud = new HUD(game, weapons, drones, waves);

// Zoom/scope
const DEFAULT_FOV = 75;
const ZOOM_FOV = 20;
let zoomed = false;

function zoomIn() {
  zoomed = true;
  camera.fov = ZOOM_FOV;
  camera.updateProjectionMatrix();
  document.getElementById('crosshair').style.display = 'none';
  document.getElementById('scope-overlay').style.display = 'block';
}

function zoomOut() {
  zoomed = false;
  camera.fov = DEFAULT_FOV;
  camera.updateProjectionMatrix();
  document.getElementById('crosshair').style.display = 'block';
  document.getElementById('scope-overlay').style.display = 'none';
}

function startGame() {
  game.state = 'playing';
  waves.startNextWave();
  hud.announceWave(waves.getMessage());
  hud.hideMessage();
}

function restart() {
  game.score = 0;
  game.wave = 0;
  game.state = 'playing';
  game.won = false;
  drones.clear();
  weapons.reset();
  waves.reset();
  if (zoomed) zoomOut();
  waves.startNextWave();
  hud.announceWave(waves.getMessage());
  hud.hideMessage();
  if (!isMobile) controls.lock();
}

// === DESKTOP CONTROLS ===
let controls;
if (!isMobile) {
  controls = new PointerLockControls(camera, document.body);
  game.controls = controls;

  document.addEventListener('click', () => {
    if (game.state === 'menu') controls.lock();
    else if (game.state === 'gameover') restart();
  });

  controls.addEventListener('lock', () => {
    if (game.state === 'menu') startGame();
  });

  controls.addEventListener('unlock', () => {
    if (game.state === 'playing') controls.lock();
  });

  document.addEventListener('mousedown', (e) => {
    if (game.state === 'playing' && e.button === 0) weapons.startFiring();
    if (game.state === 'playing' && e.button === 2) zoomIn();
  });
  document.addEventListener('mouseup', (e) => {
    if (e.button === 0) weapons.stopFiring();
    if (e.button === 2) zoomOut();
  });
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('keydown', (e) => {
    if (game.state !== 'playing') return;
    if (e.code === 'Digit1') weapons.switchWeapon(0);
    if (e.code === 'Digit2') weapons.switchWeapon(1);
    if (e.code === 'Digit3') weapons.switchWeapon(2);
    if (e.code === 'KeyR') weapons.reload();
  });
}

// === MOBILE CONTROLS ===
if (isMobile) {
  // Show mobile UI
  document.getElementById('mobile-ui').style.display = 'block';

  // DeviceOrientation for camera look
  let orientAlpha = 0, orientBeta = 0, orientGamma = 0;
  let orientBase = null;

  function handleOrientation(e) {
    if (game.state !== 'playing') return;
    const alpha = e.alpha || 0; // compass
    const beta = e.beta || 0;   // front-back tilt (-180 to 180)
    const gamma = e.gamma || 0; // left-right tilt (-90 to 90)

    if (!orientBase) {
      orientBase = { alpha, beta, gamma };
    }

    // Relative rotation from starting orientation
    let yaw = -(alpha - orientBase.alpha) * (Math.PI / 180);
    let pitch = -(beta - orientBase.beta) * (Math.PI / 180);

    // Clamp pitch
    pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));

    camera.rotation.order = 'YXZ';
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;
  }

  function requestOrientationPermission() {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      // iOS 13+
      DeviceOrientationEvent.requestPermission().then(response => {
        if (response === 'granted') {
          window.addEventListener('deviceorientation', handleOrientation);
        }
      });
    } else {
      window.addEventListener('deviceorientation', handleOrientation);
    }
  }

  // Tap to start / shoot
  document.addEventListener('touchstart', (e) => {
    if (game.state === 'menu') {
      requestOrientationPermission();
      startGame();
      return;
    }
    if (game.state === 'gameover') {
      orientBase = null;
      restart();
      return;
    }
    // Don't shoot if tapping UI buttons
    if (e.target.closest('#mobile-ui')) return;
    if (game.state === 'playing') weapons.startFiring();
  });

  document.addEventListener('touchend', (e) => {
    if (!e.target.closest('#mobile-ui')) weapons.stopFiring();
  });

  // Weapon switch buttons
  document.getElementById('btn-w1').addEventListener('touchstart', (e) => { e.stopPropagation(); weapons.switchWeapon(0); });
  document.getElementById('btn-w2').addEventListener('touchstart', (e) => { e.stopPropagation(); weapons.switchWeapon(1); });
  document.getElementById('btn-w3').addEventListener('touchstart', (e) => { e.stopPropagation(); weapons.switchWeapon(2); });
  document.getElementById('btn-reload').addEventListener('touchstart', (e) => { e.stopPropagation(); weapons.reload(); });
  document.getElementById('btn-scope').addEventListener('touchstart', (e) => { e.stopPropagation(); zoomIn(); });
  document.getElementById('btn-scope').addEventListener('touchend', (e) => { e.stopPropagation(); zoomOut(); });
}

// Game loop
const clock = new THREE.Clock();
let prevDroneCount = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (game.state === 'playing') {
    weapons.update(dt);
    drones.update(dt);
    waves.update(dt);

    // Collisions
    const hits = weapons.checkCollisions(drones.getActiveDrones());
    hits.forEach(({ drone }) => {
      game.score += drone.points || 10;
      drones.destroyDrone(drone);
      audio.playHit();
      hud.showHitMarker();
    });

    // Drone reached player
    if (drones.checkReachedPlayer(camera.position)) {
      game.state = 'gameover';
      audio.playExplosion();
      hud.showGameOver();
      if (!isMobile && controls) controls.unlock();
    }

    // Wave complete check
    if (!waves.betweenWaves && drones.count === 0 && waves.staggerQueue.length === 0 && prevDroneCount > 0) {
      if (game.wave >= waves.totalWaves) {
        game.state = 'gameover';
        game.won = true;
        hud.showGameOver();
        if (!isMobile && controls) controls.unlock();
      } else {
        waves.betweenWaves = true;
        waves.waveTimer = 3;
      }
    }
    prevDroneCount = drones.count + waves.staggerQueue.length;

    // Between waves — when timer expires, start next
    if (waves.betweenWaves && waves.waveTimer <= 0) {
      waves.betweenWaves = false;
      waves.startNextWave();
      weapons.refill();
      hud.announceWave(waves.getMessage());
    }
  }

  hud.update(dt);
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

hud.showMenu();
animate();
