import fs from 'fs';
export function parseObj(path) {
  const V = [], VT = [], groups = {}; let g = 'none';
  for (const line of fs.readFileSync(path, 'utf8').split('\n')) {
    if (line.startsWith('v ')) { const [, x, y, z] = line.trim().split(/\s+/); V.push([+x, +y, +z]); }
    else if (line.startsWith('vt ')) { const [, u, v] = line.trim().split(/\s+/); VT.push([+u, +v]); }
    else if (line.startsWith('g ')) { g = line.slice(2).trim(); groups[g] ??= []; }
    else if (line.startsWith('f ')) { groups[g].push(line.trim().split(/\s+/).slice(1).map((t) => { const [a, b] = t.split('/'); return [+a - 1, b ? +b - 1 : -1]; })); }
  }
  return { V, VT, groups };
}
export function applyTarget(V, path, w) {
  if (!w) return;
  for (const line of fs.readFileSync(path, 'utf8').split('\n')) {
    if (!line || line[0] === '#') continue; const [i, x, y, z] = line.trim().split(/\s+/).map(Number);
    if (Number.isFinite(i) && V[i]) { V[i][0] += x * w; V[i][1] += y * w; V[i][2] += z * w; }
  }
}
export function joints(o, V) {
  const J = {};
  for (const [g, faces] of Object.entries(o.groups)) if (g.startsWith('joint-')) {
    const set = new Set(); for (const f of faces) for (const [vi] of f) set.add(vi);
    const c = [0, 0, 0]; for (const vi of set) for (let k = 0; k < 3; k++) c[k] += V[vi][k] / set.size; J[g.slice(6)] = c;
  }
  return J;
}
