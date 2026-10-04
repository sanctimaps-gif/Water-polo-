import fs from 'fs';
import { acc } from './glb.mjs';
const I = acc(0), P = acc(1), Nn = acc(2), U = acc(3);
// Scan units -> head bone space (metres): top 3.97, chin ~ -0.5, nose z 2.59.
const s = 0.0556, ox = 0.08, oy = 0.5, oz = 0.25;
const n = P.length / 3, map = new Int32Array(n).fill(-1);
const keepV = (i) => P[i * 3 + 1] > -1.25;   // head + top of the neck
// Hidden under the cap shell (top / back): drop triangles fully inside it.
const capHidden = (i) => { const x = (P[i*3] + ox) * s, y = (P[i*3+1] + oy) * s - 0.03, z = (P[i*3+2] - oz) * s;
  const dx = x / (0.95 * 0.117), dy = (y - 0.1) / (1.06 * 0.117), dz = (z + 0.006) / (1.05 * 0.117);
  const r = Math.hypot(dx, dy, dz); const front = z > 0.03 && y < 0.17; return r < 0.97 && !front && y > 0.06; };
const tris = [];
for (let t = 0; t < I.length; t += 3) {
  const a = I[t], b = I[t + 1], c = I[t + 2];
  if (!keepV(a) || !keepV(b) || !keepV(c)) continue;
  if (capHidden(a) && capHidden(b) && capHidden(c)) continue;
  tris.push(a, b, c);
}
const verts = []; for (const v of tris) if (map[v] < 0) { map[v] = verts.length; verts.push(v); }
const m = verts.length, pos = new Float32Array(m * 3), nor = new Float32Array(m * 3), uv = new Float32Array(m * 2), raw = new Float32Array(m * 3);
verts.forEach((v, k) => {
  pos[k*3] = (P[v*3] + ox) * s; pos[k*3+1] = (P[v*3+1] + oy) * s - 0.03; pos[k*3+2] = (P[v*3+2] - oz) * s;
  raw.set([P[v*3], P[v*3+1], P[v*3+2]], k * 3);
  nor.set([Nn[v*3], Nn[v*3+1], Nn[v*3+2]], k * 3); uv[k*2] = U[v*2]; uv[k*2+1] = U[v*2+1];
});
const idx = new Uint16Array(tris.map((v) => map[v]));
const hdr = Buffer.alloc(8); hdr.writeUInt32LE(m, 0); hdr.writeUInt32LE(idx.length, 4);
fs.writeFileSync('./web/assets/head/head.bin', Buffer.concat([hdr, Buffer.from(pos.buffer), Buffer.from(nor.buffer), Buffer.from(uv.buffer), Buffer.from(idx.buffer)]));
console.log('verts', n, '->', m, 'tris', I.length / 3, '->', idx.length / 3);
