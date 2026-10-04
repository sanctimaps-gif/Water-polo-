// Run: node tools/web-tests/state.mjs — game state rules: every displayed value must be real.
import { GameState, EVENTS, SHOP_ITEMS, overall, matchStats, maxLevel, tradeValue } from '../../web/state.js';
import { Match } from '../../web/sim.js';
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const st = new GameState();

// TOTAL is computed from the 7 starters + position bonus
const t = st.teamTotal();
const items = [[st.lineup.gk, -1], ...st.lineup.slots.map((id, i) => [id, i])];
const manual = Math.round(items.reduce((a, [id, s]) => a + overall(st.player(id)) + st.slotBonus(st.player(id), s), 0) / 7);
ok(t.total === manual, `TOTAL ${t.total} equals the recomputed value ${manual}`);
// moving a field player in goal lowers the TOTAL; best lineup restores it
const gk = st.lineup.gk, field = st.lineup.slots[2];
st.swap(gk, field);
ok(st.teamTotal().total < t.total, `field player in goal lowers TOTAL (${st.teamTotal().total} < ${t.total})`);
st.autoLineup();
ok(st.teamTotal().total >= t.total, `MEILLEUR TOTAL restores the best lineup (${st.teamTotal().total})`);
// position bonus reaches the match engine
const def = st.userTeamDef(), p0 = st.player(st.lineup.slots[5]);
ok(def.players[6].stats.physical === Math.min(99, matchStats(p0).physical + st.slotBonus(p0, 5)), 'match stats include skills, form and the position bonus');
const m = new Match({ seed: 1, humanTeam: 0 }, def, st.opponentTeamDef('sharks')); m.start(); for (let i = 0; i < 200; i++) m.step();
ok(m.teams[0].def.name === st.data.club.name, 'match uses the club and its lineup');

// PROGRESSION — training costs training points and raises the rating, up to the cap of the quality tier
const pl = st.player(st.lineup.slots[0]), before = overall(pl), tp0 = st.data.currencies.tp, cost = st.upgradeCost(pl);
ok(st.upgrade(pl.id) && overall(pl) > before && st.data.currencies.tp === tp0 - cost, `training spends ${cost} TP and raises the rating (${before} -> ${overall(pl)})`);
st.data.currencies.tp = 1e6; st.upgradeMax(pl.id);
ok(pl.level === maxLevel(pl) && !st.upgrade(pl.id), `training stops at the quality cap (level ${pl.level})`);
const q0 = pl.quality, ovq = overall(pl), tok = st.data.currencies.tokens[q0];
ok(st.upgradeQuality(pl.id) && pl.quality === q0 + 1 && overall(pl) > ovq && st.data.currencies.tokens[q0] === tok - 1 && maxLevel(pl) > pl.level, 'quality upgrade uses a token, raises stats and the level cap');
// form: low form really lowers the match stats; a medical kit restores it
const fp = st.player(st.lineup.slots[1]); fp.form = 10; const low = matchStats(fp).shooting; const mk = st.data.currencies.medkits;
ok(st.heal(fp.id) && fp.form === 60 && matchStats(fp).shooting >= low && st.data.currencies.medkits === mk - 1, 'medical kit: +50 form, stats back up');
// PHYSIQUE MAXIMAL: +4 speed for one match
const sp0 = matchStats(fp).speed; ok(st.energize(fp.id) && matchStats(fp).speed > sp0 && !st.energize(fp.id), 'energy drink: physique boost for the next match, not stackable');
// trade: bench players -> training points; starters cannot be traded
const benchP = st.bench()[0], val = tradeValue(benchP), tpb = st.data.currencies.tp, n0 = st.squad.length;
ok(!st.canTrade(st.lineup.gk), 'starters cannot be traded');
ok(st.trade([benchP.id]) === val && st.squad.length === n0 - 1 && st.data.currencies.tp === tpb + val, `trade a bench player for ${val} TP`);
// career stats + form after a match: starters get the match stats and tire, the bench recovers
{ const st = new GameState(); const sId = st.lineup.slots[2], s = st.player(sId), b = st.bench()[0], g0 = s.career.goals, m0 = s.career.matches, f0 = s.form, bf = (b.form = 50);
  const zero = { goals: 0, passes: 0, passesOk: 0, steals: 0, interceptions: 0, saves: 0, shots: 0 };
  st.applyResult({ mode: 'quick', opponent: 'sharks' }, { hs: 2, as: 1, stats: zero, players: { [sId]: { goals: 2, assists: 1, shots: 3, steals: 0, saves: 0, passes: 4 } } });
  ok(s.career.goals === g0 + 2 && s.career.matches === m0 + 1 && s.form === Math.max(0, f0 - 12) && b.form === bf + 15, 'career stats and form updated after a match'); }
// recruit (coins) adds a player
st.data.currencies.coins += 5000; const nr = st.squad.length, rec = st.recruit();
ok(rec && st.squad.length === nr + 1 && rec.form === 100 && rec.skills.length === 2, 'scouting adds a new player with skills');

// league season: 7 rounds, table consistent
for (let r = 0; r < 7; r++) {
  const nm = st.nextLeagueMatch(); ok(!!nm, `league round ${r + 1} has a fixture vs ${nm && nm.opponent}`);
  const out = st.applyResult({ mode: 'league', opponent: nm.opponent }, { hs: 5, as: 3, stats: { passesOk: 20, steals: 2, interceptions: 1, saves: 4, shots: 10 } });
  if (r < 6) { const rows = st.standings(); ok(rows.reduce((a, x) => a + x.p, 0) === 8 * (r + 1), 'every club played the round'); ok(rows.reduce((a, x) => a + x.gf, 0) === rows.reduce((a, x) => a + x.ga, 0), 'goals for = goals against'); }
  if (r === 6) ok(out.league.finished, `season finished, user ${out.league.champion ? 'champion' : 'pos ' + out.league.position}`);
}
ok(st.data.league.season === 2 && st.data.league.round === 0, 'new season starts');
ok(st.data.profile.matches === 7 && st.data.profile.wins === 7, 'profile counts matches and wins');

// objectives progress from match stats and pay out once
const ob = st.data.objectives.list.find((o) => o.progress >= o.n && !o.claimed);
if (ob) { const c0 = st.data.currencies.coins; ok(!!st.claimObjective(ob.id) && st.data.currencies.coins === c0 + (ob.reward.coins || 0), `objective ${ob.id} claimed`); ok(st.claimObjective(ob.id) === null, 'cannot claim twice'); }

// daily gift once per day
const g = st.claimGift(); ok(!!g && !st.giftAvailable() && st.claimGift() === null, 'daily gift once per day');

// shop: cannot buy without funds, buying equips
st.data.currencies.gems = 0; const gold = SHOP_ITEMS.find((i) => i.id === 'cap_gold');
ok(!st.buy(gold) && !st.owns('cap_gold'), 'cannot buy gem item without gems');
st.data.currencies.coins = 700; const black = SHOP_ITEMS.find((i) => i.id === 'cap_black');
ok(st.buy(black) && st.owns('cap_black') && st.data.currencies.coins === 100 && st.equippedColor('cap') === black.color, 'buy cap: coins spent, owned, equipped');

// events: progress on wins, claim reward, real timer
const ev = EVENTS[0]; let es = st.eventState(ev);
ok(es.remaining > 0 && es.remaining <= 7 * 86400000, 'event timer is real (≤ 7 days)');
for (let i = 0; i < ev.matches; i++) st.applyResult({ mode: 'event', eventId: ev.id, opponent: 'x' }, { hs: 4, as: 2, stats: { passesOk: 0, steals: 0, interceptions: 0, saves: 0, shots: 0 } });
es = st.eventState(ev); ok(es.status === 'CLAIMABLE', 'event completed -> claimable');
const c1 = st.data.currencies.coins; st.claimEvent(ev); ok(st.data.currencies.coins === c1 + ev.reward.coins && st.eventState(ev).status === 'COMPLETED', 'event reward granted once');
ok(st.eventState(EVENTS[3]).status === 'LOCKED' || st.data.profile.trophies.length > 0, 'gala locked without trophy');
console.log(fail ? `${fail} FAILED` : 'ALL PASSED'); process.exit(fail ? 1 : 0);
