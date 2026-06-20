export const generateCurl = req => {
  let curl = 'curl -X ' + req.method + " '" + req.url + "'";
  if (req.headers) {
    Object.entries(req.headers).forEach(([k, v]) => {
      curl += " -H '" + k + ': ' + v + "'";
    });
  }
  if (req.body) {
    curl += " -d '" + req.body.replace(/'/g, "'\\''") + "'";
  }
  return curl;
};

export const generateSQLMapRequest = req => {
  // Generate HTTP request file for SQLMap (-r flag)
  try {
    const url = new URL(req.url);
    const path = url.pathname + url.search;

    let request = `${req.method} ${path} HTTP/1.1\r\n`;
    request += `Host: ${url.host}\r\n`;

    if (req.headers) {
      Object.entries(req.headers).forEach(([k, v]) => {
        // Skip Host header as we already added it
        if (k.toLowerCase() !== 'host') {
          request += `${k}: ${v}\r\n`;
        }
      });
    }

    request += '\r\n';

    if (req.body) {
      request += req.body;
    }

    return request;
  } catch (e) {
    return '';
  }
};

export const generatePayloadList = (cfg) => {
  let items = [];
  if (cfg.type === 'list') {
    items = (cfg.items || '').split('\n').filter(l => l.length > 0);
  } else if (cfg.type === 'numbers') {
    const from = Number(cfg.from) || 0;
    const to = Number(cfg.to) || 0;
    const step = Math.max(1, Number(cfg.step) || 1);
    const pad = Number(cfg.padLen) || 0;
    for (let n = from; n <= to; n += step) {
      let s = String(n);
      if (pad > 0) while (s.length < pad) s = '0' + s;
      items.push(s);
    }
  } else if (cfg.type === 'bruteforce') {
    const chars = (cfg.charset || 'a').split('');
    const minL = Math.max(1, Number(cfg.minLen) || 1);
    const maxL = Math.min(8, Number(cfg.maxLen) || 3);
    const gen = (prefix, len) => {
      if (prefix.length === len) { items.push(prefix); return; }
      for (const c of chars) gen(prefix + c, len);
    };
    for (let l = minL; l <= maxL; l++) gen('', l);
    if (items.length > 500000) items = items.slice(0, 500000); // safety cap
  }
  // Processing
  items = items.map(v => {
    if (cfg.prefix) v = cfg.prefix + v;
    if (cfg.suffix) v = v + cfg.suffix;
    if (cfg.urlEncode) v = encodeURIComponent(v);
    if (cfg.base64) v = btoa(v);
    return v;
  });
  return items;
};

export const generateAttackCombinations = (intUrl, intHeaders, intBody, intMethod, intAttackType, intPayloads, parseIntPositions) => {
  const positions = parseIntPositions(intUrl, intHeaders, intBody);
  if (positions.length === 0) return [];
  const payloadSets = positions.map((_, i) => generatePayloadList(intPayloads[i] || { type: 'list', items: '' }));
  const combos = [];

  if (intAttackType === 'broadcast') {
    // Same payload in all positions
    const list = payloadSets[0] || [];
    for (const val of list) {
      const payloads = {};
      positions.forEach((_, i) => { payloads[i] = val; });
      combos.push({ payloads, label: val });
    }
  } else if (intAttackType === 'parallel') {
    // Zip all lists
    const minLen = Math.min(...payloadSets.map(s => s.length));
    for (let j = 0; j < minLen; j++) {
      const payloads = {};
      positions.forEach((_, i) => { payloads[i] = payloadSets[i][j]; });
      combos.push({ payloads, label: payloadSets.map(s => s[j]).join(' | ') });
    }
  } else if (intAttackType === 'matrix') {
    // Cartesian product
    const cart = (arr) => {
      if (arr.length === 0) return [[]];
      const [first, ...rest] = arr;
      const restCombos = cart(rest);
      const result = [];
      for (const v of first) for (const rc of restCombos) result.push([v, ...rc]);
      return result;
    };
    const products = cart(payloadSets);
    for (const combo of products) {
      const payloads = {};
      positions.forEach((_, i) => { payloads[i] = combo[i]; });
      combos.push({ payloads, label: combo.join(' | ') });
    }
    if (combos.length > 1000000) combos.length = 1000000; // safety cap
  } else {
    // targeted (default; también 'sniper'): cada posición se prueba una a la vez
    // con su payload set mientras las demás conservan su valor original.
    for (let pi = 0; pi < positions.length; pi++) {
      for (const val of payloadSets[pi]) {
        const payloads = {};
        positions.forEach((_, i) => { payloads[i] = i === pi ? val : null; }); // null = keep original
        combos.push({ payloads, label: val });
      }
    }
  }
  return combos;
};
