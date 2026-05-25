// ─────────────────────────────────────────
// utils.js — pure formatting and date utilities
// No external dependencies. Safe to load first.
// ─────────────────────────────────────────

// Currency formatting
const fmt  = v => v == null ? '—' : '$' + Math.round(v).toLocaleString();
const fmtK = v => '$' + (v / 1000).toFixed(1) + 'k';

// Date formatting
function fmtDate(d) {
  return d.toLocaleDateString('en-SG', { day: 'numeric', month: 'short' });
}

// Days from now to a date string (negative = past)
function daysUntil(dateStr) {
  return Math.round((new Date(dateStr) - new Date()) / 86400000);
}

// Whether a promo is still active
function isActive(promo) {
  return promo && new Date(promo.validUntil) >= new Date();
}

// Actual current COE — always from bid history, never affected by the scenario slider
function getActualCOE() {
  return COE_HISTORY.bids[COE_HISTORY.bids.length - 1]?.value || S.coe;
}

function getNextCOEBidDate() {
  // COE bids every 2 weeks; reference: 20 May 2026
  const REF = new Date('2026-05-20');
  const now = new Date();
  let d = new Date(REF);
  while (d <= now) d = new Date(d.getTime() + 14 * 24 * 60 * 60 * 1000);
  return d;
}
