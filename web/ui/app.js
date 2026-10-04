// WATER POLO 26 MOBILE — front-end screens (landscape only). Every value comes from GameState.
import { EVENTS, SHOP_ITEMS, CLUBS, POOLS, SLOT_ROLES, ROLE_ABBR, COUNTRIES, STAT_KEYS, overall, rarity, formatDuration, dayKey, QUALITIES, SKILLS, maxLevel, tradeValue, DAILY_GIFTS } from '../state.js';
import { TACTICS } from '../sim.js';
import { logoSvg, icon, trophySvg, LOGO_SHAPES, LOGO_SYMBOLS } from './art.js';

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
    root.addEventListener('input', (e) => { if (e.target.id === 'club-name') this.renameClub(e.target.value); });
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
  back() { const prev = this.stack.pop(); if (prev) { this.current = prev; this.render(); } else this.show('home', {}, false); }
  home() { this.stack = []; this.show('home', {}, false); }
  hide() { this.root.classList.add('hidden'); this.api.setHero(false); }
  render() {
    this.st.refreshDaily();
    const { name, params } = this.current;
    const body = this['scr_' + name](params);
    this.root.classList.remove('hidden');
    this.root.className = `app scr-${name}`;
    this.root.innerHTML = (name === 'results' || name === 'prematch' ? '' : this.header()) + `<main class="screen anim-in">${body}</main>`;
    this.api.setHero(name === 'home' || name === 'customize', name);
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
      <nav class="tiles-left">
        <button class="tile t-green" data-act="nav" data-arg="ranking">${icon('chart', 30)}<span>${this.L('ui.ranking')}</span></button>
        <button class="tile t-green" data-act="nav" data-arg="customize">${icon('cap', 30)}<span>${this.L('ui.customize')}</span></button>
        <button class="tile t-teal" data-act="nav" data-arg="objectives">${icon('list', 30)}<span>${this.L('ui.objectives')}</span>${this.badge(objDone)}</button>
        <button class="tile t-orange" data-act="nav" data-arg="rewards">${icon('gift', 30)}<span>${this.L('ui.free_rewards')}</span>${this.badge(st.giftAvailable() ? 1 : 0)}</button>
      </nav>
      <div class="hero-space" data-act="nav" data-arg="customize"></div>
      <section class="home-right">
        ${nm ? `<button class="match-card" data-act="prematch-league">
          <div class="mc-head"><b>${this.L('ui.league')}</b><small>${this.L('ui.season', nm.season)} · ${this.L('ui.match_n', nm.round, nm.rounds)}</small></div>
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
          <button class="tile wide t-magenta" data-act="nav" data-arg="events">${icon('trophy', 28)}<span>${this.L('ui.events')}</span>
            ${nextEv ? `<small>${this.timer(Date.now() + nextEv[1].remaining, nextEv[1].status === 'UPCOMING' ? 'ui.starts_in' : 'ui.ends_in')}</small>` : ''}${this.badge(evs.filter(([, s]) => s.status === 'CLAIMABLE').length)}</button>
          <button class="tile wide t-violet" data-act="nav" data-arg="shop">${icon('bag', 28)}<span>${this.L('ui.shop')}</span></button>
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
      <p class="sub">${POOLS[0].name} · ${this.L('ui.reward_win', p.mode === 'quick' ? 75 : 150)} ${icon('coin', 16)}</p>
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
    return `<div class="results ${hs > as ? 'win' : hs < as ? 'loss' : 'draw'}"><h1>${this.L(title)}</h1>
      <div class="res-score"><span>${esc(this.st.data.club.short)}</span><b>${hs} - ${as}</b><span>${esc(opponent)}</span></div>
      <div class="res-body"><div class="res-stats">${rows.map(([x, k, y]) => `<div class="sr"><b>${x}</b><span>${this.L(k)}</span><b>${y}</b></div>`).join('')}</div>
      <div class="res-rew"><div class="rw">${icon('coin', 30)}<b>+${s.coins}</b></div><div class="rw">${icon('star', 30)}<b>+${s.xp} ${this.L('ui.xp')}</b></div><div class="rw">${icon('dumbbell', 30)}<b>+${s.tp}</b></div>${s.medkits ? `<div class="rw">${icon('medkit', 30)}<b>+${s.medkits}</b></div>` : ''}
      ${notes.map((n) => `<p>${esc(n)}</p>`).join('')}</div></div>
      <button class="btn play big" data-act="home">${this.L('ui.continue')}</button></div>`;
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
      case 'prematch-league': { const nm = st.nextLeagueMatch(); if (nm) this.show('prematch', { mode: 'league', opponent: nm.opponent, title: `${this.L('ui.league')} · ${this.L('ui.match_n', nm.round, nm.rounds)}` }); break; }
      case 'prematch-event': { const ev = EVENTS.find((e) => e.id === arg), o = st.eventOpponent(ev); this.show('prematch', { mode: 'event', eventId: ev.id, opponent: o.club, rating: o.rating, title: `${this.L(ev.name)} · ${o.index + 1}/${ev.matches}` }); break; }
      case 'quick': { const c = CLUBS[Math.floor(Math.random() * CLUBS.length)]; this.show('prematch', { mode: 'quick', opponent: c.id, title: this.L('ui.quick') }); break; }
      case 'go': this.hide(); this.api.startMatch(this.current.params); break;
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
    const m = document.createElement('div'); m.className = 'modal sheet-modal';
    m.innerHTML = `<div class="modal-box wide anim-pop"><h2 class="ps-title">${title}</h2><div class="modal-body">${html}</div><div class="modal-actions"><button class="btn" data-close>${this.L('ui.back')}</button></div></div>`;
    m.addEventListener('click', (e) => {
      if (e.target === m || e.target.closest('[data-close]')) { m.remove(); this.render(); return; }
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
