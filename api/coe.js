// Vercel API Route — api/coe.js
// Primary: LTA DataMall (fast, single request, uses LTA_ACCOUNT_KEY env var)
// Fallback: data.gov.sg (no key needed, 3-step but always available)

const https = require('https');
const { URL } = require('url');

function get(hostname, path, headers = {}) {
  return new Promise((resolve, reject) => {
    https.get({ hostname, path, headers: { 'User-Agent': 'SGCarIQ/1.0', ...headers } }, (res) => {
      let r = ''; res.on('data', c => r += c); res.on('end', () => resolve({ status: res.statusCode, body: r }));
    }).on('error', reject);
  });
}

function post(hostname, path, body) {
  const data = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), 'User-Agent': 'SGCarIQ/1.0' }
    }, (res) => {
      let r = ''; res.on('data', c => r += c); res.on('end', () => resolve({ status: res.statusCode, body: r }));
    });
    req.on('error', reject); req.write(data); req.end();
  });
}

function download(urlStr) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    https.get({ hostname: u.hostname, path: u.pathname + u.search }, (res) => {
      if ([301,302,303].includes(res.statusCode)) return download(res.headers.location).then(resolve).catch(reject);
      let r = ''; res.on('data', c => r += c); res.on('end', () => resolve(r));
    }).on('error', reject);
  });
}

function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim());
  const parseLine = (line) => {
    const out = []; let cur = '', q = false;
    for (const ch of line) {
      if (ch === '"') { q = !q; }
      else if (ch === ',' && !q) { out.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    out.push(cur.trim()); return out;
  };
  const headers = parseLine(lines[0]).map(h => h.toLowerCase());
  return { headers, rows: lines.slice(1).map(l => {
    const v = parseLine(l);
    return Object.fromEntries(headers.map((h, i) => [h, v[i] || '']));
  })};
}

// ── Tier 1: LTA DataMall ──────────────────────────────────────────
async function fromLTA(key) {
  const { status, body } = await get(
    'datamall2.mytransport.sg',
    '/ltaodataservice/COEResult',
    { AccountKey: key, Accept: 'application/json' }
  );
  if (status !== 200) throw new Error(`LTA HTTP ${status}: ${body.slice(0, 100)}`);
  const d = JSON.parse(body);
  const catB = (d.value || []).find(x => x.vehicle_class === 'Category B');
  if (!catB) throw new Error('No Category B in LTA response');
  return {
    value: +catB.premium,
    label: `${catB.month} Bid ${catB.bidding_no}`.trim()
  };
}

// ── Tier 2: data.gov.sg ───────────────────────────────────────────
const DATASET_ID = 'd_69b3380ad7e51aff3a7dcc84eba52b8a';
const API_HOST   = 'api-open.data.gov.sg';

async function fromGovSG() {
  const base = `/v1/public/api/datasets/${DATASET_ID}`;
  await post(API_HOST, `${base}/initiate-download`, { exportType: 'csv' });
  const poll = await get(API_HOST, `${base}/poll-download`);
  const csvUrl = JSON.parse(poll.body)?.data?.url || JSON.parse(poll.body)?.url;
  if (!csvUrl) throw new Error('No CSV URL from data.gov.sg');

  const csv = await download(csvUrl);
  const { rows } = parseCSV(csv);
  const SKIP = new Set(['bidding_no','bid_no','month','vehicle_class']);
  const catB = rows.filter(r => (r.vehicle_class || '').toLowerCase().includes('category b'));
  if (!catB.length) throw new Error('No Cat B rows in CSV');

  for (let i = catB.length - 1; i >= 0; i--) {
    for (const [k, v] of Object.entries(catB[i])) {
      if (SKIP.has(k)) continue;
      const n = parseInt((v || '').replace(/[^0-9]/g, ''));
      if (n > 15000) return {
        value: n,
        label: `${catB[i].month} Bid ${catB[i].bidding_no || ''}`.trim()
      };
    }
  }
  throw new Error('No premium >$15k in CSV. Last row: ' + JSON.stringify(catB[catB.length - 1]));
}

// ── Handler ───────────────────────────────────────────────────────
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const key = (process.env.LTA_ACCOUNT_KEY || '').trim();
  const errors = [];

  if (key) {
    try {
      const result = await fromLTA(key);
      return res.json({ ...result, _source: 'LTA DataMall' });
    } catch (e) {
      errors.push('LTA: ' + e.message);
    }
  }

  try {
    const result = await fromGovSG();
    return res.json({ ...result, _source: 'data.gov.sg' });
  } catch (e) {
    errors.push('GovSG: ' + e.message);
  }

  res.json({ _error: errors.join(' | ') });
};
