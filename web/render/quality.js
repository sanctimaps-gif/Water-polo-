// Adaptive graphics quality for the web build: LOW / MEDIUM / HIGH / ULTRA + AUTO detection
// and a frame-time governor (AUTO only) that steps the tier down when the device cannot keep up.

export const TIERS = ['LOW', 'MEDIUM', 'HIGH', 'ULTRA'];

export const PRESETS = {
  LOW: {
    pixelRatio: 1, shadows: false, shadowMap: 512, water: 0, waterSeg: [70, 52], particles: 300, crowd: 260,
    shafts: false, faceDetail: false, limbSeg: 6, netLines: 7, envMapSize: 64, targetFps: 30,
  },
  MEDIUM: {
    pixelRatio: 1.25, shadows: true, shadowMap: 1024, water: 1, waterSeg: [120, 90], particles: 700, crowd: 700,
    shafts: false, faceDetail: true, limbSeg: 8, netLines: 11, envMapSize: 128, targetFps: 60,
  },
  HIGH: {
    pixelRatio: 1.6, shadows: true, shadowMap: 2048, water: 2, waterSeg: [170, 128], particles: 1400, crowd: 1300,
    shafts: true, faceDetail: true, limbSeg: 10, netLines: 15, envMapSize: 256, targetFps: 60,
  },
  ULTRA: {
    pixelRatio: 2, shadows: true, shadowMap: 2048, water: 3, waterSeg: [230, 170], particles: 2400, crowd: 2200,
    shafts: true, faceDetail: true, limbSeg: 12, netLines: 19, envMapSize: 256, targetFps: 60,
  },
};

/** Reads the GPU name (when the browser exposes it) and device hints, returns a tier. */
export function detectTier() {
  let gpu = '';
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
    gpu = (ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl ? gl.getParameter(gl.RENDERER) : '') || '';
  } catch { /* no WebGL info */ }
  const g = gpu.toLowerCase();
  const mem = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  const mobile = matchMedia('(pointer: coarse)').matches;

  let tier;
  if (g.includes('swiftshader') || g.includes('llvmpipe') || g.includes('software')) tier = 'LOW';
  else if (g.includes('apple')) tier = mobile ? 'HIGH' : 'ULTRA';                       // iPhone / iPad / Apple silicon
  else if (/adreno.*(7\d\d|8\d\d)/.test(g) || /mali-g7[1-9]|mali-g[89]\d|immortalis|xclipse/.test(g)) tier = 'HIGH';
  else if (/adreno.*6\d\d/.test(g) || /mali-g[5-7]\d/.test(g)) tier = 'MEDIUM';
  else if (/adreno|mali|powervr|videocore/.test(g)) tier = 'LOW';
  else if (/nvidia|geforce|radeon|rtx|gtx|iris xe|arc/.test(g)) tier = 'ULTRA';
  else tier = mobile ? 'MEDIUM' : 'HIGH';

  if (mem <= 2 || cores <= 2) tier = 'LOW';
  else if ((mem <= 3 || cores <= 4) && TIERS.indexOf(tier) > 1) tier = 'MEDIUM';
  return { tier, gpu: gpu || 'unknown' };
}

/** Steps the tier down after ~4 s below 80 % of the target frame rate (AUTO mode only). */
export class FpsGovernor {
  constructor() { this.avg = 60; this.low = 0; this.cooldown = 3; }
  sample(dt, targetFps) {
    if (dt <= 0) return false;
    this.avg += (1 / dt - this.avg) * 0.05;
    if (this.cooldown > 0) { this.cooldown -= dt; return false; }
    this.low = this.avg < targetFps * 0.8 ? this.low + dt : 0;
    if (this.low > 4) { this.low = 0; this.cooldown = 6; return true; }
    return false;
  }
}
