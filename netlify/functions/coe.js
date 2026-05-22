// Netlify Function — fetches latest Cat B COE from data.gov.sg

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

exports.handler = async () => {
  const CORS = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

  try {
    const apiPath = `/v1/public/api/datasets/${DATASET_ID}`;

    // Step 1: Initiate download
    await request('POST', `${apiPath}/initiate-download`, JSON.stringify({ exportType: 'csv' }));

    // Step 2: Poll for URL
    const pollRaw = await request('GET', `${apiPath}/poll-download`);
    const poll = JSON.parse(pollRaw);
    const downloadUrl = poll?.data?.url || poll?.url;
    if (!downloadUrl) throw new Error(`No download URL. Poll: ${pollRaw.substring(0, 300)}`);

    // Step 3: Download CSV
    const csv = await fetchUrl(downloadUrl);
    const lines = csv.split('\n').filter(l => l.trim());
    if (lines.length < 2) throw new Error('CSV empty');

    // Step 4: Parse headers
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());

    // Step 5: Find last Category B row
    let catB = null;
    for (let i = lines.length - 1; i >= 1; i--) {
      const cols = lines[i].split(',').map(c => c.replace(/"/g, '').trim());
      const row = Object.fromEntries(headers.map((h, j) => [h, cols[j] || '']));
      const vc = (row.vehicle_class || row.vehicleclass || '').toLowerCase();
      if (vc.includes('category b') || vc === 'b') { catB = row; break; }
    }
    if (!catB) throw new Error(`No Cat B row. Headers: ${headers.join(', ')}`);

    // Step 6: Find the premium — it's the field with value > $50,000
    // (quota and bids are always in the hundreds; premium is always >$50k for Cat B)
    const EXCLUDE = ['bidding_no', 'bid_no'];
    const premiumKey = Object.keys(catB).find(k => {
      if (EXCLUDE.includes(k)) return false;
      const v = parseInt(catB[k]);
      return !isNaN(v) && v > 15000;
    });

    if (!premiumKey) throw new Error(
      `No premium found (>$50k) in row: ${JSON.stringify(catB)}`
    );

    const premium = parseInt(catB[premiumKey]);
    const month   = catB.month || catB.bidding_month || '';
    const bidNo   = catB.bidding_no || catB.bid_no || '';

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ value: premium, label: `${month} Bid ${bidNo}`.trim(), _source: 'data.gov.sg' })
    };

  } catch (e) {
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ _error: e.message }) };
  }
};
