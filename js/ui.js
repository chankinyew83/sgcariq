// ─────────────────────────────────────────
// ui.js — navigation, tab renders, DOM utilities
// Depends on: all other modules (loaded last before app.js)
// ─────────────────────────────────────────

// ── Navigation ──────────────────────────────────────────────────
const TABS = ['command', 'compare', 'own', 'market', 'deal', 'intel'];

// RENDERS is defined after all render functions exist
// (hoisting doesn't apply to const — declared at bottom of this file)
function nav(id) {
  document.querySelectorAll('.tab').forEach((t, i) => {
    const on = TABS[i] === id;
    t.classList.toggle('on', on);
    t.setAttribute('aria-selected', String(on));
  });
  document.querySelectorAll('.sec').forEach(s =>
    s.classList.toggle('on', s.id === 'sec-' + id)
  );
  RENDERS[id]?.();
  labelTables();
}

// ── Command tab ──────────────────────────────────────────────────
function renderCommand() {
  const ranked = CARS.map(c => ({ c, s: score(c) })).sort((a, b) => b.s.tot - a.s.tot);
  const { c: top, s } = ranked[0];
  const tco = getTCO(top, 7);

  const heroEl = document.getElementById('hero-card');
  if (heroEl) heroEl.innerHTML = `
    <div class="hero" role="region">
      <p class="hero-eyebrow">Current Best Available</p>
      <h1 class="hero-title">${top.name}</h1>
      <p class="u-sm u-dim mt-2">${fmt(bestPrice(top))} · ${top.seats}-seat · Road tax ${fmt(top.roadTax)}/yr</p>
      <div class="u-row u-wrap mt-2" style="gap:var(--sp-3)">
        <div style="flex:1;min-width:160px">
          <div class="u-between u-sm">
            <span class="u-bold" style="color:${s.col}">Score ${s.tot}/100</span>
            <span class="chip chip-success">${s.lbl}</span>
          </div>
          <div class="score-track mt-2"><div class="score-fill" style="width:${s.tot}%;background:${s.col}"></div></div>
        </div>
      </div>
      <p class="u-xs u-dim mt-3">Annual ownership ~${fmtK(tco.annualCost)} · Dep ~${fmtK(tco.annualDep)}/yr · Running ~${fmtK(tco.run)}/yr</p>
      <div class="u-row u-wrap mt-4" style="gap:var(--sp-2)">
        <a class="btn btn-primary" href="tel:+6598505206">📞 Call Ranee</a>
        <button class="btn btn-ghost" onclick="nav('compare')">Compare All →</button>
      </div>
    </div>`;

  // Brand subtitle — current month/year
  const brandSub = document.querySelector('.brand-sub');
  if (brandSub) brandSub.textContent =
    'Singapore Car Intelligence · ' + new Date().toLocaleDateString('en-SG', { month: 'short', year: 'numeric' });

  // Tesla alert — only show if promo still active
  const teslaPromo  = PROMOS.find(p => p.id.startsWith('tesla'));
  const teslaActive = teslaPromo && isActive(teslaPromo);
  const dTesla      = teslaPromo ? daysUntil(teslaPromo.validUntil) : -1;
  const alertWrap   = document.getElementById('tesla-alert-wrap');
  if (alertWrap) {
    alertWrap.innerHTML = teslaActive ? `
      <div class="card card-urgent mb-3">
        <div class="u-between u-wrap" style="gap:var(--sp-2);margin-bottom:var(--sp-2)">
          <div class="u-row"><span class="chip chip-tesla">★ Tesla</span><span class="chip chip-warning">${dTesla <= 0 ? 'TODAY' : dTesla + ' DAY' + (dTesla === 1 ? '' : 'S') + ' LEFT'}</span></div>
          <span class="u-xs u-dim">Expires ${fmtDate(new Date(teslaPromo.validUntil))}</span>
        </div>
        <p class="u-sm u-bold mb-2">Tesla Car Expo Deal — Guaranteed COE Package</p>
        <div class="u-grid-2 mb-2" style="gap:var(--sp-2)">
          <div class="card-inset"><p class="u-xs u-muted u-upper mb-2">Rate</p><p class="u-mono u-heavy u-tesla" style="font-size:var(--t-lg)">${teslaPromo.interest}%</p><p class="u-xs u-dim">≥$8k loan savings vs market rate.</p></div>
          <div class="card-inset"><p class="u-xs u-muted u-upper mb-2">EV Rebate</p><p class="u-mono u-heavy u-warning" style="font-size:var(--t-lg)">$30k</p><p class="u-xs u-dim">VES rebate in price. Lost if VES bands change in next Budget.</p></div>
        </div>
        <div class="u-row u-wrap" style="gap:var(--sp-2)">
          <a class="btn btn-tesla" href="tel:+6591841638">📞 Tesla +65 9184 1638</a>
          <button class="btn btn-ghost u-xs" onclick="nav('market')">View Promotion →</button>
        </div>
      </div>` : '';
  }

  // Signals
  renderSignals();

  // Header badges
  const nextBid = getNextCOEBidDate();
  const dBid    = Math.max(0, Math.round((nextBid - new Date()) / 86400000));
  const badgesEl = document.getElementById('hdr-badges');
  if (badgesEl) badgesEl.innerHTML =
    `<span class="u-xs u-muted">Cat B COE ${fmt(getActualCOE())} · Next bid ${fmtDate(nextBid)}${teslaActive ? ' · Tesla deal ' + dTesla + 'd' : ''}</span>`;

  // Actions
  const actions = [];
  if (teslaActive) {
    actions.push({ icon: '⚡', title: `Call Tesla — deal expires ${fmtDate(new Date(teslaPromo.validUntil))} (+65 9184 1638)`, body: 'Guaranteed COE back. 1.28% rate confirmed. $30k VES rebate already in price — risk is rebate reduces in next Budget if you delay. Limited units.', urgent: true });
  }
  actions.push({ icon: '📞', title: 'Confirm IONIQ 9 Demo 6s availability — Ranee +65 9850 5206', body: 'Current top-ranked option for 6-seat BEV. Confirm mileage and that last-known price still holds before the next COE round.', urgent: true });

  const scbExpiry = '2026-06-30';
  if (daysUntil(scbExpiry) > 0) {
    actions.push({ icon: '🏦', title: `Apply SCB CashOne personal loan — 3% cashback expires ${fmtDate(new Date(scbExpiry))}`, body: '1.08% flat + new-client cashback via SingSaver. Get in-principle approval now; draw down only at S&P signing.', urgent: daysUntil(scbExpiry) <= 14 });
  }
  if (dBid <= 5) {
    actions.push({ icon: '⏰', title: `COE bid closes in ${dBid} day${dBid === 1 ? '' : 's'} — results ${fmtDate(nextBid)}`, body: 'Rising trend. Each round at current trajectory adds ~$2,600 to the purchase cost. Act before this round if you can.', urgent: dBid <= 2 });
  }
  actions.push({ icon: '🔭', title: 'Monitor for Tesla Model Y RWD — insideevs.com', body: 'A ≤230kW variant drops road tax to $742/yr, changing the recommendation entirely. SG follows global launches ~12 months later.', urgent: false });

  const actionsEl = document.getElementById('actions');
  if (actionsEl) actionsEl.innerHTML = actions.map(a =>
    `<div class="action ${a.urgent ? 'action-urgent' : ''}">
      <div class="action-icon">${a.icon}</div>
      <div><p class="action-title">${a.title}</p><p class="action-body">${a.body}</p></div>
    </div>`).join('');
}

// ── Signals (shared between command and market) ─────────────────
function renderSignals() {
  const el = document.getElementById('signals');
  if (!el) return;
  const actualCOE = getActualCOE();
  const nextBid     = getNextCOEBidDate();
  const dBid        = Math.max(0, Math.round((nextBid - new Date()) / 86400000));
  const teslaPromo  = PROMOS.find(p => p.id.startsWith('tesla'));
  const teslaActive = teslaPromo && isActive(teslaPromo);
  const dT          = teslaPromo ? daysUntil(teslaPromo.validUntil) : -1;
  el.innerHTML = `
    <div class="sig"><p class="sig-val">${fmtK(actualCOE)}</p><p class="sig-lbl">Cat B COE</p><p class="sig-trend">Updated ${COE_HISTORY.updated}</p></div>
    <div class="sig"><p class="sig-val">${dBid}d</p><p class="sig-lbl">Next Bid</p><p class="sig-trend">Results ${fmtDate(nextBid)}</p></div>
    <div class="sig"><p class="sig-val" style="color:${teslaActive ? 'var(--color-tesla)' : 'var(--text-2)'}">${teslaActive ? dT + 'd' : '\u2014'}</p><p class="sig-lbl">${teslaActive ? 'Tesla Deal' : 'No Deal'}</p><p class="sig-trend">${teslaActive ? 'Exp ' + fmtDate(new Date(teslaPromo.validUntil)) : '\u2014'}</p></div>`;
}

// Re-renders active tab; skips redundant signal render on Command
function refreshAll() {
  const active = document.querySelector('.sec.on')?.id?.replace('sec-', '');
  if (active) RENDERS[active]?.();
  if (active && active !== 'command') {
    const sigEl = document.getElementById('signals');
    if (sigEl) renderSignals();
  }
}

// ── Compare tab ──────────────────────────────────────────────────
function renderCompare() {
  const ranked = CARS.map(c => ({ c, s: score(c) })).sort((a, b) => b.s.tot - a.s.tot);
  const lbEl = document.getElementById('leaderboard');
  if (lbEl) lbEl.innerHTML = ranked.map((r, i) => {
    const { c, s } = r;
    const t = getTCO(c, 7);
    const dims = [
      { l: 'Financial', v: s.fin, col: 'var(--color-primary-lt)' },
      { l: 'Road Tax',  v: s.rt,  col: s.rt >= 80 ? 'var(--color-success)' : s.rt >= 40 ? 'var(--color-warning)' : 'var(--color-danger)' },
      { l: 'Timing',   v: s.tim, col: 'var(--color-primary-lt)' },
      { l: 'Family',   v: s.fam, col: 'var(--color-primary-lt)' },
      { l: 'Brand',    v: s.brd, col: 'var(--color-warning)' }
    ];
    return `<div class="lb" id="lb-${c.id}" onclick="toggleLb('${c.id}')" role="button" aria-expanded="false">
      <div class="lb-row">
        <div class="lb-rank u-muted u-bold">${i + 1}</div>
        <div style="flex:1;min-width:0">
          <p class="lb-name">${c.name}</p>
          <p class="lb-sub">${c.seats}s · ${c.type} · ${fmt(c.roadTax)}/yr</p>
        </div>
        <div style="flex:0 0 72px;text-align:right">
          <p class="lb-score" style="color:${s.col}">${s.tot}</p>
          <div class="lb-bar"><div class="lb-bar-fill" style="width:${s.tot}%;background:${s.col}"></div></div>
          <p class="lb-lbl" style="color:${s.col}">${s.lbl}</p>
        </div>
      </div>
      <div class="lb-detail">
        <div class="u-stack-2 mb-3">
          ${dims.map(d => `<div class="u-row" style="gap:8px"><span class="u-xs u-dim" style="width:66px;flex:0 0 66px">${d.l}</span><div class="cost-track" style="height:3px"><div class="cost-fill" style="width:${d.v}%;background:${d.col}"></div></div><span class="u-xs u-mono u-bold" style="width:22px;text-align:right">${d.v}</span></div>`).join('')}
        </div>
        <div class="u-grid-2" style="gap:4px">
          <div class="u-between" style="padding:4px 0;border-bottom:1px solid var(--border)"><span class="u-xs u-dim">Buy price</span><span class="u-mono u-bold u-xs">${fmt(c.expo || c.b6 || c.list)}</span></div>
          <div class="u-between" style="padding:4px 0;border-bottom:1px solid var(--border)"><span class="u-xs u-dim">Annual TCO</span><span class="u-mono u-bold u-xs">${fmtK(t.annualCost)}</span></div>
          <div class="u-between" style="padding:4px 0;border-bottom:1px solid var(--border)"><span class="u-xs u-dim">Annual dep</span><span class="u-mono u-xs">${fmtK(t.annualDep)}</span></div>
          <div class="u-between" style="padding:4px 0;border-bottom:1px solid var(--border)"><span class="u-xs u-dim">Running/yr</span><span class="u-mono u-xs">${fmtK(t.run)}</span></div>
          <div class="u-between" style="padding:4px 0"><span class="u-xs u-dim">Road tax</span><span class="u-mono u-xs ${c.roadTax > 2000 ? 'u-danger' : ''}">${fmt(c.roadTax)}</span></div>
          <div class="u-between" style="padding:4px 0"><span class="u-xs u-dim">Residual 7yr</span><span class="u-mono u-xs">${fmtK(t.resid)}</span></div>
        </div>
        <p class="u-xs u-dim mt-2 u-lh">${c.notes}</p>
      </div>
    </div>`;
  }).join('');

  const sorted = [...CARS].map(c => ({ c, t: getTCO(c, 7) })).sort((a, b) => a.t.annualCost - b.t.annualCost);
  const maxC   = Math.max(...sorted.map(r => r.t.annualCost));
  const cbEl   = document.getElementById('cost-bars');
  if (cbEl) cbEl.innerHTML = sorted.map(r => {
    const col = r.t.annualCost < 30000 ? 'var(--color-success)' : r.t.annualCost < 36000 ? 'var(--color-warning)' : 'var(--color-danger)';
    return `<div class="cost-row"><span class="cost-name">${r.c.short}</span><div class="cost-track"><div class="cost-fill" style="width:${(r.t.annualCost / maxC) * 100}%;background:${col}"></div></div><span class="cost-val" style="color:${col}">${fmtK(r.t.annualCost)}</span></div>`;
  }).join('');
}

function toggleLb(id) {
  const el   = document.getElementById('lb-' + id);
  const open = !el.classList.contains('open');
  document.querySelectorAll('.lb.open').forEach(e => { e.classList.remove('open'); e.setAttribute('aria-expanded', 'false'); });
  if (open) { el.classList.add('open'); el.setAttribute('aria-expanded', 'true'); }
}

// ── Ownership tab ────────────────────────────────────────────────
function renderOwn() { onScenario(); renderDepTable(); }

function onScenario() {
  S.coe  = +document.getElementById('s-coe').value;
  S.hold = +document.getElementById('s-hold').value;
  S.km   = +document.getElementById('s-km').value;
  document.getElementById('v-coe').textContent  = '$' + S.coe.toLocaleString();
  document.getElementById('v-hold').textContent = S.hold + ' years';
  document.getElementById('v-km').textContent   = S.km.toLocaleString();
  buildTCOChart();
  buildBreakdown();
}

function buildBreakdown() {
  const best = [...CARS].map(c => ({ c, t: getTCO(c, S.hold) })).sort((a, b) => a.t.annualCost - b.t.annualCost)[0];
  const lbEl = document.getElementById('own-label');
  if (lbEl) lbEl.textContent = best.c.name;
  const t = best.t;
  const rows = [
    ['Purchase price',          fmt(t.price),      ''],
    ['Residual value (' + S.hold + 'yr)', fmt(t.resid), 'u-success'],
    ['Total depreciation',       fmt(t.dep),        ''],
    ['Annual depreciation',      fmtK(t.annualDep), ''],
    ['Annual running costs',     fmtK(t.run),       '']
  ];
  const bdEl = document.getElementById('own-breakdown');
  if (bdEl) bdEl.innerHTML = `<div class="u-stack-1">${rows.map(([l, v, c]) =>
    `<div class="u-between" style="padding:7px 0;border-bottom:1px solid var(--border)"><span class="u-sm">${l}</span><span class="u-mono u-bold u-sm ${c}">${v}</span></div>`
  ).join('')}<div class="u-between" style="padding:9px 0"><span class="u-md u-bold">Annual ownership</span><span class="u-mono u-heavy u-md u-success">${fmtK(t.annualCost)}</span></div></div>`;
}

function renderDepTable() {
  const car   = CARS.find(c => c.id === 'tesla-yl');
  const price = car ? bestPrice(car) : 267999;
  const arf   = car?.arf || 50000;
  const coe   = getActualCOE();
  const lbl   = document.getElementById('dep-table-label');
  if (lbl) lbl.textContent = `Depreciation — ${car?.name || 'Tesla YL'} ${fmt(price)}`;

  // Scrap PARF: what the car gets at year 10 deregistration (5% of ARF, capped $30k)
  const scrapParf = Math.min(arf * 0.05, 30000);

  const pcts  = [, 0.30, 0.30, 0.30, 0.30, 0.30, 0.25, 0.20, 0.15, 0.10, 0.05];
  const dtEl  = document.getElementById('dep-table');
  if (!dtEl) return;

  dtEl.innerHTML = [1,2,3,4,5,6,7,8,9,10].map((yr, i) => {
    const p     = pcts[yr];
    const parf  = Math.min(arf * p, 30000);
    const coeR  = yr < 10 ? ((10 - yr) / 10) * coe : 0;
    const mkt   = yr <= 7 ? 10000 : 5000;
    const resid = parf + (yr < 10 ? coeR : 0) + (yr < 10 ? mkt : 0);

    // sgCarmart convention: (Market value − Scrap PARF) / Remaining COE years
    // This is the annual dep a buyer would see when you list this car for sale.
    const remaining = 10 - yr;
    const dep = remaining > 0 ? (resid - scrapParf) / remaining : null;

    const col = dep === null ? 'var(--text-3)'
              : dep < 20000 ? 'var(--color-success)'
              : dep < 28000 ? 'var(--color-warning)'
              : 'var(--color-danger)';

    return `<tr class="${yr === 7 ? 'tr-accent' : ''} ${i >= 4 ? 'tr-hide' : ''}">
      <td data-label="Hold">${yr}yr${yr === 7 ? ' ⭐' : ''}</td>
      <td data-label="PARF %">${(p * 100).toFixed(0)}%</td>
      <td class="right u-mono u-success" data-label="PARF">${fmt(parf)}</td>
      <td class="right u-mono" data-label="COE Val">${coeR > 0 ? fmt(coeR) : '—'}</td>
      <td class="right u-mono u-bold" data-label="Residual">${fmt(resid)}</td>
      <td class="right u-mono u-bold" data-label="Annual Dep" style="color:${col}">${dep !== null ? fmtK(dep) : '—'}</td>
    </tr>`;
  }).join('');
}

function toggleRows(btn) {
  const hidden = [...document.querySelectorAll('#dep-table .tr-hide')];
  const open   = hidden.length > 0;
  hidden.forEach(r => { r.classList.remove('tr-hide'); r.classList.add('tr-shown'); });
  if (!open) document.querySelectorAll('#dep-table .tr-shown').forEach(r => { r.classList.add('tr-hide'); r.classList.remove('tr-shown'); });
  btn.textContent = open ? '▴ Show less' : '▾ Show all 10 years';
}

// ── Expand / progressive disclosure ─────────────────────────────
function toggleExpand(id, btn) {
  const el   = document.getElementById(id);
  const open = !el.classList.contains('open');
  el.classList.toggle('open', open);
  btn.classList.toggle('open', open);
  btn.setAttribute('aria-expanded', String(open));
}

// ── Mobile table labels ──────────────────────────────────────────
function labelTables() {
  if (window.innerWidth > 640) return;
  document.querySelectorAll('.overflow-x table').forEach(tbl => {
    const ths = [...tbl.querySelectorAll('thead th')].map(t => t.textContent.trim().slice(0, 13));
    if (!ths.length) return;
    tbl.querySelectorAll('tbody tr').forEach(row =>
      [...row.querySelectorAll('td')].forEach((td, i) => { if (ths[i]) td.setAttribute('data-label', ths[i]); })
    );
    const rows = [...tbl.querySelectorAll('tbody tr')];
    if (rows.length >= 5) rows.slice(4).forEach(r => r.classList.add('tr-hide'));
  });
}

// ── Home screen icon (PWA) ───────────────────────────────────────
function generateIcon() {
  const c = document.createElement('canvas'); c.width = c.height = 180;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(90, 90, 20, 90, 90, 130);
  g.addColorStop(0, '#1E1E1C'); g.addColorStop(1, '#0F0F0E');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 180, 180);
  ctx.strokeStyle = 'rgba(196,136,90,.35)'; ctx.lineWidth = 4; ctx.strokeRect(8, 8, 164, 164);
  ctx.fillStyle = '#C4885A';
  ctx.beginPath(); ctx.moveTo(20, 30); ctx.lineTo(160, 30); ctx.lineTo(160, 52);
  ctx.quadraticCurveTo(130, 52, 108, 76); ctx.quadraticCurveTo(96, 64, 90, 62);
  ctx.quadraticCurveTo(84, 64, 72, 76); ctx.quadraticCurveTo(50, 52, 20, 52); ctx.closePath(); ctx.fill();
  ctx.fillRect(80, 62, 20, 90);
  ctx.fillStyle = '#EDEDEA'; ctx.font = '700 18px Inter,Arial,sans-serif'; ctx.textAlign = 'center'; ctx.fillText('SG CAR IQ', 90, 175);
  const link = document.getElementById('apple-icon'); if (link) link.href = c.toDataURL('image/png');
}

// ── Render registry — defined after all render functions ─────────
const RENDERS = {
  command: renderCommand,
  compare: renderCompare,
  own:     renderOwn,
  market:  renderMarket,
  deal:    calcBridge,
  intel:   () => {},
};
