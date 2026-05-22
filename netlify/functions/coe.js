// Netlify Function — fetches latest Cat B COE from data.gov.sg
// LTA's real-time /COEResult endpoint is deprecated — data now on data.gov.sg
// Runs server-side so no CORS issues

const https = require('https');

const DATASET_ID = 'd_69b3380ad7e51aff3a7dcc84eba52b8a';

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'SGCarIQ/1.0' } }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => resolve(raw));
    }).on('error', reject);
  });
}

exports.handler = async () => {
  const CORS = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

  try {
    // Step 1: Get the download URL from data.gov.sg
    const pollRaw = await get(
      `https://api-production.data.gov.sg/v2/public/api/datasets/${DATASET_ID}/poll-download`
    );
    const poll = JSON.parse(pollRaw);
    const downloadUrl = poll.url || poll.data?.url;
    if (!downloadUrl) throw new Error(`No URL in poll response: ${pollRaw.substring(0, 200)}`);

    // Step 2: Download the CSV
    const csv = await get(downloadUrl);

    // Step 3: Parse CSV — find latest Cat B row
    const lines = csv.split('\n').filter(l => l.trim());
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
    const rows = lines.slice(1).map(line => {
      const cols = line.split(',').map(c => c.replace(/"/g, '').trim());
      return Object.fromEntries(headers.map((h, i) => [h, cols[i] || '']));
    });

    // Get the last Category B row (most recent)
    const catB = rows.filter(r =>
      (r.vehicle_class || r.vehicleclass || r['vehicle class'] || '').toLowerCase().includes('b')
    ).pop();

    if (!catB) throw new Error(`No Cat B found. Headers: ${headers.join(', ')}`);

    // Find the premium/price field
    const premium = catB.premium || catB.coe_premium || catB.price ||
                    catB[Object.keys(catB).find(k => k.includes('premium') || k.includes('price'))] || '0';
    const month   = catB.month || catB.bidding_month || '';
    const bidNo   = catB.bidding_no || catB.bidno || catB.bid_no || '';

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        value: parseInt(premium.replace(/[^0-9]/g, '')),
        label: `${month} Bid ${bidNo}`.trim(),
        _source: 'data.gov.sg'
      })
    };

  } catch (e) {
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ _error: e.message })
    };
  }
};
