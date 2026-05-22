// Netlify Function — fetches latest COE from LTA DataMall
// Uses Node's built-in https module — no packages needed

const https = require('https');

exports.handler = (event, context, callback) => {
  const key = (process.env.LTA_ACCOUNT_KEY || '').trim(); // trim any accidental spaces

  const respond = (data) => callback(null, {
    statusCode: 200,
    headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  if (!key) return respond({ _error: 'LTA_ACCOUNT_KEY not set in Netlify environment variables' });

  const req = https.request({
    hostname: 'datamall2.mytransport.sg',
    path: '/ltaodataservice/COEResult',
    method: 'GET',
    headers: {
      'AccountKey': key,
      'Accept': 'application/json'
    }
  }, (res) => {
    let raw = '';
    res.on('data', chunk => raw += chunk);
    res.on('end', () => {
      // Always return valid JSON — even if LTA sends plain text/HTML error
      try {
        respond(JSON.parse(raw));
      } catch(e) {
        // LTA returned plain text — surface it so we can see the actual message
        respond({ _error: `LTA said: ${raw.substring(0, 300)}`, _status: res.statusCode });
      }
    });
  });

  req.on('error', (e) => respond({ _error: e.message }));
  req.end();
};
