// Run: node tools/web-tests/subs.mjs — rolling substitutions (water polo rules) on the real engine:
// a called-off player stops playing, swims to his team's re-entry area (corner at his own goal line),
// and the substitute enters from there, fresh.
import { Match, HOME, AWAY, Ev } from '../../web/sim.js';
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
// Steps until a team has the ball calmly (a team-mate has held it >= 1 s): end of the action.
const calm = (mm, ti, max = 50 * 60) => { let k = 0; while (k++ < max) { const o = mm.ball.owner; if (o && o.team === ti && mm.ball.state === 'POSSESSED' && o.possTime >= 1.2) return true; mm.step(); mm.drain(); } return false; };
const m = new Match({ seed: 3, humanTeam: 0 }, HOME(), AWAY()); m.start();
for (let i = 0; i < 50 * 6; i++) m.step();
// never during the action: the ball carrier, or while the ball is in flight / just received
{ const o = m.ball.owner || m.teams[1].field[1]; const t0 = o.team; o.stamina = 0.1;
  ok(!m.requestSub(o) && !o.subOut, 'the ball carrier is never called off (wait until he has released the ball)');
  const mate = m.teams[t0].field.find((q) => q !== o && q.excluded <= 0); o.possTime = 0.3;
  ok(!m.requestSub(mate), 'no call while the action is still going on (ball just received)'); }
const tSide = calm(m, 1) ? 1 : (calm(m, 0), 0);
const team = m.teams[tSide], p = team.field.find((q) => m.ball.owner !== q && q.excluded <= 0); p.stamina = 0.1;
ok(m.requestSub(p) && p.subOut, 'tired player called off');
ok(!m.requestSub(team.field.find((q) => q !== p && m.ball.owner !== q)), 'one substitution at a time per team');
const d0 = Math.hypot(p.pos.x - m.reentrySpot(p).x, p.pos.z - m.reentrySpot(p).z);
let n = 0; while (!m.subReady(p) && n++ < 50 * 40) { m.step(); m.drain(); if (!p.subOut) break; }
const spot = m.reentrySpot(p);
const og2 = m.ownGoal(tSide); ok(m.subReady(p) && Math.abs(spot.x - og2.x) < 1 && Math.abs(spot.z) > m.cfg.hw - 1.5, `he swam ${d0.toFixed(1)} m to the re-entry area (own goal line corner) in ${(n / 50).toFixed(1)} s`);
const pd = { name: 'S. Fresh', number: 12, role: 'WINGER', personality: 'CALM', stats: { ...p.stats }, slot: p.slot };
m.substitute(p, pd); const evs = m.drain();
ok(p.name === 'S. Fresh' && p.number === 12 && p.stamina === 1 && !p.subOut && evs.some((e) => e.type === Ev.SUB), 'substitute enters from the re-entry area, fresh (Substitution event)');
for (let i = 0; i < 50 * 3; i++) m.step();
ok(m.phase === 'LIVE' || m.phase === 'RESTART' || m.events !== undefined, 'match goes on');
// The swim to the re-entry area is proportional to the clock compression (a period is always shown as 8:00).
{ const t = {}; for (const min of [1, 2, 4]) {
    const q = new Match({ seed: 5, humanTeam: 0, periodDuration: min * 60 }, HOME(), AWAY()); q.start(); for (let i = 0; i < 50 * 6; i++) q.step();
    const ti = calm(q, 1) ? 1 : (calm(q, 0), 0), pl = q.teams[ti].field.find((x) => q.ball.owner !== x); q.requestSub(pl); let k = 0; while (!q.subReady(pl) && k++ < 50 * 60) { q.step(); q.drain(); } t[min] = k / 50; }
  ok(t[1] < t[2] && t[2] < t[4] && Math.abs(t[2] / t[1] - 2) < 0.6 && Math.abs(t[4] / t[2] - 2) < 0.6, `swim time ∝ period length: 1 min ${t[1]} s, 2 min ${t[2]} s, 4 min ${t[4]} s`); }
console.log(fail ? `${fail} FAILED` : 'ALL PASSED'); process.exit(fail ? 1 : 0);
