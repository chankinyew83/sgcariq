// ─────────────────────────────────────────
// deal.js — bridge loan calculator
// Depends on: utils.js (fmt)
// ─────────────────────────────────────────

function calcBridge() {
  // Update personal loan market heading with current month/year
  const lbl = document.getElementById('pl-market-label');
  if (lbl) lbl.textContent = 'Personal Loan Market — ' +
    new Date().toLocaleDateString('en-SG', { month: 'long', year: 'numeric' });

  const price = +document.getElementById('b-price')?.value  || 267999;
  const ltv   = +document.getElementById('b-ltv')?.value    || 60;
  const carR  = +document.getElementById('b-rate')?.value   || 1.28;
  const carT  = +document.getElementById('b-tenure')?.value || 7;
  const minP  = +document.getElementById('b-min')?.value    || 50;
  const inc   = +document.getElementById('b-incentives')?.value || 6330;
  const plR   = +document.getElementById('b-pl-rate')?.value   || 1.08;
  const plT   = +document.getElementById('b-pl-tenure')?.value || 3;

  const maxL   = price * (ltv / 100);
  const minL   = price * (minP / 100);
  const bridge = Math.max(0, maxL - minL);
  const down   = price - maxL;
  const baseI  = maxL * (carR / 100) * carT;
  const dealI  = minL * (carR / 100) * carT;
  const plI    = bridge * (plR / 100) * plT;
  const saving = baseI - (dealI + plI);
  const works  = bridge > 0 && (plR * plT) < (carR * carT);

  const el = document.getElementById('bridge-card');
  if (!el) return;

  el.innerHTML = `<div class="verdict ${works ? 'verdict-works' : 'verdict-fails'}">
    <h2 class="verdict-title">${!bridge ? '⚠ No Bridge Room' : works ? '✅ Bridge Viable' : '❌ Not Viable at These Rates'}</h2>
    <p class="u-sm u-dim mt-2">${
      !bridge
        ? 'Minimum loan equals MAS cap. Negotiate the floor downward.'
        : works
          ? `Dealer loan ${minP}% (${fmt(minL)}) preserves all incentives. Bridge ${fmt(bridge)} via PL at ${plR}%.`
          : `PL total (${plR}%×${plT}yr = ${(plR * plT).toFixed(2)}%) exceeds car loan (${carR}%×${carT}yr = ${(carR * carT).toFixed(2)}%). Do not bridge.`
    }</p>
    <div class="vt-grid">
      <div class="vt"><p class="vt-val" style="color:${saving > 0 ? 'var(--color-success)' : 'var(--color-danger)'}">${fmt(Math.abs(saving))}</p><p class="vt-lbl">${saving > 0 ? 'Saved' : 'Extra Cost'}</p></div>
      <div class="vt"><p class="vt-val">${fmt(bridge)}</p><p class="vt-lbl">Bridge</p></div>
      <div class="vt"><p class="vt-val">${fmt(down)}</p><p class="vt-lbl">Down Payment</p></div>
      <div class="vt"><p class="vt-val u-success">${fmt(inc)}</p><p class="vt-lbl">Incentives</p></div>
    </div>
    <div class="u-between u-xs u-dim mt-2 pt-3 gap-line u-wrap" style="gap:var(--sp-3)">
      <span>Baseline: ${fmt(maxL)} @ ${carR}%×${carT}yr = ${fmt(baseI)}</span>
      <span>With bridge: ${fmt(dealI + plI)} total interest</span>
    </div>
    <p class="u-xs u-muted mt-2">Dealer minimum floor is commercial policy, not MAS regulation — negotiable. Every 5% reduction adds ~${fmt(price * 0.05 * ((carR * carT - plR * plT) / 100))}.</p>
  </div>`;
}
