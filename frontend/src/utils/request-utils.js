export const buildIntRequest = (combo, intUrl, intHeaders, intBody, intMethod) => {
  const marker = /\u00a7([^\u00a7]*)\u00a7/g;
  let posIdx = 0;
  const replaceMarkers = (text, section) => {
    const startIdx = posIdx;
    // count markers in this section
    let count = 0;
    marker.lastIndex = 0;
    let mm;
    while ((mm = marker.exec(text)) !== null) count++;
    const result = text.replace(marker, () => {
      const val = combo.payloads[startIdx + (posIdx - startIdx)];
      const orig = '';
      posIdx++;
      return val !== null && val !== undefined ? val : orig;
    });
    return result;
  };
  posIdx = 0;
  const url = replaceMarkers(intUrl, 'url');
  const headersText = replaceMarkers(intHeaders, 'headers');
  const body = replaceMarkers(intBody, 'body');

  let h = {};
  try {
    headersText.split('\n').forEach(l => {
      const [k, ...v] = l.split(':');
      if (k && v.length) h[k.trim()] = v.join(':').trim();
    });
  } catch (e) {}
  // Auto Content-Length
  if (body) {
    const len = new TextEncoder().encode(body).length;
    const clKey = Object.keys(h).find(k => k.toLowerCase() === 'content-length');
    if (clKey) h[clKey] = String(len); else h['Content-Length'] = String(len);
  } else {
    const clKey = Object.keys(h).find(k => k.toLowerCase() === 'content-length');
    if (clKey) delete h[clKey];
  }
  return { method: intMethod, url, headers: h, body: body || null };
};

export const normalizeRequest = (req, source) => {
  if (source === 'webhook') {
    return { id: req.request_id, method: req.method || 'GET', url: req.url || '',
      headers: req.headers || {}, body: req.content || null, source: 'webhook' };
  }
  if (source === 'repeater') {
    return { id: req.id, method: req.method, url: req.url,
      headers: req.headers || {}, body: req.body || null, name: req.name, source: 'repeater' };
  }
  if (source === 'websocket') {
    return { id: req.id, method: 'WS', url: req.url || '',
      headers: {}, body: req.content || req.body || null, source: 'websocket' };
  }
  if (source === 'collection') {
    return { id: req.id, method: req.method, url: req.url,
      headers: req.headers || {}, body: req.body || null, source: 'collection' };
  }
  if (source === 'intercept') {
    return { id: req.id, method: req.method, url: req.url,
      headers: req.headers || {}, body: req.body || null, source: 'intercept' };
  }
  if (source === 'selection') {
    return { id: 'selection', method: 'TEXT', url: '', headers: {}, body: req.body || '', source: 'selection' };
  }
  return { id: req.id, method: req.method, url: req.url,
    headers: req.headers || {}, body: req.body || null, saved: req.saved, source: 'history' };
};
