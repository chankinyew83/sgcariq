// Vercel Serverless Function — api/coe.js
// Fetches latest Cat B COE premium from data.gov.sg
// KEY FIX: proper CSV parser handles "126,236" (comma inside quoted number)

const https = require('https');
const { URL } = require('url');

const DATASET_ID = 'd_69b3380ad7e51aff3a7dcc84eba52b8a';
const API_HOST   = 'api-open.data.gov.sg';

function post(path, body) {
  const data = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: API_HOST, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, (res) => {
      let r = ''; res.on('data', c => r += c); res.on('end', () => resolve(r));
    });
    req.on('error', reject); req.write(data); req.end();
  });
}

function get(path) {
  return new Promise((resolve, reject) => {
    https.get({ hostname: API_HOST, path }, (res) => {
      let r = ''; res.on('data', c => r += c); res.on('end', () => resolve(r));
    }).on('error', reject);
  });
}

function download(urlStr) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const mod = u.protocol === 'https:' ? https : require('http');
    mod.get({ hostname: u.hostname, path: u.pathname + u.search }, (res) => {
      if ([301,302,303].includes(res.statusCode))
        return download(res.headers.location).then(resolve).catch(reject);
      let r = ''; res.on('data', c => r += c); res.on('end', () => resolve(r));
    }).on('error', reject);
  });
}

// Proper CSV parser — handles quoted fields containing commas e.g. "126,236"
function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim());
  const parseLine = (line) => {
    const out = []; let cur = '', q = false;
    for (const ch of line) {
      if (ch === '"') { q = !q; }
      else if (ch === ',' && !q) { out.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    out.push(cur.trim());
    return out;
  };
  const headers = parseLine(lines[0]).map(h => h.toLowerCase());
  const rows = lines.slice(1).map(l => {
    const vals = parseLine(l);
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] || '']));
  });
  return { headers, rows };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  try {
    const base = `/v1/public/api/datasets/${DATASET_ID}`;

    // Step 1: initiate download
    await post(`${base}/initiate-download`, { exportType: 'csv' });

    // Step 2: poll for download URL
    const pollRaw = await get(`${base}/poll-download`);
    const poll = JSON.parse(pollRaw);
    const csvUrl = poll?.data?.url || poll?.url;
    if (!csvUrl) throw new Error('No CSV URL: ' + pollRaw.slice(0, 200));

    // Step 3: download and parse CSV
    const csv = await download(csvUrl);
    const { headers, rows } = parseCSV(csv);

    // Step 4: find latest Cat B row with valid premium > $15,000
    const SKIP = new Set(['bidding_no','bid_no','month','vehicle_class','vehicleclass']);
    const catB = rows.filter(r =>
      (r.vehicle_class || r.vehicleclass || '').toLowerCase().includes('category b')
    );
    if (!catB.length) throw new Error('No Cat B rows. Headers: ' + headers.join(', '));

    let premium = 0, col = '', row = null;
    for (let i = catB.length - 1; i >= 0; i--) {
      for (const [k, v] of Object.entries(catB[i])) {
        if (SKIP.has(k)) continue;
        const n = parseInt((v || '').replace(/[^0-9]/g, ''));
        if (n > 15000) { premium = n; col = k; row = catB[i]; break; }
      }
      if (premium) break;
    }

    if (!premium) throw new Error(
      'No premium >$15k. Last Cat B row: ' + JSON.stringify(catB[catB.length - 1])
    );

    res.json({
      value: premium,
      label: ((row.month || '') + ' Bid ' + (row.bidding_no || row.bid_no || '')).trim(),
      _col: col,
      _source: 'data.gov.sg'
    });

  } catch (err) {
    res.json({ _error: err.message });
  }
};
