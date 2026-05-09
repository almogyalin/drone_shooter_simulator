import * as THREE from 'three';

const WAVE_CONFIGS = [
  // Wave 1: Hovering — very close, easy targets
  { drones: [
    { count: 4, behavior: { type: 'hover' }, distRange: [25, 50], height: [8, 15], points: 10, angleRange: [-0.4, 0.4] }
  ], message: 'Wave 1 — Stationary Targets\nDrones hovering nearby. Get used to aiming.' },

  // Wave 2: Slow approach, one at a time
  { drones: [
    { count: 4, behavior: { type: 'slow', speed: 8 }, distRange: [120, 180], height: [15, 25], points: 15, stagger: 3, angleRange: [-0.5, 0.5] }
  ], message: 'Wave 2 — Slow Approach\nDrones moving toward you at low speed.' },

  // Wave 3: Slow approach, simultaneous
  { drones: [
    { count: 6, behavior: { type: 'slow', speed: 10 }, distRange: [140, 200], height: [15, 25], points: 15, angleRange: [-0.8, 0.8] }
  ], message: 'Wave 3 — Multiple Slow Drones\nSeveral drones approaching from a wider arc.' },

  // Wave 4: Fast from one direction
  { drones: [
    { count: 3, behavior: { type: 'fast', speed: 25 }, distRange: [200, 280], height: [15, 30], points: 25, angleRange: [-0.5, 0.5] }
  ], message: 'Wave 4 — Fast Approach\nDrones at realistic FPV speed.\nYou have seconds to react.' },

  // Wave 5: Fast from wider arc
  { drones: [
    { count: 5, behavior: { type: 'fast', speed: 30 }, distRange: [200, 300], height: [15, 30], points: 25, stagger: 1.5, angleRange: [-1.2, 1.2] }
  ], message: 'Wave 5 — Fast Multi-Direction\nFast drones from a wider angle. Stay alert.' },

  // Wave 6: Evasive moderate
  { drones: [
    { count: 3, behavior: { type: 'evasive', speed: 15, jinkStrength: 2 }, distRange: [150, 220], height: [12, 25], points: 40, angleRange: [-1.0, 1.0] }
  ], message: 'Wave 6 — Evasive Maneuvers\nDrones performing unpredictable jinking.' },

  // Wave 7: Evasive aggressive — half circle
  { drones: [
    { count: 5, behavior: { type: 'evasive', speed: 20, jinkStrength: 4 }, distRange: [180, 260], height: [12, 28], points: 50, angleRange: [-1.57, 1.57] }
  ], message: 'Wave 7 — Aggressive Evasion\nHarder to track. Coming from a wider arc.' },

  // Wave 8: Mix fast + evasive — half circle
  { drones: [
    { count: 3, behavior: { type: 'fast', speed: 30 }, distRange: [200, 280], height: [15, 30], points: 30, angleRange: [-1.57, 1.57] },
    { count: 3, behavior: { type: 'evasive', speed: 18, jinkStrength: 3 }, distRange: [150, 220], height: [12, 25], points: 45, angleRange: [-1.57, 1.57] }
  ], message: 'Wave 8 — Mixed Threats\nFast and evasive drones from 180°.' },

  // Wave 9: Coordinated 2 groups of 2
  { drones: [
    { count: 2, behavior: { type: 'coordinated', speed: 22 }, distRange: [180, 240], height: [15, 25], points: 35, angleRange: [0, 0.1] },
    { count: 2, behavior: { type: 'coordinated', speed: 22 }, distRange: [180, 240], height: [15, 25], points: 35, angleRange: [Math.PI - 0.1, Math.PI + 0.1] }
  ], message: 'Wave 9 — Coordinated Attack\nDrones attacking from opposite sides simultaneously.' },

  // Wave 10: 3 groups of 2 at 120°
  { drones: [
    { count: 2, behavior: { type: 'coordinated', speed: 25 }, distRange: [190, 250], height: [15, 28], points: 40, angleRange: [0, 0.2] },
    { count: 2, behavior: { type: 'coordinated', speed: 25 }, distRange: [190, 250], height: [15, 28], points: 40, angleRange: [2.09, 2.29] },
    { count: 2, behavior: { type: 'coordinated', speed: 25 }, distRange: [190, 250], height: [15, 28], points: 40, angleRange: [4.18, 4.38] }
  ], message: 'Wave 10 — Three-Axis Attack\nCoordinated from 120° apart. You can\'t watch everywhere.' },

  // Wave 11: 4 directions + evasive
  { drones: [
    { count: 1, behavior: { type: 'coordinated', speed: 28 }, distRange: [190, 250], height: [15, 25], points: 40, angleRange: [0, 0.1] },
    { count: 1, behavior: { type: 'coordinated', speed: 28 }, distRange: [190, 250], height: [15, 25], points: 40, angleRange: [1.57, 1.67] },
    { count: 1, behavior: { type: 'coordinated', speed: 28 }, distRange: [190, 250], height: [15, 25], points: 40, angleRange: [3.14, 3.24] },
    { count: 1, behavior: { type: 'coordinated', speed: 28 }, distRange: [190, 250], height: [15, 25], points: 40, angleRange: [4.71, 4.81] },
    { count: 2, behavior: { type: 'evasive', speed: 20, jinkStrength: 3 }, distRange: [170, 230], height: [12, 25], points: 50 }
  ], message: 'Wave 11 — Surrounded\nAttacks from all four directions plus evasive drones.' },

  // Wave 12: Swarm 10
  { drones: [
    { count: 10, behavior: { type: 'swarm', speed: 22 }, distRange: [180, 280], height: [10, 30], points: 30 }
  ], message: 'Wave 12 — The Swarm Begins\n10 drones. This is where conventional weapons fail.' },

  // Wave 13: Swarm 15 faster
  { drones: [
    { count: 15, behavior: { type: 'swarm', speed: 26 }, distRange: [190, 300], height: [10, 30], points: 30 }
  ], message: 'Wave 13 — Growing Swarm\n15 drones, faster approach. Overwhelm is the strategy.' },

  // Wave 14: Swarm 20 evasive
  { drones: [
    { count: 20, behavior: { type: 'swarm', speed: 30 }, distRange: [190, 300], height: [10, 30], points: 35 }
  ], message: 'Wave 14 — Mass Attack\n20 drones. Even 90% accuracy isn\'t enough.' },

  // Wave 15: Final swarm
  { drones: [
    { count: 25, behavior: { type: 'swarm', speed: 33 }, distRange: [180, 280], height: [10, 30], points: 40 }
  ], message: 'Wave 15 — FINAL WAVE\n25 drones. No infantry weapon can stop this.\nThis is the reality of modern drone warfare.' }
];

const EDUCATIONAL_MESSAGES = {
  3: 'Real FPV drones travel at 140 km/h.\nA soldier has less than 5 seconds to react at 200m.',
  5: 'An M16 bullet is fast, but hitting a 30cm target\nmoving at 100+ km/h is nearly impossible.',
  8: 'Modern FPV drones use AI-assisted evasion.\nHit rates drop to 20-43% even for trained operators.',
  11: 'Coordinated drone attacks from multiple angles\nmake single-shooter defense impossible.',
  14: 'Even at 92% intercept rate, a 25-drone swarm\nstill gets 2 drones through. That\'s enough.'
};

export class WaveManager {
  constructor(game, droneManager) {
    this.game = game;
    this.droneManager = droneManager;
    this.waveTimer = 0;
    this.betweenWaves = false;
    this.staggerQueue = [];
    this.staggerTimer = 0;
    this.totalWaves = WAVE_CONFIGS.length;
  }

  reset() {
    this.waveTimer = 0;
    this.betweenWaves = false;
    this.staggerQueue = [];
  }

  startNextWave() {
    this.game.wave++;
    if (this.game.wave > WAVE_CONFIGS.length) {
      this.game.state = 'gameover';
      this.game.won = true;
      return;
    }
    const config = WAVE_CONFIGS[this.game.wave - 1];
    this.spawnWave(config);
    this.betweenWaves = false;
  }

  spawnWave(config) {
    config.drones.forEach(group => {
      for (let i = 0; i < group.count; i++) {
        if (group.stagger) {
          this.staggerQueue.push({ group, delay: i * group.stagger });
        } else {
          this.spawnDrone(group);
        }
      }
    });
  }

  spawnDrone(group) {
    let angle;
    if (group.angleRange) {
      angle = group.angleRange[0] + Math.random() * (group.angleRange[1] - group.angleRange[0]);
    } else {
      angle = Math.random() * Math.PI * 2;
    }
    // Offset so angle 0 = forward (-Z direction, default camera facing)
    angle += -Math.PI / 2;
    const dist = group.distRange[0] + Math.random() * (group.distRange[1] - group.distRange[0]);
    const height = group.height[0] + Math.random() * (group.height[1] - group.height[0]);
    const pos = new THREE.Vector3(
      Math.cos(angle) * dist,
      height,
      Math.sin(angle) * dist
    );
    this.droneManager.spawn(pos, { ...group.behavior }, group.points);
  }

  update(dt) {
    // Stagger spawning
    for (let i = this.staggerQueue.length - 1; i >= 0; i--) {
      this.staggerQueue[i].delay -= dt;
      if (this.staggerQueue[i].delay <= 0) {
        this.spawnDrone(this.staggerQueue[i].group);
        this.staggerQueue.splice(i, 1);
      }
    }

    // Between waves countdown
    if (this.betweenWaves) {
      this.waveTimer -= dt;
    }
  }

  getMessage() {
    if (this.game.wave > 0 && this.game.wave <= WAVE_CONFIGS.length) {
      return WAVE_CONFIGS[this.game.wave - 1].message;
    }
    return '';
  }

  getEducationalMessage() {
    return EDUCATIONAL_MESSAGES[this.game.wave] || null;
  }
}
