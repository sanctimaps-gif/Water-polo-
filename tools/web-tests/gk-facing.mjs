// Run: node tools/web-tests/gk-facing.mjs — the goalkeepers face the play (back to their goal) during live play.
import { Match, HOME, AWAY } from '../../web/sim.js';
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
for (const seed of [7, 21]) {
  const m = new Match({ seed, humanTeam: 0 }, HOME(), AWAY()); m.start();
  let n = 0, sum = 0, back = 0;
  for (let i = 0; i < 50 * 180; i++) { m.step(); m.drain(); for (const t of [0, 1]) { const g = m.teams[t].gk; if (m.ball.owner === g || m.phase !== 'LIVE') continue; const d = g.facing.x * m.sign(t); sum += d; n++; if (d < 0) back++; } }
  ok(sum / n > 0.8 && back === 0, `seed ${seed}: goalkeepers face the field (mean ${(sum / n).toFixed(2)}, ${back} frames turned toward their own goal)`);
}
console.log(fail ? `${fail} FAILED` : 'ALL PASSED'); process.exit(fail ? 1 : 0);
