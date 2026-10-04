import fs from 'fs';
const d = fs.readFileSync('./tools/assets/src/lps.glb'); const L = d.readUInt32LE(12); const J = JSON.parse(d.slice(20, 20 + L).toString()); const B = d.slice(20 + L + 8);
export function acc(i) { const a = J.accessors[i], bv = J.bufferViews[a.bufferView], off = (bv.byteOffset || 0) + (a.byteOffset || 0), n = { SCALAR: 1, VEC2: 2, VEC3: 3 }[a.type];
  const buf = B.buffer.slice(B.byteOffset + off, B.byteOffset + off + a.count * n * (a.componentType === 5126 ? 4 : 2));
  return a.componentType === 5126 ? new Float32Array(buf) : new Uint16Array(buf); }
