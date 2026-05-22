// Netlify Function — fetches latest COE from LTA DataMall
// Uses Node's built-in https module — no packages needed, works on all Node versions

const https = require('https');

exports.handler = (event, context, callback) => {
  const key = process.env.LTA_ACCOUNT_KEY;

  const respond = (data) => callback(null, {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json'
    },
    body: typeof data === 'string' ? data : JSON.stringify(data)
  });

  if (!key) {
    return respond({ _error: 'LTA_ACCOUNT_KEY not set in Netlify environment variables' });
  }

  const req = https.request({
    hostname: 'datamall2.mytransport.sg',
    path: '/ltaodataservice/COEResult',
    method: 'GET',
    headers: {
      'AccountKey': key,
      'accept': 'application/json'
    }
  }, (res) => {
    let raw = '';
    res.on('data', chunk => raw += chunk);
    res.on('end', () => respond(raw));
  });

  req.on('error', (e) => respond({ _error: e.message }));
  req.end();
};
