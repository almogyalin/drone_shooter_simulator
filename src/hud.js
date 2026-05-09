import * as THREE from 'three';

export class HUD {
  constructor(game, weapons, drones, waves) {
    this.game = game;
    this.weapons = weapons;
    this.drones = drones;
    this.waves = waves;
    this.weaponEl = document.getElementById('weapon-info');
    this.waveEl = document.getElementById('wave-info');
    this.scoreEl = document.getElementById('score-info');
    this.messageEl = document.getElementById('message');
    this.hitMarkerEl = document.getElementById('hit-marker');
    this.radarCanvas = document.getElementById('radar');
    this.radarCtx = this.radarCanvas.getContext('2d');
    this.radarCanvas.width = 120;
    this.radarCanvas.height = 120;
    this.hitMarkerTimer = 0;
    this.waveAnnounceTimer = 0;
    this.waveMessage = '';
  }

  update(dt) {
    if (this.game.state === 'playing') {
      const info = this.weapons.getInfo();
      this.weaponEl.innerHTML = `<b>[${this.weapons.currentWeapon + 1}] ${info.name}</b><br>${info.reloading ? 'RELOADING...' : `${info.ammo} / ${info.maxAmmo}`}<br><span style="color:#0b0">[1] M16  [2] Shotgun  [3] FN MAG  [R] Reload<br>Hold Right Click: Scope</span>`;
      this.waveEl.innerHTML = this.waveAnnounceTimer > 0 ? `<b>Wave ${this.game.wave}</b><br><span style="font-size:12px;white-space:pre-line">${this.waveMessage}</span>` : `Wave ${this.game.wave} — ${this.drones.count} drones remaining`;
      this.scoreEl.textContent = `Score: ${this.game.score}`;

      if (this.waveAnnounceTimer > 0) this.waveAnnounceTimer -= dt;
      this.drawRadar();
    }

    if (this.hitMarkerTimer > 0) {
      this.hitMarkerTimer -= dt;
      this.hitMarkerEl.style.opacity = this.hitMarkerTimer > 0 ? '1' : '0';
    }
  }

  drawRadar() {
    const ctx = this.radarCtx;
    const cx = 60, cy = 60, r = 55;
    ctx.clearRect(0, 0, 120, 120);
    ctx.strokeStyle = 'rgba(0,255,0,0.3)';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, r / 2, 0, Math.PI * 2); ctx.stroke();

    const cam = this.game.camera;
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    const camAngle = Math.atan2(dir.x, dir.z);

    const drones = this.drones.getActiveDrones();
    ctx.fillStyle = '#f00';
    drones.forEach(d => {
      const dx = d.mesh.position.x;
      const dz = d.mesh.position.z;
      const angle = Math.atan2(dx, dz) - camAngle;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const normDist = Math.min(dist / 250, 1) * r;
      const px = cx + Math.sin(angle) * normDist;
      const py = cy - Math.cos(angle) * normDist;
      ctx.beginPath(); ctx.arc(px, py, 2, 0, Math.PI * 2); ctx.fill();
    });

    ctx.fillStyle = '#0f0';
    ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill();
  }

  showHitMarker() {
    this.hitMarkerTimer = 0.2;
    this.hitMarkerEl.style.opacity = '1';
  }

  announceWave(message) {
    this.waveMessage = message;
    this.waveAnnounceTimer = 4;
  }

  showMenu() {
    this.messageEl.style.display = 'block';
    this.messageEl.innerHTML = `<h1>ANTI-DRONE</h1><p>Demonstrate the challenge of countering suicide drones<br>with conventional infantry weapons</p><br><p><b>Click to Start</b></p><br><p class="subtitle">Mouse: Aim | Left Click: Fire | Right Click: Scope | 1/2/3: Switch Weapon | R: Reload</p><p class="subtitle">Survive 15 waves of increasingly difficult drone attacks</p>`;
  }

  showGameOver() {
    this.messageEl.style.display = 'block';
    if (this.game.won) {
      this.messageEl.innerHTML = `<h1>IMPOSSIBLE VICTORY</h1><p>You survived all 15 waves!</p><p>Score: ${this.game.score}</p><br><p>In reality, no single soldier with small arms<br>can counter a drone swarm.</p><br><p><b>Click to Restart</b></p>`;
    } else {
      this.messageEl.innerHTML = `<h1>KILLED IN ACTION</h1><p>A drone reached your position.</p><p>Wave: ${this.game.wave} | Score: ${this.game.score}</p><br><p class="subtitle">${this.getDeathInsight()}</p><br><p><b>Click to Restart</b></p>`;
    }
  }

  getDeathInsight() {
    if (this.game.wave <= 3) return 'Even slow drones are lethal if you miss.';
    if (this.game.wave <= 5) return 'At 140 km/h, you had less than 5 seconds to react.';
    if (this.game.wave <= 8) return 'Evasive maneuvers make small arms nearly useless.';
    if (this.game.wave <= 11) return 'Coordinated attacks from multiple angles overwhelm a single defender.';
    return 'A drone swarm cannot be stopped by infantry weapons. This is the reality of modern warfare.';
  }

  hideMessage() {
    this.messageEl.style.display = 'none';
  }
}
