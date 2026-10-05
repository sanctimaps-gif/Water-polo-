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
{ const m = setup(); m.cfg.autoSwitch = false; m.cfg.exclusionRate = 0; const me = m.slot(0, 2); m.setHuman(me, false); me.pos = { x: -9, y: 0, z: 4 };
  const c = m.slot(1, 2); c.pos = { x: -5, y: 0, z: 0 }; m.give(c, false); m.drain();
  c.stats.defense = 1; c.stats.physical = 99; c.stats.technique = 99;   // the carrier keeps the ball
  const d0 = Math.hypot(me.pos.x - c.pos.x, me.pos.z - c.pos.z);
  for (let i = 0; i < 200; i++) { c.nextDecision = 1e9; m.setHumanCommand({ move: { x: 0, y: 0, z: 0 }, defendHeld: true }); m.step(); if (m.ball.owner !== c) break; }
  const d1 = Math.hypot(me.pos.x - c.pos.x, me.pos.z - c.pos.z), og = m.ownGoal(0);
  const goalSide = Math.hypot(me.pos.x - og.x, me.pos.z - og.z) < Math.hypot(c.pos.x - og.x, c.pos.z - og.z) + 0.3;
  ok(d1 < 1.6 && d1 < d0 && goalSide, `DÉFENSE held = auto press (${d0.toFixed(1)} m -> ${d1.toFixed(1)} m, goal side ${goalSide})`); }
// EXCLUSION (20 s): the player goes to the re-entry corner, the opponents get 6 v 5, he comes back after 20 s
{ const m = setup(); const d = m.slot(1, 3), a = m.slot(0, 5); a.pos = { x: 9, y: 0, z: 0 }; m.give(a, false); m.drain();
  m.exclude(d, a); const ev = m.drain().map((e) => e.type);
  ok(ev.includes('Exclusion') && d.excluded > 0 && m.shortHanded(1) && Math.abs(d.pos.x - m.ownGoal(1).x) < 1 && Math.abs(d.pos.z) > 8, 'exclusion: player to the re-entry corner, team short-handed');
  ok(m.chooseTarget(m.slot(1, 2), null, 'STANDARD', 1, 0) !== d, 'excluded player is never a pass target');
  for (let i = 0; i < 50 * 21 && d.excluded > 0; i++) { m.step(); if (m.ball.owner && m.ball.owner.team === 1) break; }
  ok(d.excluded <= 0, 're-entry after 20 s or when his team regains the ball'); }
{ const m = setup(); const d = m.slot(1, 3), a = m.slot(0, 5); m.give(a, false); m.exclude(d, a); m.drain(); m.onGoal(0);
  ok(d.excluded <= 0 && m.stats.teams[0].ppGoals === 1, 'a power-play goal ends the exclusion and is counted'); }
// PASSE EN PROFONDEUR: team-mate swimming free toward goal -> ball laid on the water ahead of him, he swims onto it.
{ const m = setup(); m.cfg.autoSwitch = false; const me = m.human; me.pos = { x: -2, y: 0, z: 0 }; const r = m.slot(0, me.slot === 3 ? 1 : 3); r.pos = { x: 2, y: 0, z: 3 }; r.vel = { x: 2.2, y: 0, z: 0 };
  m.give(me, false); m.drain(); m.setHumanCommand({ move: { x: 0, y: 0, z: 0 }, pass: true, passDir: { x: 0.8, y: 0, z: 0.6 } });
  let kind = null, got = null;
  for (let i = 0; i < 200 && !got; i++) { m.step(); for (const e of m.drain()) if (e.type === 'PassMade') kind = e.kind; if (m.ball.owner) got = m.ball.owner; }
  ok(kind === 'depth' && got === r && r.pos.x > 3, `pass in depth: kind ${kind}, caught by the runner ahead (x ${r.pos.x.toFixed(1)})`); }
// LOBE: holding PASSE gives a high pass
{ const m = setup(); const me = m.human; me.pos = { x: 0, y: 0, z: 0 }; const t = m.slot(0, 3); t.pos = { x: 5, y: 0, z: 2 }; t.vel = { x: 0, y: 0, z: 0 }; m.give(me, false); m.drain();
  m.setHumanCommand({ move: { x: 0, y: 0, z: 0 }, pass: true, lob: true }); let kind = null, top = 0;
  for (let i = 0; i < 60; i++) { m.step(); for (const e of m.drain()) if (e.type === 'PassMade') kind = e.kind; top = Math.max(top, m.ball.pos.y); }
  ok(kind === 'lob' && top > 2, `lob: kind ${kind}, apex ${top.toFixed(1)} m`); }
// RULE: free throw inside 5 m = no direct shot (must pass first); outside 5 m the shot is allowed.
{ const m = setup(); const me = m.human; me.pos = { x: 9, y: 0, z: 0 }; m.restart = { team: 0, pos: { x: 9, y: 0, z: 0 }, taker: me }; m.executeRestart(); run(m, 20);
  m.setHumanCommand({ move: { x: 0, y: 0, z: 0 }, quickShot: true }); const ev = run(m, 3);
  ok(!ev.includes('ShotTaken') && ev.includes('NoDirectShot5m') && m.ball.owner === me, 'free throw inside 5 m: no direct shot');
  const mate = m.slot(0, me.slot === 3 ? 1 : 3); mate.pos = { x: 8, y: 0, z: 3 };
  m.setHumanCommand({ move: { x: 0, y: 0, z: 0 }, pass: true, passDir: { x: -0.3, y: 0, z: 1 } }); run(m, 60);
  ok(m.freeThrow === null, 'after a pass the free throw restriction is lifted'); }
{ const m = setup(); const me = m.human; me.pos = { x: 4, y: 0, z: 0 }; m.restart = { team: 0, pos: { x: 4, y: 0, z: 0 }, taker: me }; m.executeRestart(); run(m, 20);
  m.setHumanCommand({ move: { x: 0, y: 0, z: 0 }, quickShot: true }); ok(run(m, 3).includes('ShotTaken'), 'free throw outside 5 m: direct shot allowed'); }
// RULE: 2 m offside — an attacker without the ball inside the 2 m line, ball outside it -> turnover.
{ const m = setup(); const c = m.slot(0, 1), mate = m.slot(0, 4); c.pos = { x: 5, y: 0, z: 0 }; m.give(c, false); m.drain(); c.nextDecision = 1e9;
  mate.pos = { x: 11.5, y: 0, z: 1 }; mate.human = false; let ev = [];
  for (let i = 0; i < 40 && !ev.includes('Offside2m'); i++) { mate.pos = { x: 11.5, y: 0, z: 1 }; m.step(); ev = ev.concat(m.drain().map((e) => e.type)); }
  ok(ev.includes('Offside2m'), '2 m offside whistled'); }
// PASSER LE JOUEUR: burst around the marker; a beaten marker is stunned
{ let beat = 0, fails = 0; for (let sd = 1; sd <= 30; sd++) { const m = new Match({ seed: sd, humanTeam: 0 }, HOME(), AWAY()); m.start(); for (let i = 0; i < 10; i++) m.step();
    for (const p of m.players) p.pos = { x: p.team === 0 ? -11 : 11, y: 0, z: -9 + p.id };
    m.cfg.autoSwitch = false; const me = m.human, d = m.slot(1, 2); me.pos = { x: 0, y: 0, z: 0 }; d.pos = { x: 1, y: 0, z: 0 }; m.give(me, false); m.drain();
    m.setHumanCommand({ move: { x: 1, y: 0, z: 0 }, dodge: true }); const ev = run(m, 2); if (ev.includes('Dodge')) beat++; if (ev.includes('DodgeFail')) fails++; }
  ok(beat > 3 && fails > 3, `PASSER LE JOUEUR: ${beat}/30 beaten, ${fails} failed`); }
console.log(fail ? `${fail} FAILED` : 'ALL PASSED'); process.exit(fail ? 1 : 0);
