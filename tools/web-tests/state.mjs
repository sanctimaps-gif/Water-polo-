// Run: node tools/web-tests/state.mjs — game state rules: every displayed value must be real.
import { GameState, clubById, EVENTS, SHOP_ITEMS, overall, matchStats, maxLevel, tradeValue, packTier, PACK_TIERS, PACK_SLOTS } from '../../web/state.js';
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
ok(st.data.league.season === 2 && st.data.league.round === 0, 'new season starts');
ok(st.data.profile.matches === M0 + R && st.data.profile.wins === W0 + R, 'profile counts matches and wins');
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
  // WORLD: every country = 5 divisions × 9 clubs (+ the user's club as 10th team); real clubs first, others GAME_CREATED
  { const W = await import('../../web/world.js'); let okAll = true, names = true;
    for (const c of W.WORLD_COUNTRIES) { const d = W.countryClubs(c.code).divisions, ids = d.flat();
      if (d.length !== 5 || d.some((x) => x.length !== 9) || new Set(ids).size !== 45) okAll = false;
      const cl = ids.map(W.clubById); if (cl.some((x) => !x || [x.color, x.color2, x.kits.home.suit, x.kits.home.suit2, x.kits.away.cap, x.kits.home.number].some((v) => typeof v !== 'number') || x.rating < 40 || (x.gameCreated ? x.verified || x.ref : !x.ref.source.length))) okAll = false;
      if (new Set(cl.map((x) => x.name)).size !== 45 || new Set(cl.map((x) => x.short)).size !== 45 || cl.some((x) => !/^[A-Z]{3,4}$/.test(x.short))) names = false; }
    ok(okAll && W.WORLD_COUNTRIES.length > 190, `${W.WORLD_COUNTRIES.length} countries × 5 divisions × 9 clubs; game-created clubs flagged (not verified, no source)`);
    ok(names, 'club names and 3-letter abbreviations unique in each country');
    const ita = W.countryClubs('ITA').divisions[0].map(W.clubById); ok(ita[0].id === 'recco' && !ita[0].gameCreated, 'real clubs first, strongest in Division 1'); }
  const R0 = { passesOk: 0, steals: 0, interceptions: 0, saves: 0, shots: 0 };
  const playSeason = (s, score) => { let n = 0; const s0 = s.data.league.season; while (s.data.league.season === s0 && s.nextLeagueMatch() && n++ < 40) { const nm = s.nextLeagueMatch(); s.applyResult({ mode: 'league', opponent: nm.opponent }, { ...score(nm), stats: R0 }); } };
  const check = (s, code) => { const d = s.data.world[code].divisions, ids = d.flat(); return d.every((x) => x.length === 9) && new Set(ids).size === 45 && !ids.includes('user'); };
  { const s = new GameState(); s.chooseClub(s.draftFrom('recco'), { mode: 'with' }); const lg = s.data.league;
    ok(Object.keys(lg.table).length === 10 && !lg.table.recco && lg.rounds.length === 18 && lg.division === 1, 'JOUER AVEC Pro Reca: Division 1 with 9 other clubs (a game club takes its place), 18 rounds home and away'); }
  // Career from Division 5: finishing 1st every season = promoted every season, Division 1 after 4 seasons
  { const s = new GameState(); const d = s.draftFrom(null); d.country = 'FRA'; s.chooseClub(d, { mode: 'version', division: 5 }); const path = [s.data.career.division]; let sizes = true;
    for (let k = 0; k < 5; k++) { playSeason(s, () => ({ hs: 9, as: 1 })); path.push(s.data.career.division); sizes = sizes && check(s, 'FRA') && s.data.seasonEnd.stage === 'done'; }
    ok(path.join() === '5,4,3,2,1,1', `1st = promoted: division ${path.join(' → ')}`); ok(sizes, 'every season: 5 divisions × 9 clubs kept, no duplicates, the user is not in the AI lists');
    const sum = s.data.seasonEnd.summary; ok(sum.userChampion && s.data.profile.trophies.some((t) => t.name === 'league') && s.data.continental && s.data.continental.competition === 'euro-champions' && s.data.continental.seed === 1,
      'Division 1 1st = national champion + best continental place (France: Euro Champions)');
    ok(s.data.careerHistory.length === 5 && s.data.league.season === 6 && s.data.league.rounds.length === 18, 'history kept, new season + calendar generated');
    const cl = s.tournamentDef('euro-champions'); ok(s.tournamentStatus(cl) === 'AVAILABLE' && s.tournamentStatus(s.tournamentDef('euro-challenge')) === 'LOCKED', 'qualification opens the continental competition (others locked)'); }
  // Forced final table: user 2nd → plays the 2nd v 3rd playoff; winning = promoted; 1st promoted too; AI moves keep 9 per division
  const forceTable = (s, pos) => { const lg = s.data.league, ids = Object.keys(lg.table).filter((x) => x !== 'user'); ids.splice(pos - 1, 0, 'user');
    ids.forEach((id, i) => { lg.table[id] = { p: 18, w: 18 - i * 2, d: 0, l: i * 2, gf: 200 - i * 10, ga: 100, pts: (18 - i * 2) * 3 }; }); lg.round = lg.rounds.length; return ids; };
  { const s = new GameState(); const d = s.draftFrom(null); d.country = 'ESP'; s.chooseClub(d, { mode: 'version', division: 3 }); const ids = forceTable(s, 2);
    const pending = s.startSeasonEnd({ f: () => 0.3 }); const pp = s.pendingPlayoff();
    ok(pending && pp && pp.opponent === ids[2] && pp.kind === 'promotion' && !s.canChangeCountry(), 'user 2nd: playoff vs the 3rd is played by the user');
    const out = s.applyResult({ mode: 'playoff', opponent: pp.opponent }, { hs: 6, as: 4, stats: R0 });
    ok(out.season && s.data.career.division === 2 && out.season.promoted.includes(ids[0]) && out.season.promoted.includes('user') && check(s, 'ESP'), 'playoff won: promoted with the 1st (Division 3 → 2)');
    ok(s.data.world.ESP.divisions[1].includes(ids[0]) && !s.data.world.ESP.divisions[2].includes(ids[0]), 'the 1st moved up with the user'); }
  { const s = new GameState(); const d = s.draftFrom(null); d.country = 'ESP'; s.chooseClub(d, { mode: 'version', division: 3 }); const ids = forceTable(s, 3);
    s.startSeasonEnd({ f: () => 0.3 }); const pp = s.pendingPlayoff(); s.applyResult({ mode: 'playoff', opponent: pp.opponent }, { hs: 2, as: 5, stats: R0 });
    ok(s.data.career.division === 3 && s.data.seasonEnd.summary.promoted.join() === [ids[0], ids[1]].join() && check(s, 'ESP'), 'user 3rd, playoff lost: stays; the 1st and the 2nd go up'); }
  { const s = new GameState(); const d = s.draftFrom(null); d.country = 'GRE'; s.chooseClub(d, { mode: 'version', division: 2 }); forceTable(s, 10);
    const below = s.data.world.GRE.divisions[2].slice(); s.startSeasonEnd({ f: () => 0.3 });
    const sum = s.data.seasonEnd.summary;
    ok(s.data.career.division === 2 && sum.relegated.length === 2 && !sum.relegated.includes('user') && sum.relegated.every((id) => s.data.world.GRE.divisions[2].includes(id)) && check(s, 'GRE'),
      "user last: never relegated; the 2 lowest AI clubs go down to make room for the 2 promoted"); }
  // Division 1: 1st qualified; 2nd v 3rd = next continental place (Italy: 3 places)
  { const s = new GameState(); const d = s.draftFrom(null); d.country = 'ITA'; s.chooseClub(d, { mode: 'version', division: 1 }); const ids = forceTable(s, 2);
    s.startSeasonEnd({ f: () => 0.3 }); const pp = s.pendingPlayoff(); ok(pp && pp.kind === 'continental', 'Division 1: 2nd v 3rd = continental playoff');
    s.applyResult({ mode: 'playoff', opponent: pp.opponent }, { hs: 7, as: 6, stats: R0 }); const pl = s.data.seasonEnd.summary.continental;
    ok(pl.length === 3 && pl[0].id === ids[0] && pl[1].id === 'user' && pl[2].id === ids[2] && s.data.continental.seed === 2 && s.data.career.division === 1,
      `continental places: 1st → ${pl[0].competition}, playoff winner → ${pl[1].competition}, loser → ${pl[2].competition}`);
    ok(s.data.world.ITA.divisions[0].length === 9 && check(s, 'ITA'), 'Division 1: 2 relegated for the 2 promoted from Division 2'); }
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
  const s = new GameState(), Z = { passesOk: 0, steals: 0, interceptions: 0, saves: 0, shots: 0 };
  const nm = s.nextLeagueMatch(), out = s.applyResult({ mode: 'league', opponent: nm.opponent }, { hs: 3, as: 2, stats: Z });
  ok(out.pack && out.pack.tier === 2 && s.data.packs.slots.length === 1, 'every match gives a pack (win = gold), stored in a slot');
  const c0 = { ...s.data.currencies, tokens: [...s.data.currencies.tokens] }, r = s.openPack(out.pack.id), g = (k) => r.cards.filter((c) => c.kind === k).reduce((a, c) => a + c.n, 0);
  ok(s.data.currencies.coins === c0.coins + g('coins') && s.data.currencies.tp === c0.tp + g('tp') && s.data.currencies.gems === c0.gems + g('gems') && s.data.currencies.medkits === c0.medkits + g('medkits')
    && s.data.currencies.energy === c0.energy + g('energy') && s.data.currencies.tokens[0] === c0.tokens[0] + 1 && s.data.packs.slots.length === 0 && g('coins') >= PACK_TIERS[2].coins[0],
    `gold pack opened: ${r.cards.map((c) => c.kind + ' ' + c.n).join(', ')} — all granted, slot freed`);
  ok(s.openPack(out.pack.id) === null, 'a pack opens only once');
  const n0 = s.squad.length, e = s.addPack(3), re = s.openPack(e.id), pc = re.cards.find((c) => c.kind === 'player');
  ok(pc && s.squad.length === n0 + 1 && s.player(pc.id) && re.cards.length >= 6, 'ELITE pack: a new player joins the squad');
  for (let i = 0; i < PACK_SLOTS + 1; i++) s.addPack(i % 4);
  ok(s.data.packs.slots.length === PACK_SLOTS && s.data.packs.fresh && s.findPack(s.data.packs.fresh.id), '4 slots: a 5th pack must be opened now'); }
console.log(fail ? `${fail} FAILED` : 'ALL PASSED'); process.exit(fail ? 1 : 0);
