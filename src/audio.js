export class AudioManager {
  constructor() {
    this.ctx = null;
  }

  getCtx() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    return this.ctx;
  }

  playHit() {
    const ctx = this.getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  }

  playExplosion() {
    const ctx = this.getCtx();
    const bufferSize = ctx.sampleRate * 0.3;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start();
  }

  playShoot(type) {
    const ctx = this.getCtx();
    const now = ctx.currentTime;

    // Transient crack/bang
    const bangBuf = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
    const bangData = bangBuf.getChannelData(0);
    for (let i = 0; i < bangData.length; i++) {
      bangData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.01));
    }
    const bang = ctx.createBufferSource();
    bang.buffer = bangBuf;
    const bangGain = ctx.createGain();
    const bangFilter = ctx.createBiquadFilter();
    bangFilter.type = 'highpass';

    if (type === 'shotgun') {
      bangGain.gain.setValueAtTime(0.8, now);
      bangGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      bangFilter.frequency.value = 300;
    } else if (type === 'mag') {
      bangGain.gain.setValueAtTime(0.5, now);
      bangGain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
      bangFilter.frequency.value = 600;
    } else {
      // M16 — sharp crack
      bangGain.gain.setValueAtTime(0.6, now);
      bangGain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);
      bangFilter.frequency.value = 800;
    }

    bang.connect(bangFilter);
    bangFilter.connect(bangGain);
    bangGain.connect(ctx.destination);
    bang.start(now);

    // Low thump body
    const thump = ctx.createOscillator();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(type === 'shotgun' ? 60 : 80, now);
    thump.frequency.exponentialRampToValueAtTime(20, now + 0.1);
    const thumpGain = ctx.createGain();
    thumpGain.gain.setValueAtTime(type === 'shotgun' ? 0.6 : 0.3, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    thump.connect(thumpGain);
    thumpGain.connect(ctx.destination);
    thump.start(now);
    thump.stop(now + 0.1);
  }
}
