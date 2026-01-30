const { useState, useEffect, useRef } = React;

const API = '';
const WS_URL = 'ws://' + location.host + '/ws';

function Blackwire() {
  // Estado principal
  const [tab, setTab] = useState('projects');
  const [prjs, setPrjs] = useState([]);
  const [curPrj, setCurPrj] = useState(null);

  // Estado del proxy
  const [pxRun, setPxRun] = useState(false);
  const [pxPort, setPxPort] = useState(8080);
  const [pxMode, setPxMode] = useState('regular');
  const [pxArgs, setPxArgs] = useState('');

  // Estado de requests
  const [reqs, setReqs] = useState([]);
  const [selReq, setSelReq] = useState(null);
  const [detTab, setDetTab] = useState('request');

  // Estado del Repeater
  const [repReqs, setRepReqs] = useState([]);
  const [selRep, setSelRep] = useState(null);
  const [repM, setRepM] = useState('GET');
  const [repU, setRepU] = useState('');
  const [repH, setRepH] = useState('');
  const [repB, setRepB] = useState('');
  const [repResp, setRepResp] = useState(null);
  const [repRespBody, setRepRespBody] = useState('');

  // NUEVA FUNCIONALIDAD: Historial de navegación en Repeater
  const [repHistory, setRepHistory] = useState([]);
  const [repHistoryIndex, setRepHistoryIndex] = useState(-1);

  // Estado general
  const [loading, setLoading] = useState(false);
  const [commits, setCommits] = useState([]);
  const [cmtMsg, setCmtMsg] = useState('');
  const [toasts, setToasts] = useState([]);

  // Filtros
  const [search, setSearch] = useState('');
  const [savedOnly, setSavedOnly] = useState(false);
  const [scopeOnly, setScopeOnly] = useState(false);

  // Intercept
  const [intOn, setIntOn] = useState(false);
  const [pending, setPending] = useState([]);
  const [selPend, setSelPend] = useState(null);
  const [editReq, setEditReq] = useState(null);

  // Scope
  const [scopeRules, setScopeRules] = useState([]);
  const [newPat, setNewPat] = useState('');
  const [newType, setNewType] = useState('include');

  // Projects
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  // Extensions
  const [extensions, setExtensions] = useState([]);
  const [whkReqs, setWhkReqs] = useState([]);
  const [whkLoading, setWhkLoading] = useState(false);
  const [whkApiKey, setWhkApiKey] = useState('');

  // Webhook History (interactive tab)
  const [selWhkReq, setSelWhkReq] = useState(null);
  const [whkSearch, setWhkSearch] = useState('');
  const [whkDetTab, setWhkDetTab] = useState('request');
  const [whkReqFormat, setWhkReqFormat] = useState('raw');

  // Formatos
  const [reqFormat, setReqFormat] = useState('raw');
  const [respFormat, setRespFormat] = useState('raw');

  // Proxy Config
  const [showProxyCfg, setShowProxyCfg] = useState(false);

  // NUEVA FUNCIONALIDAD: Menú contextual
  const [contextMenu, setContextMenu] = useState(null);

  const wsRef = useRef(null);
  const webhookExt = extensions.find(e => e.name === 'webhook_site');

  const toast = (m, t = 'info') => {
    const id = Date.now();
    setToasts(p => [...p, { id, message: m, type: t }]);
    setTimeout(() => setToasts(p => p.filter(x => x.id !== id)), 3000);
  };

  const api = {
    get: async u => (await fetch(API + u)).json(),
    post: async (u, d) => (await fetch(API + u, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: d ? JSON.stringify(d) : undefined
    })).json(),
    put: async (u, d) => (await fetch(API + u, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: d ? JSON.stringify(d) : undefined
    })).json(),
    del: async u => (await fetch(API + u, { method: 'DELETE' })).json()
  };

  useEffect(() => {
    loadPrjs();
    loadCur();
    connectWs();
    return () => wsRef.current?.close();
  }, []);

  useEffect(() => {
    if (curPrj) {
      loadReqs();
      loadRep();
      loadGit();
      loadScope();
      loadExts();
      checkPx();
    }
  }, [curPrj]);

  // NUEVA FUNCIONALIDAD: Ctrl+S para auto-commits
  useEffect(() => {
    const handleKeyDown = e => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        if (curPrj) {
          autoCommit();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [curPrj]);

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      window.addEventListener('click', handleClick);
      return () => window.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  useEffect(() => {
    setWhkApiKey(webhookExt?.config?.api_key || '');
  }, [webhookExt?.config?.api_key]);

  useEffect(() => {
    if (tab !== 'extensions' && tab !== 'webhook') return;
    if (!webhookExt?.enabled || !webhookExt?.config?.token_id) return;
    loadWebhookLocal();
    const id = setInterval(() => refreshWebhook(true), 15000);
    return () => clearInterval(id);
  }, [tab, webhookExt?.enabled, webhookExt?.config?.token_id]);

  const connectWs = () => {
    const ws = new WebSocket(WS_URL);
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.type === 'new_request') setReqs(p => [m.data, ...p]);
      if (m.type === 'intercept_new') setPending(p => [...p, m.data]);
      if (m.type === 'intercept_status') setIntOn(m.enabled);
      if (m.type === 'intercept_forwarded' || m.type === 'intercept_dropped')
        setPending(p => p.filter(r => r.id !== m.request_id));
      if (m.type === 'intercept_all_forwarded' || m.type === 'intercept_all_dropped')
        setPending([]);
    };
    ws.onclose = () => setTimeout(connectWs, 3000);
    wsRef.current = ws;
  };

  const loadPrjs = async () => setPrjs(await api.get('/api/projects'));

  const loadCur = async () => {
    const r = await api.get('/api/projects/current');
    if (r.project) {
      setCurPrj(r.project);
      setIntOn(r.config?.intercept_enabled || false);
      setScopeRules(r.config?.scope_rules || []);
      setPxPort(r.config?.proxy_port || 8080);
      setPxMode(r.config?.proxy_mode || 'regular');
      setPxArgs(r.config?.proxy_args || '');
      setTab('history');
    }
  };

  const loadReqs = async () => setReqs(await api.get('/api/requests?limit=500'));
  const loadRep = async () => setRepReqs(await api.get('/api/repeater'));
  const loadGit = async () => setCommits(await api.get('/api/git/history'));
  const loadScope = async () => {
    const r = await api.get('/api/scope');
    setScopeRules(r.rules || []);
  };
  const loadExts = async () => {
    const r = await api.get('/api/extensions');
    setExtensions(r.extensions || []);
  };
  const checkPx = async () => {
    const r = await api.get('/api/proxy/status');
    setPxRun(r.running);
    setIntOn(r.intercept_enabled);
  };

  const loadWebhookLocal = async () => {
    if (!curPrj) return;
    if (!webhookExt?.config?.token_id) {
      setWhkReqs([]);
      return;
    }
    const r = await api.get('/api/webhooksite/requests?limit=200');
    setWhkReqs(r.requests || []);
  };

  const refreshWebhook = async (silent = false) => {
    if (!webhookExt?.config?.token_id) {
      if (!silent) toast('No webhook token', 'error');
      return;
    }
    setWhkLoading(true);
    try {
      const r = await api.post('/api/webhooksite/refresh', { limit: 50 });
      if (r.status === 'ok') {
        await loadWebhookLocal();
        if (!silent) toast('Webhook updated', 'success');
      } else {
        if (!silent) toast(r.detail || 'Webhook refresh failed', 'error');
      }
    } catch (e) {
      if (!silent) toast('Webhook refresh failed', 'error');
    }
    setWhkLoading(false);
  };

  const createWebhookToken = async () => {
    setWhkLoading(true);
    try {
      const r = await api.post('/api/webhooksite/token');
      if (r.status === 'created') {
        await loadExts();
        await loadWebhookLocal();
        toast('Webhook URL created', 'success');
      } else {
        toast(r.detail || 'Failed to create webhook', 'error');
      }
    } catch (e) {
      toast('Failed to create webhook', 'error');
    }
    setWhkLoading(false);
  };

  const clearWebhookHistory = async () => {
    await api.del('/api/webhooksite/requests');
    setWhkReqs([]);
    setSelWhkReq(null);
    toast('Webhook history cleared', 'success');
  };

  const whkToRepeater = r => {
    const hdrs = r.headers || {};
    setRepM(r.method || 'GET');
    setRepU(r.url || '');
    setRepH(Object.entries(hdrs).map(([k, v]) => k + ': ' + v).join('\n'));
    setRepB(r.content || '');
    setTab('repeater');
    toast('Sent to Repeater', 'success');
  };

  const whkContextAction = async (action, req) => {
    setContextMenu(null);
    switch (action) {
      case 'repeater':
        whkToRepeater(req);
        break;
      case 'copy-url':
        navigator.clipboard.writeText(req.url || '');
        toast('URL copied', 'success');
        break;
      case 'copy-curl': {
        let curl = 'curl -X ' + (req.method || 'GET') + " '" + (req.url || '') + "'";
        if (req.headers) {
          Object.entries(req.headers).forEach(([k, v]) => { curl += " -H '" + k + ': ' + v + "'"; });
        }
        if (req.content) {
          curl += " -d '" + req.content.replace(/'/g, "'\\''") + "'";
        }
        navigator.clipboard.writeText(curl);
        toast('cURL copied', 'success');
        break;
      }
      case 'copy-content':
        navigator.clipboard.writeText(req.content || '');
        toast('Content copied', 'success');
        break;
    }
  };

  const filteredWhk = whkReqs.filter(r => {
    if (whkSearch && !(r.url || '').toLowerCase().includes(whkSearch.toLowerCase()) &&
        !(r.method || '').toLowerCase().includes(whkSearch.toLowerCase()) &&
        !(r.ip || '').toLowerCase().includes(whkSearch.toLowerCase())) return false;
    return true;
  });

  const selectPrj = async n => {
    await api.post('/api/projects/' + n + '/select');
    setCurPrj(n);
    await loadCur();
    setTab('history');
    toast('Project: ' + n, 'success');
  };

  const createPrj = async () => {
    if (!newName.trim()) return;
    await api.post('/api/projects', { name: newName, description: newDesc });
    await loadPrjs();
    await selectPrj(newName);
    setShowNew(false);
    setNewName('');
    setNewDesc('');
    toast('Created', 'success');
  };

  const delPrj = async n => {
    if (!confirm('Delete ' + n + '?')) return;
    await api.del('/api/projects/' + n);
    if (curPrj === n) setCurPrj(null);
    await loadPrjs();
    toast('Deleted', 'success');
  };

  const startPx = async () => {
    setLoading(true);
    const r = await api.post('/api/proxy/start?port=' + pxPort + '&mode=' + encodeURIComponent(pxMode) + '&extra=' + encodeURIComponent(pxArgs));
    setLoading(false);
    if (r.status === 'started' || r.status === 'already_running') {
      setPxRun(true);
      toast('Proxy started', 'success');
    } else {
      toast('Failed: ' + (r.error || 'unknown'), 'error');
    }
  };

  const stopPx = async () => {
    await api.post('/api/proxy/stop');
    setPxRun(false);
    toast('Stopped', 'success');
  };

  const launchBr = async () => {
    const r = await api.post('/api/browser/launch?proxy_port=' + pxPort);
    toast(r.status === 'launched' ? 'Browser launched' : 'Failed', 'success');
  };

  const togInt = async () => {
    const r = await api.post('/api/intercept/toggle');
    setIntOn(r.enabled);
    toast('Intercept ' + (r.enabled ? 'ON' : 'OFF'), 'success');
  };

  const fwdReq = async (id, mod = null) => {
    await api.post('/api/intercept/' + id + '/forward', mod);
    setPending(p => p.filter(r => r.id !== id));
    if (selPend?.id === id) setSelPend(null);
  };

  const dropReq = async id => {
    await api.post('/api/intercept/' + id + '/drop');
    setPending(p => p.filter(r => r.id !== id));
    if (selPend?.id === id) setSelPend(null);
  };

  const fwdAll = async () => {
    await api.post('/api/intercept/forward-all');
    setPending([]);
    setSelPend(null);
  };

  const dropAll = async () => {
    await api.post('/api/intercept/drop-all');
    setPending([]);
    setSelPend(null);
  };

  const addRule = async () => {
    if (!newPat.trim()) return;
    await api.post('/api/scope/rules', { pattern: newPat, rule_type: newType });
    await loadScope();
    setNewPat('');
    toast('Rule added', 'success');
  };

  const delRule = async id => {
    await api.del('/api/scope/rules/' + id);
    await loadScope();
  };

  const togRule = async id => {
    await api.put('/api/scope/rules/' + id);
    await loadScope();
  };

  // NUEVA FUNCIONALIDAD: Pretty Print/Minify en Repeater
  const prettyPrint = text => {
    try {
      const obj = JSON.parse(text);
      return JSON.stringify(obj, null, 2);
    } catch (e) {
      try {
        const parser = new DOMParser();
        const xml = parser.parseFromString(text, 'text/xml');
        if (xml.getElementsByTagName('parsererror').length === 0) {
          return formatXml(new XMLSerializer().serializeToString(xml));
        }
      } catch (e2) {}
    }
    return text;
  };

  const minify = text => {
    try {
      const obj = JSON.parse(text);
      return JSON.stringify(obj);
    } catch (e) {}
    return text.replace(/\s+/g, ' ').trim();
  };

  const formatXml = xml => {
    const PADDING = '  ';
    const reg = /(>)(<)(\/*)/g;
    let pad = 0;
    xml = xml.replace(reg, '$1\n$2$3');
    return xml.split('\n').map(node => {
      let indent = 0;
      if (node.match(/.+<\/\w[^>]*>$/)) {
        indent = 0;
      } else if (node.match(/^<\/\w/)) {
        if (pad !== 0) pad -= 1;
      } else if (node.match(/^<\w[^>]*[^\/]>.*$/)) {
        indent = 1;
      }
      const padding = PADDING.repeat(pad);
      pad += indent;
      return padding + node;
    }).join('\n');
  };

  // NUEVA FUNCIONALIDAD: Historial de navegación en Repeater
  const saveToHistory = (request, response) => {
    const historyItem = {
      method: request.method,
      url: request.url,
      headers: request.headers,
      body: request.body,
      response: response
    };
    setRepHistory(prev => {
      const newHistory = prev.slice(0, repHistoryIndex + 1);
      return [...newHistory, historyItem];
    });
    setRepHistoryIndex(prev => prev + 1);
  };

  const navigateHistory = direction => {
    const newIndex = repHistoryIndex + direction;
    if (newIndex >= 0 && newIndex < repHistory.length) {
      const item = repHistory[newIndex];
      setRepM(item.method);
      setRepU(item.url);
      setRepH(item.headers);
      setRepB(item.body);
      setRepResp(item.response);
      setRepHistoryIndex(newIndex);
    }
  };

  const sendRep = async () => {
    setLoading(true);
    setRepResp(null);
    let h = {};
    try {
      repH.split('\n').forEach(l => {
        const [k, ...v] = l.split(':');
        if (k && v.length) h[k.trim()] = v.join(':').trim();
      });
    } catch (e) {}

    const requestData = { method: repM, url: repU, headers: h, body: repB };
    const r = await api.post('/api/repeater/send-raw', { ...requestData, body: repB || null });
    setRepResp(r);
    setRepRespBody(r.body || '');
    setLoading(false);

    // Guardar en historial
    saveToHistory(requestData, r);
  };

  const toRep = r => {
    setRepM(r.method);
    setRepU(r.url);
    setRepH(Object.entries(r.headers || {}).map(([k, v]) => k + ': ' + v).join('\n'));
    setRepB(r.body || '');
    setTab('repeater');
    toast('Sent to Repeater', 'success');
  };

  const saveRep = async () => {
    const n = prompt('Name:');
    if (!n) return;
    let h = {};
    try {
      repH.split('\n').forEach(l => {
        const [k, ...v] = l.split(':');
        if (k && v.length) h[k.trim()] = v.join(':').trim();
      });
    } catch (e) {}
    await api.post('/api/repeater', { name: n, method: repM, url: repU, headers: h, body: repB });
    loadRep();
    toast('Saved', 'success');
  };

  const loadRepItem = r => {
    setSelRep(r.id);
    setRepM(r.method);
    setRepU(r.url);
    setRepH(Object.entries(r.headers || {}).map(([k, v]) => k + ': ' + v).join('\n'));
    setRepB(r.body || '');
    if (r.last_response) setRepResp(r.last_response);
  };

  const commit = async () => {
    if (!cmtMsg.trim()) return;
    const r = await api.post('/api/git/commit?message=' + encodeURIComponent(cmtMsg));
    if (r.status === 'committed') {
      toast('Committed: ' + r.hash, 'success');
      setCmtMsg('');
      loadGit();
    }
  };

  // NUEVA FUNCIONALIDAD: Auto-commit con Ctrl+S
  const autoCommit = async () => {
    const msg = 'Auto-commit ' + new Date().toISOString();
    const r = await api.post('/api/git/commit?message=' + encodeURIComponent(msg));
    if (r.status === 'committed') {
      toast('Auto-committed: ' + r.hash.substring(0, 7), 'success');
      loadGit();
    } else {
      toast('No changes to commit', 'info');
    }
  };

  const togSave = async id => {
    await api.put('/api/requests/' + id + '/save');
    loadReqs();
  };

  const delReq = async id => {
    await api.del('/api/requests/' + id);
    loadReqs();
    if (selReq?.id === id) setSelReq(null);
  };

  const clearHist = async () => {
    if (!confirm('Clear unsaved?')) return;
    await api.del('/api/requests?keep_saved=true');
    loadReqs();
    toast('Cleared', 'success');
  };

  const togExtEnabled = async (name, enabled) => {
    const ext = extensions.find(e => e.name === name);
    if (!ext) return;
    const newCfg = { ...ext.config, enabled };
    await api.put('/api/extensions/' + name, newCfg);
    loadExts();
    toast('Extension ' + (enabled ? 'enabled' : 'disabled'), 'success');
  };

  const updateExtCfg = async (name, cfg) => {
    await api.put('/api/extensions/' + name, cfg);
    loadExts();
    toast('Extension updated', 'success');
  };

  const saveProxyCfg = async () => {
    if (!curPrj) return;
    const r = await api.get('/api/projects/current');
    if (!r.config) return;
    r.config.proxy_port = pxPort;
    r.config.proxy_mode = pxMode;
    r.config.proxy_args = pxArgs;
    await save_project_config(curPrj, r.config);
    toast('Proxy config saved', 'success');
    setShowProxyCfg(false);
  };

  const save_project_config = async (name, config) => {
    await api.put('/api/projects/' + name, config);
  };

  // ===== EXTENSION UI COMPONENTS =====

  function MatchReplaceUI({ ext, updateExtCfg }) {
    const rules = ext.config?.rules || [];

    const updateRule = (idx, field, value) => {
      const newRules = rules.map((r, i) => i === idx ? { ...r, [field]: value } : r);
      updateExtCfg(ext.name, { ...ext.config, rules: newRules });
    };

    const removeRule = idx => {
      updateExtCfg(ext.name, { ...ext.config, rules: rules.filter((_, i) => i !== idx) });
    };

    const addRule = () => {
      updateExtCfg(ext.name, { ...ext.config, rules: [...rules, {
        enabled: true, when: 'request', target: 'url', pattern: '', replace: '', regex: false, ignore_case: false, header: ''
      }]});
    };

    const duplicateRule = idx => {
      const newRules = [...rules];
      newRules.splice(idx + 1, 0, { ...rules[idx] });
      updateExtCfg(ext.name, { ...ext.config, rules: newRules });
    };

    const whenColors = { request: 'var(--blue)', response: 'var(--green)', both: 'var(--orange)' };
    const s = {
      card: { background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: '6px', padding: '12px', marginBottom: '8px', opacity: 1 },
      cardOff: { background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: '6px', padding: '12px', marginBottom: '8px', opacity: 0.5 },
      row: { display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' },
      lastRow: { display: 'flex', gap: '8px', alignItems: 'center' },
      label: { fontSize: '10px', color: 'var(--txt3)', marginBottom: '3px', display: 'block' },
      sel: { background: 'var(--bg)', color: 'var(--txt)', border: '1px solid var(--brd)', borderRadius: '4px', padding: '4px 6px', fontSize: '11px', fontFamily: 'JetBrains Mono', outline: 'none' },
      inp: { background: 'var(--bg)', color: 'var(--txt)', border: '1px solid var(--brd)', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', fontFamily: 'JetBrains Mono', flex: 1, outline: 'none', width: '100%' },
      badge: (color) => ({ fontSize: '9px', padding: '2px 6px', borderRadius: '3px', background: color, color: '#fff', fontWeight: '600', textTransform: 'uppercase' }),
    };

    return (
      <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--brd)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--txt2)' }}>
            Rules ({rules.length})
          </div>
          <button className="btn btn-sm btn-p" onClick={addRule}>+ Add Rule</button>
        </div>

        {rules.length === 0 && (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--txt3)', fontSize: '11px', background: 'var(--bg3)', borderRadius: '6px' }}>
            No rules yet. Click "+ Add Rule" to create one.
          </div>
        )}

        {rules.map((rule, idx) => (
          <div key={idx} style={rule.enabled ? s.card : s.cardOff}>
            {/* Row 1: Enable + When + Target + Actions */}
            <div style={s.row}>
              <input type="checkbox" checked={rule.enabled} onChange={e => updateRule(idx, 'enabled', e.target.checked)}
                title={rule.enabled ? 'Disable rule' : 'Enable rule'} />
              <span style={s.badge(whenColors[rule.when] || 'var(--txt3)')}>#{idx + 1}</span>
              <div style={{ flex: 0 }}>
                <select style={s.sel} value={rule.when} onChange={e => updateRule(idx, 'when', e.target.value)}>
                  <option value="request">Request</option>
                  <option value="response">Response</option>
                  <option value="both">Both</option>
                </select>
              </div>
              <div style={{ flex: 0 }}>
                <select style={s.sel} value={rule.target} onChange={e => updateRule(idx, 'target', e.target.value)}>
                  <option value="url">URL</option>
                  <option value="headers">Header</option>
                  <option value="body">Body</option>
                </select>
              </div>
              {rule.target === 'headers' && (
                <input style={{ ...s.inp, maxWidth: '120px' }} value={rule.header || ''} placeholder="Header name"
                  onChange={e => updateRule(idx, 'header', e.target.value)} title="Leave empty to match all headers" />
              )}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
                <button className="btn btn-sm btn-s" onClick={() => duplicateRule(idx)} title="Duplicate">⧉</button>
                <button className="btn btn-sm btn-d" onClick={() => removeRule(idx)} title="Delete">✕</button>
              </div>
            </div>

            {/* Row 2: Pattern → Replace */}
            <div style={s.lastRow}>
              <div style={{ flex: 1 }}>
                <label style={s.label}>Match</label>
                <input style={s.inp} value={rule.pattern} placeholder={rule.regex ? '(regex)' : 'text to find'}
                  onChange={e => updateRule(idx, 'pattern', e.target.value)} />
              </div>
              <span style={{ color: 'var(--txt3)', fontSize: '14px', marginTop: '14px' }}>→</span>
              <div style={{ flex: 1 }}>
                <label style={s.label}>Replace</label>
                <input style={s.inp} value={rule.replace} placeholder="replacement"
                  onChange={e => updateRule(idx, 'replace', e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: '6px', marginTop: '14px' }}>
                <button className={'btn btn-sm ' + (rule.regex ? 'btn-p' : 'btn-s')} onClick={() => updateRule(idx, 'regex', !rule.regex)}
                  title="Regular expression" style={{ fontFamily: 'JetBrains Mono', fontSize: '10px' }}>.*</button>
                <button className={'btn btn-sm ' + (rule.ignore_case ? 'btn-p' : 'btn-s')} onClick={() => updateRule(idx, 'ignore_case', !rule.ignore_case)}
                  title="Ignore case" style={{ fontFamily: 'JetBrains Mono', fontSize: '10px' }}>Aa</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  function WebhookSiteUI({ ext, updateExtCfg, whkReqs, whkApiKey, setWhkApiKey, whkLoading, createWebhookToken, refreshWebhook, loadWebhookLocal, toast }) {
    return (
      <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--brd)' }}>
        <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '8px', color: 'var(--txt2)' }}>Webhook.site</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', color: 'var(--txt2)', marginBottom: '6px' }}>API Key (optional)</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input className="inp" type="password" placeholder="Api-Key" value={whkApiKey} onChange={e => setWhkApiKey(e.target.value)} />
              <button className="btn btn-sm btn-s" onClick={() => updateExtCfg(ext.name, { ...ext.config, api_key: whkApiKey })}>Save</button>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11px', color: 'var(--txt2)', marginBottom: '6px' }}>Webhook URL</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input className="inp" readOnly value={ext.config?.token_url || ''} placeholder="Create a webhook URL" />
              <button className="btn btn-sm btn-s" disabled={!ext.config?.token_url} onClick={() => {
                navigator.clipboard.writeText(ext.config.token_url);
                toast('Copied', 'success');
              }}>Copy</button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-sm btn-p" onClick={createWebhookToken} disabled={whkLoading}>
              {ext.config?.token_id ? 'Regenerate URL' : 'Create URL'}
            </button>
            <button className="btn btn-sm btn-s" onClick={() => refreshWebhook()} disabled={!ext.config?.token_id || whkLoading}>Sync Now</button>
          </div>
          <div style={{ marginTop: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <div style={{ fontSize: '11px', color: 'var(--txt2)' }}>Local history</div>
              <button className="btn btn-sm btn-s" onClick={loadWebhookLocal} disabled={!ext.config?.token_id}>Reload</button>
            </div>
            <div style={{ border: '1px solid var(--brd)', borderRadius: '6px', overflow: 'auto', maxHeight: '220px' }}>
              {whkReqs.length === 0 && (
                <div style={{ padding: '10px', fontSize: '11px', color: 'var(--txt3)', textAlign: 'center' }}>
                  No requests yet
                </div>
              )}
              {whkReqs.map(r => (
                <div key={r.request_id} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 120px 140px', gap: '8px', padding: '8px 10px', borderBottom: '1px solid var(--brd)', fontSize: '11px', fontFamily: 'JetBrains Mono' }}>
                  <span className={'mth mth-' + (r.method || 'GET')}>{r.method || 'GET'}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.url || r.path || '-'}</span>
                  <span style={{ color: 'var(--txt2)' }}>{r.ip || '-'}</span>
                  <span style={{ color: 'var(--txt3)' }}>{r.created_at || ''}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Registry de componentes de extensión
  const EXTENSION_COMPONENTS = {
    'match_replace': MatchReplaceUI,
    'webhook_site': WebhookSiteUI,
  };

  const syntaxHighlight = json => {
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, match => {
      let cls = 'json-number';
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'json-key';
        } else {
          cls = 'json-string';
        }
      } else if (/true|false/.test(match)) {
        cls = 'json-bool';
      } else if (/null/.test(match)) {
        cls = 'json-null';
      }
      return '<span class="' + cls + '">' + match + '</span>';
    });
  };

  const formatBody = (body, format) => {
    if (!body) return { text: body, html: false };
    if (format === 'pretty') {
      try {
        const obj = JSON.parse(body);
        const formatted = JSON.stringify(obj, null, 2);
        return { text: syntaxHighlight(formatted), html: true };
      } catch (e) {
        return { text: body, html: false };
      }
    }
    return { text: body, html: false };
  };

  // NUEVA FUNCIONALIDAD: Menú contextual
  const showContextMenu = (e, req) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      request: req
    });
  };

  const handleContextAction = async (action, req) => {
    setContextMenu(null);
    switch (action) {
      case 'repeater':
        toRep(req);
        break;
      case 'favorite':
        await togSave(req.id);
        break;
      case 'copy-url':
        navigator.clipboard.writeText(req.url);
        toast('URL copied', 'success');
        break;
      case 'copy-curl':
        const curl = generateCurl(req);
        navigator.clipboard.writeText(curl);
        toast('cURL copied', 'success');
        break;
      case 'delete':
        await delReq(req.id);
        break;
    }
  };

  const generateCurl = req => {
    let curl = `curl -X ${req.method} '${req.url}'`;
    if (req.headers) {
      Object.entries(req.headers).forEach(([k, v]) => {
        curl += ` -H '${k}: ${v}'`;
      });
    }
    if (req.body) {
      curl += ` -d '${req.body.replace(/'/g, "'\\''")}'`;
    }
    return curl;
  };

  const filtered = reqs.filter(r => {
    if (search && !r.url.toLowerCase().includes(search.toLowerCase())) return false;
    if (scopeOnly && !r.in_scope) return false;
    if (savedOnly && !r.saved) return false;
    return true;
  });

  const stCls = s => !s ? '' : s < 300 ? 'st2' : s < 400 ? 'st3' : s < 500 ? 'st4' : 'st5';
  const fmtTime = t => t ? new Date(t).toLocaleTimeString('en-US', { hour12: false }) : '';
  const fmtH = h => h ? Object.entries(h).map(([k, v]) => k + ': ' + (Array.isArray(v) ? v.join(', ') : v)).join('\n') : '';

  return (
    <div className="app">
      <style dangerouslySetInnerHTML={{ __html: `
:root{--bg:#0a0e14;--bg2:#0d1117;--bg3:#161b22;--bgh:#1f262d;--brd:#30363d;--txt:#e6edf3;--txt2:#8b949e;--txt3:#6e7681;--blue:#58a6ff;--green:#3fb950;--red:#f85149;--orange:#d29922;--purple:#a371f7;--cyan:#39c5cf}
*{margin:0;padding:0;box-sizing:border-box}body{font-family:Inter,sans-serif;background:var(--bg);color:var(--txt);overflow:hidden}
.app{display:flex;flex-direction:column;height:100vh}
.hdr{display:flex;align-items:center;justify-content:space-between;padding:10px 20px;background:var(--bg2);border-bottom:1px solid var(--brd)}
.logo{display:flex;align-items:center;gap:10px}.logo-i{width:32px;height:32px;background:linear-gradient(135deg,var(--cyan),var(--purple));border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:700}
.logo-t{font-family:'JetBrains Mono';font-size:18px;font-weight:600;background:linear-gradient(90deg,var(--cyan),var(--purple));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.prj-badge{background:var(--bg3);padding:4px 10px;border-radius:4px;font-size:11px;color:var(--cyan);border:1px solid var(--brd);margin-left:12px}
.hdr-ctrl{display:flex;align-items:center;gap:10px}
.int-tog{display:flex;align-items:center;gap:6px;padding:6px 12px;background:var(--bg3);border:1px solid var(--brd);border-radius:6px;font-size:11px;cursor:pointer}
.int-tog.on{background:rgba(248,81,73,.2);border-color:var(--red)}.int-dot{width:8px;height:8px;border-radius:50%;background:var(--txt3)}
.int-tog.on .int-dot{background:var(--red);animation:pulse 1s infinite}.pend-badge{background:var(--red);color:#fff;padding:1px 6px;border-radius:10px;font-size:10px;margin-left:4px}
.prx-st{display:flex;align-items:center;gap:6px;padding:5px 10px;background:var(--bg3);border-radius:6px;font-family:'JetBrains Mono';font-size:11px}
.st-dot{width:8px;height:8px;border-radius:50%}.st-dot.run{background:var(--green);animation:pulse 2s infinite}.st-dot.stop{background:var(--red)}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
.btn{padding:6px 14px;border:none;border-radius:5px;font-size:12px;font-weight:500;cursor:pointer;display:inline-flex;align-items:center;gap:5px}
.btn-p{background:var(--blue);color:#fff}.btn-s{background:var(--bg3);color:var(--txt);border:1px solid var(--brd)}.btn-d{background:var(--red);color:#fff}.btn-g{background:var(--green);color:#fff}
.btn-sm{padding:3px 8px;font-size:11px}.btn-lg{padding:10px 20px;font-size:13px}.btn:disabled{opacity:.5}
.tabs{display:flex;background:var(--bg2);border-bottom:1px solid var(--brd);padding:0 16px}
.tab{padding:10px 18px;font-size:12px;font-weight:500;color:var(--txt2);cursor:pointer;border-bottom:2px solid transparent;display:flex;align-items:center;gap:5px}
.tab:hover{color:var(--txt);background:var(--bg3)}.tab.act{color:var(--blue);border-bottom-color:var(--blue)}
.tab-badge{background:var(--red);color:#fff;padding:1px 5px;border-radius:8px;font-size:9px}
.main{flex:1;display:flex;overflow:hidden}
.panel{display:flex;flex-direction:column;overflow:hidden}.pnl-hdr{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--bg2);border-bottom:1px solid var(--brd);font-size:12px;font-weight:500}
.pnl-cnt{flex:1;overflow:auto}.hist-pnl{width:44%;border-right:1px solid var(--brd)}.det-pnl{flex:1;display:flex;flex-direction:column}
.req-list{font-family:'JetBrains Mono';font-size:11px}.req-item{display:grid;grid-template-columns:60px 1fr 60px 55px;gap:10px;padding:8px 14px;border-bottom:1px solid var(--brd);cursor:pointer;align-items:center}
.req-item:hover{background:var(--bgh)}.req-item.sel{background:var(--bg3);border-left:3px solid var(--blue)}.req-item.out{opacity:.4}
.mth{font-weight:600;padding:2px 6px;border-radius:3px;text-align:center;font-size:10px}
.mth-GET{background:rgba(63,185,80,.15);color:var(--green)}.mth-POST{background:rgba(88,166,255,.15);color:var(--blue)}
.mth-PUT,.mth-PATCH{background:rgba(210,153,34,.15);color:var(--orange)}.mth-DELETE{background:rgba(248,81,73,.15);color:var(--red)}
.url{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sts{font-weight:500}
.st2{color:var(--green)}.st3{color:var(--blue)}.st4{color:var(--orange)}.st5{color:var(--red)}.ts{color:var(--txt3);font-size:10px}
.det-tabs{display:flex;background:var(--bg2);border-bottom:1px solid var(--brd);padding:0 10px}
.det-tab{padding:8px 14px;font-size:11px;color:var(--txt2);cursor:pointer;border-bottom:2px solid transparent}
.det-tab.act{color:var(--cyan);border-bottom-color:var(--cyan)}
.code{flex:1;padding:14px;font-family:'JetBrains Mono';font-size:11px;line-height:1.5;background:var(--bg);overflow:auto;white-space:pre-wrap;word-break:break-all}
.json-key{color:var(--cyan)}.json-string{color:var(--green)}.json-number{color:var(--orange)}.json-bool{color:var(--purple)}.json-null{color:var(--txt3)}
.flt-bar{display:flex;align-items:center;gap:6px;padding:6px 14px;background:var(--bg3);border-bottom:1px solid var(--brd)}
.flt-in{flex:1;padding:5px 8px;background:var(--bg2);border:1px solid var(--brd);border-radius:4px;color:var(--txt);font-size:11px;outline:none}
.flt-tog{padding:3px 8px;background:var(--bg2);border:1px solid var(--brd);border-radius:4px;font-size:10px;cursor:pointer}.flt-tog.act{background:var(--blue);border-color:var(--blue)}
.empty{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:var(--txt3);font-size:13px;gap:6px}.empty-i{font-size:40px;opacity:.3}
.acts{display:flex;gap:6px}
.prj-pnl{padding:24px;max-width:800px;margin:0 auto;width:100%}.prj-hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}.prj-hdr h2{font-size:18px}
.new-prj{background:var(--bg2);padding:16px;border-radius:8px;margin-bottom:16px;display:flex;flex-direction:column;gap:10px}
.inp{padding:8px 12px;background:var(--bg3);border:1px solid var(--brd);border-radius:5px;color:var(--txt);font-size:12px;outline:none}.inp:focus{border-color:var(--blue)}
.form-acts{display:flex;gap:10px}.prj-list{display:flex;flex-direction:column;gap:10px}
.prj-card{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;background:var(--bg2);border:1px solid var(--brd);border-radius:8px;cursor:pointer}
.prj-card:hover{background:var(--bg3);border-color:var(--blue)}.prj-card.cur{border-color:var(--cyan)}
.prj-name{font-weight:600;font-size:14px;margin-bottom:3px}.cur-badge{background:var(--cyan);color:#000;padding:1px 6px;border-radius:3px;font-size:9px;margin-left:6px}
.prj-desc{color:var(--txt2);font-size:12px}.prj-date{color:var(--txt3);font-size:10px;margin-top:3px}
.int-pnl{display:flex;flex-direction:column;width:100%;height:100%}.int-ctrl{display:flex;gap:10px;padding:14px;background:var(--bg2);border-bottom:1px solid var(--brd)}
.int-cnt{display:flex;flex:1;overflow:hidden}.pend-list{width:280px;border-right:1px solid var(--brd);display:flex;flex-direction:column}
.pend-item{display:flex;gap:10px;padding:10px 14px;border-bottom:1px solid var(--brd);cursor:pointer;align-items:center}
.pend-item:hover{background:var(--bgh)}.pend-item.sel{background:var(--bg3);border-left:3px solid var(--orange)}
.int-edit{flex:1;display:flex;flex-direction:column;overflow:hidden}.ed-row{display:flex;gap:10px;padding:10px 14px;background:var(--bg2);border-bottom:1px solid var(--brd)}
.ed-ta{width:100%;padding:14px;background:var(--bg);border:none;border-bottom:1px solid var(--brd);color:var(--txt);font-family:'JetBrains Mono';font-size:11px;resize:none;outline:none}
.scp-pnl{padding:24px;max-width:700px;margin:0 auto;width:100%}.scp-hdr{margin-bottom:20px}.scp-hdr h3{font-size:16px;margin-bottom:6px}.scp-hdr p{color:var(--txt2);font-size:12px}
.scp-form{display:flex;gap:10px;margin-bottom:20px}.sel{padding:8px 12px;background:var(--bg3);border:1px solid var(--brd);border-radius:5px;color:var(--txt);font-size:12px}
.scp-rules{display:flex;flex-direction:column;gap:6px}.scp-rule{display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--bg2);border:1px solid var(--brd);border-radius:6px}
.scp-rule.dis{opacity:.4}.rul-type{padding:3px 8px;border-radius:3px;font-size:10px;font-weight:600}
.rul-inc{background:rgba(63,185,80,.15);color:var(--green)}.rul-exc{background:rgba(248,81,73,.15);color:var(--red)}
.rul-pat{flex:1;font-family:'JetBrains Mono';font-size:12px}.rul-acts{display:flex;gap:6px}
.rep-cnt{display:flex;width:100%;height:100%}.rep-side{width:200px;border-right:1px solid var(--brd);display:flex;flex-direction:column}
.rep-list{flex:1;overflow:auto}.rep-item{display:flex;gap:6px;padding:10px 14px;border-bottom:1px solid var(--brd);cursor:pointer;align-items:center}
.rep-item:hover{background:var(--bgh)}.rep-item.sel{background:var(--bg3);border-left:3px solid var(--purple)}.rep-item .name{font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rep-main{flex:1;display:flex;flex-direction:column}.req-bar{display:flex;gap:10px;padding:10px 14px;background:var(--bg2);border-bottom:1px solid var(--brd)}
.mth-sel{padding:6px 10px;background:var(--bg3);border:1px solid var(--brd);border-radius:5px;color:var(--txt);font-family:'JetBrains Mono';font-size:12px;font-weight:600}
.url-in{flex:1;padding:6px 10px;background:var(--bg3);border:1px solid var(--brd);border-radius:5px;color:var(--txt);font-family:'JetBrains Mono';font-size:12px;outline:none}
.rep-edit{display:grid;grid-template-columns:1fr 1fr;flex:1;gap:1px;background:var(--brd)}.ed-pane{display:flex;flex-direction:column;background:var(--bg)}
.ed-hdr{padding:6px 14px;background:var(--bg2);border-bottom:1px solid var(--brd);font-size:11px;font-weight:500;display:flex;justify-content:space-between}
.git-pnl{padding:24px;max-width:700px;margin:0 auto;width:100%}.git-sec{margin-bottom:20px}
.git-ttl{font-size:13px;font-weight:600;margin-bottom:10px;color:var(--txt2)}.cmt-form{display:flex;gap:10px}
.cmt-in{flex:1;padding:8px 12px;background:var(--bg3);border:1px solid var(--brd);border-radius:5px;color:var(--txt);outline:none}
.cmt-list{background:var(--bg2);border-radius:8px;border:1px solid var(--brd)}.cmt-item{display:flex;gap:14px;padding:12px 14px;border-bottom:1px solid var(--brd);font-family:'JetBrains Mono';font-size:11px;align-items:center}
.cmt-item:last-child{border-bottom:none}.cmt-hash{color:var(--purple);font-weight:500}.cmt-msg{flex:1}.cmt-date{color:var(--txt3);font-size:10px}
.toast-c{position:fixed;bottom:20px;right:20px;z-index:1000}.toast{padding:10px 18px;background:var(--bg3);border:1px solid var(--brd);border-radius:6px;font-size:12px;margin-top:6px;animation:slideIn .2s}
.toast.success{border-color:var(--green)}.toast.error{border-color:var(--red)}@keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}
::-webkit-scrollbar{width:6px;height:6px}::-webkit-scrollbar-track{background:var(--bg)}::-webkit-scrollbar-thumb{background:var(--brd);border-radius:3px}
.context-menu{position:fixed;background:var(--bg2);border:1px solid var(--brd);border-radius:8px;padding:4px;box-shadow:0 8px 24px rgba(0,0,0,0.5);z-index:1000;min-width:180px}
.context-menu-item{padding:8px 12px;font-size:12px;color:var(--txt);cursor:pointer;border-radius:4px;transition:all .15s ease}
.context-menu-item:hover{background:var(--bgh)}
.context-menu-divider{height:1px;background:var(--brd);margin:4px 0}
      `}} />

      <header className="hdr">
        <div className="logo">
          <div className="logo-i">BW</div>
          <span className="logo-t">Blackwire</span>
          {curPrj && <span className="prj-badge">{curPrj}</span>}
        </div>
        <div className="hdr-ctrl">
          {curPrj && (
            <React.Fragment>
              <div className={'int-tog' + (intOn ? ' on' : '')} onClick={togInt}>
                <span className="int-dot"></span>
                Intercept {intOn ? 'ON' : 'OFF'}
                {pending.length > 0 && <span className="pend-badge">{pending.length}</span>}
              </div>
              <div className="prx-st" onClick={() => setShowProxyCfg(true)} style={{ cursor: 'pointer' }} title={'Mode: ' + pxMode + (pxArgs ? ' | Args: ' + pxArgs : '')}>
                <div className={'st-dot ' + (pxRun ? 'run' : 'stop')}></div>
                {pxRun ? pxMode + ' :' + pxPort : 'Stopped'}
              </div>
              {!pxRun ? (
                <button className="btn btn-g" onClick={startPx} disabled={loading}>▶ Start</button>
              ) : (
                <button className="btn btn-d" onClick={stopPx}>■ Stop</button>
              )}
              <button className="btn btn-s" onClick={launchBr} disabled={!pxRun}>🌐</button>
            </React.Fragment>
          )}
        </div>
      </header>

      <nav className="tabs">
        <div className={'tab' + (tab === 'projects' ? ' act' : '')} onClick={() => setTab('projects')}>Projects</div>
        {curPrj && (
          <React.Fragment>
            <div className={'tab' + (tab === 'history' ? ' act' : '')} onClick={() => setTab('history')}>History</div>
            <div className={'tab' + (tab === 'intercept' ? ' act' : '')} onClick={() => setTab('intercept')}>
              Intercept
              {pending.length > 0 && <span className="tab-badge">{pending.length}</span>}
            </div>
            <div className={'tab' + (tab === 'repeater' ? ' act' : '')} onClick={() => setTab('repeater')}>Repeater</div>
            <div className={'tab' + (tab === 'scope' ? ' act' : '')} onClick={() => setTab('scope')}>Scope</div>
            <div className={'tab' + (tab === 'extensions' ? ' act' : '')} onClick={() => setTab('extensions')}>Extensions</div>
            {webhookExt?.enabled && webhookExt?.config?.token_id && (
              <div className={'tab' + (tab === 'webhook' ? ' act' : '')} onClick={() => setTab('webhook')}>
                Webhook
                {whkReqs.length > 0 && <span className="tab-badge">{whkReqs.length}</span>}
              </div>
            )}
            <div className={'tab' + (tab === 'git' ? ' act' : '')} onClick={() => setTab('git')}>Git</div>
          </React.Fragment>
        )}
      </nav>

      <main className="main">
        {tab === 'projects' && (
          <div className="prj-pnl">
            <div className="prj-hdr">
              <h2>Projects</h2>
              <button className="btn btn-p" onClick={() => setShowNew(true)}>+ New</button>
            </div>
            {showNew && (
              <div className="new-prj">
                <input className="inp" placeholder="Project name" value={newName} onChange={e => setNewName(e.target.value)} />
                <input className="inp" placeholder="Description" value={newDesc} onChange={e => setNewDesc(e.target.value)} />
                <div className="form-acts">
                  <button className="btn btn-p" onClick={createPrj}>Create</button>
                  <button className="btn btn-s" onClick={() => setShowNew(false)}>Cancel</button>
                </div>
              </div>
            )}
            <div className="prj-list">
              {prjs.map(p => (
                <div key={p.name} className={'prj-card' + (p.is_current ? ' cur' : '')} onClick={() => selectPrj(p.name)}>
                  <div>
                    <div className="prj-name">
                      {p.name}
                      {p.is_current && <span className="cur-badge">ACTIVE</span>}
                    </div>
                    <div className="prj-desc">{p.description || 'No description'}</div>
                    <div className="prj-date">{p.created_at ? new Date(p.created_at).toLocaleDateString() : ''}</div>
                  </div>
                  <div onClick={e => e.stopPropagation()}>
                    <button className="btn btn-sm btn-d" onClick={() => delPrj(p.name)}>🗑</button>
                  </div>
                </div>
              ))}
              {prjs.length === 0 && (
                <div className="empty">
                  <div className="empty-i"></div>
                  <span>No projects</span>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'history' && curPrj && (
          <React.Fragment>
            <div className="panel hist-pnl">
              <div className="flt-bar">
                <input className="flt-in" placeholder="Filter..." value={search} onChange={e => setSearch(e.target.value)} />
                <div className={'flt-tog' + (scopeOnly ? ' act' : '')} onClick={() => setScopeOnly(!scopeOnly)}>Scope</div>
                <div className={'flt-tog' + (savedOnly ? ' act' : '')} onClick={() => setSavedOnly(!savedOnly)}>★</div>
              </div>
              <div className="pnl-hdr">
                <span>{filtered.length} requests</span>
                <div className="acts">
                  <button className="btn btn-sm btn-s" onClick={loadReqs}>↻</button>
                  <button className="btn btn-sm btn-d" onClick={clearHist}>Clear</button>
                </div>
              </div>
              <div className="pnl-cnt">
                <div className="req-list">
                  {filtered.map(r => (
                    <div
                      key={r.id}
                      className={'req-item' + (selReq?.id === r.id ? ' sel' : '') + (!r.in_scope ? ' out' : '')}
                      onClick={() => setSelReq(r)}
                      onContextMenu={e => showContextMenu(e, r)}
                    >
                      <span className={'mth mth-' + r.method}>{r.method}</span>
                      <span className="url" title={r.url}>{r.url}</span>
                      <span className={'sts ' + stCls(r.response_status)}>{r.response_status || '-'}</span>
                      <span className="ts">{fmtTime(r.timestamp)}</span>
                    </div>
                  ))}
                  {filtered.length === 0 && (
                    <div className="empty">
                      <div className="empty-i">📭</div>
                      <span>No requests</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="panel det-pnl">
              {selReq ? (
                <React.Fragment>
                  <div className="pnl-hdr">
                    <span>{selReq.method} {selReq.url.substring(0, 50)}</span>
                    <div className="acts">
                      <button className="btn btn-sm btn-p" onClick={() => toRep(selReq)}>→ Rep</button>
                      <button className={'btn btn-sm ' + (selReq.saved ? 'btn-g' : 'btn-s')} onClick={() => togSave(selReq.id)}>
                        {selReq.saved ? '★' : '☆'}
                      </button>
                      <button className="btn btn-sm btn-d" onClick={() => delReq(selReq.id)}>🗑</button>
                    </div>
                  </div>
                  <div className="det-tabs">
                    <div className={'det-tab' + (detTab === 'request' ? ' act' : '')} onClick={() => setDetTab('request')}>Request</div>
                    <div className={'det-tab' + (detTab === 'response' ? ' act' : '')} onClick={() => setDetTab('response')}>Response</div>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <button className={'btn btn-sm ' + (detTab === 'request' ? (reqFormat === 'raw' ? 'btn-p' : 'btn-s') : (respFormat === 'raw' ? 'btn-p' : 'btn-s'))} onClick={() => detTab === 'request' ? setReqFormat('raw') : setRespFormat('raw')}>
                        Raw
                      </button>
                      <button className={'btn btn-sm ' + (detTab === 'request' ? (reqFormat === 'pretty' ? 'btn-p' : 'btn-s') : (respFormat === 'pretty' ? 'btn-p' : 'btn-s'))} onClick={() => detTab === 'request' ? setReqFormat('pretty') : setRespFormat('pretty')}>
                        Pretty
                      </button>
                    </div>
                  </div>
                  <div className="code">
                    {(() => {
                      const reqFormatted = selReq.body ? formatBody(selReq.body, reqFormat) : { text: '', html: false };
                      const respFormatted = formatBody(selReq.response_body || '', respFormat);
                      const content = detTab === 'request'
                        ? (selReq.method + ' ' + (() => {
                            try {
                              return new URL(selReq.url).pathname;
                            } catch (e) {
                              return selReq.url;
                            }
                          })() + '\n\n' + fmtH(selReq.headers) + (selReq.body ? '\n\n' + reqFormatted.text : ''))
                        : ('HTTP ' + selReq.response_status + '\n\n' + fmtH(selReq.response_headers) + '\n\n' + respFormatted.text);
                      const isHtml = detTab === 'request' ? reqFormatted.html : respFormatted.html;
                      return isHtml ? <div dangerouslySetInnerHTML={{ __html: content }} /> : content;
                    })()}
                  </div>
                </React.Fragment>
              ) : (
                <div className="empty">
                  <span>Select request</span>
                </div>
              )}
            </div>
          </React.Fragment>
        )}

        {tab === 'intercept' && curPrj && (
          <div className="int-pnl">
            <div className="int-ctrl">
              <button className={'btn btn-lg ' + (intOn ? 'btn-d' : 'btn-g')} onClick={togInt}>
                {intOn ? '🔴 ON' : '⚪ OFF'}
              </button>
              {pending.length > 0 && (
                <React.Fragment>
                  <button className="btn btn-p" onClick={fwdAll}>▶ Forward All ({pending.length})</button>
                  <button className="btn btn-d" onClick={dropAll}>✕ Drop All</button>
                </React.Fragment>
              )}
            </div>
            <div className="int-cnt">
              <div className="pend-list">
                <div className="pnl-hdr">
                  <span>Pending ({pending.length})</span>
                </div>
                {pending.map(r => (
                  <div key={r.id} className={'pend-item' + (selPend?.id === r.id ? ' sel' : '')} onClick={() => { setSelPend(r); setEditReq({ ...r }); }}>
                    <span className={'mth mth-' + r.method}>{r.method}</span>
                    <span className="url">{r.url}</span>
                  </div>
                ))}
                {pending.length === 0 && (
                  <div className="empty" style={{ padding: 30 }}>
                    <span>{intOn ? 'Waiting...' : 'Enable intercept'}</span>
                  </div>
                )}
              </div>
              <div className="int-edit">
                {selPend && editReq ? (
                  <React.Fragment>
                    <div className="pnl-hdr">
                      <span>Edit</span>
                      <div className="acts">
                        <button className="btn btn-g" onClick={() => fwdReq(selPend.id, editReq)}>▶ Forward</button>
                        <button className="btn btn-d" onClick={() => dropReq(selPend.id)}>✕ Drop</button>
                      </div>
                    </div>
                    <div className="ed-row">
                      <select className="mth-sel" value={editReq.method} onChange={e => setEditReq({ ...editReq, method: e.target.value })}>
                        <option>GET</option>
                        <option>POST</option>
                        <option>PUT</option>
                        <option>DELETE</option>
                      </select>
                      <input className="url-in" value={editReq.url} onChange={e => setEditReq({ ...editReq, url: e.target.value })} />
                    </div>
                    <textarea className="ed-ta" placeholder="Headers" style={{ height: '30%' }} value={fmtH(editReq.headers)} onChange={e => {
                      const h = {};
                      e.target.value.split('\n').forEach(l => {
                        const [k, ...v] = l.split(':');
                        if (k && v.length) h[k.trim()] = v.join(':').trim();
                      });
                      setEditReq({ ...editReq, headers: h });
                    }} />
                    <textarea className="ed-ta" placeholder="Body" style={{ flex: 1 }} value={editReq.body || ''} onChange={e => setEditReq({ ...editReq, body: e.target.value })} />
                  </React.Fragment>
                ) : (
                  <div className="empty">
                    <span>Select pending request</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === 'scope' && curPrj && (
          <div className="scp-pnl">
            <div className="scp-hdr">
              <h3>Scope Rules</h3>
              <p>Define which hosts are in scope</p>
            </div>
            <div className="scp-form">
              <input className="inp" style={{ flex: 1 }} placeholder="Pattern: *.example.com" value={newPat} onChange={e => setNewPat(e.target.value)} />
              <select className="sel" value={newType} onChange={e => setNewType(e.target.value)}>
                <option value="include">Include</option>
                <option value="exclude">Exclude</option>
              </select>
              <button className="btn btn-p" onClick={addRule}>+ Add</button>
            </div>
            <div className="scp-rules">
              {scopeRules.map(r => (
                <div key={r.id} className={'scp-rule' + (r.enabled ? '' : ' dis')}>
                  <span className={'rul-type rul-' + (r.rule_type === 'include' ? 'inc' : 'exc')}>{r.rule_type}</span>
                  <span className="rul-pat">{r.pattern}</span>
                  <div className="rul-acts">
                    <button className="btn btn-sm btn-s" onClick={() => togRule(r.id)}>{r.enabled ? 'Disable' : 'Enable'}</button>
                    <button className="btn btn-sm btn-d" onClick={() => delRule(r.id)}>🗑</button>
                  </div>
                </div>
              ))}
              {scopeRules.length === 0 && (
                <div className="empty" style={{ padding: 30 }}>
                  <span>No rules - all in scope</span>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'repeater' && curPrj && (
          <div className="rep-cnt">
            <div className="rep-side">
              <div className="pnl-hdr">
                <span>Saved</span>
                <button className="btn btn-sm btn-p" onClick={saveRep}>+</button>
              </div>
              <div className="rep-list">
                {repReqs.map(r => (
                  <div key={r.id} className={'rep-item' + (selRep === r.id ? ' sel' : '')} onClick={() => loadRepItem(r)}>
                    <span className={'mth mth-' + r.method}>{r.method}</span>
                    <span className="name">{r.name}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rep-main">
              <div className="req-bar">
                <button className="btn btn-s" onClick={() => navigateHistory(-1)} disabled={repHistoryIndex <= 0} title="Previous">◀</button>
                <button className="btn btn-s" onClick={() => navigateHistory(1)} disabled={repHistoryIndex >= repHistory.length - 1} title="Next">▶</button>
                <select className="mth-sel" value={repM} onChange={e => setRepM(e.target.value)}>
                  <option>GET</option>
                  <option>HEAD</option>
                  <option>POST</option>
                  <option>PUT</option>
                  <option>PATCH</option>
                  <option>DELETE</option>
                  <option>CONNECT</option>
                  <option>OPTIONS</option>
                  <option>TRACE</option>
                  <option>PATCH</option>
                </select>
                <input className="url-in" placeholder="https://..." value={repU} onChange={e => setRepU(e.target.value)} />
                <button className="btn btn-p" onClick={sendRep} disabled={loading || !repU}>{loading ? '...' : '▶ Send'}</button>
              </div>
              <div className="rep-edit">
                <div className="ed-pane">
                  <div className="ed-hdr">
                    <span>Headers</span>
                  </div>
                  <textarea className="ed-ta" style={{ height: '40%' }} value={repH} onChange={e => setRepH(e.target.value)} />
                  <div className="ed-hdr">
                    <span>Body</span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button className="btn btn-sm btn-s" onClick={() => setRepB(prettyPrint(repB))} title="Pretty Print">Pretty</button>
                      <button className="btn btn-sm btn-s" onClick={() => setRepB(minify(repB))} title="Minify">Minify</button>
                    </div>
                  </div>
                  <textarea className="ed-ta" style={{ flex: 1 }} value={repB} onChange={e => setRepB(e.target.value)} />
                </div>
                <div className="ed-pane">
                  <div className="ed-hdr">
                    <span>Response</span>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {repResp && !repResp.error && (
                        <span style={{ color: 'var(--txt3)' }}>
                          {repResp.status_code} • {repResp.elapsed?.toFixed(3)}s
                        </span>
                      )}
                      {repResp && repResp.body && !repResp.error && (
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button className="btn btn-sm btn-s" onClick={() => setRepRespBody(prettyPrint(repRespBody))} title="Pretty Print">Pretty</button>
                          <button className="btn btn-sm btn-s" onClick={() => setRepRespBody(minify(repRespBody))} title="Minify">Minify</button>
                        </div>
                      )}
                    </div>
                  </div>
                  {repResp && repResp.error ? (
                    <div className="code">{repResp.error}</div>
                  ) : repResp ? (
                    <>
                      <div className="code" style={{ height: '100px', overflow: 'auto', marginBottom: '8px', borderBottom: '1px solid var(--brd)' }}>
                        {fmtH(repResp.headers)}
                      </div>
                      <textarea
                        className="ed-ta"
                        style={{ flex: 1 }}
                        value={repRespBody}
                        onChange={e => setRepRespBody(e.target.value)}
                        placeholder="Response body will appear here"
                      />
                    </>
                  ) : (
                    <div className="code">Send a request</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'webhook' && curPrj && webhookExt?.enabled && (
          <React.Fragment>
            <div className="panel hist-pnl">
              <div className="flt-bar">
                <input className="flt-in" placeholder="Filter by URL, method, IP..." value={whkSearch} onChange={e => setWhkSearch(e.target.value)} />
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <span style={{ fontSize: '10px', color: 'var(--txt3)' }}>{webhookExt?.config?.token_url ? '● Live' : ''}</span>
                </div>
              </div>
              <div className="pnl-hdr">
                <span>{filteredWhk.length} webhook requests</span>
                <div className="acts">
                  <button className="btn btn-sm btn-s" onClick={() => refreshWebhook()} disabled={whkLoading}>{whkLoading ? '⏳' : '↻'} Sync</button>
                  <button className="btn btn-sm btn-s" onClick={loadWebhookLocal}>↻</button>
                  <button className="btn btn-sm btn-d" onClick={clearWebhookHistory}>Clear</button>
                </div>
              </div>
              <div className="pnl-cnt">
                <div className="req-list">
                  {filteredWhk.map(r => (
                    <div
                      key={r.request_id}
                      className={'req-item' + (selWhkReq?.request_id === r.request_id ? ' sel' : '')}
                      onClick={() => { setSelWhkReq(r); setWhkDetTab('request'); }}
                      onContextMenu={e => {
                        e.preventDefault();
                        setContextMenu({ x: e.clientX, y: e.clientY, request: r, source: 'webhook' });
                      }}
                    >
                      <span className={'mth mth-' + (r.method || 'GET')}>{r.method || 'GET'}</span>
                      <span className="url" title={r.url}>{r.url || r.path || '-'}</span>
                      <span style={{ color: 'var(--txt2)', fontSize: '10px', minWidth: '90px' }}>{r.ip || '-'}</span>
                      <span className="ts">{fmtTime(r.created_at)}</span>
                    </div>
                  ))}
                  {filteredWhk.length === 0 && (
                    <div className="empty">
                      <div className="empty-i">🔗</div>
                      <span>{webhookExt?.config?.token_id ? 'No webhook requests yet' : 'Create a webhook URL first'}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="panel det-pnl">
              {selWhkReq ? (
                <React.Fragment>
                  <div className="pnl-hdr">
                    <span>{selWhkReq.method || 'GET'} {(selWhkReq.url || '').substring(0, 50)}</span>
                    <div className="acts">
                      <button className="btn btn-sm btn-p" onClick={() => whkToRepeater(selWhkReq)}>→ Rep</button>
                      <button className="btn btn-sm btn-s" onClick={() => {
                        navigator.clipboard.writeText(selWhkReq.url || '');
                        toast('URL copied', 'success');
                      }}>📋</button>
                    </div>
                  </div>
                  <div className="det-tabs">
                    <div className={'det-tab' + (whkDetTab === 'request' ? ' act' : '')} onClick={() => setWhkDetTab('request')}>Request</div>
                    <div className={'det-tab' + (whkDetTab === 'headers' ? ' act' : '')} onClick={() => setWhkDetTab('headers')}>Headers</div>
                    <div className={'det-tab' + (whkDetTab === 'query' ? ' act' : '')} onClick={() => setWhkDetTab('query')}>Query</div>
                    <div className={'det-tab' + (whkDetTab === 'body' ? ' act' : '')} onClick={() => setWhkDetTab('body')}>Body</div>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {(whkDetTab === 'body' || whkDetTab === 'request') && (
                        <React.Fragment>
                          <button className={'btn btn-sm ' + (whkReqFormat === 'raw' ? 'btn-p' : 'btn-s')} onClick={() => setWhkReqFormat('raw')}>Raw</button>
                          <button className={'btn btn-sm ' + (whkReqFormat === 'pretty' ? 'btn-p' : 'btn-s')} onClick={() => setWhkReqFormat('pretty')}>Pretty</button>
                        </React.Fragment>
                      )}
                    </div>
                  </div>
                  <div className="code">
                    {(() => {
                      if (whkDetTab === 'request') {
                        const info = (selWhkReq.method || 'GET') + ' ' + (selWhkReq.url || '') + '\n'
                          + 'IP: ' + (selWhkReq.ip || '-') + '\n'
                          + 'User-Agent: ' + (selWhkReq.user_agent || '-') + '\n'
                          + 'Time: ' + (selWhkReq.created_at || '-') + '\n\n'
                          + '--- Headers ---\n' + fmtH(selWhkReq.headers)
                          + (selWhkReq.content ? '\n\n--- Body ---\n' + (whkReqFormat === 'pretty' ? formatBody(selWhkReq.content, 'pretty').text : selWhkReq.content) : '');
                        return info;
                      }
                      if (whkDetTab === 'headers') {
                        return fmtH(selWhkReq.headers) || 'No headers';
                      }
                      if (whkDetTab === 'query') {
                        const q = selWhkReq.query || {};
                        const entries = Object.entries(q);
                        if (entries.length === 0) return 'No query parameters';
                        return entries.map(([k, v]) => k + ' = ' + v).join('\n');
                      }
                      if (whkDetTab === 'body') {
                        if (!selWhkReq.content) return 'No body content';
                        if (whkReqFormat === 'pretty') {
                          return formatBody(selWhkReq.content, 'pretty').text;
                        }
                        return selWhkReq.content;
                      }
                      return '';
                    })()}
                  </div>
                </React.Fragment>
              ) : (
                <div className="empty">
                  <span>Select a webhook request</span>
                </div>
              )}
            </div>
          </React.Fragment>
        )}

        {tab === 'git' && curPrj && (
          <div className="git-pnl">
            <div className="git-sec">
              <div className="git-ttl">Create Commit (Press Ctrl+S for auto-commit)</div>
              <div className="cmt-form">
                <input className="cmt-in" placeholder="Message..." value={cmtMsg} onChange={e => setCmtMsg(e.target.value)} onKeyPress={e => e.key === 'Enter' && commit()} />
                <button className="btn btn-p" onClick={commit}>Commit</button>
              </div>
            </div>
            <div className="git-sec">
              <div className="git-ttl">History</div>
              <div className="cmt-list">
                {commits.map((c, i) => (
                  <div key={i} className="cmt-item">
                    <span className="cmt-hash">{c.hash}</span>
                    <span className="cmt-msg">{c.message}</span>
                    <span className="cmt-date">{c.date}</span>
                  </div>
                ))}
                {commits.length === 0 && (
                  <div className="cmt-item" style={{ justifyContent: 'center', color: 'var(--txt3)' }}>
                    No commits
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === 'extensions' && curPrj && (
          <div className="scp-pnl">
            <div className="scp-hdr">
              <h3>Extensions</h3>
              <p>Manage and configure extensions for request/response manipulation</p>
            </div>
            {extensions.length === 0 && (
              <div className="empty" style={{ padding: 30 }}>
                <div className="empty-i"></div>
                <span>No extensions installed</span>
              </div>
            )}
            {extensions.map(ext => (
              <div key={ext.name} style={{ background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: '8px', padding: '16px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>{ext.title || ext.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--txt2)' }}>{ext.description || 'No description'}</div>
                  </div>
                  <button className={'btn btn-sm ' + (ext.enabled ? 'btn-g' : 'btn-s')} onClick={() => togExtEnabled(ext.name, !ext.enabled)}>
                    {ext.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
                {ext.enabled && EXTENSION_COMPONENTS[ext.name] &&
                  React.createElement(EXTENSION_COMPONENTS[ext.name], {
                    ext,
                    updateExtCfg,
                    ...(ext.name === 'webhook_site' ? {
                      whkReqs,
                      whkApiKey,
                      setWhkApiKey,
                      whkLoading,
                      createWebhookToken,
                      refreshWebhook,
                      loadWebhookLocal,
                      toast
                    } : {})
                  })
                }
              </div>
            ))}
          </div>
        )}
      </main>

      <div className="toast-c">
        {toasts.map(t => (
          <div key={t.id} className={'toast ' + t.type}>{t.message}</div>
        ))}
      </div>

      {contextMenu && (
        <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={e => e.stopPropagation()}>
          {contextMenu.source === 'webhook' ? (
            <React.Fragment>
              <div className="context-menu-item" onClick={() => whkContextAction('repeater', contextMenu.request)}>
                Send to Repeater
              </div>
              <div className="context-menu-item" onClick={() => whkContextAction('copy-url', contextMenu.request)}>
                Copy URL
              </div>
              <div className="context-menu-item" onClick={() => whkContextAction('copy-curl', contextMenu.request)}>
                Copy as cURL
              </div>
              <div className="context-menu-item" onClick={() => whkContextAction('copy-content', contextMenu.request)}>
                Copy Body
              </div>
            </React.Fragment>
          ) : (
            <React.Fragment>
              <div className="context-menu-item" onClick={() => handleContextAction('repeater', contextMenu.request)}>
                Send to Repeater
              </div>
              <div className="context-menu-item" onClick={() => handleContextAction('favorite', contextMenu.request)}>
                {contextMenu.request.saved ? 'Unmark' : 'Mark'} as Favorite
              </div>
              <div className="context-menu-item" onClick={() => handleContextAction('copy-url', contextMenu.request)}>
                Copy URL
              </div>
              <div className="context-menu-item" onClick={() => handleContextAction('copy-curl', contextMenu.request)}>
                Copy as cURL
              </div>
              <div className="context-menu-divider" />
              <div className="context-menu-item" onClick={() => handleContextAction('delete', contextMenu.request)}>
                Delete
              </div>
            </React.Fragment>
          )}
        </div>
      )}

      {showProxyCfg && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }} onClick={() => setShowProxyCfg(false)}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: '8px', padding: '24px', minWidth: '500px', maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '16px', marginBottom: '16px' }}>Proxy Configuration</h3>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--txt2)', marginBottom: '6px' }}>Port</label>
              <input className="inp" type="number" value={pxPort} onChange={e => setPxPort(parseInt(e.target.value) || 8080)} min="1" max="65535" />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--txt2)', marginBottom: '6px' }}>Mode</label>
              <select className="sel" value={pxMode} onChange={e => setPxMode(e.target.value)} style={{ width: '100%' }}>
                <option value="regular">Regular</option>
                <option value="transparent">Transparent</option>
                <option value="socks5">SOCKS5</option>
                <option value="reverse:http://example.com">Reverse Proxy</option>
                <option value="upstream:http://proxy.example.com:8080">Upstream Proxy</option>
              </select>
              <div style={{ fontSize: '10px', color: 'var(--txt3)', marginTop: '4px' }}>Select proxy operating mode</div>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--txt2)', marginBottom: '6px' }}>Additional Arguments</label>
              <input className="inp" type="text" value={pxArgs} onChange={e => setPxArgs(e.target.value)} placeholder="--ssl-insecure --verbose" />
              <div style={{ fontSize: '10px', color: 'var(--txt3)', marginTop: '4px' }}>Extra mitmproxy arguments (e.g., --ssl-insecure --verbose)</div>
            </div>
            <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--bg3)', borderRadius: '6px', fontSize: '11px' }}>
              <div style={{ fontWeight: '600', marginBottom: '8px', color: 'var(--txt2)' }}>Common Configurations:</div>
              <div style={{ marginBottom: '4px' }}><strong>Transparent:</strong> Intercept traffic at network level (requires iptables)</div>
              <div style={{ marginBottom: '4px' }}><strong>SOCKS5:</strong> Run as SOCKS5 proxy server</div>
              <div style={{ marginBottom: '4px' }}><strong>Reverse:</strong> Act as reverse proxy for specific server</div>
              <div style={{ marginBottom: '4px' }}><strong>Upstream:</strong> Chain with another proxy</div>
              <div style={{ marginTop: '8px', color: 'var(--txt3)', fontSize: '10px' }}>Docs: <a href="https://docs.mitmproxy.org/stable/concepts-modes/" target="_blank" style={{ color: 'var(--cyan)' }}>mitmproxy.org/modes</a></div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-p" onClick={saveProxyCfg}>Save</button>
              <button className="btn btn-s" onClick={() => setShowProxyCfg(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<Blackwire />);
