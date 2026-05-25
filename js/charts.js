// ─────────────────────────────────────────
// charts.js — Chart.js rendering
// Depends on: data.js (COE_HISTORY, CARS, S), utils.js (fmtK), scoring.js (getTCO)
// ─────────────────────────────────────────

// Module-level chart instances — destroyed and recreated on each render
// to prevent Chart.js canvas reuse errors.
let tcoChart = null;
let coeChart  = null;

// Annual TCO bar chart — rendered in Ownership tab
function buildTCOChart() {
  if (tcoChart) { tcoChart.destroy(); tcoChart = null; }
  const ctx = document.getElementById('tco-chart')?.getContext('2d');
  if (!ctx) return;

  const rows = [...CARS]
    .map(c => ({ c, t: getTCO(c, S.hold) }))
    .sort((a, b) => a.t.annualCost - b.t.annualCost);

  tcoChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: rows.map(r => r.c.short),
      datasets: [{
        label: 'Annual TCO',
        data: rows.map(r => Math.round(r.t.annualCost)),
        backgroundColor: rows.map(r =>
          r.t.annualCost < 30000 ? 'rgba(92,158,122,.7)' :
          r.t.annualCost < 36000 ? 'rgba(184,136,74,.7)' :
                                   'rgba(184,96,96,.7)'
        ),
        borderRadius: 4,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#5C5C5A', font: { size: 10, family: 'Inter' } }, grid: { display: false }, border: { display: false } },
        y: { ticks: { color: '#5C5C5A', font: { size: 10, family: 'Inter' }, callback: v => '$' + Math.round(v / 1000) + 'k' }, grid: { color: '#2C2C2A' }, border: { display: false } }
      }
    }
  });

  const best = rows[0];
  const noteEl = document.getElementById('scenario-note');
  if (noteEl) noteEl.textContent =
    `Lowest: ${best.c.short} ${fmtK(best.t.annualCost)}/yr · ${S.hold}yr hold · COE $${(S.coe / 1000).toFixed(0)}k · ${(S.km / 1000).toFixed(0)}k km/yr`;
}

// COE trend line chart — rendered in Market tab
function buildCOE() {
  if (coeChart) { coeChart.destroy(); coeChart = null; }
  const ctx = document.getElementById('coe-chart')?.getContext('2d');
  if (!ctx) return;

  const bids    = COE_HISTORY.bids;
  const labels  = [...bids.map(b => b.label), 'Forecast'];
  const actuals = [...bids.map(b => b.value), null];
  const latest  = bids[bids.length - 1]?.value || S.coe;
  const forecast = bids.map((_, i) => i === bids.length - 1 ? latest : null)
                      .concat([Math.round(latest * 1.02)]);

  coeChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Cat B',
          data: actuals,
          borderColor: 'var(--color-primary)',
          backgroundColor: 'rgba(196,136,90,.1)',
          tension: 0.35,
          pointRadius: 4,
          pointBackgroundColor: 'var(--color-primary)',
          fill: true,
          borderWidth: 2
        },
        {
          label: 'Forecast',
          data: forecast,
          borderColor: 'var(--color-warning)',
          borderDash: [5, 4],
          backgroundColor: 'rgba(184,136,74,.05)',
          tension: 0.35,
          pointRadius: 3,
          fill: true,
          borderWidth: 1.5
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#5C5C5A', font: { size: 10, family: 'Inter' } } } },
      scales: {
        x: { ticks: { color: '#5C5C5A', font: { size: 9, family: 'Inter' } }, grid: { color: '#2C2C2A' }, border: { display: false } },
        y: { ticks: { color: '#5C5C5A', font: { size: 9, family: 'Inter' }, callback: v => '$' + Math.round(v / 1000) + 'k' }, grid: { color: '#2C2C2A' }, border: { display: false } }
      }
    }
  });
}
