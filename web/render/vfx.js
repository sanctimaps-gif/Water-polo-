// Water VFX: pooled spray particles (one draw call), driven by gameplay events and swimmer strokes.
// Each burst also pushes an impact ripple into the water shader.
import * as THREE from '../vendor/three.module.min.js';

export class Splashes {
  constructor(scene, water, capacity) {
    this.water = water;
    this.cap = capacity;
    this.pos = new Float32Array(capacity * 3);
    this.vel = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);      // remaining life (s), <= 0 = free
    this.size = new Float32Array(capacity);
    this.alpha = new Float32Array(capacity);
    this.next = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo = g;
    const mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 600 } },
      vertexShader: `attribute float aSize; attribute float aAlpha; varying float vA; uniform float uScale;
        void main(){ vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = aSize * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying float vA; void main(){ vec2 c = gl_PointCoord - 0.5; float d = dot(c,c); if (d > 0.25) discard;
        float rim = smoothstep(0.25, 0.05, d); gl_FragColor = vec4(mix(vec3(0.75,0.9,1.0), vec3(1.0), rim), vA * rim); }`,
      transparent: true, depthWrite: false,
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 3;
    scene.add(this.points);
    this.material = mat;
  }

  setScale(viewportHeight) { this.material.uniforms.uScale.value = viewportHeight * 0.9; }

  emit(x, y, z, vx, vy, vz, life, size) {
    const i = this.next; this.next = (this.next + 1) % this.cap;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = life; this.size[i] = size; this.alpha[i] = 0.9;
  }

  /**
   * Generic burst. power 0.2 (drop) .. 3 (goal). dir: optional {x,z} to throw spray forward.
   */
  burst(x, z, power = 1, dir = null, y = 0.02) {
    const n = Math.min(80, Math.round(6 + power * 22));
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, sp = (0.6 + Math.random() * 1.8) * Math.sqrt(power);
      let vx = Math.cos(a) * sp * 0.8, vz = Math.sin(a) * sp * 0.8;
      if (dir) { vx += dir.x * sp * 0.8; vz += dir.z * sp * 0.8; }
      this.emit(x + Math.cos(a) * 0.1, y, z + Math.sin(a) * 0.1, vx, (1.4 + Math.random() * 2.6) * Math.sqrt(power), vz,
        0.5 + Math.random() * 0.6, 0.025 + Math.random() * 0.05 * Math.min(2, power));
    }
    this.water.ripple(x, z, Math.min(3, 0.4 + power));
  }

  /** Small arm-entry spray of a swimming stroke. */
  stroke(x, z, power) {
    for (let k = 0; k < 6; k++) {
      const a = Math.random() * Math.PI * 2;
      this.emit(x, 0.02, z, Math.cos(a) * 0.6, 1 + Math.random() * 1.4 * power, Math.sin(a) * 0.6, 0.35 + Math.random() * 0.25, 0.02 + Math.random() * 0.02);
    }
    this.water.ripple(x, z, 0.25 * power);
  }

  /** Drops falling from the ball / hands. */
  drip(x, y, z) { this.emit(x, y, z, (Math.random() - 0.5) * 0.3, 0, (Math.random() - 0.5) * 0.3, 0.6, 0.018); }

  update(dt) {
    const p = this.pos, v = this.vel;
    for (let i = 0; i < this.cap; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= dt;
      v[i * 3 + 1] -= 9.81 * dt;
      p[i * 3] += v[i * 3] * dt; p[i * 3 + 1] += v[i * 3 + 1] * dt; p[i * 3 + 2] += v[i * 3 + 2] * dt;
      if (p[i * 3 + 1] < 0) this.life[i] = 0;
      this.alpha[i] = Math.min(0.9, this.life[i] * 2.5);
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
  }
}
