// ─────────────────────────────────────────
// app.js — application bootstrap
// Must be loaded last. Depends on all other modules.
// ─────────────────────────────────────────

async function init() {
  // Load saved COE history
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

  // Load user-added promos and merge in front of hardcoded ones
  try {
    const savedPromos = await Store.get('promos');
    if (savedPromos?.length) PROMOS = [...savedPromos, ...PROMOS];
  } catch(e) {
    console.warn('[SGCarIQ] Could not load saved promos:', e.message);
  }

  // Render initial view
  try {
    renderCommand();
  } catch(e) {
    console.error('[SGCarIQ] renderCommand() failed:', e);
  }

  generateIcon();
  labelTables();

  const updEl = document.getElementById('coe-updated');
  if (updEl) updEl.textContent = `Last updated: ${COE_HISTORY.updated} · Latest: ${fmt(S.coe)}`;
}

init();
