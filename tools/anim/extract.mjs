// Samples a Mixamo FBX clip: root-local positions of the main joints per frame (30 fps). Usage: node extract.mjs clip.fbx out.json
import fs from 'fs';
globalThis.self = globalThis; globalThis.window = globalThis;
globalThis.document = { createElementNS: () => ({ style: {} }), createElement: () => ({ style: {}, getContext: () => null }) };
const THREE = await import('three');
const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
const buf = fs.readFileSync(process.argv[2]);
const obj = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
const clip = obj.animations.find((c) => c.duration > 0);
const mixer = new THREE.AnimationMixer(obj); mixer.clipAction(clip).play();
const B = {}; obj.traverse((o) => { if (o.isBone && !B[o.name.replace('mixamorig', '')]) B[o.name.replace('mixamorig', '')] = o; });
const names = ['Hips', 'Spine', 'Spine2', 'Neck', 'Head', 'HeadTop_End', 'LeftArm', 'LeftForeArm', 'LeftHand', 'LeftHandMiddle1', 'RightArm', 'RightForeArm', 'RightHand', 'RightHandMiddle1',
  'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase'];
const frames = [], n = Math.round(clip.duration * 30), v = new THREE.Vector3();
obj.updateMatrixWorld(true);
const inv = new THREE.Matrix4().copy(obj.matrixWorld).invert();
for (let i = 0; i <= n; i++) {
  mixer.setTime(i / 30); obj.updateMatrixWorld(true);
  const f = {}; for (const k of names) { B[k].getWorldPosition(v); v.applyMatrix4(inv); f[k] = [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)]; }
  // head forward axis (world) for the yaw
  frames.push(f);
}
fs.writeFileSync(process.argv[3], JSON.stringify({ fps: 30, duration: clip.duration, frames }));
console.log('frames', frames.length, 'hips0', frames[0].Hips, 'head0', frames[0].Head, 'lfoot', frames[0].LeftFoot, 'lhand', frames[0].LeftHand);
