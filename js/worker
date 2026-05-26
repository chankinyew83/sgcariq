// SGCarIQ — Cloudflare Worker entry point
// Routes /api/coe to the COE handler
// All other requests served from static assets

import { onRequestGet as handleCOE } from './functions/api/coe.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/coe') {
      return handleCOE({ request, env, ctx });
    }

    // Serve static assets (index.html, js/*.js etc)
    return env.ASSETS.fetch(request);
  }
};
