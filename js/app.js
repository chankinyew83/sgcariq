// ─────────────────────────────────────────
// app.js — application bootstrap
// Must be loaded last. Depends on all other modules.
// ─────────────────────────────────────────

// Phase 4: fetch live COE from Cloudflare Worker, silently update if newer
async function fetchCOEFromAPI() {
  try {
    const r = await fetch('/api/coe');
    if (!r.ok) return;
    const d = await r.json();
    if (!d.value || d._error) return;

    const current = getActualCOE();
    if (d.value === current) return; // already up to date

    // New data — append to history and persist
    const label = d.label || new Date().toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: '2-digit' });
    COE_HISTORY.bids.push({ label, value: d.value });
    COE_HISTORY.updated = new Date().toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' });
    S.coe = d.value;

    await Store.set('coe', COE_HISTORY);

    // Sync slider
    const sl = document.getElementById('s-coe');
    if (sl) { sl.value = d.value; const vEl = document.getElementById('v-coe'); if (vEl) vEl.textContent = '$' + d.value.toLocaleString(); }

    // Refresh signals and coe label without full re-render
    renderSignals();
    const updEl = document.getElementById('coe-updated');
    if (updEl) updEl.textContent = `Last updated: ${COE_HISTORY.updated} · Latest: ${fmt(d.value)}${d._cache === 'stale' ? ' (cached)' : ''}`;

    console.info('[SGCarIQ] COE auto-updated to', d.value, 'via', d._source || '/api/coe');
  } catch (e) {
    // Silent — localStorage fallback already applied
    console.warn('[SGCarIQ] /api/coe unavailable, using stored value:', e.message);
  }
}

async function init() {
  // Load saved COE history from localStorage
  try {
    const saved = await Store.get('coe');
    if (saved?.bids?.length) {
      COE_HISTORY = saved;
      S.coe = saved.bids[saved.bids.length - 1].value;
      const sl = document.getElementById('s-coe');
      if (sl) {
        sl.value = S.coe;
        document.getElementById('v-coe').textContent = '$' + S.coe.toLocaleString();
      }
    }
  } catch(e) {
    console.warn('[SGCarIQ] Could not load saved COE history:', e.message);
  }

  // Load user-added promos
  try {
    const savedPromos = await Store.get('promos');
    if (savedPromos?.length) PROMOS = [...savedPromos, ...PROMOS];
  } catch(e) {
    console.warn('[SGCarIQ] Could not load saved promos:', e.message);
  }

  // Render with stored data first (instant)
  try {
    renderCommand();
  } catch(e) {
    console.error('[SGCarIQ] renderCommand() failed:', e);
  }

  generateIcon();
  labelTables();

  const updEl = document.getElementById('coe-updated');
  if (updEl) updEl.textContent = `Last updated: ${COE_HISTORY.updated} · Latest: ${fmt(S.coe)}`;

  // Phase 4: then silently freshen from API (non-blocking)
  fetchCOEFromAPI();
}

init();
