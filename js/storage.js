 // ─────────────────────────────────────────
// storage.js — persistence layer
// Tier 1: API_BASE_URL (future REST endpoint)
// Tier 2: window.storage (Claude artifact, cross-device)
// Tier 3: localStorage (static hosting, same-device)
// ─────────────────────────────────────────

const API_BASE_URL = ''; // reserved — set to e.g. 'https://your-api.com/sgcariq'

const Store = {
  async get(key) {
    if (API_BASE_URL) {
      try {
        const r = await fetch(`${API_BASE_URL}/${key}`);
        if (r.ok) return await r.json();
      } catch(e) {}
    }
    try {
      if (typeof window.storage !== 'undefined') {
        const r = await window.storage.get('sgcariq:' + key);
        return r ? JSON.parse(r.value) : null;
      }
    } catch(e) {}
    try {
      const v = localStorage.getItem('sgcariq:' + key);
      return v ? JSON.parse(v) : null;
    } catch(e) { return null; }
  },

  async set(key, val) {
    const json = JSON.stringify(val);
    if (API_BASE_URL) {
      try {
        await fetch(`${API_BASE_URL}/${key}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: json
        });
        return;
      } catch(e) {}
    }
    try {
      if (typeof window.storage !== 'undefined') {
        await window.storage.set('sgcariq:' + key, json);
        return;
      }
    } catch(e) {}
    try { localStorage.setItem('sgcariq:' + key, json); } catch(e) {}
  }
};
 
