// Vercel API Route — fetches latest Cat B COE from data.gov.sg
// File location in repo: /api/coe.js

const https = require('https');
const DATASET_ID = 'd_69b3380ad7e51aff3a7dcc84eba52b8a';
const BASE = 'api-open.data.gov.sg';

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: BASE, path, method,
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'SGCarIQ/1.0' }
    };
    if (body) opts.headers['Content-Length'] = Buffer.byteLength(body);
    const req = https.request(opts, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => resolve(raw));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'SGCarIQ/1.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => resolve(raw));
    }).on('error', reject);
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  try {
    const apiPath = `/v1/public/api/datasets/${DATASET_ID}`;
    await request('POST', `${apiPath}/initiate-download`, JSON.stringify({ exportType: 'csv' }));
    const pollRaw = await request('GET', `${apiPath}/poll-download`);
    const poll = JSON.parse(pollRaw);
    const downloadUrl = poll?.data?.url || poll?.url;
    if (!downloadUrl) throw new Error(`No download URL. Poll: ${pollRaw.substring(0, 300)}`);

    const csv = await fetchUrl(downloadUrl);
    const lines = csv.split('\n').filter(l => l.trim());
    if (lines.length < 2) throw new Error('CSV empty');

    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());

    let catB = null;
    for (let i = lines.length - 1; i >= 1; i--) {
      const cols = lines[i].split(',').map(c => c.replace(/"/g, '').trim());
      const row = Object.fromEntries(headers.map((h, j) => [h, cols[j] || '']));
      const vc = (row.vehicle_class || row.vehicleclass || '').toLowerCase();
      if (vc.includes('category b') || vc === 'b') { catB = row; break; }
    }
    if (!catB) throw new Error(`No Cat B row. Headers: ${headers.join(', ')}`);

    const PREMIUM_KEYS = ['quota_premium', 'quotapremium', 'coe_premium', 'coepremium', 'premium_price'];
    let premium = 0, premiumKey = '';
    for (const k of PREMIUM_KEYS) {
      const v = parseInt((catB[k] || '').replace(/[^0-9]/g, ''));
      if (v > 15000) { premium = v; premiumKey = k; break; }
    }
    if (!premium) {
      const EXCLUDE = ['bidding_no', 'bid_no', 'month', 'vehicle_class'];
      for (const [k, v] of Object.entries(catB)) {
        if (EXCLUDE.includes(k)) continue;
        const n = parseInt((v || '').replace(/[^0-9]/g, ''));
        if (n > 15000) { premium = n; premiumKey = k; break; }
      }
    }
    if (!premium) throw new Error(`No COE premium found. Row: ${JSON.stringify(catB)}`);

    const month = catB.month || '';
    const bidNo = catB.bidding_no || catB.bid_no || '';
    res.json({ value: premium, label: `${month} Bid ${bidNo}`.trim(), _col: premiumKey });

  } catch (e) {
    res.json({ _error: e.message });
  }
};
