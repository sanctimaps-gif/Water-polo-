// Run: node tools/web-tests/human-actions.mjs  — every touch action must reach the web simulation.
// Regression test for every human action of the web build.
import { Match, HOME, AWAY } from '../../web/sim.js';
let fail = 0; const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) fail++; };
const setup = () => { const m = new Match({ seed: 3, humanTeam: 0 }, HOME(), AWAY()); m.start(); for (let i = 0; i < 50; i++) m.step(); m.drain();
  for (const p of m.players) p.pos = { x: p.team === 0 ? -11 : 11, y: 0, z: -9 + p.id }; return m; };
const run = (m, n) => { for (let i = 0; i < n; i++) m.step(); return m.drain().map(e => e.type); };
{ const m = setup(); const me = m.human; me.pos = { x: 0, y: 0, z: 0 }; m.slot(0, 3).pos = { x: 5, y: 0, z: 2 }; m.give(me, false); m.drain();
  m.setHumanCommand({ move: { x: 0, y: 0, z: 0 }, pass: true }); ok(run(m, 60).includes('PassMade'), 'PASSE (tap) makes a pass'); }
{ const m = setup(); const me = m.human; me.pos = { x: 6, y: 0, z: 0 }; m.give(me, false); m.drain();
  m.setHumanCommand({ move: { x: 0, y: 0, z: 0 }, shootReleased: true }); ok(run(m, 3).includes('ShotTaken'), 'TIR (tap) = quick shot'); }
{ const m = setup(); const me = m.human; me.pos = { x: 6, y: 0, z: 0 }; m.give(me, false); m.drain();
  for (let i = 0; i < 30; i++) { m.setHumanCommand({ move: { x: 0, y: 0, z: 0 }, shootHeld: true }); m.step(); }
  ok(me.charging && me.charge > 0.5, 'TIR (hold) charges'); m.setHumanCommand({ move: { x: 0, y: 0, z: 0 }, shootReleased: true }); ok(run(m, 2).includes('ShotTaken'), 'TIR (release) shoots'); }
{ let steals = 0, fouls = 0; for (let s = 1; s <= 30; s++) { const m = new Match({ seed: s, humanTeam: 0 }, HOME(), AWAY()); m.start(); for (let i = 0; i < 10; i++) m.step();
    for (const p of m.players) p.pos = { x: p.team === 0 ? -11 : 11, y: 0, z: -9 + p.id };
    const me = m.human, c = m.slot(1, 2); c.pos = { x: 0, y: 0, z: 0 }; me.pos = { x: 0.8, y: 0, z: 0 }; m.give(c, false); m.drain();
    m.setHumanCommand({ move: { x: 0, y: 0, z: 0 }, defend: true }); const ev = run(m, 2); if (ev.includes('Steal')) steals++; if (ev.includes('Foul')) fouls++; }
  ok(steals > 0, `DÉFENSE steals the ball (${steals}/30 steals, ${fouls} fouls)`); }
{ const m = setup(); const me = m.human; me.pos = { x: 0, y: 0, z: 0 }; const z0 = me.pos.z;
  for (let i = 0; i < 100; i++) { m.setHumanCommand({ move: { x: 0, y: 0, z: 1 }, sprint: true }); m.step(); }
  ok(me.pos.z - z0 > 2, `joystick moves the player (${(me.pos.z - z0).toFixed(2)} m in 2 s)`); ok(me.stamina < 1, 'sprint uses stamina'); }
{ const m = setup(); const me = m.human; me.pos = { x: 6, y: 0, z: 0 }; m.give(me, false); m.drain();
  m.setHumanCommand({ move: { x: 0, y: 0, z: 0 }, quickShot: true }); ok(run(m, 2).includes('ShotTaken'), 'double tap = quick shot'); }
// Auto switch: opponent attacks far from me → control goes to my player nearest the ball (goal side).
{ const m = setup(); const me = m.slot(0, 2); m.setHuman(me, false); me.pos = { x: -11, y: 0, z: 9 };
  const c = m.slot(1, 2); c.pos = { x: -4, y: 0, z: 0 }; const d = m.slot(0, 3); d.pos = { x: -6, y: 0, z: 0.5 }; m.give(c, false); m.drain();
  m.lastSwitch = -9; run(m, 2); ok(m.human === d, 'auto switch → defender nearest the ball carrier');
  const h = m.human; run(m, 10); ok(m.human === h, 'no flicker right after a switch'); }
// Own pass in flight → control follows the ball to the receiver.
{ const m = setup(); const me = m.human; me.pos = { x: 0, y: 0, z: 0 }; const r = m.slot(0, 3); r.pos = { x: 5, y: 0, z: 2 }; m.give(me, false); m.drain();
  m.lastSwitch = -9; m.setHumanCommand({ move: { x: 0, y: 0, z: 0 }, pass: true }); let sw = false;
  for (let i = 0; i < 40 && !sw; i++) { m.step(); sw = m.human !== me; } ok(sw, 'auto switch → pass receiver'); }
{ const m = new Match({ seed: 3, humanTeam: 0, autoSwitch: false }, HOME(), AWAY()); m.start(); const h = m.human; for (let i = 0; i < 500; i++) m.step();
  ok(m.human === h || (m.ball.owner && m.ball.owner === m.human), 'autoSwitch off = manual only'); }
// DÉFENSE held, no joystick: the defender presses the ball carrier automatically (goal side, arm's length).
{ const m = setup(); m.cfg.autoSwitch = false; const me = m.slot(0, 2); m.setHuman(me, false); me.pos = { x: -9, y: 0, z: 4 };
  const c = m.slot(1, 2); c.pos = { x: -5, y: 0, z: 0 }; m.give(c, false); m.drain();
  c.stats.defense = 1; c.stats.physical = 99; c.stats.technique = 99;   // the carrier keeps the ball
  const d0 = Math.hypot(me.pos.x - c.pos.x, me.pos.z - c.pos.z);
  for (let i = 0; i < 200; i++) { c.nextDecision = 1e9; m.setHumanCommand({ move: { x: 0, y: 0, z: 0 }, defendHeld: true }); m.step(); if (m.ball.owner !== c) break; }
  const d1 = Math.hypot(me.pos.x - c.pos.x, me.pos.z - c.pos.z), og = m.ownGoal(0);
  const goalSide = Math.hypot(me.pos.x - og.x, me.pos.z - og.z) < Math.hypot(c.pos.x - og.x, c.pos.z - og.z) + 0.3;
  ok(d1 < 1.6 && d1 < d0 && goalSide, `DÉFENSE held = auto press (${d0.toFixed(1)} m -> ${d1.toFixed(1)} m, goal side ${goalSide})`); }
console.log(fail ? `${fail} FAILED` : 'ALL PASSED'); process.exit(fail ? 1 : 0);
