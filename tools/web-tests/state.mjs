// Run: node tools/web-tests/state.mjs — game state rules: every displayed value must be real.
import { GameState, EVENTS, SHOP_ITEMS, overall } from '../../web/state.js';
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
ok(def.players[6].stats.physical === Math.min(99, p0.stats.physical + st.slotBonus(p0, 5)), 'match stats include the position bonus');
const m = new Match({ seed: 1, humanTeam: 0 }, def, st.opponentTeamDef('sharks')); m.start(); for (let i = 0; i < 200; i++) m.step();
ok(m.teams[0].def.name === st.data.club.name, 'match uses the club and its lineup');

// upgrade costs coins and raises the rating
const pl = st.player(st.lineup.slots[0]), before = overall(pl), coins = st.data.currencies.coins;
ok(st.upgrade(pl.id) && overall(pl) > before - 0 && st.data.currencies.coins === coins - 150, 'player upgrade spends 150 coins and raises stats');

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
