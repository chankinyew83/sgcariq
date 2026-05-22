// Vercel API Route — /api/coe.js
// Fetches latest Cat B COE premium from data.gov.sg
// KEY FIX: proper CSV parser handles "126,236" (comma inside quoted number)

const https = require('https');
const DATASET_ID = 'd_69b3380ad7e51aff3a7dcc84eba52b8a';

function httpsRequest(method, hostname, path, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname, path, method,
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
    const u = new URL(url);
    https.get({ hostname: u.hostname, path: u.pathname + u.search, headers: { 'User-Agent': 'SGCarIQ/1.0' } }, (res) => {
      if ([301, 302, 303].includes(res.statusCode)) return fetchUrl(res.headers.location).then(resolve).catch(reject);
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => resolve(raw));
    }).on('error', reject);
  });
}

// Proper CSV parser — handles quoted fields containing commas (e.g. "126,236")
function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim());
  function parseLine(line) {
    const fields = [];
    let cur = '', inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { fields.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    fields.push(cur.trim());
    return fields;
  }
  const headers = parseLine(lines[0]).map(h => h.toLowerCase());
  return { headers, rows: lines.slice(1).map(l => {
    const cols = parseLine(l);
    return Object.fromEntries(headers.map((h, i) => [h, cols[i] || '']));
  })};
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  try {
    const apiPath = `/v1/public/api/datasets/${DATASET_ID}`;
    await httpsRequest('POST', 'api-open.data.gov.sg', `${apiPath}/initiate-download`,
      JSON.stringify({ exportType: 'csv' }));

    const pollRaw = await httpsRequest('GET', 'api-open.data.gov.sg', `${apiPath}/poll-download`);
    const poll = JSON.parse(pollRaw);
    const downloadUrl = poll?.data?.url || poll?.url;
    if (!downloadUrl) throw new Error(`No URL. Poll: ${pollRaw.substring(0, 200)}`);

    const csv = await fetchUrl(downloadUrl);
    const { headers, rows } = parseCSV(csv);

    // Find all Category B rows, most recent last
    const catBRows = rows.filter(r => {
      const vc = (r.vehicle_class || r.vehicleclass || '').toLowerCase();
      return vc.includes('category b') || vc === 'b';
    });
    if (!catBRows.length) throw new Error(`No Cat B rows. Headers: ${headers.join(', ')}`);

    // Find most recent row that has a valid COE premium (>$15,000)
    const EXCLUDE = new Set(['bidding_no', 'bid_no', 'month', 'vehicle_class', 'vehicleclass']);
    let premium = 0, premiumKey = '', bestRow = null;

    // Scan from most recent backwards
    for (let i = catBRows.length - 1; i >= 0; i--) {
      const row = catBRows[i];
      for (const [k, v] of Object.entries(row)) {
        if (EXCLUDE.has(k)) continue;
        // Strip all non-numeric chars (handles "126,236" → 126236)
        const n = parseInt((v || '').replace(/[^0-9]/g, ''));
        if (n > 15000) { premium = n; premiumKey = k; bestRow = row; break; }
      }
      if (premium) break;
    }

    if (!premium) throw new Error(
      `No premium > $15k found. Headers: ${headers.join(', ')} | Last Cat B: ${JSON.stringify(catBRows[catBRows.length-1])}`
    );

    const month  = bestRow.month || bestRow.bidding_month || '';
    const bidNo  = bestRow.bidding_no || bestRow.bid_no || '';

    res.json({ value: premium, label: `${month} Bid ${bidNo}`.trim(), _col: premiumKey, _source: 'data.gov.sg' });

  } catch (e) {
    res.json({ _error: e.message });
  }
};
