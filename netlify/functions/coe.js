// Netlify Function — fetches latest COE results from LTA DataMall
// Runs on Netlify's servers, so no CORS issues
// Your API key stays secret — never exposed in the browser

exports.handler = async () => {
  try {
    const response = await fetch(
      'https://datamall2.mytransport.sg/ltaodataservice/COEResult',
      { headers: { AccountKey: process.env.LTA_ACCOUNT_KEY } }
    );
    const data = await response.json();
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
