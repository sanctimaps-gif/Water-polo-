// Run: node tools/web-tests/deflect.mjs — one-touch deflection: a quick tap on SHOOT while a team-mate's pass comes
// to the user's player near the goal redirects the ball to goal without control (SHOT event with deflect).
import { Match, HOME, AWAY, Ev } from '../../web/sim.js';
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const run = (tap, near, seed) => {
  const m = new Match({ seed, humanTeam: 0 }, HOME(), AWAY()); m.start(); for (let i = 0; i < 50 * 3; i++) m.step(); m.drain();
  const t = m.teams[0], goal = m.targetGoal(0), s = m.sign(0), cen = t.field.find((q) => q.slot === 5), pt = t.field.find((q) => q.slot === 2);
  cen.pos = { x: goal.x - s * (near ? 2.5 : 10), y: 0, z: 1.2 }; pt.pos = { x: goal.x - s * (near ? 8 : 15), y: 0, z: -1 };
  for (const o of m.teams[1].field) o.pos = { x: goal.x - s * 12, y: 0, z: o.slot * 2 - 5 };   // no defender on the way
  m.give(pt, true); m.passTo(pt, cen, { x: 0, y: 0, z: 0 }, false); m.setHuman(cen, false);
  let deflect = null, caught = false;
  for (let i = 0; i < 50 * 2 && !deflect && !caught; i++) {
    if (tap && i === 12) m.setHumanCommand({ shootReleased: true, quickShot: true });
    m.step(); for (const e of m.drain()) { if (e.type === Ev.SHOT && e.deflect) deflect = e; }
    if (m.ball.owner === cen) caught = true;
  }
  return { deflect, caught, m };
};
let hits = 0;
for (let k = 0; k < 6; k++) { const r = run(true, true, 10 + k); if (r.deflect) hits++; }
ok(hits >= 5, `tap on SHOOT as the pass arrives at 2.5 m: deflected to goal without control (${hits}/6)`);
{ const r = run(false, true, 3); ok(r.caught && !r.deflect, 'no tap: the centre catches the ball'); }
{ const r = run(true, false, 3); ok(!r.deflect, 'far from the goal (10 m): no deflection'); }
console.log(fail ? `${fail} FAILED` : 'ALL PASSED'); process.exit(fail ? 1 : 0);
