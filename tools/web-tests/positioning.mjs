// Run: node tools/web-tests/positioning.mjs — analyses AI positioning over AI-vs-AI matches.
// Metrics (sampled every 0.5 s of live play):
//  clump       share of field players with a team-mate closer than 1.8 m (lower = better spacing)
//  nearBall    average number of players within 3 m of the ball (crowding)
//  slotErr     settled attack: average distance (m) between each attacker and his position spot
//  goalSide    defence: share of defenders between their mark and their own goal
//  centerIn2m  settled attack: share of time the centre-forward is within 3 m of the opponent goal
//  behindBall  defence: share of defenders behind the ball (on their goal side of it)
import { Match, HOME, AWAY } from '../../web/sim.js';
const args = process.argv.slice(2), N = +(args[0] || 6);
const acc = { clump: [], nearBall: [], slotErr: [], goalSide: [], centerIn2m: [], behindBall: [], goals: 0, shots: 0 };
const mean = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
for (let s = 1; s <= N; s++) {
  const m = new Match({ seed: s, humanTeam: -1, periodDuration: 120 }, HOME(), AWAY()); m.start();
  let k = 0;
  while (!m.finished) {
    m.step();
    if (++k % 25 || m.phase !== 'LIVE') continue;
    const field = m.players.filter((p) => !p.isGK), b = m.ball.pos;
    acc.clump.push(field.filter((p) => field.some((q) => q !== p && q.team === p.team && Math.hypot(q.pos.x - p.pos.x, q.pos.z - p.pos.z) < 1.8)).length / field.length);
    acc.nearBall.push(m.players.filter((p) => Math.hypot(p.pos.x - b.x, p.pos.z - b.z) < 3).length);
    const att = m.possessionTeam;
    if (att < 0 || !m.ball.owner) continue;
    const goalX = m.targetGoal(att).x, settled = Math.abs(b.x - goalX) < 9;
    if (settled) {
      const tp = m.teams[att].tp;
      for (const p of m.teams[att].field) if (p !== m.ball.owner) acc.slotErr.push(Math.hypot(p.pos.x - m.attackSpot(att, p.slot, tp).x, p.pos.z - m.attackSpot(att, p.slot, tp).z));
      const cf = m.teams[att].field.find((p) => p.slot === 5); acc.centerIn2m.push(Math.abs(cf.pos.x - goalX) < 3 ? 1 : 0);
    }
    const def = 1 - att, own = m.ownGoal(def);
    for (const d of m.teams[def].field) {
      const mark = m.teams[att].field.find((p) => p.slot === d.slot);
      acc.goalSide.push(Math.hypot(d.pos.x - own.x, d.pos.z - own.z) < Math.hypot(mark.pos.x - own.x, mark.pos.z - own.z) ? 1 : 0);
      acc.behindBall.push((d.pos.x - b.x) * (own.x > 0 ? 1 : -1) > -0.5 ? 1 : 0);
    }
  }
  for (const t of m.stats.teams) { acc.goals += t.goals; acc.shots += t.shots; }
}
const out = { clump: mean(acc.clump), nearBall: mean(acc.nearBall), slotErr: mean(acc.slotErr), goalSide: mean(acc.goalSide), centerIn2m: mean(acc.centerIn2m), behindBall: mean(acc.behindBall), goalsPerMatch: acc.goals / N, conversion: acc.goals / Math.max(1, acc.shots) };
for (const [k, v] of Object.entries(out)) console.log(k.padEnd(14), v.toFixed(3));
// Regression limits (CI): spacing, goal-side defence, centre-forward at 2 m, matches still produce goals.
const limits = [['clump', '<', 0.5], ['slotErr', '<', 2.8], ['goalSide', '>', 0.65], ['centerIn2m', '>', 0.25], ['goalsPerMatch', '>', 2.5]];
let fail = 0;
for (const [k, op, v] of limits) { const okk = op === '<' ? out[k] < v : out[k] > v; if (!okk) { console.log(`FAIL ${k} ${out[k].toFixed(3)} ${op} ${v}`); fail++; } }
console.log(fail ? `${fail} FAILED` : 'ALL PASSED'); process.exitCode = fail ? 1 : 0;
export default out;
