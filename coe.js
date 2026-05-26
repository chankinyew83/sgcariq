// Cloudflare Pages Function — /api/coe
// Primary:  LTA DataMall (env.LTA_ACCOUNT_KEY required)
// Fallback: data.gov.sg (no key, 3-step CSV download)
// Cache:    KV (env.SGCARIQ_KV), TTL 24h, stale-while-revalidate
//
// Setup in CF Dashboard:
//   Pages → sgcariq → Settings → Functions → KV bindings → SGCARIQ_KV
//   Pages → sgcariq → Settings → Environment Variables → LTA_ACCOUNT_KEY

const DATASET_ID   = 'd_69b3380ad7e51aff3a7dcc84eba52b8a';
const CACHE_KEY    = 'coe:latest';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours — COE bids every 2 weeks

// ── LTA DataMall ─────────────────────────────────────────────────
async function fromLTA(key) {
  const r = await fetch(
    'https://datamall2.mytransport.sg/ltaodataservice/COEResult',
    { headers: { AccountKey: key, Accept: 'application/json' } }
  );
  if (!r.ok) throw new Error(`LTA HTTP ${r.status}`);
  const d = await r.json();
  const catB = (d.value || []).find(x => x.vehicle_class === 'Category B');
  if (!catB) throw new Error('No Cat B in LTA response');
  return {
    value: +catB.premium,
    label: `${catB.month} Bid ${catB.bidding_no}`.trim(),
    _source: 'LTA DataMall'
  };
}

// ── data.gov.sg (CSV download) ────────────────────────────────────
function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim());
  const parseLine = line => {
    const out = []; let cur = '', q = false;
    for (const ch of line) {
      if (ch === '"') { q = !q; }
      else if (ch === ',' && !q) { out.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    out.push(cur.trim());
    return out;
  };
  const headers = parseLine(lines[0]).map(h => h.toLowerCase());
  return lines.slice(1).map(l => {
    const v = parseLine(l);
    return Object.fromEntries(headers.map((h, i) => [h, v[i] || '']));
  });
}

async function fromGovSG() {
  const base = `https://api-open.data.gov.sg/v1/public/api/datasets/${DATASET_ID}`;
  await fetch(`${base}/initiate-download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ exportType: 'csv' })
  });
  const poll    = await (await fetch(`${base}/poll-download`)).json();
  const csvUrl  = poll?.data?.url || poll?.url;
  if (!csvUrl) throw new Error('No CSV URL from data.gov.sg');

  const csv     = await (await fetch(csvUrl)).text();
  const rows    = parseCSV(csv);
  const SKIP    = new Set(['bidding_no', 'bid_no', 'month', 'vehicle_class']);
  const catBAll = rows.filter(r =>
    (r.vehicle_class || '').toLowerCase().includes('category b')
  );
  if (!catBAll.length) throw new Error('No Cat B rows in CSV');

  for (let i = catBAll.length - 1; i >= 0; i--) {
    for (const [k, v] of Object.entries(catBAll[i])) {
      if (SKIP.has(k)) continue;
      const n = parseInt((v || '').replace(/[^0-9]/g, ''));
      if (n > 15000) return {
        value: n,
        label: `${catBAll[i].month} Bid ${catBAll[i].bidding_no || ''}`.trim(),
        _source: 'data.gov.sg'
      };
    }
  }
  throw new Error('No premium >$15k found in CSV');
}

// ── Handler ───────────────────────────────────────────────────────
export async function onRequestGet({ env }) {
  const headers = {
    'Content-Type':                'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control':               'public, s-maxage=3600, stale-while-revalidate=86400'
  };
  const json = (data, status = 200) =>
    new Response(JSON.stringify(data), { status, headers });

  const kv     = env?.SGCARIQ_KV ?? null;
  const ltaKey = (env?.LTA_ACCOUNT_KEY ?? '').trim();
  const errors = [];

  // ── 1. Check KV cache ──
  if (kv) {
    try {
      const cached = await kv.get(CACHE_KEY, 'json');
      if (cached?.value) {
        const age = cached.ts ? Date.now() - cached.ts : Infinity;
        if (age < CACHE_TTL_MS) {
          return json({ ...cached, _cache: 'hit', _age: Math.round(age / 3600000) + 'h' });
        }
        // Stale — try refresh but return stale on failure below
      }
    } catch (e) {
      errors.push('KV read: ' + e.message);
    }
  }

  // ── 2. Try LTA DataMall ──
  if (ltaKey) {
    try {
      const result = await fromLTA(ltaKey);
      const toStore = { ...result, ts: Date.now() };
      if (kv) await kv.put(CACHE_KEY, JSON.stringify(toStore)).catch(() => {});
      return json(toStore);
    } catch (e) {
      errors.push('LTA: ' + e.message);
    }
  }

  // ── 3. Try data.gov.sg ──
  try {
    const result = await fromGovSG();
    const toStore = { ...result, ts: Date.now() };
    if (kv) await kv.put(CACHE_KEY, JSON.stringify(toStore)).catch(() => {});
    return json(toStore);
  } catch (e) {
    errors.push('GovSG: ' + e.message);
  }

  // ── 4. Return stale cache if available ──
  if (kv) {
    try {
      const stale = await kv.get(CACHE_KEY, 'json');
      if (stale?.value) return json({ ...stale, _cache: 'stale', _errors: errors });
    } catch (e) {}
  }

  return json({ _error: errors.join(' | ') }, 503);
}

// Handle OPTIONS preflight
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Max-Age':       '86400'
    }
  });
}
