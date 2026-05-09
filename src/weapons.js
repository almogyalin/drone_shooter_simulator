import * as THREE from 'three';

class Projectile {
  constructor(mesh, velocity, maxLife = 2) {
    this.mesh = mesh;
    this.velocity = velocity;
    this.life = 0;
    this.maxLife = maxLife;
    this.alive = true;
    this.prevPos = mesh.position.clone();
  }
  update(dt) {
    this.life += dt;
    if (this.life > this.maxLife) { this.alive = false; return; }
    this.prevPos.copy(this.mesh.position);
    this.velocity.y -= 9.8 * dt; // slight gravity
    this.mesh.position.addScaledVector(this.velocity, dt);
  }
}

const WEAPONS = [
  { name: 'M16', fireRate: 0.1, magSize: 30, reloadTime: 2.5, spread: 0.003, projectileSpeed: 300, burst: 1, color: 0xffff00 },
  { name: 'Shotgun', fireRate: 0.8, magSize: 8, reloadTime: 3, spread: 0.12, projectileSpeed: 200, burst: 12, color: 0xff8800 },
  { name: 'FN MAG', fireRate: 0.07, magSize: 50, reloadTime: 4, spread: 0.02, projectileSpeed: 280, burst: 1, burstCount: 5, burstDelay: 0.07, color: 0xff4400 }
];

export class WeaponSystem {
  constructor(game, scene, camera, audio) {
    this.game = game;
    this.scene = scene;
    this.camera = camera;
    this.audio = audio;
    this.projectiles = [];
    this.currentWeapon = 0;
    this.ammo = WEAPONS.map(w => w.magSize);
    this.firing = false;
    this.fireCooldown = 0;
    this.reloading = false;
    this.reloadTimer = 0;
    this.burstRemaining = 0;
    this.burstTimer = 0;
    this.muzzleFlash = this.createMuzzleFlash();
    this.muzzleTimer = 0;
    this.weaponModels = this.createWeaponModels();
    this.showCurrentModel();
  }

  createMuzzleFlash() {
    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xffff00 })
    );
    flash.visible = false;
    this.scene.add(flash);
    return flash;
  }

  createWeaponModels() {
    const models = [];
    // M16 - long barrel
    const m16 = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.5), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.08, 0.2), new THREE.MeshLambertMaterial({ color: 0x4a3728 }));
    stock.position.z = 0.3;
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 6), new THREE.MeshLambertMaterial({ color: 0x333333 }));
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = -0.35;
    m16.add(body, stock, barrel);
    models.push(m16);

    // Shotgun - thick short barrel
    const sg = new THREE.Group();
    const sgBody = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.4), new THREE.MeshLambertMaterial({ color: 0x333333 }));
    const sgStock = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.09, 0.2), new THREE.MeshLambertMaterial({ color: 0x5a4030 }));
    sgStock.position.z = 0.25;
    const sgBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.25, 6), new THREE.MeshLambertMaterial({ color: 0x444444 }));
    sgBarrel.rotation.x = Math.PI / 2;
    sgBarrel.position.z = -0.28;
    sg.add(sgBody, sgStock, sgBarrel);
    models.push(sg);

    // FN MAG - bulky
    const mag = new THREE.Group();
    const magBody = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.5), new THREE.MeshLambertMaterial({ color: 0x2a2a2a }));
    const magBox = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.08), new THREE.MeshLambertMaterial({ color: 0x3a5a3a }));
    magBox.position.set(0, -0.06, 0.1);
    const magBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.35, 6), new THREE.MeshLambertMaterial({ color: 0x333333 }));
    magBarrel.rotation.x = Math.PI / 2;
    magBarrel.position.z = -0.38;
    mag.add(magBody, magBox, magBarrel);
    models.push(mag);

    models.forEach(m => { m.visible = false; this.scene.add(m); });
    return models;
  }

  showCurrentModel() {
    this.weaponModels.forEach((m, i) => m.visible = i === this.currentWeapon);
  }

  get weapon() { return WEAPONS[this.currentWeapon]; }

  switchWeapon(idx) {
    if (idx >= 0 && idx < WEAPONS.length && idx !== this.currentWeapon) {
      this.currentWeapon = idx;
      this.reloading = false;
      this.reloadTimer = 0;
      this.burstRemaining = 0;
      this.showCurrentModel();
    }
  }

  startFiring() { this.firing = true; }
  stopFiring() { this.firing = false; }

  reload() {
    if (!this.reloading && this.ammo[this.currentWeapon] < this.weapon.magSize) {
      this.reloading = true;
      this.reloadTimer = this.weapon.reloadTime;
    }
  }

  fire() {
    const w = this.weapon;
    if (this.ammo[this.currentWeapon] <= 0) { this.reload(); return; }

    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);

    const count = w.burst || 1;
    for (let i = 0; i < count; i++) {
      const spread = new THREE.Vector3(
        (Math.random() - 0.5) * w.spread,
        (Math.random() - 0.5) * w.spread,
        (Math.random() - 0.5) * w.spread
      );
      const vel = dir.clone().add(spread).normalize().multiplyScalar(w.projectileSpeed);
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(w.name === 'Shotgun' ? 0.02 : 0.03, 4, 4),
        new THREE.MeshBasicMaterial({ color: w.color })
      );
      mesh.position.copy(this.camera.position);
      this.scene.add(mesh);
      this.projectiles.push(new Projectile(mesh, vel));
    }

    this.ammo[this.currentWeapon]--;
    this.fireCooldown = w.fireRate;
    this.showMuzzleFlash();
    if (this.audio) this.audio.playShoot(w.name === 'Shotgun' ? 'shotgun' : w.name === 'FN MAG' ? 'mag' : 'm16');
  }

  showMuzzleFlash() {
    this.muzzleFlash.visible = true;
    this.muzzleTimer = 0.03;
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    this.muzzleFlash.position.copy(this.camera.position).addScaledVector(dir, 1);
  }

  update(dt) {
    // Reload
    if (this.reloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.ammo[this.currentWeapon] = this.weapon.magSize;
        this.reloading = false;
      }
    }

    // Fire cooldown
    this.fireCooldown -= dt;

    // Burst fire for FN MAG
    if (this.burstRemaining > 0) {
      this.burstTimer -= dt;
      if (this.burstTimer <= 0) {
        this.fire();
        this.burstRemaining--;
        this.burstTimer = this.weapon.burstDelay || 0.07;
      }
    } else if (this.firing && this.fireCooldown <= 0 && !this.reloading) {
      if (this.weapon.burstCount) {
        this.burstRemaining = this.weapon.burstCount - 1;
        this.burstTimer = this.weapon.burstDelay || 0.07;
        this.fire();
      } else {
        this.fire();
      }
    }

    // Muzzle flash
    if (this.muzzleTimer > 0) {
      this.muzzleTimer -= dt;
      if (this.muzzleTimer <= 0) this.muzzleFlash.visible = false;
    }

    // Update projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      this.projectiles[i].update(dt);
      if (!this.projectiles[i].alive) {
        this.scene.remove(this.projectiles[i].mesh);
        this.projectiles.splice(i, 1);
      }
    }

    // Position weapon model
    const model = this.weaponModels[this.currentWeapon];
    if (model.visible) {
      const dir = new THREE.Vector3();
      this.camera.getWorldDirection(dir);
      const right = new THREE.Vector3().crossVectors(dir, this.camera.up).normalize();
      const down = new THREE.Vector3(0, -1, 0);
      model.position.copy(this.camera.position)
        .addScaledVector(dir, 0.5)
        .addScaledVector(right, 0.2)
        .addScaledVector(down, 0.2);
      model.lookAt(this.camera.position.clone().addScaledVector(dir, 10));
    }
  }

  checkCollisions(activeDrones) {
    const hits = [];
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      if (!p.alive) continue;
      for (const drone of activeDrones) {
        // Swept collision: closest point on segment [prevPos, curPos] to drone center
        const a = p.prevPos;
        const b = p.mesh.position;
        const c = drone.mesh.position;
        const ab = new THREE.Vector3().subVectors(b, a);
        const ac = new THREE.Vector3().subVectors(c, a);
        const abLenSq = ab.lengthSq();
        let t = abLenSq > 0 ? ac.dot(ab) / abLenSq : 0;
        t = Math.max(0, Math.min(1, t));
        const closest = a.clone().addScaledVector(ab, t);
        const dist = closest.distanceTo(c);
        if (dist < drone.hitRadius) {
          p.alive = false;
          this.scene.remove(p.mesh);
          this.projectiles.splice(i, 1);
          hits.push({ drone, projectile: p });
          break;
        }
      }
    }
    return hits;
  }

  reset() {
    this.projectiles.forEach(p => this.scene.remove(p.mesh));
    this.projectiles = [];
    this.ammo = WEAPONS.map(w => w.magSize);
    this.currentWeapon = 0;
    this.reloading = false;
    this.firing = false;
    this.burstRemaining = 0;
    this.showCurrentModel();
  }

  refill() {
    this.ammo = WEAPONS.map(w => w.magSize);
    this.reloading = false;
    this.reloadTimer = 0;
  }

  getInfo() {
    return {
      name: this.weapon.name,
      ammo: this.ammo[this.currentWeapon],
      maxAmmo: this.weapon.magSize,
      reloading: this.reloading
    };
  }
}
