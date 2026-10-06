// Run: node tools/web-tests/challenges.mjs — DÉFIS (penalty, free throw, power play, tutorial) on the real engine.
import { Match, HOME, AWAY, DRILLS } from '../../web/sim.js';
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const mk = (kind, seed = 1) => { const m = new Match({ seed, humanTeam: 0 }, HOME(), AWAY()); m.startDrill(kind); return m; };
const play = (m, brain, max = 50 * 400) => { const ev = []; for (let i = 0; i < max && m.phase !== 'ENDED'; i++) { if (brain) brain(m, i); m.step(); ev.push(...m.drain()); } return ev; };
const towards = (m, t) => { const p = m.human.pos, dx = t.x - p.x, dz = t.z - p.z, l = Math.hypot(dx, dz) || 1; return { x: dx / l, y: 0, z: dz / l }; };
const shootCorner = (m, i, z = 1.1) => { const me = m.human; if (m.ball.owner === me && m.phase === 'LIVE' && m.drill.pause <= 0)
  m.setHumanCommand({ move: { x: 0, y: 0, z: 0 }, shootReleased: true, hasAim: true, aimX: (i % 2 ? 1 : -1) * 0.8, aimY: 0.3 }); };

// No input: every attempt runs out of time, the challenge ends, only the involved players are in the water.
{ const m = mk('penalty'); const active = m.players.filter((p) => !p.benched);
  ok(active.length === 2 && active.includes(m.human) && active.includes(m.teams[1].gk), 'penalty: shooter + goalkeeper only (others benched)');
  ok(Math.abs(Math.abs(m.human.pos.x - m.targetGoal(0).x) - 5) < 0.01 && m.ball.owner === m.human, 'penalty: ball at the 5 m line');
  const ev = play(m); ok(m.phase === 'ENDED' && m.drill.results.length === 5 && m.drill.made === 0 && ev.some((e) => e.type === 'MatchEnd'), 'penalty: 5 attempts, timeout = missed, challenge ends'); }
// Shooting at the corners: a real duel with the goalkeeper (neither always in nor always saved).
{ let goals = 0, n = 0; for (let s = 1; s <= 20; s++) { const m = mk('penalty', s); play(m, shootCorner); goals += m.drill.made; n += m.drill.total; }
  ok(goals > n * 0.2 && goals < n * 0.95, `penalty: ${goals}/${n} goals against the AI goalkeeper`); }
// Free throw outside 5 m: direct shot allowed, one defender between the ball and the goal.
{ const m = mk('freethrow'); const def = m.players.filter((p) => !p.benched && p.team === 1 && !p.isGK);
  ok(def.length === 1 && m.freeThrow && !m.freeThrow.inside5, 'free throw: outside 5 m, one defender in front');
  let goals = 0, shots = 0; for (let s = 1; s <= 20; s++) { const q = mk('freethrow', s); const ev = play(q, shootCorner); goals += q.drill.made; shots += ev.filter((e) => e.type === 'ShotTaken').length;
    if (ev.some((e) => e.type === 'NoDirectShot5m')) ok(false, 'free throw: direct shot refused'); }
  ok(shots >= 90 && goals < shots, `free throw: direct shots taken (${shots}), ${goals} goals`); }
// Power play: 6 v 5 for 20 s.
{ const m = mk('powerplay'); const n = (t) => m.teams[t].field.filter((p) => !p.excluded).length;
  ok(n(0) === 6 && n(1) === 5 && m.shotClockLeft === 20, 'power play: 6 v 5, 20 s');
  let made = 0; for (let s = 1; s <= 10; s++) { const q = mk('powerplay', s);
    play(q, (mm, i) => { const me = mm.human; if (mm.ball.owner !== me || mm.phase !== 'LIVE') return; if (me.possTime > 0.8 && Math.abs(me.pos.x - mm.targetGoal(0).x) < 6.5) shootCorner(mm, i); else if (me.possTime > 1.2) mm.setHumanCommand({ move: { x: 0, y: 0, z: 0 }, pass: true }); });
    made += q.drill.made; ok(q.phase === 'ENDED' && q.drill.results.length === 3, `power play ${s}: 3 attempts played`); }
  ok(made > 0, `power play: ${made}/30 converted`); }
// Tutorial: scripted player completes the 6 steps.
{ const m = mk('tutorial'); const steps = [];
  play(m, (mm, i) => { const d = mm.drill, me = mm.human; if (mm.phase !== 'LIVE') return; if (!steps.includes(d.step)) steps.push(d.step);
    if (d.step === 'swim') mm.setHumanCommand({ move: towards(mm, d.target) });
    else if (d.step === 'sprint') mm.setHumanCommand({ move: towards(mm, d.target), sprint: true });
    else if (d.step === 'pass') mm.setHumanCommand({ move: { x: 0, y: 0, z: 0 }, pass: mm.ball.owner === me });
    else if (d.step === 'shoot' || d.step === 'goal') shootCorner(mm, i);
    else if (d.step === 'steal') { const c = mm.ball.owner; mm.setHumanCommand({ move: c && c !== me ? towards(mm, c.pos) : { x: 0, y: 0, z: 0 }, defend: i % 10 === 0 }); } }, 50 * 900);
  ok(m.phase === 'ENDED' && m.drill.made >= DRILLS.tutorial.steps.length && steps.join() === DRILLS.tutorial.steps.join(), `tutorial: steps ${steps.join(' → ')} completed`); }
// Save: stars and first-time rewards only once.
{ const { GameState } = await import('../../web/state.js'); const st = new GameState(); const c0 = st.data.currencies.coins, g0 = st.data.currencies.gems;
  const r1 = st.recordChallenge('penalty', 4, 5); ok(r1.stars === 3 && r1.newStars === 3 && st.data.currencies.coins === c0 + 180 && st.data.currencies.gems === g0 + 5, 'penalty 4/5 = 3 stars, 180 coins + 5 gems');
  const r2 = st.recordChallenge('penalty', 5, 5); ok(r2.newStars === 0 && r2.reward.coins === 0 && !r2.reward.gems && st.challengeState('penalty').best === 5, 'replaying: best kept, no second reward'); }
console.log(fail ? `${fail} FAILED` : 'ALL PASSED'); process.exit(fail ? 1 : 0);
