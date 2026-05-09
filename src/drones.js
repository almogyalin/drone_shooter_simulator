import * as THREE from 'three';

function createDroneMesh() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.15, 0.5),
    new THREE.MeshLambertMaterial({ color: 0x222222 })
  );
  group.add(body);
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI / 2) + Math.PI / 4;
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.05, 0.45),
      new THREE.MeshLambertMaterial({ color: 0x333333 })
    );
    arm.position.set(Math.cos(angle) * 0.35, 0, Math.sin(angle) * 0.35);
    arm.rotation.y = -angle;
    group.add(arm);
    const rotor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.15, 0.01, 8),
      new THREE.MeshLambertMaterial({ color: 0x666666, transparent: true, opacity: 0.6 })
    );
    rotor.position.set(Math.cos(angle) * 0.45, 0.05, Math.sin(angle) * 0.45);
    rotor.userData.rotorIndex = i;
    group.add(rotor);
  }
  const led = new THREE.Mesh(
    new THREE.SphereGeometry(0.04, 4, 4),
    new THREE.MeshBasicMaterial({ color: 0xff0000 })
  );
  led.position.set(0, -0.08, 0.25);
  group.add(led);
  return group;
}

export class Drone {
  constructor(position, behavior, points = 10) {
    this.mesh = createDroneMesh();
    this.mesh.position.copy(position);
    this.behavior = behavior;
    this.hitRadius = 0.8;
    this.alive = true;
    this.falling = false;
    this.fallVelocity = new THREE.Vector3();
    this.points = points;
    this.time = Math.random() * 100;
    this.spawnPos = position.clone();
    this.speed = behavior.speed || 10;
    // Evasive params
    this.evasiveOffset = new THREE.Vector3();
    this.jinkTimer = 0;
    this.jinkTarget = new THREE.Vector3();
    // Buzzing audio
    this.buzzOsc = null;
    this.buzzGain = null;
    this.initBuzz();
  }

  initBuzz() {
    try {
      const ctx = Drone.audioCtx || (Drone.audioCtx = new (window.AudioContext || window.webkitAudioContext)());
      this.buzzGain = ctx.createGain();
      this.buzzGain.gain.value = 0;
      this.buzzGain.connect(ctx.destination);

      // Motor whine — high frequency buzz
      this.motorOsc = ctx.createOscillator();
      this.motorOsc.type = 'square';
      this.motorOsc.frequency.value = 185 + Math.random() * 30;
      const motorGain = ctx.createGain();
      motorGain.gain.value = 0.3;
      this.motorOsc.connect(motorGain);
      motorGain.connect(this.buzzGain);
      this.motorOsc.start();

      // Prop wash — filtered noise
      const bufSize = ctx.sampleRate * 2;
      const noiseBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
      this.noiseSource = ctx.createBufferSource();
      this.noiseSource.buffer = noiseBuf;
      this.noiseSource.loop = true;
      const bandpass = ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.value = 400 + Math.random() * 100;
      bandpass.Q.value = 2;
      const noiseGain = ctx.createGain();
      noiseGain.gain.value = 0.7;
      this.noiseSource.connect(bandpass);
      bandpass.connect(noiseGain);
      noiseGain.connect(this.buzzGain);
      this.noiseSource.start();

      // Low frequency throb — simulates blade pass
      this.throbOsc = ctx.createOscillator();
      this.throbOsc.type = 'sine';
      this.throbOsc.frequency.value = 45 + Math.random() * 10;
      const throbGain = ctx.createGain();
      throbGain.gain.value = 0.4;
      this.throbOsc.connect(throbGain);
      throbGain.connect(this.buzzGain);
      this.throbOsc.start();
    } catch (e) {}
  }

  stopBuzz() {
    try {
      if (this.motorOsc) { this.motorOsc.stop(); this.motorOsc = null; }
      if (this.noiseSource) { this.noiseSource.stop(); this.noiseSource = null; }
      if (this.throbOsc) { this.throbOsc.stop(); this.throbOsc = null; }
    } catch (e) {}
  }

  update(dt, playerPos) {
    if (!this.alive) return;
    this.time += dt;

    // Spin rotors
    this.mesh.children.forEach(c => {
      if (c.userData.rotorIndex !== undefined) c.rotation.y += dt * 40;
    });

    const toPlayer = new THREE.Vector3().subVectors(playerPos, this.mesh.position);
    const dist = toPlayer.length();
    const horizDist = new THREE.Vector2(toPlayer.x, toPlayer.z).length();
    toPlayer.normalize();

    // Dive threshold — fly level at altitude until close, then dive at ~45°
    const diveRange = 40;
    const horizDir = new THREE.Vector3(toPlayer.x, 0, toPlayer.z).normalize();

    switch (this.behavior.type) {
      case 'hover':
        this.mesh.position.y += Math.sin(this.time * 3) * 0.002;
        break;

      case 'slow': {
        const dir = horizDist > diveRange ? horizDir : toPlayer;
        this.mesh.position.addScaledVector(dir, this.speed * dt);
        this.mesh.position.y += Math.sin(this.time * 2) * 0.003;
        break;
      }

      case 'fast': {
        const dir = horizDist > diveRange ? horizDir : toPlayer;
        this.mesh.position.addScaledVector(dir, this.speed * dt);
        break;
      }

      case 'evasive': {
        this.jinkTimer -= dt;
        if (this.jinkTimer <= 0) {
          this.jinkTimer = 0.3 + Math.random() * 0.5;
          const right = new THREE.Vector3().crossVectors(toPlayer, new THREE.Vector3(0, 1, 0)).normalize();
          const up = new THREE.Vector3(0, 1, 0);
          this.jinkTarget.set(0, 0, 0)
            .addScaledVector(right, (Math.random() - 0.5) * this.behavior.jinkStrength)
            .addScaledVector(up, (Math.random() - 0.5) * this.behavior.jinkStrength * 0.5);
        }
        this.evasiveOffset.lerp(this.jinkTarget, dt * 5);
        const baseDir = horizDist > diveRange ? horizDir : toPlayer;
        const evasiveDir = baseDir.clone().add(this.evasiveOffset).normalize();
        this.mesh.position.addScaledVector(evasiveDir, this.speed * dt);
        break;
      }

      case 'coordinated': {
        const dir = horizDist > diveRange ? horizDir : toPlayer;
        this.mesh.position.addScaledVector(dir, this.speed * dt);
        const right2 = new THREE.Vector3().crossVectors(toPlayer, new THREE.Vector3(0, 1, 0)).normalize();
        this.mesh.position.addScaledVector(right2, Math.sin(this.time * 4) * dt * 2);
        break;
      }

      case 'swarm': {
        this.jinkTimer -= dt;
        if (this.jinkTimer <= 0) {
          this.jinkTimer = 0.2 + Math.random() * 0.3;
          const r = new THREE.Vector3().crossVectors(toPlayer, new THREE.Vector3(0, 1, 0)).normalize();
          this.jinkTarget.set(0, 0, 0)
            .addScaledVector(r, (Math.random() - 0.5) * 3)
            .add(new THREE.Vector3(0, (Math.random() - 0.5) * 1.5, 0));
        }
        this.evasiveOffset.lerp(this.jinkTarget, dt * 4);
        const baseDir2 = horizDist > diveRange ? horizDir : toPlayer;
        const swarmDir = baseDir2.clone().add(this.evasiveOffset).normalize();
        this.mesh.position.addScaledVector(swarmDir, this.speed * dt);
        break;
      }
    }

    // Face player
    this.mesh.lookAt(playerPos);

    // Keep above ground
    if (this.mesh.position.y < 1) this.mesh.position.y = 1;

    // Update buzz volume based on distance
    if (this.buzzGain) {
      const d = this.mesh.position.distanceTo(playerPos);
      this.buzzGain.gain.value = Math.pow(Math.max(0, 1 - d / 100), 3) * 0.15;
    }
  }

  distToPlayer(playerPos) {
    return this.mesh.position.distanceTo(playerPos);
  }
}

export class DroneManager {
  constructor(scene) {
    this.scene = scene;
    this.drones = [];
    this.explosions = [];
  }

  spawn(position, behavior, points) {
    const drone = new Drone(position, behavior, points);
    this.scene.add(drone.mesh);
    this.drones.push(drone);
    return drone;
  }

  update(dt) {
    const playerPos = new THREE.Vector3(0, 1.7, 0);
    this.drones.forEach(d => {
      if (d.falling) {
        d.fallVelocity.y -= 9.8 * dt;
        d.mesh.position.addScaledVector(d.fallVelocity, dt);
        d.mesh.rotation.x += dt * 8;
        d.mesh.rotation.z += dt * 5;
        if (d.mesh.position.y <= 0.1) {
          d.mesh.position.y = 0.1;
          this.createExplosion(d.mesh.position.clone());
          this.scene.remove(d.mesh);
          d.fallen = true;
        }
      } else {
        d.update(dt, playerPos);
      }
    });
    this.drones = this.drones.filter(d => !d.fallen);
    // Update explosions
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const exp = this.explosions[i];
      exp.life -= dt;
      exp.particles.forEach(p => {
        p.position.addScaledVector(p.userData.vel, dt);
        p.scale.multiplyScalar(0.95);
      });
      if (exp.life <= 0) {
        exp.particles.forEach(p => this.scene.remove(p));
        this.explosions.splice(i, 1);
      }
    }
  }

  destroyDrone(drone) {
    drone.alive = false;
    drone.falling = true;
    drone.stopBuzz();
    // Give it a random tumble velocity
    drone.fallVelocity.set(
      (Math.random() - 0.5) * 5,
      2,
      (Math.random() - 0.5) * 5
    );
  }

  createExplosion(pos) {
    const particles = [];
    // Fireball core
    for (let i = 0; i < 15; i++) {
      const size = 0.15 + Math.random() * 0.2;
      const p = new THREE.Mesh(
        new THREE.SphereGeometry(size, 6, 6),
        new THREE.MeshBasicMaterial({ color: [0xff2200, 0xff6600, 0xffaa00, 0xffdd00][Math.floor(Math.random() * 4)] })
      );
      p.position.copy(pos);
      p.userData.vel = new THREE.Vector3(
        (Math.random() - 0.5) * 12,
        Math.random() * 15 + 3,
        (Math.random() - 0.5) * 12
      );
      this.scene.add(p);
      particles.push(p);
    }
    // Debris/smoke
    for (let i = 0; i < 20; i++) {
      const p = new THREE.Mesh(
        new THREE.SphereGeometry(0.06 + Math.random() * 0.08, 4, 4),
        new THREE.MeshBasicMaterial({ color: Math.random() > 0.5 ? 0x222222 : 0x555555 })
      );
      p.position.copy(pos);
      p.userData.vel = new THREE.Vector3(
        (Math.random() - 0.5) * 18,
        Math.random() * 10 + 2,
        (Math.random() - 0.5) * 18
      );
      this.scene.add(p);
      particles.push(p);
    }
    // Ground dust ring
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const p = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 4, 4),
        new THREE.MeshBasicMaterial({ color: 0xD2B48C, transparent: true, opacity: 0.8 })
      );
      p.position.copy(pos);
      p.position.y = 0.2;
      p.userData.vel = new THREE.Vector3(
        Math.cos(angle) * 8,
        Math.random() * 2,
        Math.sin(angle) * 8
      );
      this.scene.add(p);
      particles.push(p);
    }
    this.explosions.push({ particles, life: 1.5 });
  }

  checkReachedPlayer(playerPos) {
    return this.drones.find(d => d.alive && !d.falling && d.distToPlayer(playerPos) < 2);
  }

  getActiveDrones() {
    return this.drones.filter(d => d.alive && !d.falling);
  }

  clear() {
    this.drones.forEach(d => { d.stopBuzz(); this.scene.remove(d.mesh); });
    this.drones = [];
    this.explosions.forEach(e => e.particles.forEach(p => this.scene.remove(p)));
    this.explosions = [];
  }

  get count() { return this.drones.filter(d => d.alive && !d.falling).length; }
}
