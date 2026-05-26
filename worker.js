// SGCarIQ — Cloudflare Worker (self-contained)
// Routes /api/coe, serves static assets for everything else

const DATASET_ID = 'd_69b3380ad7e51aff3a7dcc84eba52b8a';

function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim());
  const parseLine = line => {
    const out = []; let cur = '', q = false;
    for (const ch of line) {
      if (ch === '"') { q = !q; }
      else if (ch === ',' && !q) { out.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    out.push(cur.trim()); return out;
  };
  const headers = parseLine(lines[0]).map(h => h.toLowerCase());
  return lines.slice(1).map(l => {
    const v = parseLine(l);
    return Object.fromEntries(headers.map((h, i) => [h, v[i] || '']));
  });
}

async function fromLTA(key) {
  const r = await fetch('https://datamall2.mytransport.sg/ltaodataservice/COEResult', {
    headers: { AccountKey: key, Accept: 'application/json' }
  });
  if (!r.ok) throw new Error(`LTA ${r.status}`);
  const d = await r.json();
  const catB = (d.value || []).find(x => x.vehicle_class === 'Category B');
  if (!catB) throw new Error('No Cat B');
  return { value: +catB.premium, label: `${catB.month} Bid ${catB.bidding_no}`, _source: 'LTA' };
}

async function fromGovSG() {
  const base = `https://api-open.data.gov.sg/v1/public/api/datasets/${DATASET_ID}`;
  await fetch(`${base}/initiate-download`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ exportType: 'csv' }) });
  const poll = await (await fetch(`${base}/poll-download`)).json();
  const csvUrl = poll?.data?.url || poll?.url;
  if (!csvUrl) throw new Error('No CSV URL');
  const rows = parseCSV(await (await fetch(csvUrl)).text());
  const SKIP = new Set(['bidding_no','bid_no','month','vehicle_class']);
  const catB = rows.filter(r => (r.vehicle_class||'').toLowerCase().includes('category b'));
  for (let i = catB.length - 1; i >= 0; i--) {
    for (const [k, v] of Object.entries(catB[i])) {
      if (SKIP.has(k)) continue;
      const n = parseInt((v||'').replace(/[^0-9]/g,''));
      if (n > 15000) return { value: n, label: `${catB[i].month} Bid ${catB[i].bidding_no||''}`.trim(), _source: 'data.gov.sg' };
    }
  }
  throw new Error('No premium found');
}

async function handleCOE(env) {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  const kv = env?.SGCARIQ_KV ?? null;
  const key = (env?.LTA_ACCOUNT_KEY ?? '').trim();
  const CACHE_KEY = 'coe:latest';
  const TTL = 24 * 60 * 60 * 1000;

  if (kv) {
    const cached = await kv.get(CACHE_KEY, 'json').catch(() => null);
    if (cached?.value && (Date.now() - (cached.ts||0)) < TTL)
      return new Response(JSON.stringify({ ...cached, _cache: 'hit' }), { headers });
  }

  const errors = [];
  if (key) {
    try {
      const r = await fromLTA(key);
      if (kv) kv.put(CACHE_KEY, JSON.stringify({ ...r, ts: Date.now() })).catch(()=>{});
      return new Response(JSON.stringify(r), { headers });
    } catch(e) { errors.push('LTA: '+e.message); }
  }

  try {
    const r = await fromGovSG();
    if (kv) kv.put(CACHE_KEY, JSON.stringify({ ...r, ts: Date.now() })).catch(()=>{});
    return new Response(JSON.stringify(r), { headers });
  } catch(e) { errors.push('GovSG: '+e.message); }

  if (kv) {
    const stale = await kv.get(CACHE_KEY, 'json').catch(() => null);
    if (stale?.value) return new Response(JSON.stringify({ ...stale, _cache: 'stale' }), { headers });
  }

  return new Response(JSON.stringify({ _error: errors.join(' | ') }), { status: 503, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/coe') return handleCOE(env);
    return env.ASSETS.fetch(request);
  }
};
