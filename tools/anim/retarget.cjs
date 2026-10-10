// Mixamo clip -> game rig. 1) node tools/anim/extract.mjs clip.fbx pos.json   (needs `npm i three@0.160.0` for the FBXLoader)
// 2) python3 -m http.server 8765 (repo root)   3) node tools/anim/retarget.cjs pos.json web/assets/anim/<name>.json <name> "<source>"
// The fit runs in a browser page on the real (MakeHuman) rig: for every frame, the joint angles that best match the
// directions of the pelvis, thorax, head, upper arms / forearms and thighs / shins of the capture, within the joint limits.
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
(async () => {
  const [src, dst, name, source] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage(); p.on('pageerror', (e) => console.log('PE', e.message));
  await p.goto('http://localhost:8765/README.md');
  const fn = fs.readFileSync(path.join(__dirname, 'fit_page.js'), 'utf8').replace(/^\/\/.*\n/, '');
  const r = await p.evaluate(`(${fn})(${fs.readFileSync(src, 'utf8')})`);
  await b.close();
  let F = r.frames;
  const keys = Object.keys(F[0]).filter((k) => !['twist', 'neck', 'knRy', 'knLy'].includes(k) && F.some((f) => Math.abs(f[k]) > 1e-4));
  const gap = Math.max(...keys.map((k) => Math.abs(F[0][k] - F[F.length - 1][k]))); if (gap < 0.05) F = F.slice(0, -1);   // last frame = first (loop)
  fs.writeFileSync(dst, JSON.stringify({ name, source, fps: 30, keys, frames: F.map((f) => keys.map((k) => +f[k].toFixed(3))) }));
  console.log(`${F.length} frames, max fit error (torso, arms, legs)`, r.errs.reduce((m, e) => e.map((x, i) => Math.max(x, m[i])), [0, 0, 0]));
})();
