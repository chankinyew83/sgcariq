// Netlify Function — fetches latest Cat B COE from data.gov.sg
// Correct flow: POST initiate-download → GET poll-download → fetch CSV

const https = require('https');

const DATASET_ID = 'd_69b3380ad7e51aff3a7dcc84eba52b8a';
const BASE = 'api-open.data.gov.sg';

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: BASE,
      path,
      method,
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
      // Follow redirect if needed
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

    // Step 1: Initiate download (required for CSV datasets)
    await request('POST', `${apiPath}/initiate-download`, JSON.stringify({ exportType: 'csv' }));

    // Step 2: Poll for the download URL
    const pollRaw = await request('GET', `${apiPath}/poll-download`);
    const poll = JSON.parse(pollRaw);

    // The URL may be nested: poll.data.url or poll.url
    const downloadUrl = poll?.data?.url || poll?.url;
    if (!downloadUrl) throw new Error(`No download URL. Poll: ${pollRaw.substring(0, 300)}`);

    // Step 3: Download and parse the CSV
    const csv = await fetchUrl(downloadUrl);
    const lines = csv.split('\n').filter(l => l.trim());
    if (lines.length < 2) throw new Error('CSV too short: ' + csv.substring(0, 200));

    // Parse headers
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());

    // Find the last Category B row (most recent)
    let latestCatB = null;
    for (let i = lines.length - 1; i >= 1; i--) {
      const cols = lines[i].split(',').map(c => c.replace(/"/g, '').trim());
      const row = Object.fromEntries(headers.map((h, j) => [h, cols[j] || '']));
      const vc = (row.vehicle_class || row.vehicleclass || '').toLowerCase();
      if (vc.includes('category b') || vc === 'b') {
        latestCatB = row;
        break;
      }
    }

    if (!latestCatB) throw new Error(`No Cat B row found. Headers: ${headers.join(', ')}. Last line: ${lines[lines.length-1]}`);

    const premium = +(latestCatB.premium || latestCatB.coe_premium || 0);
    const month   = latestCatB.month || latestCatB.bidding_month || '';
    const bidNo   = latestCatB.bidding_no || latestCatB.bid_no || '';

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ value: premium, label: `${month} Bid ${bidNo}`.trim(), _source: 'data.gov.sg' })
    };

  } catch (e) {
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ _error: e.message }) };
  }
};
