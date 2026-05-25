// ─────────────────────────────────────────
// market.js — Market tab, COE updates, promo management
// Depends on: data.js, utils.js, scoring.js, charts.js, storage.js
// ─────────────────────────────────────────

function renderMarket() {
  const nextBid    = getNextCOEBidDate();
  const dBid       = Math.max(0, Math.round((nextBid - new Date()) / 86400000));
  const teslaPromo = PROMOS.find(p => p.id.startsWith('tesla'));
  const teslaActive = teslaPromo && isActive(teslaPromo);
  const dT         = teslaPromo ? daysUntil(teslaPromo.validUntil) : -1;

  const mktSig = document.getElementById('mkt-signals');
  if (mktSig) mktSig.innerHTML = `
    <div class="sig"><p class="sig-val">${fmtK(S.coe)}</p><p class="sig-lbl">Cat B COE</p><p class="sig-trend">Updated ${COE_HISTORY.updated}</p></div>
    <div class="sig"><p class="sig-val">${dBid}d</p><p class="sig-lbl">Next Bid</p><p class="sig-trend">Results ${fmtDate(nextBid)}</p></div>
    <div class="sig"><p class="sig-val" style="color:${teslaActive ? 'var(--color-tesla)' : 'var(--text-2)'}">${teslaActive ? dT + 'd' : '—'}</p><p class="sig-lbl">${teslaActive ? 'Tesla Deal' : 'No Deal'}</p><p class="sig-trend">${teslaActive ? 'Exp ' + fmtDate(new Date(teslaPromo.validUntil)) : '—'}</p></div>`;

  buildCOE();
  buildPromos();

  // Populate price inputs for promo log form
  const pi = document.getElementById('price-inputs');
  if (pi) pi.innerHTML = '<div class="form-grid">' +
    CARS.map(c => `<div><label class="f-label">${c.short}</label><input type="number" id="cp-${c.id}" placeholder="Leave blank if not"></div>`).join('') +
    '</div>';
}

function buildPromos() {
  const today = new Date();
  const promoEl = document.getElementById('promo-list');
  if (!promoEl) return;

  promoEl.innerHTML = PROMOS.map(p => {
    const expired  = new Date(p.validUntil) < today;
    const dLeft    = Math.max(0, Math.round((new Date(p.validUntil) - today) / 86400000));
    const total    = (p.perks || []).reduce((s, pk) => s + (pk.v || 0), 0);
    const priceRows = Object.entries(p.prices).map(([cid, pr]) => {
      const car = CARS.find(c => c.id === cid);
      return car
        ? `<div class="u-between u-sm" style="padding:3px 0;border-bottom:1px solid var(--border)"><span>${car.short}</span><span class="u-mono">${fmt(pr)}</span><span class="u-mono u-success">→ ${fmt(pr - total)} net</span></div>`
        : '';
    }).join('');
    const cardClass = p.id.startsWith('tesla') && !expired ? 'promo-card tesla'
                    : expired ? 'promo-card' : 'promo-card active';

    return `<div class="${cardClass}">
      <div class="u-between u-wrap mb-3" style="gap:var(--sp-2)">
        <div><p class="u-md u-bold">${p.source}</p><p class="u-xs u-dim">${p.date} · ${p.interest}%</p></div>
        <div class="u-row" style="gap:var(--sp-1)">
          <span class="u-bold u-sm ${expired ? 'u-danger' : 'u-warning'}">${expired ? 'Expired' : dLeft + 'd left'}</span>
          <span class="chip ${expired ? 'chip-danger' : p.id.startsWith('tesla') ? 'chip-tesla' : 'chip-warning'}">${expired ? 'EXPIRED' : 'ACTIVE'}</span>
        </div>
      </div>
      <div class="u-stack-1 mb-2">${priceRows}</div>
      <p class="u-xs u-muted mt-2">${(p.perks || []).map(pk => pk.l + ' ' + fmt(pk.v)).join(' · ')}${total ? ' = ' + fmt(total) : ''}</p>
      ${p.notes ? `<p class="u-xs u-muted mt-1">${p.notes}</p>` : ''}
    </div>`;
  }).join('');
}

async function updateCOE() {
  const val = +document.getElementById('coe-new-val').value;
  const lbl = document.getElementById('coe-new-lbl').value.trim();

  if (!val || val < 80000 || val > 200000) {
    alert('Enter a valid Cat B COE premium between $80,000 and $200,000.');
    return;
  }

  const label = lbl || `Update ${new Date().toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: '2-digit' })}`;
  COE_HISTORY.bids.push({ label, value: val });
  COE_HISTORY.updated = new Date().toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' });
  S.coe = val;

  await Store.set('coe', COE_HISTORY);

  document.getElementById('coe-new-val').value = '';
  document.getElementById('coe-new-lbl').value = '';

  const slider = document.getElementById('s-coe');
  if (slider) {
    slider.value = val;
    document.getElementById('v-coe').textContent = '$' + val.toLocaleString();
  }

  refreshAll();

  const updEl = document.getElementById('coe-updated');
  if (updEl) updEl.textContent = `Last updated: ${COE_HISTORY.updated} · Latest: ${fmt(val)}`;
}

function addPerkRow() {
  const r = document.createElement('div');
  r.className = 'u-row';
  r.innerHTML = `<input placeholder="Perk description" class="pk-lbl" style="flex:2"><input type="number" placeholder="SGD value" class="pk-val" style="flex:1;margin-left:6px"><button onclick="this.parentElement.remove()" style="background:none;border:none;color:var(--text-3);cursor:pointer;font-size:14px;min-width:36px;min-height:44px">✕</button>`;
  document.getElementById('perk-rows').appendChild(r);
}

async function savePromo() {
  const source = document.getElementById('p-source').value.trim();
  if (!source) { alert('Source required.'); return; }

  const prices = {};
  CARS.forEach(c => {
    const v = document.getElementById('cp-' + c.id)?.value;
    if (v && +v > 0) prices[c.id] = +v;
  });
  if (!Object.keys(prices).length) { alert('Enter at least one quoted price.'); return; }

  const perks = [];
  document.querySelectorAll('#perk-rows .pk-lbl').forEach((el, i) => {
    const v = +document.querySelectorAll('#perk-rows .pk-val')[i]?.value;
    if (el.value && v) perks.push({ l: el.value, v });
  });

  PROMOS.unshift({
    id: 'p' + Date.now(),
    source,
    date: '',
    validUntil: document.getElementById('p-valid').value,
    interest: +document.getElementById('p-rate').value || null,
    prices,
    perks,
    notes: document.getElementById('p-notes').value,
    active: true
  });

  const userPromos = PROMOS.filter(p => !p.id.startsWith('tesla-') && !p.id.startsWith('expo-'));
  await Store.set('promos', userPromos);

  clearForm();
  buildPromos();
}

function clearForm() {
  ['p-source', 'p-valid', 'p-rate', 'p-notes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  CARS.forEach(c => {
    const el = document.getElementById('cp-' + c.id);
    if (el) el.value = '';
  });
  document.getElementById('perk-rows').innerHTML =
    `<div class="u-row"><input placeholder="Perk description" class="pk-lbl" style="flex:2"><input type="number" placeholder="SGD value" class="pk-val" style="flex:1;margin-left:6px"><button onclick="this.parentElement.remove()" style="background:none;border:none;color:var(--text-3);cursor:pointer;font-size:14px;min-width:36px;min-height:44px">✕</button></div>`;
}
