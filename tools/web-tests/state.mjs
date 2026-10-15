// Run: node tools/web-tests/state.mjs — game state rules: every displayed value must be real.
import { GameState, clubById, EVENTS, SHOP_ITEMS, overall, matchStats, maxLevel, tradeValue, marketValue, packTier, PACK_TIERS, PACK_SLOTS, NATION_CUPS, INTERSEASON, countryOf } from '../../web/state.js';
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
const m = new Match({ seed: 1, humanTeam: 0 }, def, st.opponentTeamDef('recco')); m.start(); for (let i = 0; i < 200; i++) m.step();
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
  st.applyResult({ mode: 'quick', opponent: 'recco' }, { hs: 2, as: 1, stats: zero, players: { [sId]: { goals: 2, assists: 1, shots: 3, steals: 0, saves: 0, passes: 4 } } });
  ok(s.career.goals === g0 + 2 && s.career.matches === m0 + 1 && s.form === Math.max(0, f0 - 12) && b.form === bf + 15, 'career stats and form updated after a match'); }
// recruit (coins) adds a player
st.data.currencies.coins += 5000; const nr = st.squad.length, rec = st.recruit();
ok(rec && st.squad.length === nr + 1 && rec.form === 100 && rec.skills.length === 2, 'scouting adds a new player with skills');

// league season (championship of the club's country), table consistent
const R = st.data.league.rounds.length, NT = Object.keys(st.data.league.table).length, M0 = st.data.profile.matches, W0 = st.data.profile.wins;
for (let r = 0; r < R; r++) {
  const nm = st.nextLeagueMatch(); ok(!!nm, `league round ${r + 1} has a fixture vs ${nm && nm.opponent}`);
  const out = st.applyResult({ mode: 'league', opponent: nm.opponent }, { hs: 5, as: 3, stats: { passesOk: 20, steals: 2, interceptions: 1, saves: 4, shots: 10 } });
  if (r < R - 1) { const rows = st.standings(); ok(rows.reduce((a, x) => a + x.p, 0) === (NT - NT % 2) * (r + 1), 'every club played the round'); ok(rows.reduce((a, x) => a + x.gf, 0) === rows.reduce((a, x) => a + x.ga, 0), 'goals for = goals against'); }
  if (r === R - 1) ok(out.league.finished, `season finished, user ${out.league.champion ? 'champion' : 'pos ' + out.league.position}`);
}
// Final Four (title): the user (1st) plays the semi-final against the 4th, then the final
{ const pf = st.pendingFinal4(); ok(pf && pf.round === 'semi' && pf.opponent === st.data.seasonEnd.ranking[3] && !st.canChangeCountry(), 'season over: FINAL FOUR, semi-final 1st v 4th played by the user');
  const o1 = st.applyResult({ mode: 'final4', opponent: pf.opponent }, { hs: 6, as: 2, stats: { passesOk: 0, steals: 0, interceptions: 0, saves: 0, shots: 0 } }), pf2 = st.pendingFinal4();
  ok(o1.final4.won && pf2 && pf2.round === 'final', `semi-final won, final against ${pf2 && pf2.opponent}`);
  const o2 = st.applyResult({ mode: 'final4', opponent: pf2.opponent }, { hs: 7, as: 5, stats: { passesOk: 0, steals: 0, interceptions: 0, saves: 0, shots: 0 } });
  ok(o2.season && o2.season.userTitle && o2.season.final4.champion === 'user' && !st.pendingFinal4(), 'final won: title of the division'); }
ok(st.data.league.season === 2 && st.data.league.round === 0, 'new season starts');
ok(st.data.profile.matches === M0 + R + 2 && st.data.profile.wins === W0 + R + 2, 'profile counts matches and wins (Final Four included)');
// End of the championship: the club may move to another country's league (squad and trophies kept)
{ const sq = st.squad.length, tr = st.data.profile.trophies.length; ok(st.canChangeCountry() && !st.changeCountry('XXX'), 'season over: change of championship allowed (valid countries only)');
  ok(st.changeCountry('ITA') && st.data.club.country === 'ITA' && st.data.league.country === 'ITA' && st.data.league.season === 2 && Object.keys(st.data.league.table).includes('user')
    && Object.keys(st.data.league.table).filter((id) => id !== 'user').every((id) => clubById(id).country === 'ITA') && st.squad.length === sq && st.data.profile.trophies.length === tr,
    'club moves to the Italian championship, squad and trophies kept');
  { const s3 = new GameState(); s3.data.league.season = 2; s3.nextLeagueMatch(); ok(s3.canChangeCountry(), 'a rest round for the other clubs keeps the window open'); }
  const nm = st.nextLeagueMatch(); st.applyResult({ mode: 'league', opponent: nm.opponent }, { hs: 1, as: 0, stats: { passesOk: 0, steals: 0, interceptions: 0, saves: 0, shots: 0 } });
  ok(!st.canChangeCountry() && !st.changeCountry('ESP'), 'no change once the season has started'); }

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
// REAL CLUBS: reference data kept apart from the game identity; the adapted name is what the game shows
{ const { CLUBS, TOURNAMENTS } = await import('../../web/state.js'); const db = (await import('../../web/data/clubs.js')).default;
  ok(db.clubs.length >= 40 && db.clubs.every((c) => c.source && c.source.length && c.lastUpdated && c.officialReferenceName && c.gameClubName && c.gameClubName !== c.officialReferenceName),
    `${db.clubs.length} real clubs: sources kept, every displayed name adapted`);
  ok(CLUBS.every((c) => c.name === db.clubs.find((d) => d.id === c.id).gameClubName), 'the game uses gameClubName');
  ok(new Set(CLUBS.map((c) => c.short)).size === CLUBS.length, 'short names unique');
  const st2 = new GameState(); const draft = st2.draftFrom('marseille'); draft.name = 'Marseille Aqua 26'; draft.short = 'MA26';
  st2.chooseClub(draft, { mode: 'version' });
  ok(st2.data.club.name === 'Marseille Aqua 26' && st2.data.club.baseClubId === 'marseille' && st2.data.club.customClubId && !Object.keys(st2.data.league.table).includes('marseille') && st2.data.league.country === 'FRA',
    'CRÉER MA VERSION: own name, baseClubId kept, replaces its base club in its national league');
  const cc = st2.customClub(); ok(cc.homeKit && cc.awayKit && cc.capDesign && cc.ballDesign && cc.baseClubId === 'marseille', 'custom club saved with kits, cap, ball');
  // WORLD: every country = 3 divisions × 9 clubs (+ the user's club as 10th team); real clubs first, others GAME_CREATED
  { const W = await import('../../web/world.js'); let okAll = true, names = true;
    for (const c of W.WORLD_COUNTRIES) { const d = W.countryClubs(c.code).divisions, ids = d.flat();
      if (d.length !== 3 || d.some((x) => x.length !== 9) || new Set(ids).size !== 27) okAll = false;
      const cl = ids.map(W.clubById); if (cl.some((x) => !x || [x.color, x.color2, x.kits.home.suit, x.kits.home.suit2, x.kits.away.cap, x.kits.home.number].some((v) => typeof v !== 'number') || x.rating < 40 || (x.gameCreated ? x.verified || x.ref : !x.ref.source.length))) okAll = false;
      if (new Set(cl.map((x) => x.name)).size !== 27 || new Set(cl.map((x) => x.short)).size !== 27 || cl.some((x) => !/^[A-Z]{3,4}$/.test(x.short))) names = false; }
    ok(okAll && W.WORLD_COUNTRIES.length > 190, `${W.WORLD_COUNTRIES.length} countries × 3 divisions × 9 clubs; game-created clubs flagged (not verified, no source)`);
    ok(names, 'club names and 3-letter abbreviations unique in each country');
    const ita = W.countryClubs('ITA').divisions[0].map(W.clubById); ok(ita[0].id === 'recco' && !ita[0].gameCreated, 'real clubs first, strongest in Division 1'); }
  const R0 = { passesOk: 0, steals: 0, interceptions: 0, saves: 0, shots: 0 };
  const playSeason = (s, score) => { let n = 0; const s0 = s.data.league.season; while (s.data.league.season === s0 && n++ < 44) { const pf = s.pendingFinal4(); if (pf) { s.applyResult({ mode: 'final4', opponent: pf.opponent }, { ...score(pf), stats: R0 }); continue; } const nm = s.nextLeagueMatch(); if (!nm) break; s.applyResult({ mode: 'league', opponent: nm.opponent }, { ...score(nm), stats: R0 }); } };
  const check = (s, code) => { const d = s.data.world[code].divisions, ids = d.flat(); return d.length === 3 && d.every((x) => x.length === 9) && new Set(ids).size === 27 && !ids.includes('user'); };
  const atDivision = (s, d) => { s.data.career.division = d; s.data.league = s.makeLeague(s.data.league.season, s.data.career.country, d); };
  // Club career: ALWAYS starts in Division 3, even with the strongest club; only 3 players of its squad are kept
  { const s = new GameState(); s.chooseClub(s.draftFrom('recco'), { mode: 'with' }); const lg = s.data.league, stars = s.squad.filter((p) => p.star);
    ok(lg.division === 3 && Object.keys(lg.table).length === 10 && !lg.table.recco && lg.rounds.length === 18, 'JOUER AVEC Pro Reca: career starts in Division 3 (10 teams, 18 rounds home and away)');
    const others = s.squad.filter((p) => !p.star), avg = others.reduce((a, p) => a + overall(p), 0) / others.length;
    ok(stars.length === 3 && stars.every((p) => overall(p) > avg + 5) && s.squad.every((p) => p.contract >= 2), `3 players of the club kept (${stars.map((p) => overall(p)).join(', ')}), the others fictional at the Division 3 level (avg ${avg.toFixed(0)}), contracts 2-3 seasons`); }
  // Finishing 1st every season: Division 3 → 2 → 1, then champion
  { const s = new GameState(); const d = s.draftFrom(null); d.country = 'FRA'; s.chooseClub(d, { mode: 'version' }); const path = [s.data.career.division]; let sizes = true;
    for (let k = 0; k < 3; k++) { playSeason(s, () => ({ hs: 9, as: 1 })); path.push(s.data.career.division); sizes = sizes && check(s, 'FRA') && s.data.seasonEnd.stage === 'done'; }
    ok(path.join() === '3,2,1,1', `1st = promoted: division ${path.join(' → ')}`); ok(sizes, 'every season: 3 divisions × 9 clubs kept, no duplicates, the user is not in the AI lists');
    const sum = s.data.seasonEnd.summary; ok(sum.userChampion && s.data.profile.trophies.some((t) => t.name === 'league') && s.data.continental && s.data.continental.competition === 'euro-champions' && s.data.continental.seed === 1,
      'Division 1 1st = national champion + best continental place (France: Euro Champions)');
    ok(s.data.careerHistory.length === 3 && s.data.league.season === 4 && s.data.league.rounds.length === 18, 'history kept, new season + calendar generated');
    const cl = s.tournamentDef('euro-champions'); ok(s.tournamentStatus(cl) === 'AVAILABLE' && s.tournamentStatus(s.tournamentDef('euro-challenge')) === 'LOCKED', 'qualification opens the continental competition (others locked)'); }
  // Forced final tables: top 4 go up (no playoff), the 4 lowest AI clubs of the division above go down
  const forceTable = (s, pos) => { const lg = s.data.league, ids = Object.keys(lg.table).filter((x) => x !== 'user'); ids.splice(pos - 1, 0, 'user');
    ids.forEach((id, i) => { lg.table[id] = { p: 18, w: 18 - i * 2, d: 0, l: i * 2, gf: 200 - i * 10, ga: 100, pts: (18 - i * 2) * 3 }; }); lg.round = lg.rounds.length; return ids; };
  const endSeason = (s, win) => { let sum = s.startSeasonEnd({ f: () => 0.3 }), pf; while (!sum && (pf = s.pendingFinal4())) sum = s.applyResult({ mode: 'final4', opponent: pf.opponent }, { hs: win ? 8 : 2, as: win ? 3 : 6, stats: R0 }).season; return sum; };
  { const s = new GameState(); const d = s.draftFrom(null); d.country = 'ESP'; s.chooseClub(d, { mode: 'version' }); const ids = forceTable(s, 4);
    const sum = endSeason(s, false);
    ok(sum.final4.semis[0].b === 'user' && sum.final4.champion !== 'user' && !sum.userTitle, 'user 4th: Final Four semi-final against the 1st, lost: no title');
    ok(sum && s.data.career.division === 2 && sum.promoted.join() === ids.slice(0, 4).join() && check(s, 'ESP'), 'user 4th of Division 3: promoted with the first 3');
    ok(ids.slice(0, 3).every((id) => s.data.world.ESP.divisions[1].includes(id)) && sum.relegated.length === 0, 'the 3 AI clubs moved up with the user'); }
  { const s = new GameState(); const d = s.draftFrom(null); d.country = 'ESP'; s.chooseClub(d, { mode: 'version' }); const ids = forceTable(s, 5);
    const sum = s.startSeasonEnd({ f: () => 0.3 });
    ok(s.data.career.division === 3 && sum.promoted.join() === ids.slice(0, 4).join() && check(s, 'ESP'), 'user 5th: stays in Division 3; the first 4 go up'); }
  { const s = new GameState(); const d = s.draftFrom(null); d.country = 'GRE'; s.chooseClub(d, { mode: 'version' }); atDivision(s, 2); forceTable(s, 10);
    const sum = s.startSeasonEnd({ f: () => 0.3 });
    ok(s.data.career.division === 2 && sum.relegated.length === 4 && !sum.relegated.includes('user') && sum.relegated.every((id) => s.data.world.GRE.divisions[2].includes(id)) && check(s, 'GRE'),
      'user last: never relegated; the 4 lowest AI clubs go down to make room for the 4 promoted'); }
  // Division 1: continental places in the order of the final ranking (Italy: 3 places)
  { const s = new GameState(); const d = s.draftFrom(null); d.country = 'ITA'; s.chooseClub(d, { mode: 'version' }); atDivision(s, 1); const ids = forceTable(s, 2);
    const sum1 = endSeason(s, true), pl = sum1.continental;
    ok(sum1.userTitle && sum1.userChampion && sum1.champion === 'user' && s.data.profile.trophies.some((t) => t.name === 'league'), '2nd of Division 1 + Final Four won = national champion');
    ok(pl.length === 3 && pl[0].id === ids[0] && pl[1].id === 'user' && pl[2].id === ids[2] && s.data.continental.seed === 2 && s.data.career.division === 1,
      `continental places: 1st → ${pl[0].competition}, 2nd → ${pl[1].competition}, 3rd → ${pl[2].competition}`);
    ok(check(s, 'ITA'), 'Division 1: 4 relegated for the 4 promoted from Division 2'); }
  // MERCATO: transfer list, signing with a contract, sale, extension, end-of-season departures
  { const s = new GameState(); s.chooseClub(s.draftFrom('marseille'), { mode: 'with' }); s.grant({ coins: 20000 });
    const list = s.market(), p0 = list[0], fee = s.signingFee(p0, 3), c0 = s.data.currencies.coins, n0 = s.squad.length;
    const np = s.buyPlayer(p0.id, 3);
    ok(list.length === 12 && np && np.contract === 3 && s.squad.length === n0 + 1 && s.data.currencies.coins === c0 - fee && !s.market().some((x) => x.id === p0.id), `transfer list of 12; signed for ${fee} coins, 3-season contract, removed from the list`);
    ok(s.signingFee(p0, 1) < s.signingFee(p0, 2) && s.signingFee(p0, 2) < s.signingFee(p0, 3), 'longer contract = higher signing fee');
    const bench = s.bench().find((p) => s.canSell(p.id)), v = Math.round(marketValue(bench) * 0.6), c1 = s.data.currencies.coins;
    ok(s.sellPlayer(bench.id) === v && s.data.currencies.coins === c1 + v && !s.player(bench.id), `sale: ${v} coins (60 % of the value), player gone`);
    ok(!s.canSell(s.lineup.slots[0]), 'starters cannot be sold');
    const r = s.squad[3], k0 = r.contract; ok(s.renew(r.id) && r.contract === k0 + 1, 'contract extended by one season');
    s.squad.forEach((p, i) => { p.contract = i < 4 ? 1 : 3; }); const n1 = s.squad.length, res = s.seasonContracts();
    ok(res.left.length === Math.min(4, n1 - 9) && s.squad.length === n1 - res.left.length && s.squad.length >= 9 && s.lineup.slots.every((id) => s.player(id)), `end of season: ${res.left.length} expired contracts leave, squad of 9 minimum kept, line-up rebuilt`); }
  // CHAMPIONNATS: a free Division 1 season with any club, outside the career
  { const s = new GameState(); s.chooseClub(s.draftFrom('marseille'), { mode: 'with' }); const career = JSON.stringify(s.data.league), sq = JSON.stringify(s.squad.map((p) => [p.id, p.form, p.career]));
    ok(s.startFree('ITA', 'recco') && s.freeClub().name && s.sideTeamDef({ mode: 'free' }).players.length === 7 && Object.keys(s.data.free.league.table).length === 9, 'free championship: Pro Reca in Lega A1 (9 teams), its own 7 players');
    let n = 0, out; while (s.freeNext() && n++ < 30) out = s.applyResult({ mode: 'free', opponent: s.freeNext().opponent }, { hs: 9, as: 1, stats: R0 });
    ok(out.free.finished && out.free.champion && s.data.free.done && s.data.profile.trophies.some((t) => t.name === 'free-ITA'), 'all matches won: champion, trophy of the championship');
    ok(JSON.stringify(s.data.league) === career && JSON.stringify(s.squad.slice(0, JSON.parse(sq).length).map((p) => [p.id, p.form, p.career])) === sq, 'the career league and the career players (form, stats) are not changed'); }
  // SÉLECTIONS: a national team chosen for each competition, draw that can be made again, career untouched
  { const s = new GameState(); s.chooseClub(s.draftFrom('marseille'), { mode: 'with' }); const career = JSON.stringify(s.data.league);
    let okAll = true; const codes = { 'nat-world': 'HUN', 'nat-four': 'ITA', 'nat-eur': 'SRB', 'nat-ame': 'USA', 'nat-asi': 'JPN', 'nat-afr': 'RSA', 'nat-oce': 'AUS' };
    for (const def of NATION_CUPS) { const code = codes[def.id]; const t0 = s.startNationCup(def, code);
      if (def.id === 'nat-world') { const g0 = JSON.stringify(t0.groups.map((g) => g.ids)); ok(s.canRedraw(def) && s.redraw(def) && s.tournamentState(def).nation === 'HUN', 'World Cup: Hungary chosen, new draw before the first match'); void g0; }
      let n = 0; while (n++ < 30) { const nm = s.natRun(() => s.nextTournamentMatch(def), code); if (!nm) break; if (nm.bye) { s.natRun(() => s.playTournamentRound(def, 0, 0), code); continue; } s.applyResult({ mode: 'tournament', tournamentId: def.id, nation: code, opponent: nm.opponent }, { hs: 9, as: 2, stats: R0 }); }
      const t = s.tournamentState(def); okAll = okAll && t.stage === 'done' && t.champion === 'user' && t.nation === code && s.tournamentTeams(def).slice(1).every((id) => id.startsWith('nat-') && id !== 'nat-' + code); }
    ok(okAll && s.data.profile.trophies.some((t) => t.name === 'nat-world'), `${NATION_CUPS.length} national team competitions won, each with its own nation`);
    ok(!s.canRedraw(NATION_CUPS[0]), 'no new draw once the competition has started');
    ok(JSON.stringify(s.data.league) === career, 'the career league is not changed by national team matches'); }
  { const s = new GameState(); ok(!s.hasCareer() && s.tournamentStatus(NATION_CUPS[0]) === 'AVAILABLE', 'World Cup playable without any club career'); }
  // Inter-season tournament: only between two seasons, against clubs of other continents
  { const s = new GameState(); s.chooseClub(s.draftFrom('marseille'), { mode: 'with' });
    ok(s.tournamentStatus(INTERSEASON) === 'LOCKED', 'inter-season tournament locked during the first season');
    s.data.league.season = 2; ok(s.tournamentStatus(INTERSEASON) === 'AVAILABLE', 'open between two seasons');
    const ids = s.tournamentTeams(INTERSEASON); ok(ids.length === 8 && ids.slice(1).every((id) => clubById(id).country && countryOf(clubById(id).country).continent !== 'EUR'), 'inter-season: 7 clubs of other continents'); }
  // tournaments: every format runs to a champion
  st2.data.profile.level = 20; let okAll = true;
  for (const def of TOURNAMENTS) { st2.startTournament(def); let n = 0; while (st2.nextTournamentMatch(def) && n < 30) { st2.playTournamentRound(def, 9, 2); n++; } const t = st2.tournamentState(def); okAll = okAll && t.stage === 'done' && t.champion === 'user'; }
  ok(okAll, `${TOURNAMENTS.length} tournaments (cups, regional, continental, international) played to the end`); }
// Rolling substitution during a match: the player in the water takes the substitute's identity and stats, fresh.
{ const st = new GameState(); const m = new Match({ seed: 4, humanTeam: 0 }, st.userTeamDef(), st.opponentTeamDef('recco')); m.start(); for (let i = 0; i < 300; i++) m.step();
  const mp = m.teams[0].players.find((p) => p.slot === 2), sub = st.bench().find((p) => p.role !== 'GOALKEEPER'); mp.stamina = 0.3;
  m.substitute(mp, st.playerDef(sub, 2)); for (let i = 0; i < 50; i++) m.step();
  ok(mp.pid === sub.id && mp.name.endsWith(sub.lastName) && mp.stamina > 0.9 && mp.stats.shooting === st.playerDef(sub, 2).stats.shooting, 'substitution: new player in the water, fresh, with his own stats'); }
// Reward packs: 4 levels from the result, every card is a real resource granted on opening.
{ ok(packTier('league', 1, 3) === 0 && packTier('league', 4, 4) === 1 && packTier('league', 5, 4) === 2 && packTier('league', 8, 5) === 3 && packTier('tournament', 6, 5) === 3 && packTier('quick', 9, 1) === 1,
    'pack level: loss bronze, draw silver, win gold, +3 goals elite, tournament win +1, quick max silver');
  const s = new GameState(), Z = { passesOk: 0, steals: 0, interceptions: 0, saves: 0, shots: 0 }; s.chooseClub(s.draftFrom('marseille'), { mode: 'with' });
  const nm = s.nextLeagueMatch(), out = s.applyResult({ mode: 'league', opponent: nm.opponent }, { hs: 3, as: 2, stats: Z });
  ok(out.pack && out.pack.tier === 2 && s.data.packs.slots.length === 1, 'every match gives a pack (win = gold), stored in a slot');
  const c0 = { ...s.data.currencies, tokens: [...s.data.currencies.tokens] }, r = s.openPack(out.pack.id), g = (k) => r.cards.filter((c) => c.kind === k).reduce((a, c) => a + c.n, 0);
  ok(s.data.currencies.coins === c0.coins + g('coins') && s.data.currencies.tp === c0.tp + g('tp') && s.data.currencies.gems === c0.gems + g('gems') && s.data.currencies.medkits === c0.medkits + g('medkits')
    && s.data.currencies.energy === c0.energy + g('energy') && s.data.currencies.tokens[0] === c0.tokens[0] + 1 && s.data.packs.slots.length === 0 && g('coins') >= PACK_TIERS[2].coins[0],
    `gold pack opened: ${r.cards.map((c) => c.kind + ' ' + c.n).join(', ')} — all granted, slot freed`);
  ok(s.openPack(out.pack.id) === null, 'a pack opens only once');
  const n0 = s.squad.length, e = s.addPack(3), re = s.openPack(e.id), pc = re.cards.find((c) => c.kind === 'player');
  ok(pc && s.squad.length === n0 + 1 && s.player(pc.id) && re.cards.length >= 6, 'ELITE pack: a new player joins the squad');
  // every pack has a player, stronger with the pack level; a full squad trades him for training points
  const avg = [0, 1, 2, 3].map((t) => { const x = new GameState(); x.chooseClub(x.draftFrom('marseille'), { mode: 'with' }); let sum = 0; for (let i = 0; i < 12; i++) { const pk = x.addPack(t), o = x.openPack(pk.id), c = o.cards.find((k) => k.kind === 'player');
    sum += overall(x.player(c.id)); x.data.squad = x.squad.filter((q) => q.id !== c.id); } return sum / 12; });
  ok(avg[0] < avg[1] && avg[1] < avg[2] && avg[2] < avg[3], `pack players: average rating ${avg.map((v) => v.toFixed(1)).join(' < ')} (bronze → elite)`);
  { const x = new GameState(); x.chooseClub(x.draftFrom('marseille'), { mode: 'with' }); while (x.squad.length < 18) x.squad.push({ ...x.squad[1], id: 'f' + x.squad.length });
    const tp0 = x.data.currencies.tp, o = x.openPack(x.addPack(1).id), cv = o.cards.find((k) => k.kind === 'converted');
    ok(cv && x.squad.length === 18 && x.data.currencies.tp === tp0 + o.cards.filter((k) => k.kind === 'tp').reduce((a, k) => a + k.n, 0) + cv.n, `full squad: pack player traded for ${cv && cv.n} training points`); }
  for (let i = 0; i < PACK_SLOTS + 1; i++) s.addPack(i % 4);
  ok(s.data.packs.slots.length === PACK_SLOTS && s.data.packs.fresh && s.findPack(s.data.packs.fresh.id), '4 slots: a 5th pack must be opened now'); }
// Career saves (LOADER): no team at the start, 4 slots, switching keeps each career; the global progress stays
{ const s = new GameState();
  ok(!s.hasCareer() && s.slotCards().every((c) => !c) && s.tournamentStatus(s.tournamentList()[0]) === 'LOCKED', 'no team at the start: 4 empty career slots, club competitions locked');
  ok(s.openSlot(1) === 'new' && !s.hasCareer(), 'empty slot 2 opened: new career (league, then club)');
  s.chooseClub(s.draftFrom('marseille'), { mode: 'with' }); ok(s.hasCareer() && s.data.slot === 1 && s.slotCards()[1].name === s.data.club.name, 'club chosen: career saved in slot 2');
  const sq1 = s.squad.map((p) => p.id).join(), coins = s.data.currencies.coins;
  ok(s.openSlot(3) === 'new' && !s.hasCareer() && s.slotCards()[1] && s.slotCards()[1].name, 'slot 4: new career, slot 2 kept');
  s.chooseClub(s.draftFrom('recco'), { mode: 'with' }); s.data.currencies.coins += 100;
  ok(s.openSlot(1) === 'loaded' && s.squad.map((p) => p.id).join() === sq1 && s.data.club.baseClubId === 'marseille' && s.data.currencies.coins === coins + 100, 'back to slot 2: its club and squad, currencies shared');
  s.deleteSlot(3); ok(!s.slotCards()[3] && s.slotCards()[1], 'slot deleted'); }
console.log(fail ? `${fail} FAILED` : 'ALL PASSED'); process.exit(fail ? 1 : 0);
