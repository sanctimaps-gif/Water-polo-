// WATER POLO 26 MOBILE — front-end screens (landscape only). Every value comes from GameState.
import { EVENTS, SHOP_ITEMS, TOURNAMENTS, CLUBS, POOLS, LEAGUES, COUNTRY_LEAGUES, BALL_DESIGNS, defaultKits, SLOT_ROLES, ROLE_ABBR, COUNTRIES, STAT_KEYS, overall, rarity, formatDuration, dayKey, QUALITIES, SKILLS, maxLevel, tradeValue, DAILY_GIFTS } from '../state.js';
import { TACTICS } from '../sim.js';
import { logoSvg, icon, trophySvg, trophyArt, flagSvg, LOGO_SHAPES, LOGO_SYMBOLS, LOGO_PATTERNS } from './art.js';

const KIT_PATTERNS = ['plain', 'halves', 'stripe', 'sash', 'chevron'];

const hex = (c) => '#' + c.toString(16).padStart(6, '0');
const flag = (code) => (COUNTRIES.find((c) => c[0] === code) || ['', ''])[1];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const PALETTE = [0x1e5bd8, 0x0f4c81, 0x13c4e8, 0x1f8a70, 0x2fbf71, 0xf2c81a, 0xf28c1a, 0xd8321e, 0xb81e5a, 0x7a2fd0, 0x16181d, 0xf4f6f8];
const TIER = { standard: ['#1fb06a', '#0f6fa8', '#2fe08a', '#7fd8ff'], special: ['#13c4e8', '#1946d8', '#7ff0ff', '#a9c4ff'], major: ['#f2c81a', '#1a1a1a', '#ffe680', '#8a6a00'], premium: ['#c42aa8', '#5a1fb8', '#ff8af0', '#c9a2ff'] };
const SKINS = ['#f1c7a6', '#e0ac87', '#c68b62', '#a86d47', '#7c4e31', '#5a3622'];

export class App {
  constructor(root, api) {
    this.root = root; this.api = api; this.st = api.state;
    this.stack = []; this.current = null; this.sel = null; this.teamTab = 'starters'; this.rankTab = 'season';
    root.addEventListener('click', (e) => { const t = e.target.closest('[data-act]'); if (t && root.contains(t)) { this.api.uiSound(); this.act(t.dataset.act, t.dataset.arg, t); } });
    root.addEventListener('input', (e) => {
      if (e.target.id === 'club-name') this.renameClub(e.target.value);
      const f = e.target.dataset && e.target.dataset.field; if (!f || !this.draft) return;
      this.edField(f, e.target.value);
      if (e.target.type === 'color' || e.target.tagName === 'SELECT') { this.render(); this.api.preview(this.draft, this.edView); return; }
      // text fields: refresh the identity strip without re-rendering (keeps the keyboard open)
      const d = this.draft, q = (s) => this.root.querySelector(s);
      if (q('.ed-name')) q('.ed-name').textContent = d.name; if (q('.ed-logo')) q('.ed-logo').innerHTML = logoSvg(d.logo, d.color, d.color2, 64, d.color3);
      if (q('.ed-id small')) q('.ed-id small').textContent = `${d.short} · ${d.city} · ${flag(d.country)}`;
    });
    root.addEventListener('change', (e) => { if (e.target.tagName === 'SELECT' && e.target.dataset.field && this.draft) { this.edField(e.target.dataset.field, e.target.value); this.render(); } });
    // drag on the 3D preview turns the player
    let drag = null;
    root.addEventListener('pointerdown', (e) => { if (e.target.closest('[data-drag="hero"]') && !e.target.closest('button')) drag = e.clientX; });
    addEventListener('pointermove', (e) => { if (drag !== null) { this.api.rotateHero((e.clientX - drag) * 0.012); drag = e.clientX; } });
    addEventListener('pointerup', () => { drag = null; });
    document.addEventListener('pointerdown', (e) => { if (e.target.closest('[data-drag="hero3d"]')) drag = e.clientX; });
    setInterval(() => this.tick(), 1000);
    this.st.onChange(() => this.refreshHeader());
  }
  L(k, ...a) { return this.api.L(k, ...a); }

  // ------------------------------------------------------------------ navigation
  show(name, params = {}, push = true) {
    if (push && this.current) this.stack.push(this.current);
    this.current = { name, params };
    this.render();
  }
  back() { if (this.current && this.current.name === 'editor') this.api.preview(null); const prev = this.stack.pop(); if (prev) { this.current = prev; this.render(); } else this.show('home', {}, false); }
  home() { if (this.current && this.current.name === 'editor') this.api.preview(null); this.stack = []; this.show('home', {}, false); }
  hide() { this.root.classList.add('hidden'); this.api.setHero(false); }
  render() {
    this.st.refreshDaily();
    const { name, params } = this.current;
    const body = this['scr_' + name](params);
    this.root.classList.remove('hidden');
    this.root.className = `app scr-${name}`;
    const same = this.lastScreen === name; this.lastScreen = name;   // re-render of the same screen: no slide-in (editor, filters)
    const sc = this.root.querySelector('.custom-panel, .club-grid'), scroll = same && sc ? sc.scrollTop : 0;
    this.root.innerHTML = (name === 'results' || name === 'prematch' || name === 'editor' || params.first ? '' : this.header()) + `<main class="screen ${same ? '' : 'anim-in'}">${body}</main>`;
    if (scroll) { const n = this.root.querySelector('.custom-panel, .club-grid'); if (n) n.scrollTop = scroll; }
    this.api.setHero(name === 'home' || name === 'customize' || name === 'editor', name);
  }
  tick() {
    if (this.root.classList.contains('hidden')) return;
    let expired = false;
    this.root.querySelectorAll('[data-until]').forEach((el) => {
      const ms = +el.dataset.until - Date.now();
      if (ms <= 0) expired = true;
      el.textContent = this.L(el.dataset.fmt, formatDuration(ms));
    });
    if (expired) this.render();
  }

  // ------------------------------------------------------------------ shared components
  header() {
    const d = this.st.data, t = this.st.teamTotal().total, pr = d.profile, need = this.st.xpForLevel(pr.level);
    return `<header class="topbar">
      <button class="icon-btn" data-act="nav" data-arg="settings" aria-label="settings">${icon('gear', 26)}</button>
      <button class="brand" data-act="home" aria-label="Water Polo 26 Mobile"><img src="web/assets/icon-192.png" alt="" width="44" height="44"></button>
      <button class="club-chip" data-act="nav" data-arg="profile">${logoSvg(d.club.logo, d.club.color, d.club.color2, 38)}
        <span><b>${esc(d.club.name)}</b><small>${this.L('ui.total')} <em id="hdr-total">${t}</em></small></span></button>
      <div class="lvl"><span>${this.L('ui.level')} <b>${pr.level}</b></span><i><u style="width:${Math.round((pr.xp / need) * 100)}%"></u></i></div>
      <div class="spacer"></div>
      <button class="cur mini" data-act="cur" data-arg="tp">${icon('dumbbell', 20)}<b id="hdr-tp">${d.currencies.tp.toLocaleString('fr-FR')}</b></button>
      <button class="cur mini" data-act="cur" data-arg="medkits">${icon('medkit', 20)}<b id="hdr-med">${d.currencies.medkits}</b></button>
      <button class="cur mini" data-act="cur" data-arg="energy">${icon('bolt', 20)}<b id="hdr-en">${d.currencies.energy}</b></button>
      <button class="cur coins" data-act="cur" data-arg="coins">${icon('coin', 22)}<b id="hdr-coins">${d.currencies.coins.toLocaleString('fr-FR')}</b>${icon('plus', 16)}</button>
      <button class="cur gems" data-act="cur" data-arg="gems">${icon('gem', 22)}<b id="hdr-gems">${d.currencies.gems.toLocaleString('fr-FR')}</b>${icon('plus', 16)}</button>
    </header>`;
  }
  refreshHeader() {
    const d = this.st.data, set = (id, v) => { const el = this.root.querySelector('#' + id); if (el && el.textContent !== String(v)) { el.textContent = v; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); } };
    set('hdr-coins', d.currencies.coins.toLocaleString('fr-FR')); set('hdr-tp', d.currencies.tp.toLocaleString('fr-FR')); set('hdr-med', d.currencies.medkits); set('hdr-en', d.currencies.energy); set('hdr-gems', d.currencies.gems.toLocaleString('fr-FR')); set('hdr-total', this.st.teamTotal().total);
  }
  backBtn() { return `<button class="btn back" data-act="back">${icon('back', 18)} ${this.L('ui.back')}</button>`; }
  badge(n) { return n > 0 ? `<span class="badge">${n}</span>` : ''; }
  timer(until, fmt) { return `<span data-until="${until}" data-fmt="${fmt}">${this.L(fmt, formatDuration(until - Date.now()))}</span>`; }
  reward(r) {
    return [r.coins ? `${icon('coin', 16)}${r.coins}` : '', r.gems ? `${icon('gem', 16)}${r.gems}` : '', r.tp ? `${icon('dumbbell', 16)}${r.tp}` : '',
      r.medkits ? `${icon('medkit', 16)}${r.medkits}` : '', r.energy ? `${icon('bolt', 16)}${r.energy}` : '', r.token !== undefined ? `${icon('token' + r.token, 16)}1` : ''].filter(Boolean).join(' ');
  }
  portrait(p, capColor) {
    const url = this.api.portrait && this.api.portrait(p, capColor);
    if (url) return `<img class="portrait p3d" src="${url}" alt="" draggable="false">`;
    const n = [...p.id].reduce((a, c) => a + c.charCodeAt(0), 0), skin = SKINS[n % SKINS.length], cap = p.role === 'GOALKEEPER' ? '#d81a1f' : hex(capColor);
    return `<svg class="portrait" viewBox="0 0 64 64" aria-hidden="true">
      <path d="M8 64 Q10 46 32 44 Q54 46 56 64Z" fill="${skin}"/><path d="M8 64 Q10 52 32 50 Q54 52 56 64Z" fill="${skin}" opacity=".7"/>
      <ellipse cx="32" cy="30" rx="13" ry="15" fill="${skin}"/>
      <path d="M18 28 Q18 12 32 12 Q46 12 46 28 Q40 22 32 22 Q24 22 18 28Z" fill="${cap}"/>
      <circle cx="18.5" cy="31" r="5" fill="${cap}" stroke="#0003"/><circle cx="45.5" cy="31" r="5" fill="${cap}" stroke="#0003"/>
      <circle cx="27" cy="31" r="1.6" fill="#222"/><circle cx="37" cy="31" r="1.6" fill="#222"/><path d="M28 39 Q32 41 36 39" stroke="#7a3d33" stroke-width="1.5" fill="none"/>
      ${n % 3 === 0 ? '<path d="M21 36 Q32 50 43 36 Q42 44 32 46 Q22 44 21 36Z" fill="#2a1a10" opacity=".75"/>' : ''}</svg>`;
  }
  /** Player card: shield frame of the quality tier (bronze / silver / gold / purple), 3D portrait, rating,
   *  poste, level gauge (level / cap), form arrow, name, country, club. */
  card(p, slot, opts = {}) {
    const ovr = overall(p), q = QUALITIES[p.quality || 0], bonus = slot === undefined ? 0 : this.st.slotBonus(p, slot);
    const keyStats = p.role === 'GOALKEEPER' ? [['GB', p.stats.goalkeeping], ['RÉA', p.stats.reaction], ['PLA', p.stats.positioning]]
      : [['TIR', p.stats.shooting], ['PAS', p.stats.passing], ['DÉF', p.stats.defense]];
    const fit = slot === undefined ? '' : bonus > 0 ? `<i class="fit good">+${bonus}</i>` : bonus < 0 ? `<i class="fit bad">${bonus}</i>` : '';
    const form = p.form >= 70 ? 'up' : p.form >= 40 ? 'mid' : 'down';
    return `<button class="pcard q-${q} ${opts.small ? 'small' : ''} ${opts.picked ? 'picked' : ''} ${this.sel === p.id ? 'sel' : ''}" data-act="${opts.act || 'card'}" data-arg="${p.id}" style="${opts.style || ''}">
      <div class="pc-in">
      <span class="lvl-g" title="${p.level}/${maxLevel(p)}"><u style="height:${Math.round((p.level / maxLevel(p)) * 100)}%"></u></span>
      ${this.portrait(p, this.st.equippedColor('cap') ?? this.st.data.club.color)}
      <span class="ovr">${ovr}</span><span class="role">${ROLE_ABBR[p.role]}</span>${fit}
      <span class="form f-${form}" title="${p.form}">${icon('up', 12)}</span>${p.boost > 0 ? `<span class="boost">${icon('bolt', 12)}</span>` : ''}
      <span class="nm">${esc(p.firstName[0])}. ${esc(p.lastName)}</span>
      <span class="ct">${flag(p.nationality)} ${p.nationality} · #${p.number}</span>
      ${opts.small ? '' : `<span class="ks">${keyStats.map(([k, v]) => `<b>${v}</b><small>${k}</small>`).join('')}</span>`}
      </div></button>`;
  }

  scr_home() {
    const st = this.st, nm = st.nextLeagueMatch(), me = st.clubInfo('user');
    const opp = nm ? st.clubInfo(nm.opponent) : null, pool = POOLS[(nm ? nm.round : 0) % POOLS.length];
    const evs = EVENTS.map((e) => [e, st.eventState(e)]);
    const nextEv = evs.find(([, s]) => s.status !== 'LOCKED' && s.status !== 'COMPLETED');
    const objDone = st.data.objectives.list.filter((o) => !o.claimed && o.progress >= o.n).length;
    return `<div class="home">
      <nav class="tiles-left hubs">
        <button class="tile t-orange" data-act="hub" data-arg="play">${icon('play', 26)}<span>${this.L('hub.play')}</span></button>
        <button class="tile t-blue" data-act="hub" data-arg="club">${icon('team', 26)}<span>${this.L('hub.club')}</span></button>
        <button class="tile t-green" data-act="hub" data-arg="career">${icon('star', 26)}<span>${this.L('hub.career')}</span></button>
        <button class="tile t-magenta" data-act="hub" data-arg="content">${icon('gift', 26)}<span>${this.L('hub.content')}</span>${this.badge(objDone + (st.giftAvailable() ? 1 : 0) + evs.filter(([, s]) => s.status === 'CLAIMABLE').length)}</button>
        <button class="tile t-violet" data-act="nav" data-arg="shop">${icon('bag', 26)}<span>${this.L('ui.shop')}</span></button>
      </nav>
      <div class="hero-space" data-act="edit-club"></div>
      <section class="home-right">
        ${nm ? `<button class="match-card" data-act="prematch-league">
          <div class="mc-head"><b>${esc(st.data.league.name || this.L('ui.league'))}</b><small>${this.L('ui.season', nm.season)} · ${this.L('ui.match_n', nm.round, nm.rounds)}</small></div>
          <div class="mc-vs">
            <div class="mc-team">${logoSvg(me.logo, me.color, me.color2, 86)}<span class="mc-name">${esc(me.name)}</span><span class="pill">${me.total}</span></div>
            <div class="vs">${this.L('ui.vs')}</div>
            <div class="mc-team">${logoSvg(opp.logo, opp.color, opp.color2, 86)}<span class="mc-name">${esc(opp.name)}</span><span class="pill">${opp.total}</span></div>
            <div class="mc-info"><span>${icon('star', 16)} ${pool.name}</span><span>${this.L('ui.weather_indoor')}</span></div>
          </div>
          <div class="mc-play">${icon('play', 20)} ${this.L('ui.play')}</div>
        </button>` : ''}
        <div class="tiles-row">
          <button class="tile wide t-blue" data-act="nav" data-arg="team">${icon('team', 28)}<span>${this.L('ui.team')}</span><small>${this.L('ui.total')} ${me.total}</small></button>
          <button class="tile wide t-magenta" data-act="nav" data-arg="tournaments">${icon('trophy', 28)}<span>${this.L('tour.title')}</span>${this.badge(TOURNAMENTS.filter((d) => st.tournamentStatus(d) === 'ACTIVE').length)}</button>
          <button class="tile wide t-green" data-act="nav" data-arg="myclub">${icon('star', 28)}<span>${this.L('hub.mycareer')}</span></button>
          <button class="tile wide t-dark" data-act="quick">${icon('play', 28)}<span>${this.L('ui.quick')}</span></button>
        </div>
      </section>
    </div>`;
  }

  scr_team() {
    const st = this.st, L = st.lineup, tot = st.teamTotal(), capC = st.equippedColor('cap') ?? st.data.club.color;
    // Formation seen from the pool deck: attacking goal on top (wings and centre at 2 m), flats, point, goalkeeper.
    const pos = { 4: [6, 1], 5: [41, 0], 0: [76, 1], 3: [16, 33.5], 2: [41, 33.5], 1: [66, 33.5] };
    const tabs = `<div class="tabs"><button class="${this.teamTab === 'starters' ? 'on' : ''}" data-act="team-tab" data-arg="starters">${this.L('ui.starters')}</button>
      <button class="${this.teamTab === 'tactics' ? 'on' : ''}" data-act="team-tab" data-arg="tactics">${this.L('ui.tactics')}</button>
      <button class="${this.teamTab === 'trade' ? 'on' : ''}" data-act="team-tab" data-arg="trade">${this.L('ui.trade')}</button></div>`;
    // ÉCHANGER: release reserve players for training points (starters and a squad of 9 are kept).
    this.picked = this.picked || new Set();
    const tradable = st.bench().filter((p) => st.canTrade(p.id) || this.picked.has(p.id));
    const value = [...this.picked].reduce((a, id) => a + (st.player(id) ? tradeValue(st.player(id)) : 0), 0);
    const trade = `<div class="trade"><p class="hint2">${this.L('ui.trade_hint')}</p>
      <div class="trade-grid">${tradable.length ? tradable.map((p) => this.card(p, undefined, { act: 'pick', picked: this.picked.has(p.id) })).join('') : `<p class="ni">${this.L('ui.trade_none')}</p>`}</div>
      <div class="trade-bar"><span>${this.L('ui.trade_value')} <b>${icon('dumbbell', 18)} ${value}</b></span>
      <button class="btn ${this.picked.size ? 'gold' : 'off'}" data-act="do-trade">${icon('swap', 18)} ${this.L('ui.trade')}</button></div></div>`;
    const tactics = `<div class="tactics">${TACTICS.map((t) => `<button class="tac ${st.data.club.tactic === t ? 'on' : ''}" data-act="tactic" data-arg="${t}">
      <b>${this.L('tactic.' + (t === 'COUNTER' ? 'counter' : t.toLowerCase()))}</b><small>${this.L('tdesc.' + t)}</small></button>`).join('')}</div>`;
    const field = `<div class="pool-field"><div class="goal-top"></div><div class="line2"></div><div class="line5"></div>
      ${L.slots.map((id, i) => this.card(st.player(id), i, { style: `left:${pos[i][0]}%;top:${pos[i][1]}%` })).join('')}
      ${this.card(st.player(L.gk), -1, { style: 'left:41%;top:67%' })}
      <p class="hint">${this.L('ui.tap_swap')}</p></div>`;
    return `<div class="team">
      <aside class="total-panel"><small>${this.L('ui.total')}</small><b class="big">${tot.total}</b>
        <small>${this.L('ui.avg_rating')}</small><b>${tot.base.toFixed(1)}</b>
        <small>${this.L('ui.pos_bonus')}</small><b class="${tot.bonus >= 0 ? 'pos' : 'neg'}">${tot.bonus >= 0 ? '+' : ''}${tot.bonus.toFixed(2)}</b>
        <button class="btn cyan" data-act="best">${this.L('ui.best_total')}</button></aside>
      <div class="team-main">${tabs}${this.teamTab === 'starters' ? field : this.teamTab === 'trade' ? trade : tactics}</div>
      <aside class="bench"><button class="btn cyan small" data-act="recruit">${this.L('ui.more_players')}<small>${icon('coin', 14)} ${st.recruitCost()}</small></button><h3>${this.L('ui.bench')}</h3>${st.bench().map((p) => this.card(p, undefined, { small: true })).join('')}</aside>
      <footer class="bar">${this.backBtn()}<div class="spacer"></div><button class="btn play" data-act="prematch-league">${icon('play', 18)} ${this.L('ui.play')}</button></footer>
    </div>`;
  }

  scr_ranking() {
    const rows = this.st.standings(), lg = this.st.data.league;
    const tabs = ['season', 'world', 'friends', 'regional'].map((t) => `<button class="${this.rankTab === t ? 'on' : ''}" data-act="rank-tab" data-arg="${t}">${t === 'season' ? this.L('ui.season', lg.season) : this.L('ui.' + t)}</button>`).join('');
    const table = `<table class="table"><thead><tr><th>${this.L('ui.pos')}</th><th class="l">${this.L('ui.club')}</th><th>${this.L('ui.p')}</th><th>${this.L('ui.w')}</th><th>${this.L('ui.d')}</th><th>${this.L('ui.l')}</th><th>${this.L('ui.gd')}</th><th>${this.L('ui.pts')}</th><th>${this.L('ui.total')}</th></tr></thead><tbody>
      ${rows.map((r, i) => `<tr class="${r.id === 'user' ? 'me' : ''}"><td>${i + 1}</td><td class="l">${logoSvg(r.info.logo, r.info.color, r.info.color2, 22)} ${esc(r.info.name)}</td><td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.gd > 0 ? '+' : ''}${r.gd}</td><td><b>${r.pts}</b></td><td>${r.info.total}</td></tr>`).join('')}
    </tbody></table>`;
    return `<div class="panel-screen"><h1>${this.L('ui.ranking')} · ${this.L('ui.league')}</h1><div class="tabs">${tabs}</div>
      ${this.rankTab === 'season' ? table : `<p class="ni">${this.L('ui.online_ni')}</p>`}
      <footer class="bar">${this.backBtn()}</footer></div>`;
  }

  scr_events() {
    const cards = EVENTS.map((e) => {
      const s = this.st.eventState(e), [c1, c2, c3, c4] = TIER[e.tier];
      let action;
      if (s.status === 'LOCKED') action = `<span class="ev-lock">${icon('lock', 18)} ${e.minLevel ? this.L('ui.need_level', e.minLevel) : this.L('ui.need_trophy')}</span>`;
      else if (s.status === 'UPCOMING') action = `<span class="ev-lock">${this.timer(Date.now() + s.remaining, 'ui.starts_in')}</span>`;
      else if (s.status === 'CLAIMABLE') action = `<button class="btn gold" data-act="claim-event" data-arg="${e.id}">${this.L('ui.claim')} ${this.reward(e.reward)}</button>`;
      else if (s.status === 'COMPLETED') action = `<span class="ev-lock">✔ ${this.L('ui.completed')}</span>`;
      else action = `<button class="btn play" data-act="prematch-event" data-arg="${e.id}">${s.progress ? this.L('ui.continue') : this.L('ui.start')}</button>`;
      return `<article class="ev-card ${s.status === 'LOCKED' ? 'locked' : ''}" style="--c1:${c1};--c2:${c2}">
        <h2>${this.L(e.name)}</h2><div class="ev-trophy">${trophySvg(c3, c4)}</div>
        <div class="ev-prog">${Array.from({ length: e.matches }, (_, i) => `<i class="${i < s.progress ? 'on' : ''}"></i>`).join('')}</div>
        <small>${s.status === 'UPCOMING' || s.status === 'LOCKED' ? '' : this.timer(Date.now() + s.remaining, 'ui.ends_in')}</small>
        <small>${this.L('ui.matches_left', Math.max(0, e.matches - s.progress))} · ${this.reward(e.reward)}</small>${action}</article>`;
    }).join('');
    return `<div class="panel-screen"><h1>${this.L('ui.events')}</h1><div class="ev-row">${cards}</div><footer class="bar">${this.backBtn()}</footer></div>`;
  }

  scr_objectives() {
    const o = this.st.data.objectives, midnight = new Date(); midnight.setHours(24, 0, 0, 0);
    return `<div class="panel-screen"><h1>${this.L('ui.objectives')}</h1><p class="sub">${this.timer(midnight.getTime(), 'ui.resets_in')}</p>
      <div class="list">${o.list.map((ob) => {
        const done = ob.progress >= ob.n;
        return `<div class="row-card ${ob.claimed ? 'claimed' : ''}"><div class="rc-main"><b>${this.L('obj.' + ob.id, ob.n)}</b>
          <div class="bar-prog"><u style="width:${(ob.progress / ob.n) * 100}%"></u><span>${ob.progress} / ${ob.n}</span></div></div>
          <div class="rc-rew">${this.reward(ob.reward)}</div>
          ${ob.claimed ? `<span class="ev-lock">✔</span>` : `<button class="btn ${done ? 'gold' : 'off'}" ${done ? `data-act="claim-obj" data-arg="${ob.id}"` : 'disabled'}>${this.L('ui.claim')}</button>`}</div>`;
      }).join('')}</div><footer class="bar">${this.backBtn()}</footer></div>`;
  }

  scr_rewards() {
    const g = this.st.data.gift, avail = this.st.giftAvailable(), cur = g.streak % 7;
    const gifts = [0, 1, 2, 3, 4, 5, 6].map((i) => {
      const r = DAILY_GIFTS[i];
      const state = i < cur ? 'got' : i === cur && avail ? 'now' : '';
      return `<div class="gift ${state}"><small>${this.L('ui.day', i + 1)}</small>${icon(i === 6 ? 'gem' : 'gift', 34)}<b>${this.reward(r)}</b></div>`;
    }).join('');
    return `<div class="panel-screen"><h1>${this.L('ui.free_rewards')}</h1><h2 class="center">${this.L('ui.daily_gift')}</h2><div class="gifts">${gifts}</div>
      <div class="center">${avail ? `<button class="btn gold big" data-act="claim-gift">${this.L('ui.claim')}</button>` : `<p class="sub">${this.L('ui.come_back')}</p>`}</div>
      <footer class="bar">${this.backBtn()}</footer></div>`;
  }

  scr_customize() {
    const c = this.st.data.club;
    const sw = (which, cur) => PALETTE.map((col) => `<button class="sw ${col === cur ? 'on' : ''}" style="background:${hex(col)}" data-act="color" data-arg="${which}:${col}"></button>`).join('');
    const symbols = [...LOGO_SYMBOLS, ...(this.st.owns('logo_crown') ? ['crown'] : [])];
    return `<div class="custom">
      <div class="hero-space"></div>
      <section class="custom-panel">
        <div class="logo-preview">${logoSvg(c.logo, c.color, c.color2, 110)}</div>
        <label>${this.L('ui.name')}<input id="club-name" maxlength="18" value="${esc(c.name)}" autocomplete="off"></label>
        <label>${this.L('ui.primary')}</label><div class="swatches">${sw('color', c.color)}</div>
        <label>${this.L('ui.secondary')}</label><div class="swatches">${sw('color2', c.color2)}</div>
        <label>${this.L('ui.shape')}</label><div class="choices">${LOGO_SHAPES.map((s) => `<button class="ch ${c.logo.shape === s ? 'on' : ''}" data-act="shape" data-arg="${s}">${logoSvg({ ...c.logo, shape: s }, c.color, c.color2, 40)}</button>`).join('')}</div>
        <label>${this.L('ui.symbol')}</label><div class="choices">${symbols.map((s) => `<button class="ch ${c.logo.symbol === s ? 'on' : ''}" data-act="symbol" data-arg="${s}">${logoSvg({ ...c.logo, symbol: s }, c.color, c.color2, 40)}</button>`).join('')}</div>
      </section>
      <footer class="bar">${this.backBtn()}</footer></div>`;
  }

  // ------------------------------------------------------------------ hubs (JOUER / MON CLUB / CARRIÈRE / CONTENU / BOUTIQUE)
  static HUBS = {
    play: ['t-orange', 'play', [['quick', 'ui.quick', 'play', 'quick'], ['nav', 'hub.tournament', 'trophy', 'tournaments'], ['nav', 'hub.league', 'chart', 'ranking']]],
    club: ['t-blue', 'team', [['nav', 'ui.team', 'team', 'team'], ['nav', 'hub.players', 'list', 'squad'], ['team-tab-go', 'hub.lineup', 'swap', 'starters'], ['team-tab-go', 'ui.tactics', 'chart', 'tactics'], ['edit-club', 'ui.customize', 'cap', '']]],
    career: ['t-green', 'star', [['nav', 'hub.mycareer', 'trophy', 'myclub'], ['nav', 'hub.progress', 'up', 'progress'], ['nav', 'hub.stats', 'chart', 'profile']]],
    content: ['t-magenta', 'gift', [['nav', 'hub.challenges', 'list', 'objectives'], ['nav', 'ui.events', 'trophy', 'events'], ['nav', 'ui.rewards', 'gift', 'rewards']]],
  };
  scr_hub({ id }) {
    const [cls, ic, items] = App.HUBS[id];
    return `<div class="panel-screen hub"><h1>${icon(ic, 26)} ${this.L('hub.' + id)}</h1><div class="hub-grid n${items.length}">
      ${items.map(([act, k, ico, arg], i) => `<button class="tile ${cls} hub-tile" style="animation-delay:${i * 50}ms" data-act="${act}" data-arg="${arg}">${icon(ico, 40)}<span>${this.L(k)}</span><small>${this.L(k + '_d')}</small></button>`).join('')}</div>
      <footer class="bar">${this.backBtn()}</footer></div>`;
  }
  scr_squad() {
    const st = this.st, order = ['GOALKEEPER', 'CENTER', 'DEFENDER', 'PLAYMAKER', 'FINISHER', 'WINGER', 'ALL_ROUNDER'];
    const list = [...st.squad].sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role) || overall(b) - overall(a));
    return `<div class="panel-screen"><h1>${this.L('hub.players')} · ${list.length}</h1><p class="sub">${this.L('hub.players_tip')}</p>
      <div class="squad-grid">${list.map((p) => this.card(p, undefined, { act: 'sheet' })).join('')}</div><footer class="bar">${this.backBtn()}</footer></div>`;
  }
  scr_progress() {
    const pr = this.st.data.profile, need = this.st.xpForLevel(pr.level), next = TOURNAMENTS.filter((d) => d.minLevel > pr.level).sort((a, b) => a.minLevel - b.minLevel)[0];
    const ev = EVENTS.filter((e) => e.minLevel > pr.level)[0];
    return `<div class="panel-screen"><h1>${this.L('hub.progress')}</h1>
      <div class="prog-top"><div class="lvl-big"><small>${this.L('ui.level')}</small><b>${pr.level}</b></div>
        <div class="xp"><div class="bar-prog big"><u style="width:${Math.round((pr.xp / need) * 100)}%"></u><span>${pr.xp} / ${need} ${this.L('ui.xp')}</span></div>
        <p class="sub">${this.L('prog.how')}</p>
        ${next ? `<p class="unlock">${icon('lock', 16)} ${this.L('prog.unlock', next.minLevel, esc(next.name))}</p>` : ''}${ev ? `<p class="unlock">${icon('lock', 16)} ${this.L('prog.unlock', ev.minLevel, this.L(ev.name))}</p>` : ''}</div></div>
      <h3>${this.L('ui.objectives')}</h3>${this.scr_objectives().replace(/^[\s\S]*?<div class="list">/, '<div class="list">').replace(/<footer[\s\S]*$/, '')}
      <footer class="bar">${this.backBtn()}</footer></div>`;
  }
  /** CARRIÈRE → MON CLUB: identity, level, fictional budget, squad, ranking, honours, current season. */
  scr_myclub() {
    const st = this.st, c = st.data.club, pr = st.data.profile, lg = st.data.league, rows = st.standings(), pos = rows.findIndex((r) => r.id === 'user') + 1;
    const base = c.baseClubId ? CLUBS.find((x) => x.id === c.baseClubId) : null, tot = st.teamTotal().total;
    const tname = (n) => n === 'league' ? lg.name : (TOURNAMENTS.find((d) => d.id === n) || { name: n }).name;
    const honours = pr.trophies.length ? pr.trophies.map((t) => `<span class="hon">${trophySvg('#ffe680', '#8a6a00', 26)} ${esc(tname(t.name))} <small>${this.L('ui.season', t.season)}</small></span>`).join('') : `<span class="sub">${this.L('mc.no_honours')}</span>`;
    const box = (k, v) => `<div><small>${this.L(k)}</small><b>${v}</b></div>`;
    return `<div class="myclub"><section class="mc-id">${logoSvg(c.logo, c.color, c.color2, 120, c.color3)}<h1>${esc(c.name)}</h1><span class="pill">${esc(c.short)}</span>
        <span>${esc(c.city)} · ${flag(c.country)} ${c.country}</span>${base ? `<small class="based">${this.L(c.customClubId ? 'ed.based_on' : 'mc.club_of', esc(base.name))}</small>` : `<small class="based">${this.L('ed.my_club')}</small>`}
        <div class="mc-kits">${['home', 'away', 'goalkeeper'].map((k) => this.kitSwatch(c.kits[k], k, c.kits.home)).join('')}</div>
        <button class="btn cyan small" data-act="edit-club">${icon('cap', 16)} ${this.L('ui.customize')}</button></section>
      <section class="mc-data"><div class="stats-grid">${box('ui.level', pr.level)}${box('mc.budget', st.budget().toLocaleString('fr-FR') + ' €*')}${box('mc.squad', `${st.squad.length} · ${this.L('ui.total')} ${tot}`)}
        ${box('mc.rank', `${pos} / ${rows.length}`)}${box('mc.season', `${lg.season} · ${this.L('ui.match_n', Math.min(lg.round + 1, lg.rounds.length), lg.rounds.length)}`)}</div>
        <h3>${esc(lg.name)}</h3><div class="mini-table">${rows.slice(Math.max(0, pos - 3), Math.max(0, pos - 3) + 5).map((r) => `<span class="${r.id === 'user' ? 'me' : ''}"><i>${rows.indexOf(r) + 1}</i>${logoSvg(r.info.logo, r.info.color, r.info.color2, 18)} ${esc(r.info.name)}<b>${r.pts}</b></span>`).join('')}</div>
        <h3>${this.L('mc.honours')}</h3><div class="honours">${honours}</div>
        <p class="sub">* ${this.L('mc.budget_note')}</p>
        <div class="row-btns"><button class="btn" data-act="nav" data-arg="ranking">${this.L('ui.ranking')}</button><button class="btn" data-act="nav" data-arg="tournaments">${this.L('tour.title')}</button>
        <button class="btn danger small" data-act="change-club">${this.L('mc.change')}</button></div></section>
      <footer class="bar">${this.backBtn()}</footer></div>`;
  }

  // ------------------------------------------------------------------ tournaments (national cups, regional, continental, international)
  tName(def) { return def.name; }
  tFormat(def) { return this.L('tour.f_' + def.format, def.size); }
  /** Competitions in big trophy tiles (featured league + cups), tab bar at the bottom: CLUB / EUROPE / MONDE. */
  scr_tournaments() {
    const st = this.st, tab = this.tourTab || 'club', lg = st.data.league, nm = st.nextLeagueMatch(), my = st.data.club.country;
    const tile = (def) => {
      const s = st.tournamentStatus(def), t = st.tournamentState(def), mine = def.scope !== 'national' || def.country === my, locked = !mine || s === 'LOCKED';
      const [c1, c2] = def.bg || ['#2a3a55', '#101a2c'];
      const line = !mine ? `${icon('lock', 14)} ${this.L('tour.only', def.country)}` : s === 'LOCKED' ? `${icon('lock', 14)} ${this.L('ui.need_level', def.minLevel)}`
        : s === 'WON' ? `${icon('trophy', 14)} ${this.L('tour.won')}` : s === 'OUT' ? this.L('tour.out') : s === 'ACTIVE' && t ? `${icon('play', 12)} ${this.tStage(def, t)}` : this.reward(def.reward);
      return `<button class="tt ${locked ? 'locked' : ''} ${s === 'ACTIVE' ? 'active' : ''}" style="--c1:${c1};--c2:${c2}" ${locked ? '' : `data-act="tour-open" data-arg="${def.id}"`}>
        ${def.country ? `<span class="tt-flag">${flagSvg(def.country, 30)}</span>` : ''}${trophyArt(def.art, 70)}<b>${esc(def.name)}</b><small class="tt-f">${this.tFormat(def)}</small><small class="tt-s">${line}</small></button>`;
    };
    const byScope = (...sc) => TOURNAMENTS.filter((d) => sc.includes(d.scope));
    let list, featured = '';
    if (tab === 'club') {
      list = byScope('national').sort((a, b) => (b.country === my) - (a.country === my));
      featured = `<button class="tt feat" style="--c1:#3b2fd8;--c2:#120a52" data-act="${nm ? 'prematch-league' : 'nav'}" data-arg="ranking"><span class="tt-flag">${flagSvg(my, 40)}</span>
        <i class="feat-title">${this.L('hub.league')}</i>${trophyArt('bigear', 130)}<b>${esc(lg.name)}</b>
        <small class="tt-s">${nm ? `${icon('play', 12)} ${this.L('ui.match_n', nm.round, nm.rounds)} · ${esc(st.clubInfo(nm.opponent).name)}` : this.L('ui.season', lg.season)}</small></button>`;
    } else list = tab === 'europe' ? byScope('regional', 'continental') : byScope('international');
    const tabs = [['club', 'club', 'tour.t_club'], ['europe', 'star', 'tour.t_europe'], ['world', 'trophy', 'tour.t_world']];
    return `<div class="tours tab-${tab}"><div class="tt-grid ${featured ? 'has-feat' : ''}">${featured}${list.map(tile).join('')}</div>
      <nav class="tabbar"><button data-act="back">${icon('back', 22)}<span>${this.L('ui.back')}</span></button>
        ${tabs.map(([k, ic, l]) => `<button class="${tab === k ? 'on' : ''}" data-act="tour-tab" data-arg="${k}">${icon(ic === 'club' ? 'team' : ic, 22)}<span>${this.L(l)}</span></button>`).join('')}</nav></div>`;
  }
  tStage(def, t) {
    if (t.stage === 'done') return t.champion === 'user' ? this.L('tour.won') : this.L('tour.champ', esc(this.st.clubInfo(t.champion).name));
    if (t.stage === 'groups') return this.L('tour.group_day', t.round + 1, t.groups[0].rounds.length);
    if (t.stage === 'league') return this.L('tour.league_day', t.round + 1, t.groups[0].rounds.length);
    return this.L('tour.' + this.st.koRoundName(t.ko[t.ko.length - 1].length * 2));
  }
  scr_tournament({ id }) {
    const st = this.st, def = TOURNAMENTS.find((d) => d.id === id), t = st.tournamentState(def), me = st.clubInfo('user');
    const nm = st.nextTournamentMatch(def), team = (cid, size = 20) => { const c = st.clubInfo(cid); return `${logoSvg(c.logo, c.color, c.color2, size, c.color3)}<span>${esc(c.name)}</span>`; };
    let left;
    if (nm && nm.opponent) { const opp = st.clubInfo(nm.opponent);
      left = `<button class="match-card t-next" data-act="tour-play" data-arg="${id}"><div class="mc-head"><b>${esc(def.name)}</b><small>${this.tStage(def, t)}</small></div>
        <div class="mc-vs"><div class="mc-team">${logoSvg(me.logo, me.color, me.color2, 70, me.color3)}<span class="mc-name">${esc(me.name)}</span><span class="pill">${me.total}</span></div><div class="vs">${this.L('ui.vs')}</div>
        <div class="mc-team">${logoSvg(opp.logo, opp.color, opp.color2, 70, opp.color3)}<span class="mc-name">${esc(opp.name)}</span><span class="pill">${opp.total}</span></div></div>
        <div class="mc-play">${icon('play', 20)} ${this.L('ui.play')}</div></button>`; }
    else if (nm && nm.bye) left = `<div class="t-info"><b>${this.L('tour.bye')}</b><button class="btn cyan" data-act="tour-bye" data-arg="${id}">${this.L('tour.sim_day')}</button></div>`;
    else if (t && t.stage === 'done') left = `<div class="t-info champ">${trophySvg('#ffe680', '#8a6a00', 90)}<b>${this.L('tour.champion')}</b>${team(t.champion, 54)}
      ${t.champion === 'user' ? `<span>${this.reward(def.reward)}</span>` : ''}<small class="sub">${this.L('tour.next_season')}</small></div>`;
    else left = `<div class="t-info"><b>${this.L('tour.out')}</b></div>`;
    const tables = t ? t.groups.map((g, gi) => `<table class="table small"><thead><tr><th class="l">${t.groups.length > 1 ? this.L('tour.group', String.fromCharCode(65 + gi)) : this.L('ui.ranking')}</th><th>${this.L('ui.p')}</th><th>${this.L('ui.gd')}</th><th>${this.L('ui.pts')}</th></tr></thead><tbody>
      ${st.sortTable(g.table).map((cid, i) => { const r = g.table[cid]; return `<tr class="${cid === 'user' ? 'me' : ''} ${t.groups.length > 1 && i < 2 ? 'q' : ''}"><td class="l">${i + 1}. ${team(cid)}</td><td>${r.p}</td><td>${r.gf - r.ga > 0 ? '+' : ''}${r.gf - r.ga}</td><td><b>${r.pts}</b></td></tr>`; }).join('')}</tbody></table>`).join('') : '';
    const later = []; if (t && t.ko.length && t.stage !== 'done') for (let n = t.ko[t.ko.length - 1].length / 2; n >= 1; n /= 2) later.push(n);
    const bracket = t && t.ko.length ? `<div class="bracket">${t.ko.map((r) => `<div class="b-col"><h4>${this.L('tour.' + st.koRoundName(r.length * 2))}</h4>
      ${r.map((m) => `<div class="b-m ${m.a === 'user' || m.b === 'user' ? 'me' : ''}">${[['a', 'as'], ['b', 'bs']].map(([k, sk]) => `<div class="b-t ${m.winner === m[k] ? 'w' : m.winner ? 'l' : ''}">${team(m[k], 16)}<b>${m[sk] ?? ''}${m.pens && m.winner === m[k] ? '*' : ''}</b></div>`).join('')}</div>`).join('')}</div>`).join('')}${later.map((n) => `<div class="b-col"><h4>${this.L('tour.' + st.koRoundName(n * 2))}</h4>${'<div class="b-m tbd"><div class="b-t"><span>?</span></div><div class="b-t"><span>?</span></div></div>'.repeat(n)}</div>`).join('')}</div>
      ${t.ko.some((r) => r.some((m) => m.pens)) ? `<small class="sub">* ${this.L('tour.pens')}</small>` : ''}` : '';
    return `<div class="tour"><div class="tour-left"><h1>${esc(def.name)}</h1><p class="sub">${def.countries ? def.countries.map((c) => flag(c)).join(' ') : '🌍'} · ${this.tFormat(def)} · ${this.reward(def.reward)}</p>${left}</div>
      <div class="tour-right">${tables}${bracket}</div><footer class="bar">${this.backBtn()}</footer></div>`;
  }

  // ------------------------------------------------------------------ CHOISIS TON CLUB (real clubs, adapted identity)
  /** Real clubs of the database shown with their GAME identity (adapted name, original logo, game rating).
   *  The official reference data (name, competition, sources) only appears in the ⓘ panel, labelled as such. */
  scr_clubs(p = {}) {
    const countries = [...new Set(CLUBS.map((c) => c.country))], ctry = countries.includes(this.clubCountry) ? this.clubCountry : countries[0];
    const list = CLUBS.filter((c) => c.country === ctry).sort((a, b) => b.rating - a.rating);
    const sel = CLUBS.find((c) => c.id === this.pickId);
    const cname = (c) => this.L('country.' + c);
    const cols = `<div class="cp-countries">${countries.map((c) => `<button class="cp-ctry ${ctry === c ? 'on' : ''}" data-act="club-country" data-arg="${c}"><span>${cname(c)}</span>${flagSvg(c, 52)}</button>`).join('')}</div>`;
    const cards = list.map((c, i) => `<button class="club-card ${this.pickId === c.id ? 'on' : ''}" style="animation-delay:${i * 25}ms" data-act="club-pick" data-arg="${c.id}">
      <span class="ovr-b">${c.rating}<small>OVR</small></span>${logoSvg(c.logo, c.color, c.color2, 58, c.color3)}<b>${esc(c.name)}</b><small>${esc(c.city)}</small></button>`).join('');
    const ref = sel && this.showRef ? `<div class="refdata"><b>${this.L('club.ref_title')}</b>
      <span>${this.L('club.ref_name')} : ${esc(sel.ref.officialReferenceName)}</span><span>${this.L('club.ref_comp')} : ${esc(sel.ref.competition)} · ${esc(sel.ref.season)}</span>
      <span>${this.L('club.ref_src')} : ${sel.ref.source.map((u, i) => `<a href="${esc(u)}" target="_blank" rel="noopener">[${i + 1}] ${esc(new URL(u).hostname.replace('www.', ''))}</a>`).join(' ')}</span>
      <span>${this.L('club.ref_upd')} : ${esc(sel.ref.lastUpdated)}</span><small>${this.L('club.ref_note')}</small></div>` : '';
    const panel = sel ? `<aside class="club-panel anim-pop">
      <div class="cp-head"><span class="cp-logo">${logoSvg(sel.logo, sel.color, sel.color2, 84, sel.color3)}<span class="ovr-b">${sel.rating}<small>OVR</small></span></span>
        <span><b class="cp-name">${esc(sel.name)}</b><span class="cp-city">${esc(sel.city)} · ${flagSvg(sel.country, 18)}</span><small>${esc(sel.competition)}</small></span></div>
      <div class="cp-kits">${['home', 'away', 'goalkeeper'].map((k) => this.kitSwatch(sel.kits[k], k, sel.kits.home, 60)).join('')}</div>
      <div class="cp-actions"><button class="btn play" data-act="club-with">${icon('play', 18)} ${this.L('club.play_with')}</button>
        <button class="btn cyan" data-act="club-version">${icon('cap', 18)} ${this.L('club.my_version')}</button></div>
      <button class="ref-btn" data-act="club-ref">ⓘ ${this.L('club.ref_title')}</button>${ref}</aside>`
      : `<aside class="club-panel empty"><p class="sub">${this.L('club.pick_hint')}</p><p class="sub">${this.L('club.ref_note')}</p></aside>`;
    return `<div class="clubs"><header class="cp-bar"><b>${this.L('club.choose')}</b><span class="cp-tabs"><button class="on">${icon('trophy', 16)} ${this.L('club.real')}</button>
        <button data-act="club-new">${icon('plus', 16)} ${this.L('club.create')}</button></span>${p.first ? `<small>${this.L('club.first')}</small>` : this.backBtn()}</header>
      ${cols}<div class="club-grid">${cards}</div>${panel}</div>`;
  }
  /** Kit illustration: cap with ear guards and number, swim brief with its pattern (original drawing). */
  kitSwatch(k, which, home, size = 40) {
    const gk = which === 'goalkeeper', suit = hex(gk ? home.suit : k.suit), suit2 = hex(gk ? home.suit2 : k.suit2), pat = gk ? home.pattern : k.pattern;
    const cap = hex(k.cap), trim = hex(k.capTrim), id = 'kb' + Math.random().toString(36).slice(2, 8);
    const brief = 'M6 36h28v4l-7 12h-14l-7-12Z';
    const fill = pat === 'halves' ? '<rect x="20" y="34" width="16" height="20"/>' : pat === 'stripe' ? '<rect x="17" y="34" width="6" height="20"/>'
      : pat === 'sash' ? '<path d="M6 40l14-6h6L8 46Z"/>' : pat === 'chevron' ? '<path d="M6 38l14 8 14-8v4l-14 8-14-8Z"/>' : '';
    return `<span class="kit"><svg viewBox="0 0 40 56" width="${size}" height="${Math.round(size * 1.4)}" aria-hidden="true">
      <defs><clipPath id="${id}"><path d="${brief}"/></clipPath><linearGradient id="${id}g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
      <path d="M7 22a13 13 0 0 1 26 0v2H7Z" fill="${cap}"/><path d="M7 22a13 13 0 0 1 26 0v2H7Z" fill="url(#${id}g)"/>
      <path d="M8 21h24" stroke="${trim}" stroke-width="1.6"/><circle cx="8" cy="24" r="4.2" fill="${cap}" stroke="${trim}" stroke-width="1.4"/><circle cx="32" cy="24" r="4.2" fill="${cap}" stroke="${trim}" stroke-width="1.4"/>
      <path d="M9 28q11 4 22 0" stroke="${trim}" stroke-width="1" fill="none" opacity=".7"/>
      <text x="20" y="18" font-size="8" font-weight="900" text-anchor="middle" fill="${hex(k.number)}">${gk ? 1 : 7}</text>
      <path d="${brief}" fill="${suit}"/><g clip-path="url(#${id})" fill="${suit2}">${fill}<rect x="6" y="36" width="28" height="2.2"/></g>
      <path d="${brief}" fill="none" stroke="#0005" stroke-width=".8"/></svg><small>${this.L('kit.' + which)}</small></span>`;
  }

  // ------------------------------------------------------------------ club editor (CRÉER MA VERSION / CRÉER MON CLUB / MON CLUB)
  /** Edits this.draft; the 3D hero in the left gap is the live preview (rebuilt on every change). */
  scr_editor() {
    const d = this.draft, tab = this.edTab || 'id', mode = this.edMode, base = d.baseClubId ? CLUBS.find((c) => c.id === d.baseClubId) : null;
    const sw = (path, cur) => PALETTE.map((col) => `<button class="sw ${col === cur ? 'on' : ''}" style="background:${hex(col)}" data-act="ed-color" data-arg="${path}:${col}"></button>`).join('')
      + `<input type="color" class="sw pick" data-field="${path}" value="${hex(cur)}" aria-label="custom">`;
    const set = (path, vals, cur, draw) => `<div class="choices">${vals.map((v) => `<button class="ch ${v === cur ? 'on' : ''}" data-act="ed-set" data-arg="${path}:${v}">${draw(v)}</button>`).join('')}</div>`;
    const txt = (v) => `<span class="cht">${this.L('opt.' + v)}</span>`;
    const lg = (patch) => logoSvg({ ...d.logo, ...patch }, d.color, d.color2, 40, d.color3);
    const kitEd = (k) => { const K = d.kits[k]; return `<h4>${this.L('kit.' + k)}</h4>
      <label>${this.L('ed.pattern')}</label>${set(`kits.${k}.pattern`, KIT_PATTERNS, K.pattern, txt)}
      <label>${this.L('ed.suit')}</label><div class="swatches">${sw(`kits.${k}.suit`, K.suit)}</div>
      <label>${this.L('ed.suit2')}</label><div class="swatches">${sw(`kits.${k}.suit2`, K.suit2)}</div>`; };
    const capEd = (k) => { const K = d.kits[k]; return `<h4>${this.L('kit.' + k)}</h4>
      <label>${this.L('ed.cap')}</label><div class="swatches">${sw(`kits.${k}.cap`, K.cap)}</div>
      <label>${this.L('ed.captrim')}</label><div class="swatches">${sw(`kits.${k}.capTrim`, K.capTrim)}</div>
      <label>${this.L('ed.number')}</label><div class="swatches">${sw(`kits.${k}.number`, K.number)}</div>`; };
    const panes = {
      id: `<label>${this.L('ui.name')}<input data-field="name" maxlength="22" value="${esc(d.name)}" autocomplete="off"></label>
        <label>${this.L('ed.short')}<input data-field="short" maxlength="4" value="${esc(d.short)}" autocomplete="off"></label>
        <label>${this.L('club.city')}<input data-field="city" maxlength="22" value="${esc(d.city)}" autocomplete="off"></label>
        <label>${this.L('club.country')}${mode === 'edit' ? `<b class="ro">${flag(d.country)} ${d.country} · ${this.L('ed.country_locked')}</b>`
          : `<select data-field="country">${COUNTRY_LEAGUES.map((c) => `<option value="${c}" ${c === d.country ? 'selected' : ''}>${flag(c)} ${c} · ${esc((LEAGUES[c] || {}).game || '')}</option>`).join('')}</select>`}</label>
        <label>${this.L('ui.primary')}</label><div class="swatches">${sw('color', d.color)}</div>
        <label>${this.L('ui.secondary')}</label><div class="swatches">${sw('color2', d.color2)}</div>
        <label>${this.L('ed.color3')}</label><div class="swatches">${sw('color3', d.color3)}</div>`,
      logo: `<label>${this.L('ui.shape')}</label>${set('logo.shape', LOGO_SHAPES, d.logo.shape, (v) => lg({ shape: v }))}
        <label>${this.L('ui.symbol')}</label>${set('logo.symbol', [...LOGO_SYMBOLS, ...(this.st.owns('logo_crown') ? ['crown'] : [])], d.logo.symbol, (v) => lg({ symbol: v }))}
        <label>${this.L('ed.letters')}<input data-field="logo.letters" maxlength="3" value="${esc(d.logo.letters || '')}" autocomplete="off"></label>
        <label>${this.L('ed.motif')}</label>${set('logo.pattern', LOGO_PATTERNS, d.logo.pattern, (v) => lg({ pattern: v }))}
        <label>${this.L('ed.border')}</label>${set('logo.border', ['single', 'double'], d.logo.border, (v) => lg({ border: v }))}
        <p class="sub">${this.L('ed.logo_note')}</p>`,
      kits: kitEd('home') + kitEd('away'),
      cap: capEd('home') + capEd('away') + `<p class="sub">${this.L('ed.gk_note')}</p>`,
      more: `<label>${this.L('ed.ball')}</label><div class="choices">${Object.entries(BALL_DESIGNS).map(([k, [a, , g]]) => `<button class="ch ${d.ball === k ? 'on' : ''}" data-act="ed-set" data-arg="ball:${k}">
          <svg viewBox="0 0 40 40" width="40" height="40"><circle cx="20" cy="20" r="17" fill="${a}"/><path d="M4 16q16 10 32 0M4 25q16-10 32 0" stroke="${g}" stroke-width="3" fill="none"/></svg><span class="cht">${this.L('ball.' + k)}</span></button>`).join('')}</div>
        <label>${this.L('ed.pool')}</label><div class="choices">${POOLS.map((pl) => `<button class="ch wide ${d.pool === pl.id ? 'on' : ''}" data-act="ed-set" data-arg="pool:${pl.id}"><span class="cht">${pl.name}</span><small>${this.L('amb.' + pl.ambience.toLowerCase())}</small></button>`).join('')}</div>`,
    };
    const tabs = ['id', 'logo', 'kits', 'cap', 'more'].map((t) => `<button class="${tab === t ? 'on' : ''}" data-act="ed-tab" data-arg="${t}">${this.L('ed.tab_' + t)}</button>`).join('');
    const views = ['home', 'away', 'gk'].map((v) => `<button class="${(this.edView || 'home') === v ? 'on' : ''}" data-act="ed-view" data-arg="${v}">${this.L('kit.' + (v === 'gk' ? 'goalkeeper' : v))}</button>`).join('');
    return `<div class="editor">
      <div class="ed-preview hero-space" data-drag="hero"><div class="ed-badge">${icon('cap', 16)} ${this.L('ed.preview')}</div>
        <div class="ed-id"><span class="ed-logo">${logoSvg(d.logo, d.color, d.color2, 64, d.color3)}</span><span><b class="ed-name">${esc(d.name)}</b><small>${esc(d.short)} · ${esc(d.city)} · ${flag(d.country)}</small>
          ${base ? `<small class="based">${this.L(mode === 'edit' ? 'ed.my_club' : 'ed.based_on', esc(base.name))}</small>` : ''}</span></div>
        <div class="ed-views tabs small">${views}</div>
        <div class="ed-rot"><button class="icon-btn" data-act="ed-rot" data-arg="-1">⟲</button><button class="icon-btn" data-act="ed-rot" data-arg="1">⟳</button></div></div>
      <section class="custom-panel"><div class="tabs small">${tabs}</div>${panes[tab]}</section>
      <footer class="bar">${this.backBtn()}<div class="spacer"></div><button class="btn play" data-act="ed-validate">${icon('play', 18)} ${this.L('ed.validate')}</button></footer></div>`;
  }
  edField(path, value) {
    const d = this.draft, keys = path.split('.'), last = keys.pop(); let o = d; for (const k of keys) o = o[k];
    if (typeof o[last] === 'number' || /^#[0-9a-f]{6}$/i.test(value)) value = typeof value === 'string' && value[0] === '#' ? parseInt(value.slice(1), 16) : +value;
    if (path === 'short' || path === 'logo.letters') value = String(value).toUpperCase().replace(/[^A-Z0-9À-Ý]/g, '');
    o[last] = value;
    // club colours: regenerate the kits from the 3 colours, keeping the chosen patterns
    if (['color', 'color2', 'color3'].includes(path)) { const pk = { home: d.kits.home.pattern, away: d.kits.away.pattern }; d.kits = defaultKits(d.color, d.color2, d.color3); d.kits.home.pattern = pk.home; d.kits.away.pattern = pk.away; }
    if (path === 'short' && (!d.logo.letters || d.logo.letters === this.prevShort)) d.logo.letters = value.slice(0, 3);
    this.prevShort = d.short;
  }
  openEditor(draft, mode) {
    this.draft = draft; this.edMode = mode; this.edTab = 'id'; this.edView = 'home'; this.prevShort = draft.short;
    this.show('editor'); this.api.preview(this.draft, 'home');
  }
  /** Squad choice, then the club is saved and the career starts in its national league. */
  async startClub(identity, mode) {
    const r = await this.modal(this.L('club.squad'), `<p>${this.L('club.squad_desc')}</p>`, [[this.L('club.squad_start'), () => 'start'], [this.L('club.squad_own'), () => 'own']]);
    if (!r) return;
    this.st.chooseClub(JSON.parse(JSON.stringify(identity)), { mode, squad: r });
    this.api.preview(null); this.api.haptic([20, 40, 20]); this.api.rewardSound(); this.pickId = null; this.home();
    this.toast(this.L('club.welcome', identity.name));
  }

  scr_shop() {
    const items = SHOP_ITEMS.map((it) => {
      const owned = this.st.owns(it.id), eq = it.kind === 'symbol' ? this.st.data.club.logo.symbol === it.value : this.st.data.inventory.equipped[it.kind] === it.id;
      const swatch = it.color ? `<i class="swatch" style="background:${hex(it.color)}"></i>` : it.kind === 'symbol' ? logoSvg({ shape: 'shield', symbol: 'crown' }, 0x1e5bd8, 0xf2c81a, 56) : icon('star', 48);
      const price = it.price.coins ? `${icon('coin', 18)} ${it.price.coins}` : `${icon('gem', 18)} ${it.price.gems}`;
      return `<article class="shop-card"><small>${this.L('kind.' + it.kind)}</small><div class="shop-art">${swatch}</div><b>${this.L(it.name)}</b>
        ${owned ? `<button class="btn ${eq ? 'off' : 'cyan'}" data-act="equip" data-arg="${it.id}">${eq ? this.L('ui.equipped') : this.L('ui.equip')}</button>`
          : `<button class="btn ${this.st.canAfford(it.price) ? 'play' : 'off'}" data-act="buy" data-arg="${it.id}">${price}</button>`}</article>`;
    }).join('');
    return `<div class="panel-screen"><h1>${this.L('ui.shop')}</h1><p class="sub">${this.L('ui.shop_note')}</p><div class="shop-grid">${items}</div><footer class="bar">${this.backBtn()}</footer></div>`;
  }

  scr_profile() {
    const pr = this.st.data.profile;
    return `<div class="panel-screen"><h1>${this.L('ui.profile')}</h1>
      <div class="stats-grid"><div><small>${this.L('ui.level')}</small><b>${pr.level}</b></div><div><small>${this.L('ui.matches')}</small><b>${pr.matches}</b></div>
      <div><small>${this.L('ui.wins')}</small><b>${pr.wins}</b></div><div><small>+/-</small><b>${pr.goalsFor - pr.goalsAgainst}</b></div><div><small>${this.L('ui.trophies')}</small><b>${pr.trophies.length}</b></div></div>
      <div class="list">${pr.history.slice(0, 6).map((h) => `<div class="row-card"><span>${new Date(h.date).toLocaleDateString()}</span><b>${esc(this.st.clubInfo(CLUBS.some((c) => c.id === h.opponent) ? h.opponent : 'user').name)}</b><span class="score ${h.hs > h.as ? 'w' : h.hs < h.as ? 'l' : 'd'}">${h.hs} - ${h.as}</span></div>`).join('')}</div>
      <footer class="bar">${this.backBtn()}</footer></div>`;
  }

  scr_settings() {
    // Tabs like a console sports game: MATCH (camera, zoom, radar...), CONTROLS, AUDIO, GRAPHICS, OTHER.
    const tab = this.setTab || 'match', all = this.api.settingsRows();
    const tabs = ['match', 'controls', 'audio', 'graphics', 'other'].map((t) => `<button class="${tab === t ? 'on' : ''}" data-act="set-tab" data-arg="${t}">${this.L('set.' + t)}</button>`).join('');
    const rows = all.filter((r) => r[3] === tab).map(([label, value, key]) => `<div class="row"><span>${label}</span><button class="btn cyan" data-act="setting" data-arg="${key}">${value}</button></div>`).join('');
    return `<div class="panel-screen"><h1>${this.L('ui.settings')}</h1><div class="tabs">${tabs}</div><div class="settings">${rows}</div>
      ${tab === 'other' ? `<p class="sub">${this.L('ui.credits')}</p><p class="sub">${this.L('ui.save_local')}</p><button class="btn danger" data-act="reset">${this.L('ui.reset')}</button>` : ''}
      <footer class="bar">${this.backBtn()}</footer></div>`;
  }

  scr_prematch(p) {
    const me = this.st.clubInfo('user'), opp = { ...this.st.clubInfo(p.opponent), total: p.rating ? this.st.opponentTotal(p.opponent, p.rating) : this.st.clubInfo(p.opponent).total };
    const tips = ['ui.tip1', 'ui.tip2', 'ui.tip3'];
    return `<div class="prematch"><h2>${esc(p.title)}</h2>
      <div class="pm-vs"><div class="mc-team">${logoSvg(me.logo, me.color, me.color2, 120)}<span class="mc-name">${esc(me.name)}</span><span class="pill">${me.total}</span></div>
      <div class="vs big">${this.L('ui.vs')}</div>
      <div class="mc-team">${logoSvg(opp.logo, opp.color, opp.color2, 120)}<span class="mc-name">${esc(opp.name)}</span><span class="pill">${opp.total}</span></div></div>
      <p class="sub">${p.away ? this.L('ui.away_pool') : (POOLS.find((x) => x.id === this.st.data.club.pool) || POOLS[0]).name} · ${this.L('ui.reward_win', p.mode === 'quick' ? 75 : 150)} ${icon('coin', 16)}</p>
      <p class="tip">${this.L(tips[Math.floor(Math.random() * tips.length)])}</p>
      <div class="pm-actions">${this.backBtn()}<button class="btn play big" data-act="go">${icon('play', 22)} ${this.L('ui.play')}</button></div></div>`;
  }

  scr_results(p) {
    const { summary: s, hs, as, stats: a, statsOpp: b, opponent } = p;
    const title = hs > as ? 'ui.victory' : hs < as ? 'ui.defeat' : 'ui.draw';
    const pct = (x, y) => (y ? Math.round((100 * x) / y) : 0) + '%', tot = a.possession + b.possession || 1;
    const rows = [[a.shots, 'stats.shots', b.shots], [a.saves, 'stats.saves', b.saves], [pct(a.passesOk, a.passes), 'stats.passes', pct(b.passesOk, b.passes)],
      [Math.round((100 * a.possession) / tot) + '%', 'stats.possession', Math.round((100 * b.possession) / tot) + '%'], [a.steals + a.interceptions, 'stats.steals', b.steals + b.interceptions]];
    const notes = [];
    if (s.levelUps) notes.push(this.L('ui.level_up', this.st.data.profile.level));
    for (const id of s.objectives) notes.push(this.L('ui.objective_done', this.L('obj.' + id, this.st.data.objectives.list.find((o) => o.id === id)?.n ?? '')));
    if (s.league) notes.push(s.league.champion ? this.L('ui.champion') : this.L('ui.league_pos', s.league.position));
    if (s.event) notes.push(this.L('ui.event_progress', s.event.progress, s.event.total));
    if (s.tournament) { const T = s.tournament;
      if (T.pens) notes.push(this.L(T.pens === 'user' ? 'tour.pens_won' : 'tour.pens_lost'));
      if (T.champion) notes.push(this.L('tour.champion_reward', this.reward(T.reward).replace(/<[^>]+>/g, ' ')));
      else if (T.eliminated || T.qualified === false) notes.push(this.L('tour.eliminated'));
      else if (T.qualified) notes.push(this.L('tour.qualified')); }
    return `<div class="results ${hs > as ? 'win' : hs < as ? 'loss' : 'draw'}"><h1>${this.L(title)}</h1>
      <div class="res-score"><span>${esc(this.st.data.club.short)}</span><b>${hs} - ${as}</b><span>${esc(opponent)}</span></div>
      <div class="res-body"><div class="res-stats">${rows.map(([x, k, y]) => `<div class="sr"><b>${x}</b><span>${this.L(k)}</span><b>${y}</b></div>`).join('')}</div>
      <div class="res-rew"><div class="rw">${icon('coin', 30)}<b>+${s.coins}</b></div><div class="rw">${icon('star', 30)}<b>+${s.xp} ${this.L('ui.xp')}</b></div><div class="rw">${icon('dumbbell', 30)}<b>+${s.tp}</b></div>${s.medkits ? `<div class="rw">${icon('medkit', 30)}<b>+${s.medkits}</b></div>` : ''}
      ${notes.map((n) => `<p>${esc(n)}</p>`).join('')}</div></div>
      <button class="btn play big" data-act="${s.tournament ? 'tour-back' : 'home'}" data-arg="${s.tournament ? s.tournament.def : ''}">${this.L('ui.continue')}</button></div>`;
  }

  // ------------------------------------------------------------------ actions
  async act(a, arg) {
    const st = this.st;
    switch (a) {
      case 'nav': this.show(arg); break;
      case 'back': this.back(); break;
      case 'home': this.home(); break;
      case 'team-tab': this.teamTab = arg; this.sel = null; this.render(); break;
      case 'rank-tab': this.rankTab = arg; this.render(); break;
      case 'set-tab': this.setTab = arg; this.render(); break;
      case 'card': {
        if (this.sel === arg) { this.sel = null; this.playerSheet(st.player(arg)); return; }
        if (this.sel) { st.swap(this.sel, arg); this.sel = null; this.api.haptic(15); } else this.sel = arg;
        this.render(); break;
      }
      case 'pick': { if (this.picked.has(arg)) this.picked.delete(arg); else if (st.canTrade(arg)) this.picked.add(arg); this.render(); break; }
      case 'do-trade': {
        if (!this.picked.size) return;
        if (await this.confirm(this.L('ui.trade_confirm', this.picked.size))) { const tp = st.trade([...this.picked]); this.picked.clear(); this.rewardPopup({ tp }); this.render(); }
        break;
      }
      case 'recruit': {
        if (st.squad.length >= 18) { this.toast(this.L('ui.squad_full')); return; }
        if (!st.canAfford({ coins: st.recruitCost() })) { this.toast(this.L('ui.not_enough')); return; }
        if (await this.confirm(this.L('ui.recruit_confirm', st.recruitCost()))) {
          const p = st.recruit(); if (!p) return;
          this.api.rewardSound(); this.render();
          this.modal(this.L('ui.new_player'), `<div class="reveal">${this.card(p, undefined, { act: 'noop' })}</div>`);
        }
        break;
      }
      case 'best': st.autoLineup(); this.sel = null; this.render(); this.toast(this.L('ui.done')); break;
      case 'tactic': st.data.club.tactic = arg; st.save(); this.render(); break;
      case 'cur': this.modal(this.L('ui.' + arg), `<p>${this.L('ui.' + arg + '_how')}</p>`); break;
      case 'claim-gift': { const r = st.claimGift(); if (r) this.rewardPopup(r); this.render(); break; }
      case 'claim-obj': { const r = st.claimObjective(arg); if (r) this.rewardPopup(r); this.render(); break; }
      case 'claim-event': { const r = st.claimEvent(EVENTS.find((e) => e.id === arg)); if (r) this.rewardPopup(r); this.render(); break; }
      case 'buy': {
        const it = SHOP_ITEMS.find((x) => x.id === arg);
        if (!st.canAfford(it.price)) { this.toast(this.L('ui.not_enough')); return; }
        const price = it.price.coins ? `${it.price.coins} ${this.L('ui.coins').toLowerCase()}` : `${it.price.gems} ${this.L('ui.gems').toLowerCase()}`;
        if (await this.confirm(this.L('ui.confirm_buy', this.L(it.name), price))) { st.buy(it); this.api.haptic([20, 30, 20]); this.api.refreshHero(); this.render(); }
        break;
      }
      case 'equip': st.equip(SHOP_ITEMS.find((x) => x.id === arg)); this.api.refreshHero(); this.render(); break;
      case 'color': { const [k, v] = arg.split(':'); st.data.club[k] = +v; st.save(); this.api.refreshHero(); this.render(); break; }
      case 'shape': st.data.club.logo.shape = arg; st.save(); this.render(); break;
      case 'symbol': st.data.club.logo.symbol = arg; st.save(); this.render(); break;
      case 'setting': await this.api.changeSetting(arg); this.render(); break;
      case 'reset': if (await this.confirm(this.L('ui.reset_warn'))) { st.reset(); this.api.refreshHero(); this.home(); } break;
      case 'prematch-league': { const nm = st.nextLeagueMatch(); if (nm) this.show('prematch', { mode: 'league', opponent: nm.opponent, away: !nm.home, title: `${this.L('ui.league')} · ${this.L('ui.match_n', nm.round, nm.rounds)}` }); break; }
      case 'prematch-event': { const ev = EVENTS.find((e) => e.id === arg), o = st.eventOpponent(ev); this.show('prematch', { mode: 'event', eventId: ev.id, opponent: o.club, rating: o.rating, title: `${this.L(ev.name)} · ${o.index + 1}/${ev.matches}` }); break; }
      case 'quick': { const c = CLUBS[Math.floor(Math.random() * CLUBS.length)]; this.show('prematch', { mode: 'quick', opponent: c.id, title: this.L('ui.quick') }); break; }
      case 'go': this.hide(); this.api.startMatch(this.current.params); break;
      case 'hub': this.show('hub', { id: arg }); break;
      case 'team-tab-go': this.teamTab = arg; this.show('team'); break;
      case 'sheet': this.playerSheet(st.player(arg)); break;
      case 'change-club': if (await this.confirm(this.L('mc.change_warn'))) { this.pickId = null; this.show('clubs'); } break;
      case 'tour-tab': this.tourTab = arg; this.render(); break;
      case 'tour-open': { const def = TOURNAMENTS.find((d) => d.id === arg); if (!st.tournamentState(def)) st.startTournament(def); this.show('tournament', { id: arg }); break; }
      case 'tour-play': { const def = TOURNAMENTS.find((d) => d.id === arg), nm = st.nextTournamentMatch(def); if (nm && nm.opponent) this.show('prematch', { mode: 'tournament', tournamentId: arg, opponent: nm.opponent, title: `${def.name} · ${this.tStage(def, st.tournamentState(def))}` }); break; }
      case 'tour-back': this.stack = [{ name: 'home', params: {} }, { name: 'tournaments', params: {} }]; this.show('tournament', { id: arg }, false); break;
      case 'tour-bye': { const def = TOURNAMENTS.find((d) => d.id === arg); st.playTournamentRound(def, 0, 0); st.save(); this.render(); break; }
      case 'club-tab': this.clubTab = arg; this.render(); break;
      case 'club-country': this.clubCountry = arg; this.render(); break;
      case 'club-pick': this.pickId = arg; this.showRef = false; this.api.haptic(10); this.render(); break;
      case 'club-ref': this.showRef = !this.showRef; this.render(); break;
      case 'club-with': this.startClub(st.draftFrom(this.pickId), 'with'); break;
      case 'club-version': this.openEditor(st.draftFrom(this.pickId), 'version'); break;
      case 'club-new': this.openEditor(st.draftFrom(null), 'new'); break;
      case 'edit-club': { const c = st.data.club; this.openEditor(JSON.parse(JSON.stringify({ name: c.name, short: c.short, city: c.city, country: c.country, color: c.color, color2: c.color2, color3: c.color3, logo: c.logo, kits: c.kits, ball: c.ball, pool: c.pool, baseClubId: c.baseClubId })), 'edit'); break; }
      case 'ed-tab': this.edTab = arg; this.render(); break;
      case 'ed-view': this.edView = arg; this.api.preview(this.draft, arg); this.render(); break;
      case 'ed-rot': this.api.rotateHero(+arg * 0.6); break;
      case 'ed-color': { const i = arg.lastIndexOf(':'); this.edField(arg.slice(0, i), +arg.slice(i + 1)); this.api.preview(this.draft, this.edView); this.render(); break; }
      case 'ed-set': { const i = arg.lastIndexOf(':'); this.edField(arg.slice(0, i), arg.slice(i + 1)); this.api.preview(this.draft, this.edView); this.render(); break; }
      case 'ed-validate': {
        const d = this.draft; d.name = d.name.trim(); if (!d.name || !d.short) { this.toast(this.L('ed.need_name')); return; }
        if (this.edMode === 'edit') { st.updateClub(d); this.api.preview(null); this.api.haptic([20, 40, 20]); this.home(); this.toast(this.L('ui.done')); }
        else this.startClub(d, this.edMode === 'new' ? 'version' : this.edMode);
        break;
      }
    }
  }
  renameClub(v) {
    const name = v.trim().slice(0, 18); if (!name) return;
    this.st.data.club.name = name;
    this.st.data.club.short = name.replace(/[^A-Za-zÀ-ÿ ]/g, '').split(/\s+/).filter(Boolean).map((w) => w[0]).join('').toUpperCase().padEnd(3, name.toUpperCase()).slice(0, 3);
    this.st.save();
  }

  // ------------------------------------------------------------------ overlays
  /**
   * Player sheet (progression): front card + back card (stat groups, height / weight, skills), STANDARD tab
   * with the 4 progression actions (form, physique, training, quality) and the tokens, ADVANCED tab with
   * every stat, career statistics underneath.
   */
  playerSheet(p, tab = 'std') {
    const st = this.st, c = st.data.currencies, q = p.quality || 0, ml = maxLevel(p), cost = st.upgradeCost(p);
    const G = (ks) => Math.round(ks.reduce((a, k) => a + p.stats[k], 0) / ks.length);
    const groups = [['VIT', G(['speed', 'accel'])], ['END', G(['stamina', 'physical'])], ['TIR', G(['shooting', 'power', 'accuracy'])],
      ['PAS', G(['passing', 'technique'])], ['DÉF', G(['defense', 'positioning'])], p.role === 'GOALKEEPER' ? ['GB', p.stats.goalkeeping] : ['INT', G(['intelligence', 'reaction'])]];
    const back = `<div class="pcard q-${QUALITIES[q]} back"><div class="pc-in"><div class="grp">${groups.map(([k, v]) => `<span><small>${k}</small><b>${v}</b></span>`).join('')}</div>
      <div class="hw"><span>${p.weight} kg</span><span>${p.height} cm</span></div>
      ${p.skills.map((sk) => `<div class="skill ${sk.level ? '' : 'off'}">${this.L('skill.' + sk.id)} · ${sk.level ? this.L('ui.lvl', sk.level) : '🔒'}</div>`).join('')}</div></div>`;
    const tile = (title, val, btn, act, on) => `<div class="act-tile"><b>${title}</b><div class="at-val">${val}</div>
      <button class="btn ${on ? 'play' : 'off'} small" data-sact="${act}">${btn}</button></div>`;
    const formBar = `<i class="gauge"><u style="width:${p.form}%;background:${p.form >= 70 ? '#4de683' : p.form >= 40 ? '#f2c81a' : '#e5533d'}"></u></i><small>${p.form} / 100</small>`;
    const std = `<div class="act-grid">
        ${tile(this.L('ui.form'), formBar, `${icon('medkit', 16)} +50 · ${c.medkits}`, 'heal', p.form < 100 && c.medkits > 0)}
        ${tile(this.L('ui.physique'), p.boost ? `<small class="on">${this.L('ui.boost_on')}</small>` : `<small>${this.L('ui.boost_desc')}</small>`, `${icon('bolt', 16)} 1 · ${c.energy}`, 'energize', !p.boost && c.energy > 0)}
        ${tile(this.L('ui.training'), `<i class="gauge"><u style="width:${(p.level / ml) * 100}%"></u></i><small>${this.L('ui.level')} ${p.level} / ${ml}</small>`,
          p.level >= ml ? this.L('ui.max_level') : `${icon('dumbbell', 16)} ${cost}`, 'train', p.level < ml && c.tp >= cost)}
        ${tile(this.L('ui.quality'), `<small>${this.L('rar.q.' + QUALITIES[q])}${q < 3 ? ' → ' + this.L('rar.q.' + QUALITIES[q + 1]) : ''}</small><small>${q < 3 ? (st.qualityReady(p) ? this.L('ui.quality_ready') : this.L('ui.quality_need', ml)) : this.L('ui.max_level')}</small>`,
          q < 3 ? `${icon('token' + q, 16)} 1 · ${c.tokens[q]}` : '—', 'quality', st.qualityReady(p) && c.tokens[q] > 0)}
      </div>
      <div class="train-max"><button class="btn ${p.level < ml && c.tp >= cost ? 'cyan' : 'off'} small" data-sact="trainmax">${this.L('ui.train_max')}</button></div>
      <div class="tokens">${QUALITIES.map((qq, i) => `<span>${icon('token' + i, 18)} ${c.tokens[i]}</span>`).join('')}</div>`;
    const adv = `<div class="sheet-stats">${STAT_KEYS.filter((k) => k !== 'goalkeeping' || p.role === 'GOALKEEPER').map((k) => `<div class="stat"><span>${this.L('stat.' + k)}</span><i><u style="width:${p.stats[k]}%"></u></i><b>${p.stats[k]}</b></div>`).join('')}</div>`;
    const cr = p.career, career = [['ui.c_matches', cr.matches], ['ui.c_wins', cr.wins], ['ui.c_draws', cr.draws], ['ui.c_goals', cr.goals], ['ui.c_assists', cr.assists],
      ['ui.c_shots', cr.shots], ['ui.c_steals', cr.steals], p.role === 'GOALKEEPER' ? ['ui.c_saves', cr.saves] : ['ui.c_passes', cr.passes]];
    const html = `<div class="psheet">
      <div class="ps-cards">${this.card(p, undefined, { act: 'noop' })}${back}
        <div class="ps-info"><b>${this.L('role.' + p.role)}</b><span>${this.L('ui.age')} ${new Date().getFullYear() - p.birthYear}</span><span>#${p.number}</span></div></div>
      <div class="ps-right"><div class="tabs small"><button class="${tab === 'std' ? 'on' : ''}" data-stab="std">${this.L('ui.standard')}</button><button class="${tab === 'adv' ? 'on' : ''}" data-stab="adv">${this.L('ui.advanced')}</button></div>
        ${tab === 'std' ? std : adv}</div>
      <div class="ps-career">${career.map(([k, v]) => `<span>${this.L(k)}<b>${v}</b></span>`).join('')}</div>
      <small class="src">${this.L('ui.source')}</small></div>`;
    const title = `<span>${esc(p.firstName)} ${esc(p.lastName)}</span><span class="ps-club">${flag(p.nationality)} ${esc(st.data.club.name)}</span>`;
    document.querySelector('.modal.sheet-modal')?.remove();
    // live 3D model on the left (main scene hero: idle treading, drag to turn), sheet on the right
    if (this.sheetPid !== p.id) { this.sheetPid = p.id; this.api.previewPlayer(p); }
    this.api.setHero(true); document.body.classList.add('sheet-open');
    const m = document.createElement('div'); m.className = 'modal sheet-modal sheet3d';
    m.innerHTML = `<div class="ps-3d" data-drag="hero3d"><span class="ed-badge">${icon('cap', 14)} 3D · ⟲ ⟳</span></div><div class="modal-box wide anim-pop"><h2 class="ps-title">${title}</h2><div class="modal-body">${html}</div><div class="modal-actions"><button class="btn" data-close>${this.L('ui.back')}</button></div></div>`;
    m.addEventListener('click', (e) => {
      if (e.target === m || e.target.closest('[data-close]')) { m.remove(); document.body.classList.remove('sheet-open'); this.sheetPid = null; this.api.preview(null); this.render(); return; }
      const t = e.target.closest('[data-stab]'); if (t) { this.playerSheet(p, t.dataset.stab); return; }
      const a = e.target.closest('[data-sact]'); if (!a) return;
      const fn = { heal: () => st.heal(p.id), energize: () => st.energize(p.id), train: () => st.upgrade(p.id), trainmax: () => st.upgradeMax(p.id) > 0, quality: () => st.upgradeQuality(p.id) }[a.dataset.sact];
      if (fn && fn()) { this.api.haptic(25); this.api.uiSound(); this.refreshHeader(); this.playerSheet(p, tab); } else this.toast(this.L('ui.not_enough'));
    });
    document.body.appendChild(m);
  }
  modal(title, html, buttons = []) {
    return new Promise((resolve) => {
      const m = document.createElement('div'); m.className = 'modal';
      m.innerHTML = `<div class="modal-box anim-pop"><h2>${title}</h2><div class="modal-body">${html}</div><div class="modal-actions">
        ${buttons.map(([label, fn], i) => `<button class="btn ${fn ? 'play' : 'off'}" data-i="${i}">${label}</button>`).join('')}
        <button class="btn" data-close>${this.L(buttons.length ? 'ui.cancel' : 'ui.ok')}</button></div></div>`;
      const close = (v) => { m.remove(); resolve(v); };
      m.addEventListener('click', (e) => {
        if (e.target === m || e.target.closest('[data-close]')) return close(false);
        const b = e.target.closest('[data-i]'); if (b) { const fn = buttons[+b.dataset.i][1]; if (fn) { const r = fn(); m.remove(); resolve(r); } }
      });
      document.body.appendChild(m);
    });
  }
  confirm(msg) { return this.modal(this.L('ui.confirm'), `<p>${esc(msg)}</p>`, [[this.L('ui.confirm'), () => true]]); }
  rewardPopup(r) { this.api.haptic([30, 40, 60]); this.api.rewardSound(); this.modal(this.L('ui.rewards'), `<div class="reward-pop">${this.reward(r).replace(/16"/g, '40"')}</div>`); }
  toast(msg) {
    const t = document.createElement('div'); t.className = 'ui-toast'; t.textContent = msg; document.body.appendChild(t);
    setTimeout(() => t.remove(), 1800);
  }
}
