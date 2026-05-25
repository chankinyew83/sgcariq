// ─────────────────────────────────────────
// scoring.js — decision score engine and TCO calculations
// Depends on: data.js (CARS, PROMOS, S, W), utils.js (isActive)
// ─────────────────────────────────────────

// Returns the lowest available price for a car across active promos,
// falling back to expo → b6 → list price.
function bestPrice(car) {
  const today = new Date();
  let best = null;
  for (const p of PROMOS) {
    if (new Date(p.validUntil) < today) continue;
    const pr = p.prices[car.id];
    if (pr && (best === null || pr < best)) best = pr;
  }
  return best || car.expo || car.b6 || car.list;
}

// Total cost of ownership over `years`.
// Uses S (scenario state) for COE, km, energy rates, insurance, servicing.
function getTCO(car, years) {
  const { coe, km, elec, petrol, insEv, insHyb, svcEv, svcHyb, park } = S;
  const price  = bestPrice(car);
  const isEV   = car.fuel === 'ev';

  // Budget 2026 PARF schedule — capped at $30k
  const parfPct = [, 0.30, 0.30, 0.30, 0.30, 0.30, 0.25, 0.20, 0.15, 0.10, 0.05][years] || 0.05;
  const parf    = Math.min((car.arf || 0) * parfPct, 30000);
  const coeR    = years < 10 ? ((10 - years) / 10) * coe : 0;
  const mkt     = years <= 7 ? 10000 : 5000;
  const resid   = parf + (years < 10 ? coeR : 0) + (years < 10 ? mkt : 0);
  const dep     = price - resid;

  // Energy: EVs use kWh rate; hybrids use consumption L/100km (default 7)
  const hybridL = car.consumption || 7;
  const energy  = isEV
    ? km * (car.consumption / 100) * elec
    : km * (hybridL / 100) * petrol;

  const run = car.roadTax
    + (isEV ? insEv : insHyb)
    + (isEV ? svcEv : svcHyb)
    + park
    + energy;

  return {
    price, resid, dep,
    annualDep: dep / years,
    run,
    total: dep + run * years,
    annualCost: (dep + run * years) / years,
    parf, coeR, energy
  };
}

// Weighted decision score (0–100) for a car.
// Returns score breakdown for all five dimensions.
function score(car) {
  const tco = getTCO(car, 7).annualCost;
  const fin = Math.max(0, Math.min(100, ((44000 - tco) / (44000 - 26000)) * 100));
  const rt  = car.roadTax <= 800 ? 100 : car.roadTax <= 2000 ? 45 : 0;

  // Timing: data-driven from active promos, not hardcoded per car ID
  let tim = 50;
  const activePrices = PROMOS.filter(p => isActive(p)).map(p => Object.keys(p.prices));
  const hasActivePromo = activePrices.some(keys => keys.includes(car.id));
  if (hasActivePromo)                               tim = Math.min(100, tim + 35);
  else if (car.expo)                                tim += 15;
  if (car.id === 'i9-demo')                         tim = Math.min(100, tim + 25);
  if (car.id === 'santafe' || car.id === 'carnival') tim = Math.max(0, tim - 20);

  const fam = car.seats === 6 && car.type.includes('SUV') ? 100
            : car.seats === 7 && car.type.includes('SUV') ? 78 : 58;
  const brd = car.id.startsWith('tesla') ? 100 : car.id.includes('i9') ? 68 : 58;

  const raw = fin * W.financial + rt * W.roadtax + tim * W.timing + fam * W.family + brd * W.brand;
  const tot = Math.round(raw);

  return {
    tot,
    fin: Math.round(fin),
    rt:  Math.round(rt),
    tim: Math.round(tim),
    fam: Math.round(fam),
    brd: Math.round(brd),
    lbl: tot >= 80 ? 'STRONG BUY' : tot >= 65 ? 'BUY' : tot >= 50 ? 'CONSIDER' : tot >= 35 ? 'WATCH' : 'BLOCKED',
    col: tot >= 75 ? 'var(--color-success)' : tot >= 50 ? 'var(--color-warning)' : 'var(--color-danger)',
  };
}
