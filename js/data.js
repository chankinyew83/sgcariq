// ─────────────────────────────────────────
// data.js — application data
// Update this file when car prices, promos, or COE history change.
// All variables are intentionally global (no module scope).
// ─────────────────────────────────────────

// ── Scenario state — mutable, drives all calculations ──
const S = {
  coe: 126236, hold: 7, km: 15000,
  elec: 0.327, petrol: 2.50,
  insEv: 2200, insHyb: 2000,
  svcEv: 800, svcHyb: 1800,
  park: 2400
};

// ── COE bid history — updated by user via Market tab ──
let COE_HISTORY = {
  bids: [
    { label: "Jan 1 '26", value: 119100 },
    { label: "Jan 2 '26", value: 120500 },
    { label: "Feb 1 '26", value: 110890 },
    { label: "Feb 2 '26", value: 112000 },
    { label: "Mar 1 '26", value: 114002 },
    { label: "Mar 2 '26", value: 115568 },
    { label: "Apr 1 '26", value: 120001 },
    { label: "Apr 2 '26", value: 121001 },
    { label: "May 1 '26", value: 126236 },
  ],
  updated: '20 May 2026'
};

// ── Vehicle data ──
const CARS = [
  {
    id: 'tesla-yl', name: 'Tesla YL AWD ★', short: 'Tesla YL',
    seats: 7, type: 'BEV SUV', kw: 340, consumption: 14.6,
    list: 267999, b6: 267999, expo: 267999,
    roadTax: 5400, fuel: 'ev', arf: 50000, loanRate: 1.28, loanTenure: 7,
    notes: 'Preferred. Road tax $5,400/yr (340kW). Saver only — no Guaranteed Package. 1.28% financing expires 31 May.'
  },
  {
    id: 'tesla-ylr', name: 'Tesla Y LR RWD', short: 'Tesla Y LR',
    seats: 5, type: 'BEV SUV', kw: 220, consumption: 14.2,
    list: 239999, b6: 239999, expo: 239999,
    roadTax: 2206, fuel: 'ev', arf: 45000, loanRate: 1.28, loanTenure: 7,
    notes: 'Lower road tax $2,206/yr vs YL $5,400. Guaranteed Package at $242,999. 5-seater — does not meet 6-seat requirement. Watch for 7-seat option.'
  },
  {
    id: 'i9-std', name: 'IONIQ 9 2WD', short: 'IONIQ 9 2WD',
    seats: 7, type: 'BEV SUV', kw: 160, consumption: 20.6,
    list: 394499, b3: 311999, b6: 305999, expo: 294999,
    roadTax: 742, fuel: 'ev', arf: 50000, loanRate: 1.98, loanTenure: 5,
    notes: 'Best value entry. Confirm 6-BIDS batch availability.'
  },
  {
    id: 'i9-demo', name: 'IONIQ 9 Demo 6s', short: 'IONIQ 9 Demo',
    seats: 6, type: 'BEV SUV', kw: 160, consumption: 20.6,
    list: 394499, b6: 305999, expo: 299999,
    roadTax: 742, fuel: 'ev', arf: 50000, loanRate: 1.98, loanTenure: 5,
    notes: '6-seat config. Confirm availability and mileage: Ranee +65 9850 5206.'
  },
  {
    id: 'i9-cal', name: 'IONIQ 9 Cal 6s', short: 'IONIQ 9 Cal',
    seats: 6, type: 'BEV SUV', kw: 213, consumption: 20.6,
    list: 429499, b3: 346999, b6: 340999,
    roadTax: 742, fuel: 'ev', arf: 55000, loanRate: 1.98, loanTenure: 5,
    notes: 'Captain chairs AWD. +$41k premium over Demo.'
  },
  {
    id: 'santafe', name: 'Santa Fe Cal 6s', short: 'Santa Fe',
    seats: 6, type: 'Hybrid SUV', kw: 180, consumption: 6.0,
    list: 282999, b6: 282999, expo: 272999,
    roadTax: 1480, fuel: 'hybrid', arf: 35000, loanRate: 1.98, loanTenure: 5,
    notes: 'Indent basis — no stock. 1.6T hybrid.'
  },
  {
    id: 'carnival', name: 'Kia Carnival', short: 'Carnival',
    seats: 7, type: 'Hybrid MPV', kw: 180, consumption: 6.5,
    list: 295999, b6: 295999,
    roadTax: 1480, fuel: 'hybrid', arf: 35000, loanRate: 1.98, loanTenure: 5,
    notes: 'MPV format. Strong running cost profile.'
  },
];

// ── Promotions — add new entries here when dealers send promos ──
let PROMOS = [
  {
    id: 'tesla-sms-may26',
    source: 'Tesla Singapore — Pricelist May 2026',
    date: '22 May 2026',
    validUntil: '2026-06-04',
    interest: 1.28,
    prices: { 'tesla-yl': 267999 },
    perks: [{ l: '1yr road tax (incl.)', v: 5400 }],
    notes: 'Price valid till 4 Jun 2026. 1.28% financing (DBS/OCBC) expires 31 May. Guaranteed Package NOT available for YL AWD (saver only, 8 bids). Guaranteed Package available for Model Y LR RWD at $242,999 (road tax $2,206/yr). No penalty for full cash payment. $10k deposit refundable.',
    active: true
  },
  {
    id: 'expo-may26',
    source: 'Komoco — The Car Expo',
    date: '9–10 May 2026',
    validUntil: '2026-05-11',
    interest: 1.98,
    prices: { 'i9-std': 294999, 'i9-demo': 299999, 'santafe': 272999 },
    perks: [
      { l: 'Insurance credit', v: 300 },
      { l: 'Loan subsidy', v: 1288 },
      { l: '10yr servicing', v: 4000 },
      { l: '1yr road tax', v: 742 }
    ],
    notes: 'Expo expired. Demo unit may still be available at last-known price.',
    active: false
  },
];

// ── Score weights ──
const W = { financial: 0.28, roadtax: 0.22, timing: 0.18, family: 0.16, brand: 0.16 };
