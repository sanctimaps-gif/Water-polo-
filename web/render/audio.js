// Synthesised match audio (WebAudio, no downloads): whistle, splashes, ball impacts, net,
// crowd bed and roars. Started on the first user gesture (browser autoplay rules).
export class MatchAudio {
  constructor() { this.ctx = null; this.enabled = true; }

  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = this.enabled ? 0.8 : 0; this.master.connect(this.ctx.destination);
    // White noise buffer shared by every noisy sound.
    const len = this.ctx.sampleRate * 2, buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    // Crowd bed: looped band-passed noise; its gain follows the excitement.
    const src = this.ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 650; bp.Q.value = 0.6;
    this.crowdGain = this.ctx.createGain(); this.crowdGain.gain.value = 0.05;
    src.connect(bp).connect(this.crowdGain).connect(this.master); src.start();
  }

  setEnabled(on) { this.enabled = on; if (this.master) this.master.gain.value = on ? 0.8 : 0; }

  noiseBurst({ dur = 0.3, freq = 1200, q = 0.8, type = 'bandpass', gain = 0.4, attack = 0.005 }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, src = this.ctx.createBufferSource(); src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.master); src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }

  tone(freq, dur, gain = 0.2, type = 'sine', slide = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  }

  whistle(long = false) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), lfo = this.ctx.createOscillator(), lg = this.ctx.createGain(), g = this.ctx.createGain();
    o.type = 'square'; o.frequency.value = 2900; lfo.frequency.value = 38; lg.gain.value = 140;
    lfo.connect(lg).connect(o.frequency);
    const dur = long ? 0.9 : 0.35;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.06, t + 0.02); g.gain.setValueAtTime(0.06, t + dur - 0.05); g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g).connect(this.master); o.start(t); lfo.start(t); o.stop(t + dur); lfo.stop(t + dur);
  }

  splash(power = 1) { this.noiseBurst({ dur: 0.25 + power * 0.15, freq: 900 + Math.random() * 500, q: 0.5, gain: Math.min(0.5, 0.12 + power * 0.12) }); }
  ballHit(power = 1) { this.tone(140, 0.12, Math.min(0.45, 0.15 + power * 0.1), 'sine', 0.5); this.noiseBurst({ dur: 0.06, freq: 2500, gain: 0.12 }); }
  netHit() { this.noiseBurst({ dur: 0.45, freq: 500, q: 0.4, gain: 0.25, type: 'lowpass' }); }
  post() { this.tone(820, 0.6, 0.18, 'triangle'); this.tone(1240, 0.4, 0.08, 'sine'); }
  roar(amount = 1) {
    this.noiseBurst({ dur: 1.6 + amount, freq: 700, q: 0.4, gain: 0.25 * amount, attack: 0.15 });
    this.noiseBurst({ dur: 1.2 + amount, freq: 1600, q: 0.6, gain: 0.12 * amount, attack: 0.1 });
  }
  setCrowd(level) { if (this.crowdGain) this.crowdGain.gain.setTargetAtTime(0.04 + level * 0.12, this.ctx.currentTime, 0.4); }
}
