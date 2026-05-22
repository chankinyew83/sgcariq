// Test version — confirms the function route works before adding API logic
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json({ value: 126236, label: '2026-05 Bid 2', _source: 'test' });
};
