const { useState, useEffect, useRef } = React;

const API = '';
const WS_URL = 'ws://' + location.host + '/ws';

const THEMES = window.BW_THEMES || {};

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
  const [histSubTab, setHistSubTab] = useState('http'); // 'http' | 'ws'

  // Estado del Repeater
  const [repReqs, setRepReqs] = useState([]);
  const [selRep, setSelRep] = useState(null);
  const [repM, setRepM] = useState('GET');
  const [repU, setRepU] = useState('');
  const [repH, setRepH] = useState('');
  const [repB, setRepB] = useState('');
  const [repBodyColor, setRepBodyColor] = useState(false);
  const [repResp, setRepResp] = useState(null);
  const [repRespBody, setRepRespBody] = useState('');

  // Historial de navegación en Repeater
  const [repHistory, setRepHistory] = useState([]);
  const [repHistoryIndex, setRepHistoryIndex] = useState(-1);
  const [repFollowRedirects, setRepFollowRedirects] = useState(false);

  // Estado general
  const [loading, setLoading] = useState(false);
  const [commits, setCommits] = useState([]);
  const [cmtMsg, setCmtMsg] = useState('');
  const [toasts, setToasts] = useState([]);
  const [themeId, setThemeId] = useState('midnight');

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

  // Menú contextual
  const [contextMenu, setContextMenu] = useState(null);
  const ctxMenuRef = useRef(null);

  // Chepy
  const [chepyIn, setChepyIn] = useState('');
  const [chepyOps, setChepyOps] = useState([]);
  const [chepyOut, setChepyOut] = useState('');
  const [chepyErr, setChepyErr] = useState('');
  const [chepyCat, setChepyCat] = useState({});
  const [chepySelCat, setChepySelCat] = useState('');
  const [chepyBaking, setChepyBaking] = useState(false);

  // WebSocket Viewer
  const [wsConns, setWsConns] = useState([]);
  const [selWsConn, setSelWsConn] = useState(null);
  const [wsFrames, setWsFrames] = useState([]);
  const [selWsFrame, setSelWsFrame] = useState(null);
  const [wsResendMsg, setWsResendMsg] = useState('');
  const [wsResendResp, setWsResendResp] = useState(null);
  const [wsSending, setWsSending] = useState(false);

  // Collections
  const [colls, setColls] = useState([]);
  const [selColl, setSelColl] = useState(null);
  const [collItems, setCollItems] = useState([]);
  const [collVars, setCollVars] = useState({});
  const [collStep, setCollStep] = useState(0);
  const [collResps, setCollResps] = useState({});
  const [collRunning, setCollRunning] = useState(false);
  const [showCollPick, setShowCollPick] = useState(null);

  const wsRef = useRef(null);
  const repBodyEditRef = useRef(null);
  const repBodyCaretRef = useRef(null);
  const webhookExt = extensions.find(e => e.name === 'webhook_site');

  const getSelectedText = () => {
    try {
      const sel = window.getSelection();
      if (!sel) return '';
      return sel.toString().trim();
    } catch (e) {
      return '';
    }
  };

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
    try {
      const saved = localStorage.getItem('bw_theme');
      if (saved && THEMES[saved]) setThemeId(saved);
    } catch (e) {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('bw_theme', themeId);
    } catch (e) {
      // ignore storage errors
    }
  }, [themeId]);

  useEffect(() => {
    const handler = e => {
      const selected = getSelectedText();
      if (!selected) return;
      if (e.defaultPrevented) return;
      const target = e.target;
      if (target && target.closest('input, textarea, [contenteditable="true"]')) return;
      e.preventDefault();
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        source: 'selection',
        request: { body: selected },
        normalized: { id: 'selection', method: 'TEXT', url: '', headers: {}, body: selected, source: 'selection' }
      });
    };
    document.addEventListener('contextmenu', handler);
    return () => document.removeEventListener('contextmenu', handler);
  }, []);

  useEffect(() => {
    if (curPrj) {
      loadReqs();
      loadRep();
      loadGit();
      loadScope();
      loadColls();
      loadExts();
      checkPx();
    }
  }, [curPrj]);

  // Ctrl+S para auto-commits
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
      // Reposicionar si el menú se sale del viewport
      requestAnimationFrame(() => {
        const el = ctxMenuRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        let x = contextMenu.x;
        let y = contextMenu.y;
        if (x + rect.width > window.innerWidth) x = window.innerWidth - rect.width - 8;
        if (y + rect.height > window.innerHeight) y = window.innerHeight - rect.height - 8;
        if (x < 0) x = 8;
        if (y < 0) y = 8;
        if (x !== contextMenu.x || y !== contextMenu.y) {
          el.style.left = x + 'px';
          el.style.top = y + 'px';
        }
      });
      return () => window.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  useEffect(() => {
    if (tab === 'chepy' && Object.keys(chepyCat).length === 0) {
      loadChepyOps();
    }
  }, [tab]);

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

  // whkContextAction removed - unified into handleContextAction

  const filteredWhk = whkReqs.filter(r => {
    if (whkSearch && !(r.url || '').toLowerCase().includes(whkSearch.toLowerCase()) &&
        !(r.method || '').toLowerCase().includes(whkSearch.toLowerCase()) &&
        !(r.ip || '').toLowerCase().includes(whkSearch.toLowerCase())) return false;
    return true;
  });

  const selectPrj = async n => {
    const r = await api.post('/api/projects/' + encodeURIComponent(n) + '/select');
    if (r && r.status === 'selected') {
      setCurPrj(n);
      await loadCur();
      setTab('history');
      toast('Project: ' + n, 'success');
    } else {
      toast(r?.detail || 'Failed to select project', 'error');
    }
  };

  const createPrj = async () => {
    const name = newName.trim();
    if (!name) return;
    if (/[\\/]/.test(name)) {
      toast('Project name cannot contain / or \\', 'error');
      return;
    }
    const r = await api.post('/api/projects', { name, description: newDesc });
    if (!r || r.status !== 'created') {
      toast(r?.detail || 'Failed to create project', 'error');
      return;
    }
    await loadPrjs();
    await selectPrj(name);
    setShowNew(false);
    setNewName('');
    setNewDesc('');
    toast('Created', 'success');
  };

  const delPrj = async n => {
    if (!confirm('Delete ' + n + '?')) return;
    const r = await api.del('/api/projects/' + encodeURIComponent(n));
    if (r && (r.status === 'deleted' || r.status === 'ok')) {
      if (curPrj === n) setCurPrj(null);
      await loadPrjs();
      toast('Deleted', 'success');
    } else {
      toast(r?.detail || 'Failed to delete project', 'error');
    }
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

  // Pretty Print/Minify en Repeater
  // Protobuf best-effort decoder (sin esquema)
  const tryDecodeProtobuf = raw => {
    try {
      const bytes = typeof raw === 'string'
        ? new Uint8Array([...raw].map(c => c.charCodeAt(0)))
        : new Uint8Array(raw);
      if (bytes.length < 2) return null;

      const readVarint = (buf, offset) => {
        let result = 0, shift = 0;
        while (offset < buf.length) {
          const b = buf[offset++];
          result |= (b & 0x7f) << shift;
          if ((b & 0x80) === 0) return { value: result, offset };
          shift += 7;
          if (shift > 35) return null;
        }
        return null;
      };

      const decodeFields = (buf, start, end) => {
        const fields = [];
        let pos = start;
        while (pos < end) {
          const tag = readVarint(buf, pos);
          if (!tag || tag.value === 0) return null;
          pos = tag.offset;
          const fieldNum = tag.value >>> 3;
          const wireType = tag.value & 0x7;
          if (fieldNum < 1 || fieldNum > 536870911) return null;

          if (wireType === 0) { // varint
            const v = readVarint(buf, pos);
            if (!v) return null;
            pos = v.offset;
            fields.push({ field: fieldNum, type: 'varint', value: v.value });
          } else if (wireType === 2) { // length-delimited
            const len = readVarint(buf, pos);
            if (!len || len.value < 0 || pos + len.value > end) return null;
            pos = len.offset;
            const chunk = buf.slice(pos, pos + len.value);
            pos += len.value;
            // Intentar decodificar recursivamente como submensaje
            const sub = decodeFields(buf, pos - len.value, pos);
            if (sub && sub.length > 0) {
              fields.push({ field: fieldNum, type: 'message', value: sub });
            } else {
              // Intentar como string UTF-8
              try {
                const str = new TextDecoder('utf-8', { fatal: true }).decode(chunk);
                if (/^[\x20-\x7e\n\r\t]*$/.test(str) && str.length > 0) {
                  fields.push({ field: fieldNum, type: 'string', value: str });
                } else {
                  fields.push({ field: fieldNum, type: 'bytes', value: Array.from(chunk).map(b => b.toString(16).padStart(2, '0')).join(' ') });
                }
              } catch {
                fields.push({ field: fieldNum, type: 'bytes', value: Array.from(chunk).map(b => b.toString(16).padStart(2, '0')).join(' ') });
              }
            }
          } else if (wireType === 5) { // 32-bit
            if (pos + 4 > end) return null;
            const v = new DataView(buf.buffer, buf.byteOffset + pos, 4);
            fields.push({ field: fieldNum, type: 'fixed32', value: v.getFloat32(0, true) });
            pos += 4;
          } else if (wireType === 1) { // 64-bit
            if (pos + 8 > end) return null;
            const v = new DataView(buf.buffer, buf.byteOffset + pos, 8);
            fields.push({ field: fieldNum, type: 'fixed64', value: v.getFloat64(0, true) });
            pos += 8;
          } else {
            return null; // wire type desconocido
          }
        }
        return fields.length > 0 ? fields : null;
      };

      const formatFields = (fields, indent = 0) => {
        const pad = '  '.repeat(indent);
        return fields.map(f => {
          if (f.type === 'message') {
            return pad + 'field ' + f.field + ' {' + '\n' + formatFields(f.value, indent + 1) + '\n' + pad + '}';
          }
          return pad + 'field ' + f.field + ' (' + f.type + '): ' + f.value;
        }).join('\n');
      };

      const fields = decodeFields(bytes, 0, bytes.length);
      if (fields && fields.length > 0) {
        return '// Protobuf (best-effort decode)\n' + formatFields(fields);
      }
    } catch (e) {}
    return null;
  };

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
    // Protobuf best-effort: intentar decodificar datos binarios
    const proto = tryDecodeProtobuf(text);
    if (proto) return proto;
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

  // Chepy functions
  const loadChepyOps = async () => {
    const data = await api.get('/api/chepy/operations');
    if (data.operations) {
      setChepyCat(data.operations);
      const cats = Object.keys(data.operations);
      if (cats.length > 0 && !chepySelCat) setChepySelCat(cats[0]);
    }
  };

  const addChepyOp = op => {
    setChepyOps(prev => [...prev, {
      name: op.name,
      label: op.label,
      args: Object.fromEntries((op.params || []).map(p => [p.name, p.default || ''])),
      params: op.params || []
    }]);
  };

  const removeChepyOp = index => {
    setChepyOps(prev => prev.filter((_, i) => i !== index));
  };

  const updateChepyArg = (index, argName, value) => {
    setChepyOps(prev => prev.map((op, i) =>
      i === index ? { ...op, args: { ...op.args, [argName]: value } } : op
    ));
  };

  const moveChepyOp = (index, direction) => {
    setChepyOps(prev => {
      const arr = [...prev];
      const target = index + direction;
      if (target < 0 || target >= arr.length) return arr;
      [arr[index], arr[target]] = [arr[target], arr[index]];
      return arr;
    });
  };

  const bakeChepy = async () => {
    if (!chepyIn && chepyOps.length === 0) return;
    setChepyBaking(true);
    setChepyErr('');
    try {
      const data = await api.post('/api/chepy/bake', {
        input: chepyIn,
        operations: chepyOps.map(op => ({ name: op.name, args: op.args }))
      });
      if (data.error) {
        setChepyErr(data.error);
        setChepyOut('');
      } else {
        setChepyOut(data.output || '');
      }
    } catch (e) {
      setChepyErr(String(e));
    }
    setChepyBaking(false);
  };

  const clearChepyRecipe = () => {
    setChepyOps([]);
    setChepyOut('');
    setChepyErr('');
  };

  // WebSocket Viewer functions
  const loadWsConns = async () => {
    const data = await api.get('/api/websocket/connections');
    setWsConns(Array.isArray(data) ? data : []);
  };

  const loadWsFrames = async url => {
    setSelWsConn(url);
    const data = await api.get('/api/websocket/frames?url=' + encodeURIComponent(url));
    setWsFrames(Array.isArray(data) ? data : []);
    setSelWsFrame(null);
    setWsResendResp(null);
  };

  const selectWsFrame = f => {
    setSelWsFrame(f);
    setWsResendMsg(f.content || '');
    setWsResendResp(null);
  };

  const resendWsFrame = async () => {
    if (!selWsConn || !wsResendMsg) return;
    setWsSending(true);
    setWsResendResp(null);
    const r = await api.post('/api/websocket/resend', { url: selWsConn, message: wsResendMsg });
    setWsResendResp(r);
    setWsSending(false);
    if (r.error) toast('WS Error: ' + r.error, 'error');
    else toast('Frame sent', 'success');
  };

  // Collections functions
  const loadColls = async () => {
    const data = await api.get('/api/collections');
    setColls(Array.isArray(data) ? data : []);
  };

  const createColl = async () => {
    const n = prompt('Collection name:');
    if (!n) return;
    const r = await api.post('/api/collections', { name: n });
    await loadColls();
    if (r.id) { setSelColl(r.id); loadCollItems(r.id); }
    toast('Collection created', 'success');
  };

  const deleteColl = async id => {
    if (!confirm('Delete collection?')) return;
    await api.del('/api/collections/' + id);
    if (selColl === id) { setSelColl(null); setCollItems([]); }
    loadColls();
    toast('Deleted', 'success');
  };

  const loadCollItems = async cid => {
    setSelColl(cid);
    const data = await api.get('/api/collections/' + cid + '/items');
    setCollItems(Array.isArray(data) ? data : []);
    setCollStep(0);
    setCollVars({});
    setCollResps({});
  };

  const addToCollection = async (collId, req) => {
    const headers = req.headers || {};
    await api.post('/api/collections/' + collId + '/items', {
      method: req.method || 'GET',
      url: req.url || '',
      headers: typeof headers === 'string' ? {} : headers,
      body: req.body || req.content || null,
      var_extracts: []
    });
    if (selColl === collId) loadCollItems(collId);
    toast('Added to collection', 'success');
    setShowCollPick(null);
  };

  const deleteCollItem = async (cid, iid) => {
    await api.del('/api/collections/' + cid + '/items/' + iid);
    loadCollItems(cid);
  };

  const updateCollItemExtracts = async (cid, iid, extracts) => {
    await api.put('/api/collections/' + cid + '/items/' + iid, { var_extracts: extracts });
    loadCollItems(cid);
  };

  const executeCollStep = async () => {
    if (!selColl || collStep >= collItems.length) return;
    const item = collItems[collStep];
    setCollRunning(true);
    const r = await api.post('/api/collections/' + selColl + '/items/' + item.id + '/execute', { variables: collVars });
    setCollRunning(false);
    if (r.error) {
      toast('Step failed: ' + r.error, 'error');
      setCollResps(prev => ({ ...prev, [item.id]: r }));
      return;
    }
    if (r.extracted_variables) {
      setCollVars(prev => ({ ...prev, ...r.extracted_variables }));
    }
    setCollResps(prev => ({ ...prev, [item.id]: r }));
    if (collStep < collItems.length - 1) {
      setCollStep(prev => prev + 1);
    }
    toast('Step ' + (collStep + 1) + ' complete', 'success');
  };

  const resetCollRun = () => {
    setCollStep(0);
    setCollVars({});
    setCollResps({});
  };

  // Historial de navegación en Repeater
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

    // Auto-calcular Content-Length si hay body
    if (repB) {
      const len = new TextEncoder().encode(repB).length;
      const clKey = Object.keys(h).find(k => k.toLowerCase() === 'content-length');
      if (clKey) h[clKey] = String(len);
      else h['Content-Length'] = String(len);
    } else {
      // Eliminar Content-Length si no hay body
      const clKey = Object.keys(h).find(k => k.toLowerCase() === 'content-length');
      if (clKey) delete h[clKey];
    }

    const requestData = { method: repM, url: repU, headers: h, body: repB };
    const r = await api.post('/api/repeater/send-raw', { ...requestData, body: repB || null, follow_redirects: repFollowRedirects });
    setRepResp(r);
    setRepRespBody(r.body || '');
    setLoading(false);

    // Guardar en historial de navegación
    saveToHistory(requestData, r);

    // Auto-save: siempre guardar automáticamente
    if (selRep) {
      // Actualizar item existente con datos actuales y última respuesta
      await api.put('/api/repeater/' + selRep, { method: repM, url: repU, headers: h, body: repB, last_response: r });
      loadRep();
    } else {
      // Crear nuevo item automáticamente
      let host = repU;
      try { host = new URL(repU).host; } catch (e) {}
      const autoName = repM + ' ' + host;
      await api.post('/api/repeater', { name: autoName, method: repM, url: repU, headers: h, body: repB });
      const items = await api.get('/api/repeater');
      setRepReqs(items);
      if (items.length > 0) setSelRep(items[0].id);
    }
  };

  const followRedirect = async () => {
    if (!repResp || !repResp.is_redirect || !repResp.redirect_url) return;
    let nextUrl = repResp.redirect_url;
    // Resolver URL relativa
    try {
      nextUrl = new URL(nextUrl, repU).href;
    } catch (e) {}
    setRepU(nextUrl);
    setRepM('GET');
    setLoading(true);
    setRepResp(null);
    let h = {};
    try {
      repH.split('\n').forEach(l => {
        const [k, ...v] = l.split(':');
        if (k && v.length) h[k.trim()] = v.join(':').trim();
      });
    } catch (e) {}
    const requestData = { method: 'GET', url: nextUrl, headers: h, body: null };
    const r = await api.post('/api/repeater/send-raw', { ...requestData, follow_redirects: false });
    setRepResp(r);
    setRepRespBody(r.body || '');
    setLoading(false);
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
    if (r.last_response) {
      setRepResp(r.last_response);
      setRepRespBody(r.last_response.body || '');
    } else {
      setRepResp(null);
      setRepRespBody('');
    }
  };

  const renameRepItem = async id => {
    const item = repReqs.find(r => r.id === id);
    if (!item) return;
    const n = prompt('Rename:', item.name);
    if (!n || n === item.name) return;
    await api.put('/api/repeater/' + id, { name: n });
    loadRep();
    toast('Renamed', 'success');
  };

  const delRepItem = async id => {
    await api.del('/api/repeater/' + id);
    if (selRep === id) setSelRep(null);
    loadRep();
    toast('Deleted', 'success');
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

  // Auto-commit con Ctrl+S
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
    await api.put('/api/projects/' + encodeURIComponent(name), config);
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
      sel: { background: 'var(--bg)', color: 'var(--txt)', border: '1px solid var(--brd)', borderRadius: '4px', padding: '4px 6px', fontSize: '11px', fontFamily: 'var(--font-mono)', outline: 'none' },
      inp: { background: 'var(--bg)', color: 'var(--txt)', border: '1px solid var(--brd)', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', fontFamily: 'var(--font-mono)', flex: 1, outline: 'none', width: '100%' },
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
                  title="Regular expression" style={{ fontFamily: 'var(--font-mono)', fontSize: '10px' }}>.*</button>
                <button className={'btn btn-sm ' + (rule.ignore_case ? 'btn-p' : 'btn-s')} onClick={() => updateRule(idx, 'ignore_case', !rule.ignore_case)}
                  title="Ignore case" style={{ fontFamily: 'var(--font-mono)', fontSize: '10px' }}>Aa</button>
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
                <div key={r.request_id} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 120px 140px', gap: '8px', padding: '8px 10px', borderBottom: '1px solid var(--brd)', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
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

  const syntaxHighlightJSON = json => {
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

  const syntaxHighlightXML = xml => {
    const esc = xml.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return esc
      .replace(/(&lt;\/?)([\w:.-]+)/g, '$1<span class="json-key">$2</span>')
      .replace(/([\w:.-]+)(=)(&quot;|")/g, '<span class="json-bool">$1</span>$2$3')
      .replace(/(&quot;|")(.*?)(&quot;|")/g, '$1<span class="json-string">$2</span>$3')
      .replace(/(&lt;!--.*?--&gt;)/g, '<span class="json-null">$1</span>');
  };

  const syntaxHighlightProto = text => {
    const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return esc
      .replace(/^(\/\/.*)/gm, '<span class="json-null">$1</span>')
      .replace(/(field \d+)/g, '<span class="json-key">$1</span>')
      .replace(/\((varint|string|bytes|message|fixed32|fixed64)\)/g, '(<span class="json-bool">$1</span>)')
      .replace(/: (.+)$/gm, (m, val) => {
        if (/^\d+(\.\d+)?$/.test(val)) return ': <span class="json-number">' + val + '</span>';
        return ': <span class="json-string">' + val + '</span>';
      });
  };

  const escapeHtml = s => String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const getCaretOffset = el => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    if (!el.contains(range.startContainer)) return null;
    const pre = range.cloneRange();
    pre.selectNodeContents(el);
    pre.setEnd(range.startContainer, range.startOffset);
    return pre.toString().length;
  };

  const setCaretOffset = (el, offset) => {
    if (offset == null) return;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    let node;
    let remaining = offset;
    while ((node = walker.nextNode())) {
      const len = node.textContent.length;
      if (remaining <= len) {
        const range = document.createRange();
        range.setStart(node, remaining);
        range.collapse(true);
        const sel = window.getSelection();
        if (!sel) return;
        sel.removeAllRanges();
        sel.addRange(range);
        return;
      }
      remaining -= len;
    }
  };

  // Colorea cualquier body inteligentemente (JSON, XML, protobuf, texto plano)
  const colorizeBody = text => {
    if (!text) return { text: text, html: false };
    // JSON
    try {
      JSON.parse(text);
      return { text: syntaxHighlightJSON(text), html: true };
    } catch (e) {}
    // XML
    try {
      const parser = new DOMParser();
      const xml = parser.parseFromString(text, 'text/xml');
      if (xml.getElementsByTagName('parsererror').length === 0 && text.trim().startsWith('<')) {
        return { text: syntaxHighlightXML(text), html: true };
      }
    } catch (e) {}
    // Protobuf best-effort output
    if (text.includes('// Protobuf') && text.includes('field ')) {
      return { text: syntaxHighlightProto(text), html: true };
    }
    return { text: text, html: false };
  };

  const formatBody = (body, format) => {
    if (!body) return { text: body, html: false };
    if (format === 'pretty') {
      try {
        const obj = JSON.parse(body);
        const formatted = JSON.stringify(obj, null, 2);
        return { text: syntaxHighlightJSON(formatted), html: true };
      } catch (e) {
        // XML pretty
        try {
          const parser = new DOMParser();
          const xml = parser.parseFromString(body, 'text/xml');
          if (xml.getElementsByTagName('parsererror').length === 0 && body.trim().startsWith('<')) {
            const formatted = formatXml(new XMLSerializer().serializeToString(xml));
            return { text: syntaxHighlightXML(formatted), html: true };
          }
        } catch (e2) {}
        // Protobuf best-effort
        const proto = tryDecodeProtobuf(body);
        if (proto) return { text: syntaxHighlightProto(proto), html: true };
      }
    }
    // Siempre intentar colorear, incluso en raw
    return colorizeBody(body);
  };

  const handleRepBodyInput = () => {
    const el = repBodyEditRef.current;
    if (!el) return;
    repBodyCaretRef.current = getCaretOffset(el);
    const text = el.textContent || '';
    setRepB(text);
  };

  useEffect(() => {
    if (!repBodyColor) return;
    const el = repBodyEditRef.current;
    if (!el) return;
    const bodyFmt = formatBody(repB || '', 'pretty');
    const html = bodyFmt.html ? bodyFmt.text : escapeHtml(bodyFmt.text || '');
    if (el.innerHTML !== html) el.innerHTML = html;
    if (repBodyCaretRef.current != null) setCaretOffset(el, repBodyCaretRef.current);
  }, [repB, repBodyColor]);

  // Menú contextual
  // Unified context menu
  const normalizeRequest = (req, source) => {
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

  const showContextMenu = (e, req, source) => {
    e.preventDefault();
    const norm = normalizeRequest(req, source || 'history');
    setContextMenu({ x: e.clientX, y: e.clientY, request: req, source: source || 'history', normalized: norm });
  };

  

  const handleContextAction = async action => {
    if (!contextMenu) return;
    const norm = contextMenu.normalized;
    const req = contextMenu.request;
    const source = contextMenu.source;
    setContextMenu(null);
    switch (action) {
      case 'repeater':
        toRep({ method: norm.method, url: norm.url, headers: norm.headers, body: norm.body });
        break;
      case 'favorite':
        if (source === 'history' && req.id) await togSave(req.id);
        break;
      case 'copy-url':
        navigator.clipboard.writeText(norm.url);
        toast('URL copied', 'success');
        break;
      case 'copy-curl':
        navigator.clipboard.writeText(generateCurl(norm));
        toast('cURL copied', 'success');
        break;
      case 'copy-body':
        navigator.clipboard.writeText(norm.body || '');
        toast('Body copied', 'success');
        break;
      case 'send-to-cipher':
        if (norm.body) {
          setChepyIn(norm.body);
          setTab('chepy');
          toast('Sent to Cipher', 'success');
        } else {
          toast('No text selected', 'error');
        }
        break;
      case 'add-to-collection':
        setShowCollPick(norm);
        break;
      case 'rename':
        if (source === 'repeater') renameRepItem(req.id);
        break;
      case 'delete':
        if (source === 'history') await delReq(req.id);
        else if (source === 'repeater') await delRepItem(req.id);
        break;
    }
  };

  const generateCurl = req => {
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

  const filtered = reqs.filter(r => {
    if (search && !r.url.toLowerCase().includes(search.toLowerCase())) return false;
    if (scopeOnly && !r.in_scope) return false;
    if (savedOnly && !r.saved) return false;
    return true;
  });

  const stCls = s => !s ? '' : s < 300 ? 'st2' : s < 400 ? 'st3' : s < 500 ? 'st4' : 'st5';
  const fmtTime = t => t ? new Date(t).toLocaleTimeString('en-US', { hour12: false }) : '';
  const fmtH = h => h ? Object.entries(h).map(([k, v]) => k + ': ' + (Array.isArray(v) ? v.join(', ') : v)).join('\n') : '';
  const themeVars = (THEMES[themeId] && THEMES[themeId].vars)
    ? THEMES[themeId].vars
    : (THEMES.midnight && THEMES.midnight.vars) ? THEMES.midnight.vars : {};

  return (
    <div className="app" style={themeVars}>
      <style dangerouslySetInnerHTML={{ __html: `
:root{--bg:#0a0e14;--bg2:#0d1117;--bg3:#161b22;--bgh:#1f262d;--brd:#30363d;--txt:#e6edf3;--txt2:#8b949e;--txt3:#6e7681;--blue:#58a6ff;--green:#3fb950;--red:#f85149;--orange:#d29922;--purple:#a371f7;--cyan:#39c5cf;--font-main:"Inter",sans-serif;--font-mono:"JetBrains Mono",monospace}
*{margin:0;padding:0;box-sizing:border-box}body{font-family:var(--font-main);background:var(--bg);color:var(--txt);overflow:hidden}
.app{display:flex;flex-direction:column;height:100vh}
.hdr{display:flex;align-items:center;justify-content:space-between;padding:10px 20px;background:var(--bg2);border-bottom:1px solid var(--brd)}
.logo{display:flex;align-items:center;gap:10px}.logo-i{width:32px;height:32px;background:linear-gradient(135deg,var(--cyan),var(--purple));border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:700}
.logo-t{font-family:var(--font-mono);font-size:18px;font-weight:600;background:linear-gradient(90deg,var(--cyan),var(--purple));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.prj-badge{background:var(--bg3);padding:4px 10px;border-radius:4px;font-size:11px;color:var(--cyan);border:1px solid var(--brd);margin-left:12px}
.hdr-ctrl{display:flex;align-items:center;gap:10px}
.int-tog{display:flex;align-items:center;gap:6px;padding:6px 12px;background:var(--bg3);border:1px solid var(--brd);border-radius:6px;font-size:11px;cursor:pointer}
.int-tog.on{background:rgba(248,81,73,.2);border-color:var(--red)}.int-dot{width:8px;height:8px;border-radius:50%;background:var(--txt3)}
.int-tog.on .int-dot{background:var(--red);animation:pulse 1s infinite}.pend-badge{background:var(--red);color:#fff;padding:1px 6px;border-radius:10px;font-size:10px;margin-left:4px}
.prx-st{display:flex;align-items:center;gap:6px;padding:5px 10px;background:var(--bg3);border-radius:6px;font-family:var(--font-mono);font-size:11px}
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
.req-list{font-family:var(--font-mono);font-size:11px}.req-item{display:grid;grid-template-columns:60px 1fr 60px 55px;gap:10px;padding:8px 14px;border-bottom:1px solid var(--brd);cursor:pointer;align-items:center}
.req-item:hover{background:var(--bgh)}.req-item.sel{background:var(--bg3);border-left:3px solid var(--blue)}.req-item.out{opacity:.4}
.mth{font-weight:600;padding:2px 6px;border-radius:3px;text-align:center;font-size:10px}
.mth-GET{background:rgba(63,185,80,.15);color:var(--green)}.mth-POST{background:rgba(88,166,255,.15);color:var(--blue)}
.mth-PUT,.mth-PATCH{background:rgba(210,153,34,.15);color:var(--orange)}.mth-DELETE{background:rgba(248,81,73,.15);color:var(--red)}
.url{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sts{font-weight:500}
.st2{color:var(--green)}.st3{color:var(--blue)}.st4{color:var(--orange)}.st5{color:var(--red)}.ts{color:var(--txt3);font-size:10px}
.det-tabs{display:flex;background:var(--bg2);border-bottom:1px solid var(--brd);padding:0 10px}
.det-tab{padding:8px 14px;font-size:11px;color:var(--txt2);cursor:pointer;border-bottom:2px solid transparent}
.det-tab.act{color:var(--cyan);border-bottom-color:var(--cyan)}
.hist-wrap{display:flex;flex-direction:column;width:100%;height:100%}
.hist-content{display:flex;flex:1;overflow:hidden}
.hist-sub-tabs{display:flex;width:100%;background:var(--bg2);border-bottom:1px solid var(--brd);padding:0 16px;flex-shrink:0}
.hist-sub-tab{padding:7px 16px;font-size:11px;font-weight:600;color:var(--txt3);cursor:pointer;border-bottom:2px solid transparent;text-transform:uppercase;letter-spacing:.5px}
.hist-sub-tab:hover{color:var(--txt);background:var(--bg3)}.hist-sub-tab.act{color:var(--cyan);border-bottom-color:var(--cyan)}
.code{flex:1;padding:14px;font-family:var(--font-mono);font-size:11px;line-height:1.5;background:var(--bg);overflow:auto;white-space:pre-wrap;word-break:break-all}
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
.ed-ta{width:100%;padding:14px;background:var(--bg);border:none;border-bottom:1px solid var(--brd);color:var(--txt);font-family:var(--font-mono);font-size:11px;resize:none;outline:none;overflow:auto;min-height:0}
.ed-ce{flex:1;padding:14px;background:var(--bg);border:none;border-bottom:1px solid var(--brd);color:var(--txt);font-family:var(--font-mono);font-size:11px;line-height:1.5;outline:none;overflow:auto;white-space:pre-wrap;word-break:break-all;tab-size:2}
.overlay-ta::selection{background:rgba(88,166,255,.35)}
.scp-pnl{padding:24px;max-width:700px;margin:0 auto;width:100%}.scp-hdr{margin-bottom:20px}.scp-hdr h3{font-size:16px;margin-bottom:6px}.scp-hdr p{color:var(--txt2);font-size:12px}
.scp-form{display:flex;gap:10px;margin-bottom:20px}.sel{padding:8px 12px;background:var(--bg3);border:1px solid var(--brd);border-radius:5px;color:var(--txt);font-size:12px}
.scp-rules{display:flex;flex-direction:column;gap:6px}.scp-rule{display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--bg2);border:1px solid var(--brd);border-radius:6px}
.scp-rule.dis{opacity:.4}.rul-type{padding:3px 8px;border-radius:3px;font-size:10px;font-weight:600}
.rul-inc{background:rgba(63,185,80,.15);color:var(--green)}.rul-exc{background:rgba(248,81,73,.15);color:var(--red)}
.rul-pat{flex:1;font-family:var(--font-mono);font-size:12px}.rul-acts{display:flex;gap:6px}
.rep-cnt{display:flex;width:100%;height:100%;overflow:hidden}.rep-side{width:200px;border-right:1px solid var(--brd);display:flex;flex-direction:column;overflow:hidden}
.rep-list{flex:1;overflow-y:auto;overflow-x:hidden}.rep-item{display:flex;gap:6px;padding:10px 14px;border-bottom:1px solid var(--brd);cursor:pointer;align-items:center}
.rep-item:hover{background:var(--bgh)}.rep-item.sel{background:var(--bg3);border-left:3px solid var(--purple)}.rep-item .name{font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rep-main{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0}.req-bar{display:flex;gap:10px;padding:10px 14px;background:var(--bg2);border-bottom:1px solid var(--brd);flex-shrink:0}
.mth-sel{padding:6px 10px;background:var(--bg3);border:1px solid var(--brd);border-radius:5px;color:var(--txt);font-family:var(--font-mono);font-size:12px;font-weight:600}
.url-in{flex:1;padding:6px 10px;background:var(--bg3);border:1px solid var(--brd);border-radius:5px;color:var(--txt);font-family:var(--font-mono);font-size:12px;outline:none}
.rep-edit{display:grid;grid-template-columns:1fr 1fr;flex:1;gap:1px;background:var(--brd);overflow:hidden}.ed-pane{display:flex;flex-direction:column;background:var(--bg);overflow:hidden;min-height:0}
.ed-hdr{padding:6px 14px;background:var(--bg2);border-bottom:1px solid var(--brd);font-size:11px;font-weight:500;display:flex;justify-content:space-between;flex-shrink:0}
.git-pnl{padding:24px;max-width:700px;margin:0 auto;width:100%}.git-sec{margin-bottom:20px}
.git-ttl{font-size:13px;font-weight:600;margin-bottom:10px;color:var(--txt2)}.cmt-form{display:flex;gap:10px}
.cmt-in{flex:1;padding:8px 12px;background:var(--bg3);border:1px solid var(--brd);border-radius:5px;color:var(--txt);outline:none}
.cmt-list{background:var(--bg2);border-radius:8px;border:1px solid var(--brd)}.cmt-item{display:flex;gap:14px;padding:12px 14px;border-bottom:1px solid var(--brd);font-family:var(--font-mono);font-size:11px;align-items:center}
.cmt-item:last-child{border-bottom:none}.cmt-hash{color:var(--purple);font-weight:500}.cmt-msg{flex:1}.cmt-date{color:var(--txt3);font-size:10px}
.toast-c{position:fixed;bottom:20px;right:20px;z-index:1000}.toast{padding:10px 18px;background:var(--bg3);border:1px solid var(--brd);border-radius:6px;font-size:12px;margin-top:6px;animation:slideIn .2s}
.toast.success{border-color:var(--green)}.toast.error{border-color:var(--red)}@keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}
::-webkit-scrollbar{width:6px;height:6px}::-webkit-scrollbar-track{background:var(--bg)}::-webkit-scrollbar-thumb{background:var(--brd);border-radius:3px}
.context-menu{position:fixed;background:var(--bg2);border:1px solid var(--brd);border-radius:8px;padding:4px;box-shadow:0 8px 24px rgba(0,0,0,0.5);z-index:1000;min-width:180px}
.context-menu-item{padding:8px 12px;font-size:12px;color:var(--txt);cursor:pointer;border-radius:4px;transition:all .15s ease}
.context-menu-item:hover{background:var(--bgh)}
.context-menu-divider{height:1px;background:var(--brd);margin:4px 0}
.chepy-cnt{display:flex;width:100%;height:100%}.chepy-col{display:flex;flex-direction:column;overflow:hidden}
.chepy-in-col{width:30%;border-right:1px solid var(--brd)}.chepy-recipe-col{width:30%;border-right:1px solid var(--brd)}.chepy-out-col{flex:1}
.chepy-add{display:flex;flex-direction:column;border-bottom:1px solid var(--brd);max-height:40%}.chepy-ops-list{flex:1;overflow:auto;padding:0 8px 8px}
.chepy-avail-op{padding:5px 10px;font-size:11px;cursor:pointer;border-radius:4px;color:var(--txt2);font-family:var(--font-mono)}.chepy-avail-op:hover{background:var(--bg3);color:var(--cyan)}
.chepy-steps{flex:1;overflow:auto;padding:8px}
.chepy-step{background:var(--bg2);border:1px solid var(--brd);border-radius:6px;margin-bottom:6px}
.chepy-step-hdr{display:flex;align-items:center;gap:8px;padding:8px 10px}
.chepy-step-num{width:20px;height:20px;border-radius:50%;background:var(--purple);color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;flex-shrink:0}
.chepy-step-name{flex:1;font-size:12px;font-weight:500}.chepy-step-acts{display:flex;gap:3px}
.chepy-step-params{padding:6px 10px 10px;border-top:1px solid var(--brd);display:flex;flex-direction:column;gap:6px}
.chepy-param{display:flex;align-items:center;gap:8px}.chepy-param-lbl{font-size:10px;color:var(--txt2);min-width:60px}
.ws-cnt{display:flex;width:100%;height:100%}
.ws-conns{width:220px;border-right:1px solid var(--brd)}.ws-frames{width:300px;border-right:1px solid var(--brd)}.ws-detail{flex:1;display:flex;flex-direction:column}
.ws-conn-item{padding:10px 14px;border-bottom:1px solid var(--brd);cursor:pointer;font-size:11px}
.ws-conn-item:hover{background:var(--bgh)}.ws-conn-item.sel{background:var(--bg3);border-left:3px solid var(--cyan)}
.ws-conn-url{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--font-mono);font-size:11px}
.ws-conn-count{font-size:10px;color:var(--txt3)}
.ws-frame-item{display:flex;gap:8px;padding:8px 14px;border-bottom:1px solid var(--brd);cursor:pointer;align-items:center;font-size:11px}
.ws-frame-item:hover{background:var(--bgh)}.ws-frame-item.sel{background:var(--bg3);border-left:3px solid var(--cyan)}
.ws-dir{font-weight:700;font-size:14px;width:20px;text-align:center}.ws-dir-up{color:var(--green)}.ws-dir-down{color:var(--orange)}
.ws-frame-body{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--font-mono)}
.coll-cnt{display:flex;width:100%;height:100%}
.coll-side{width:200px;border-right:1px solid var(--brd)}.coll-steps{width:350px;border-right:1px solid var(--brd)}.coll-exec{flex:1;display:flex;flex-direction:column}
.coll-item{display:flex;justify-content:space-between;padding:10px 14px;border-bottom:1px solid var(--brd);cursor:pointer;font-size:12px}
.coll-item:hover{background:var(--bgh)}.coll-item.sel{background:var(--bg3);border-left:3px solid var(--purple)}
.coll-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.coll-count{color:var(--txt3);font-size:10px;background:var(--bg);padding:1px 6px;border-radius:8px}
.coll-step-item{display:flex;gap:8px;padding:8px 14px;border-bottom:1px solid var(--brd);align-items:center;font-size:11px;cursor:pointer}
.coll-step-item:hover{background:var(--bgh)}
.coll-step-item.active{background:rgba(88,166,255,.1);border-left:3px solid var(--blue)}
.coll-step-item.done{background:rgba(63,185,80,.05)}.coll-step-item.err{background:rgba(248,81,73,.05)}
.coll-step-num{width:20px;height:20px;border-radius:50%;background:var(--bg3);color:var(--txt2);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;flex-shrink:0}
.coll-step-item.active .coll-step-num{background:var(--blue);color:#fff}
.coll-vars{padding:10px 14px;border-top:1px solid var(--brd);background:var(--bg2)}
.coll-vars-hdr{font-size:10px;color:var(--txt3);font-weight:600;margin-bottom:6px;text-transform:uppercase}
.coll-var{display:flex;gap:8px;font-size:11px;font-family:var(--font-mono);padding:2px 0}
.coll-var-name{color:var(--purple);font-weight:500}.coll-var-val{color:var(--green);flex:1;overflow:hidden;text-overflow:ellipsis}
.coll-extract{display:flex;gap:6px;align-items:center;padding:4px 0;font-size:11px}
.coll-extract-name{color:var(--cyan);font-weight:500}
.coll-pick-item{padding:8px 12px;cursor:pointer;border-radius:4px;font-size:12px;margin-bottom:2px}
.coll-pick-item:hover{background:var(--bgh)}
      `}} />

      <header className="hdr">
        <div className="logo">
          <div className="logo-i">BW</div>
          <span className="logo-t">Blackwire</span>
          {curPrj && <span className="prj-badge">{curPrj}</span>}
        </div>
        <div className="hdr-ctrl">
          <select className="sel" value={themeId} onChange={e => setThemeId(e.target.value)} title="Theme">
            {Object.entries(THEMES).map(([id, t]) => (
              <option key={id} value={id}>{t.label}</option>
            ))}
          </select>
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
            <div className={'tab' + (tab === 'scope' ? ' act' : '')} onClick={() => setTab('scope')}>Scope</div>
            <div className={'tab' + (tab === 'history' ? ' act' : '')} onClick={() => setTab('history')}>History</div>
            <div className={'tab' + (tab === 'collections' ? ' act' : '')} onClick={() => { setTab('collections'); loadColls(); }}>Collections</div>
            <div className={'tab' + (tab === 'repeater' ? ' act' : '')} onClick={() => setTab('repeater')}>Repeater</div>
            <div className={'tab' + (tab === 'git' ? ' act' : '')} onClick={() => setTab('git')}>Git</div>
            <div className={'tab' + (tab === 'chepy' ? ' act' : '')} onClick={() => setTab('chepy')}>Cipher</div>
            <div className={'tab' + (tab === 'extensions' ? ' act' : '')} onClick={() => setTab('extensions')}>Extensions</div>
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
          <div className="hist-wrap">
            <div className="hist-sub-tabs">
              <div className={'hist-sub-tab' + (histSubTab === 'http' ? ' act' : '')} onClick={() => setHistSubTab('http')}>HTTP</div>
              <div className={'hist-sub-tab' + (histSubTab === 'ws' ? ' act' : '')} onClick={() => { setHistSubTab('ws'); loadWsConns(); }}>WebSocket</div>
            </div>

            {histSubTab === 'http' && (
              <div className="hist-content">
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
              </div>
            )}

            {histSubTab === 'ws' && (
              <div className="ws-cnt">
                <div className="ws-conns panel">
                  <div className="pnl-hdr">
                    <span>Connections ({wsConns.length})</span>
                    <button className="btn btn-sm btn-s" onClick={loadWsConns}>&#8635;</button>
                  </div>
                  <div className="pnl-cnt">
                    {wsConns.map(c => (
                      <div key={c.url} className={'ws-conn-item' + (selWsConn === c.url ? ' sel' : '')}
                           onClick={() => loadWsFrames(c.url)}>
                        <span className="ws-conn-url">{c.url}</span>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                          <span className="ws-conn-count">{c.frame_count} frames</span>
                          <span className="ts">{fmtTime(c.last_seen)}</span>
                        </div>
                      </div>
                    ))}
                    {wsConns.length === 0 && (
                      <div className="empty" style={{ padding: 30 }}>
                        <span>No WebSocket connections captured</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="ws-frames panel">
                  <div className="pnl-hdr">
                    <span>Frames {selWsConn ? '(' + wsFrames.length + ')' : ''}</span>
                  </div>
                  <div className="pnl-cnt">
                    {wsFrames.map(f => (
                      <div key={f.id} className={'ws-frame-item' + (selWsFrame?.id === f.id ? ' sel' : '')}
                           onClick={() => selectWsFrame(f)}
                           onContextMenu={e => showContextMenu(e, { ...f, url: selWsConn, method: 'WS', body: f.content }, 'websocket')}>
                        <span className={'ws-dir ws-dir-' + f.direction}>
                          {f.direction === 'up' ? '\u2191' : '\u2193'}
                        </span>
                        <span className="ws-frame-body">{(f.content || '').substring(0, 80)}</span>
                        <span className="ts">{fmtTime(f.timestamp)}</span>
                      </div>
                    ))}
                    {selWsConn && wsFrames.length === 0 && (
                      <div className="empty" style={{ padding: 30 }}><span>No frames</span></div>
                    )}
                    {!selWsConn && (
                      <div className="empty" style={{ padding: 30 }}><span>Select a connection</span></div>
                    )}
                  </div>
                </div>
                <div className="ws-detail panel">
                  {selWsFrame ? (
                    <React.Fragment>
                      <div className="pnl-hdr">
                        <span>{selWsFrame.direction === 'up' ? 'Client \u2192 Server' : 'Server \u2192 Client'}</span>
                        <span className="ts">{fmtTime(selWsFrame.timestamp)}</span>
                      </div>
                      <div className="code" style={{ maxHeight: '40%', borderBottom: '1px solid var(--brd)' }}>{selWsFrame.content}</div>
                      <div className="pnl-hdr"><span>Resend Frame</span></div>
                      <textarea className="ed-ta" style={{ flex: 1 }} value={wsResendMsg}
                                onChange={e => setWsResendMsg(e.target.value)} placeholder="Edit frame content..." />
                      <div style={{ padding: '10px 14px', display: 'flex', gap: '10px', background: 'var(--bg2)', borderTop: '1px solid var(--brd)' }}>
                        <button className="btn btn-p" onClick={resendWsFrame}
                                disabled={wsSending || !wsResendMsg}>
                          {wsSending ? '...' : '\u25B6 Resend'}
                        </button>
                      </div>
                      {wsResendResp && (
                        <div className="code" style={{ maxHeight: '30%', borderTop: '1px solid var(--brd)' }}>
                          {wsResendResp.error
                            ? 'Error: ' + wsResendResp.error
                            : wsResendResp.response
                              ? 'Response: ' + wsResendResp.response
                              : wsResendResp.note || 'Sent (no response)'}
                        </div>
                      )}
                    </React.Fragment>
                  ) : (
                    <div className="empty"><span>Select a frame</span></div>
                  )}
                </div>
              </div>
            )}
          </div>
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
                  <div key={r.id} className={'pend-item' + (selPend?.id === r.id ? ' sel' : '')} onClick={() => { setSelPend(r); setEditReq({ ...r }); }}
                       onContextMenu={e => showContextMenu(e, r, 'intercept')}>
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
                    <div className="pnl-hdr" onContextMenu={e => showContextMenu(e, editReq, 'intercept')}>
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
                  <div key={r.id} className={'rep-item' + (selRep === r.id ? ' sel' : '')} onClick={() => loadRepItem(r)}
                    onContextMenu={e => showContextMenu(e, r, 'repeater')}>
                    <span className={'mth mth-' + r.method}>{r.method}</span>
                    <span className="name" onDoubleClick={e => { e.stopPropagation(); renameRepItem(r.id); }}>{r.name}</span>
                    {selRep === r.id && (
                      <div style={{ marginLeft: 'auto', display: 'flex', gap: '2px' }} onClick={e => e.stopPropagation()}>
                        <button className="btn btn-sm btn-s" onClick={() => renameRepItem(r.id)} title="Rename" style={{ padding: '2px 5px', fontSize: '10px' }}>✎</button>
                        <button className="btn btn-sm btn-d" onClick={() => delRepItem(r.id)} title="Delete" style={{ padding: '2px 5px', fontSize: '10px' }}>✕</button>
                      </div>
                    )}
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
                <select className="sel" value={repFollowRedirects ? 'follow' : 'manual'} onChange={e => setRepFollowRedirects(e.target.value === 'follow')}
                  style={{ fontSize: '10px', padding: '4px 6px', minWidth: '105px' }} title="Redirect mode">
                  <option value="manual">No Redirect</option>
                  <option value="follow">Auto Follow</option>
                </select>
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
                      <button className="btn btn-sm btn-s" onClick={() => { setRepB(prettyPrint(repB)); setRepBodyColor(true); }} title="Pretty Print">Pretty</button>
                      <button className="btn btn-sm btn-s" onClick={() => { setRepB(minify(repB)); setRepBodyColor(false); }} title="Minify">Minify</button>
                    </div>
                  </div>
                  {repBodyColor ? (
                    <div
                      ref={repBodyEditRef}
                      className="ed-ce"
                      contentEditable
                      suppressContentEditableWarning
                      onInput={handleRepBodyInput}
                    />
                  ) : (
                    <textarea className="ed-ta" style={{ flex: 1 }} value={repB} onChange={e => setRepB(e.target.value)} />
                  )}
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
                      {repResp.redirect_chain && repResp.redirect_chain.length > 0 && (
                        <div style={{ padding: '6px 10px', background: 'var(--bg3)', borderBottom: '1px solid var(--brd)', fontSize: '10px', fontFamily: 'var(--font-mono)', flexShrink: 0, overflow: 'auto', maxHeight: '120px' }}>
                          <div style={{ color: 'var(--cyan)', marginBottom: '4px', fontWeight: 600 }}>Redirect chain ({repResp.redirect_chain.length} hops):</div>
                          {repResp.redirect_chain.map((hop, i) => (
                            <div key={i} style={{ color: 'var(--txt2)', paddingLeft: '8px' }}>
                              <span className={'sts ' + stCls(hop.status_code)}>{hop.status_code}</span> {hop.url} → {hop.location}
                            </div>
                          ))}
                          <div style={{ color: 'var(--green)', paddingLeft: '8px' }}>
                            <span className={'sts ' + stCls(repResp.status_code)}>{repResp.status_code}</span> {repResp.final_url}
                          </div>
                        </div>
                      )}
                      {repResp.is_redirect && !repFollowRedirects && repResp.redirect_url && (
                        <div style={{ padding: '6px 10px', background: 'rgba(210,153,34,.1)', borderBottom: '1px solid var(--brd)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', flexShrink: 0 }}>
                          <span style={{ color: 'var(--orange)', fontWeight: 600 }}>↪ Redirect</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--txt2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                title={repResp.redirect_url}>{repResp.redirect_url}</span>
                          <button className="btn btn-sm btn-p" onClick={followRedirect} disabled={loading} title="Follow this redirect">
                            Follow →
                          </button>
                        </div>
                      )}
                      <div className="code" style={{ height: '100px', minHeight: '60px', overflow: 'auto', flexShrink: 0, borderBottom: '1px solid var(--brd)' }}>
                        {fmtH(repResp.headers)}
                      </div>
                      {(() => {
                        const highlighted = colorizeBody(repRespBody);
                        return highlighted.html
                          ? <div className="code" style={{ flex: 1, overflow: 'auto' }} dangerouslySetInnerHTML={{ __html: highlighted.text }} />
                          : <textarea
                              className="ed-ta"
                              style={{ flex: 1 }}
                              value={repRespBody}
                              onChange={e => setRepRespBody(e.target.value)}
                              placeholder="Response body will appear here"
                            />;
                      })()}
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
                      onContextMenu={e => showContextMenu(e, r, 'webhook')}
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
                  {(() => {
                    if (whkDetTab === 'request') {
                      const bodyFmt = selWhkReq.content ? formatBody(selWhkReq.content, whkReqFormat) : null;
                      const info = (selWhkReq.method || 'GET') + ' ' + (selWhkReq.url || '') + '\n'
                        + 'IP: ' + (selWhkReq.ip || '-') + '\n'
                        + 'User-Agent: ' + (selWhkReq.user_agent || '-') + '\n'
                        + 'Time: ' + (selWhkReq.created_at || '-') + '\n\n'
                        + '--- Headers ---\n' + fmtH(selWhkReq.headers)
                        + (selWhkReq.content ? '\n\n--- Body ---\n' + (bodyFmt ? bodyFmt.text : selWhkReq.content) : '');
                      const isHtml = bodyFmt && bodyFmt.html;
                      return isHtml
                        ? <div className="code" dangerouslySetInnerHTML={{ __html: info }} />
                        : <div className="code">{info}</div>;
                    }
                    if (whkDetTab === 'headers') {
                      return <div className="code">{fmtH(selWhkReq.headers) || 'No headers'}</div>;
                    }
                    if (whkDetTab === 'query') {
                      const q = selWhkReq.query || {};
                      const entries = Object.entries(q);
                      return <div className="code">{entries.length === 0 ? 'No query parameters' : entries.map(([k, v]) => k + ' = ' + v).join('\n')}</div>;
                    }
                    if (whkDetTab === 'body') {
                      if (!selWhkReq.content) return <div className="code">No body content</div>;
                      const bodyFmt = formatBody(selWhkReq.content, whkReqFormat);
                      return bodyFmt.html
                        ? <div className="code" dangerouslySetInnerHTML={{ __html: bodyFmt.text }} />
                        : <div className="code">{selWhkReq.content}</div>;
                    }
                    return <div className="code"></div>;
                  })()}
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


        {tab === 'collections' && curPrj && (
          <div className="coll-cnt">
            <div className="coll-side panel">
              <div className="pnl-hdr">
                <span>Collections</span>
                <button className="btn btn-sm btn-p" onClick={createColl}>+</button>
              </div>
              <div className="pnl-cnt">
                {colls.map(c => (
                  <div key={c.id} className={'coll-item' + (selColl === c.id ? ' sel' : '')}
                       onClick={() => loadCollItems(c.id)}
                       onContextMenu={e => { e.preventDefault(); if (confirm('Delete "' + c.name + '"?')) deleteColl(c.id); }}>
                    <span className="coll-name">{c.name}</span>
                    <span className="coll-count">{c.item_count}</span>
                  </div>
                ))}
                {colls.length === 0 && (
                  <div className="empty" style={{ padding: 20, fontSize: 11 }}>
                    <span>No collections yet</span>
                  </div>
                )}
              </div>
            </div>
            <div className="coll-steps panel">
              <div className="pnl-hdr">
                <span>Steps {selColl ? '(' + collItems.length + ')' : ''}</span>
              </div>
              <div className="pnl-cnt">
                {collItems.map((item, idx) => (
                  <div key={item.id} className={'coll-step-item' + (collStep === idx ? ' active' : '') + (collResps[item.id] ? (collResps[item.id].error ? ' err' : ' done') : '')}
                       onClick={() => setCollStep(idx)}
                       onContextMenu={e => showContextMenu(e, item, 'collection')}>
                    <span className="coll-step-num">{idx + 1}</span>
                    <span className={'mth mth-' + item.method}>{item.method}</span>
                    <span className="url" style={{ flex: 1 }}>{item.url.length > 45 ? item.url.substring(0, 45) + '...' : item.url}</span>
                    {collResps[item.id] && !collResps[item.id].error && (
                      <span className={'sts ' + stCls(collResps[item.id].status_code)}>{collResps[item.id].status_code}</span>
                    )}
                    {collResps[item.id] && collResps[item.id].error && (
                      <span className="sts st5">ERR</span>
                    )}
                    <button className="btn btn-sm btn-d" onClick={e => { e.stopPropagation(); deleteCollItem(selColl, item.id); }} style={{ padding: '2px 5px', fontSize: '10px' }}>&#10005;</button>
                  </div>
                ))}
                {selColl && collItems.length === 0 && (
                  <div className="empty" style={{ padding: 20, fontSize: 11 }}>
                    <span>Add requests via right-click in History</span>
                  </div>
                )}
                {!selColl && (
                  <div className="empty" style={{ padding: 20, fontSize: 11 }}>
                    <span>Select a collection</span>
                  </div>
                )}
                {Object.keys(collVars).length > 0 && (
                  <div className="coll-vars">
                    <div className="coll-vars-hdr">Variables</div>
                    {Object.entries(collVars).map(([k, v]) => (
                      <div key={k} className="coll-var">
                        <span className="coll-var-name">{k}</span>
                        <span className="coll-var-val">{String(v).substring(0, 60)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="coll-exec panel">
              {selColl && collItems.length > 0 ? (
                <React.Fragment>
                  <div className="pnl-hdr">
                    <span>Step {Math.min(collStep + 1, collItems.length)} of {collItems.length}</span>
                    <div className="acts">
                      <button className="btn btn-sm btn-p" onClick={executeCollStep}
                              disabled={collRunning || collStep >= collItems.length}>
                        {collRunning ? '...' : '\u25B6 Send Next'}
                      </button>
                      <button className="btn btn-sm btn-s" onClick={resetCollRun}>Reset</button>
                    </div>
                  </div>
                  {(() => {
                    const item = collItems[Math.min(collStep, collItems.length - 1)];
                    if (!item) return null;
                    const resp = collResps[item.id];
                    return (
                      <React.Fragment>
                        <div style={{ padding: '10px 14px', background: 'var(--bg2)', borderBottom: '1px solid var(--brd)', fontSize: '12px' }}>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                            <span className={'mth mth-' + item.method}>{item.method}</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', flex: 1 }}>{item.url}</span>
                          </div>
                          {item.headers && Object.keys(item.headers).length > 0 && (
                            <div style={{ fontSize: '10px', color: 'var(--txt3)', marginBottom: '4px' }}>
                              {Object.entries(item.headers).map(([k, v]) => k + ': ' + v).join(' | ')}
                            </div>
                          )}
                          {item.body && (
                            <div style={{ fontSize: '10px', color: 'var(--txt3)' }}>Body: {item.body.substring(0, 100)}</div>
                          )}
                        </div>
                        <div style={{ padding: '8px 14px', background: 'var(--bg3)', borderBottom: '1px solid var(--brd)' }}>
                          <div style={{ fontSize: '10px', color: 'var(--txt2)', fontWeight: '600', marginBottom: '6px' }}>Variable Extractions</div>
                          {(item.var_extracts || []).map((ve, vi) => (
                            <div key={vi} className="coll-extract">
                              <span className="coll-extract-name">{ve.name}</span>
                              <span style={{ color: 'var(--txt3)', fontSize: '10px' }}>from {ve.source} at</span>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--cyan)' }}>{ve.path}</span>
                              <button className="btn btn-sm btn-d" style={{ padding: '1px 4px', fontSize: '9px' }}
                                onClick={() => {
                                  const newExtracts = item.var_extracts.filter((_, i) => i !== vi);
                                  updateCollItemExtracts(selColl, item.id, newExtracts);
                                }}>&#10005;</button>
                            </div>
                          ))}
                          <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                            <input className="inp" placeholder="var name" id="ve-name" style={{ flex: 1, fontSize: '10px', padding: '4px 6px' }} />
                            <select className="sel" id="ve-source" style={{ fontSize: '10px', padding: '4px' }}>
                              <option value="body">body</option>
                              <option value="header">header</option>
                            </select>
                            <input className="inp" placeholder="$.path.to.value" id="ve-path" style={{ flex: 1, fontSize: '10px', padding: '4px 6px' }} />
                            <button className="btn btn-sm btn-s" onClick={() => {
                              const name = document.getElementById('ve-name').value;
                              const source = document.getElementById('ve-source').value;
                              const path = document.getElementById('ve-path').value;
                              if (!name || !path) return;
                              const newExtracts = [...(item.var_extracts || []), { name, source, path }];
                              updateCollItemExtracts(selColl, item.id, newExtracts);
                              document.getElementById('ve-name').value = '';
                              document.getElementById('ve-path').value = '';
                            }}>+ Add</button>
                          </div>
                        </div>
                        {resp && (
                          <React.Fragment>
                            <div className="pnl-hdr">
                              <span>Response</span>
                              {!resp.error && (
                                <span style={{ color: 'var(--txt3)', fontSize: '10px' }}>
                                  {resp.status_code} &#8226; {resp.elapsed?.toFixed(3)}s
                                </span>
                              )}
                            </div>
                            {(() => {
                              if (resp.error) return <div className="code" style={{ flex: 1 }}>{resp.error}</div>;
                              const collBodyFmt = colorizeBody(resp.body || '');
                              return collBodyFmt.html
                                ? <div className="code" style={{ flex: 1 }} dangerouslySetInnerHTML={{ __html: collBodyFmt.text }} />
                                : <div className="code" style={{ flex: 1 }}>{resp.body || ''}</div>;
                            })()}
                            {resp.extracted_variables && Object.keys(resp.extracted_variables).length > 0 && (
                              <div className="coll-vars" style={{ borderTop: '1px solid var(--brd)' }}>
                                <div className="coll-vars-hdr">Extracted</div>
                                {Object.entries(resp.extracted_variables).map(([k, v]) => (
                                  <div key={k} className="coll-var">
                                    <span className="coll-var-name">{k}</span>
                                    <span className="coll-var-val">{String(v).substring(0, 60)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </React.Fragment>
                        )}
                        {!resp && (
                          <div className="empty"><span>Click "Send Next" to execute this step</span></div>
                        )}
                      </React.Fragment>
                    );
                  })()}
                </React.Fragment>
              ) : (
                <div className="empty"><span>{selColl ? 'No steps - add requests from History' : 'Select a collection'}</span></div>
              )}
            </div>
          </div>
        )}

        {tab === 'chepy' && curPrj && (
          <div className="chepy-cnt">
            <div className="chepy-col chepy-in-col">
              <div className="pnl-hdr">
                <span>Input</span>
                <button className="btn btn-sm btn-s" onClick={() => setChepyIn('')}>Clear</button>
              </div>
              <textarea
                className="ed-ta"
                style={{ flex: 1 }}
                value={chepyIn}
                onChange={e => setChepyIn(e.target.value)}
                placeholder="Paste or type input text here..."
              />
            </div>

            <div className="chepy-col chepy-recipe-col">
              <div className="pnl-hdr">
                <span>Recipe</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button className="btn btn-sm btn-d" onClick={clearChepyRecipe}>Clear</button>
                  <button className="btn btn-sm btn-p" onClick={bakeChepy} disabled={chepyBaking}>
                    {chepyBaking ? '...' : 'Bake'}
                  </button>
                </div>
              </div>

              <div className="chepy-add">
                <select className="sel" value={chepySelCat}
                  onChange={e => setChepySelCat(e.target.value)}
                  style={{ margin: '8px', borderRadius: '4px' }}>
                  {Object.keys(chepyCat).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <div className="chepy-ops-list">
                  {(chepyCat[chepySelCat] || []).map(op => (
                    <div key={op.name} className="chepy-avail-op" onClick={() => addChepyOp(op)}>
                      {op.label}
                    </div>
                  ))}
                </div>
              </div>

              <div className="chepy-steps">
                {chepyOps.length === 0 && (
                  <div className="empty" style={{ padding: 20, fontSize: 11 }}>
                    <span>Click operations above to build a recipe</span>
                  </div>
                )}
                {chepyOps.map((op, i) => (
                  <div key={i} className="chepy-step">
                    <div className="chepy-step-hdr">
                      <span className="chepy-step-num">{i + 1}</span>
                      <span className="chepy-step-name">{op.label}</span>
                      <div className="chepy-step-acts">
                        <button className="btn btn-sm btn-s" onClick={() => moveChepyOp(i, -1)} disabled={i === 0}>&#9650;</button>
                        <button className="btn btn-sm btn-s" onClick={() => moveChepyOp(i, 1)} disabled={i === chepyOps.length - 1}>&#9660;</button>
                        <button className="btn btn-sm btn-d" onClick={() => removeChepyOp(i)}>&#10005;</button>
                      </div>
                    </div>
                    {op.params.length > 0 && (
                      <div className="chepy-step-params">
                        {op.params.map(p => (
                          <div key={p.name} className="chepy-param">
                            <label className="chepy-param-lbl">{p.label}</label>
                            {p.type === 'select' ? (
                              <select className="sel" value={op.args[p.name] || p.default}
                                onChange={e => updateChepyArg(i, p.name, e.target.value)}
                                style={{ flex: 1, fontSize: '11px', padding: '5px 8px' }}>
                                {(p.options || []).map(o => <option key={o} value={o}>{o}</option>)}
                              </select>
                            ) : (
                              <input className="inp" value={op.args[p.name] || ''}
                                onChange={e => updateChepyArg(i, p.name, e.target.value)}
                                placeholder={p.default || ''}
                                style={{ flex: 1, fontSize: '11px', padding: '5px 8px' }} />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="chepy-col chepy-out-col">
              <div className="pnl-hdr">
                <span>Output</span>
                <button className="btn btn-sm btn-s"
                  onClick={() => { navigator.clipboard.writeText(chepyOut); toast('Copied', 'success'); }}
                  disabled={!chepyOut}>
                  Copy
                </button>
              </div>
              {chepyErr ? (
                <div className="code" style={{ color: 'var(--red)' }}>{chepyErr}</div>
              ) : (
                <div className="code">{chepyOut || 'Output will appear here after baking'}</div>
              )}
            </div>
          </div>
        )}
      </main>

      <div className="toast-c">
        {toasts.map(t => (
          <div key={t.id} className={'toast ' + t.type}>{t.message}</div>
        ))}
      </div>

      {contextMenu && (
        <div ref={ctxMenuRef} className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={e => e.stopPropagation()}>
          {(contextMenu.normalized?.body || contextMenu.source === 'selection') && (
            <div className="context-menu-item" onClick={() => handleContextAction('send-to-cipher')}>
              Send to Cipher
            </div>
          )}
          {contextMenu.source !== 'websocket' && (
            <div className="context-menu-item" onClick={() => handleContextAction('repeater')}>
              Send to Repeater
            </div>
          )}
          <div className="context-menu-item" onClick={() => handleContextAction('add-to-collection')}>
            Add to Collection
          </div>
          <div className="context-menu-divider" />
          <div className="context-menu-item" onClick={() => handleContextAction('copy-url')}>
            Copy URL
          </div>
          {contextMenu.source !== 'websocket' && (
            <div className="context-menu-item" onClick={() => handleContextAction('copy-curl')}>
              Copy as cURL
            </div>
          )}
          <div className="context-menu-item" onClick={() => handleContextAction('copy-body')}>
            Copy Body
          </div>
          {contextMenu.source === 'history' && (
            <React.Fragment>
              <div className="context-menu-divider" />
              <div className="context-menu-item" onClick={() => handleContextAction('favorite')}>
                {contextMenu.request.saved ? 'Unmark' : 'Mark'} as Favorite
              </div>
              <div className="context-menu-item" onClick={() => handleContextAction('delete')}>
                Delete
              </div>
            </React.Fragment>
          )}
          {contextMenu.source === 'repeater' && (
            <React.Fragment>
              <div className="context-menu-divider" />
              <div className="context-menu-item" onClick={() => handleContextAction('rename')}>
                Rename
              </div>
              <div className="context-menu-item" onClick={() => handleContextAction('delete')}>
                Delete
              </div>
            </React.Fragment>
          )}
        </div>
      )}

      {showCollPick && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }}
             onClick={() => setShowCollPick(null)}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: '8px', padding: '20px', minWidth: '300px' }}
               onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '14px', marginBottom: '12px' }}>Add to Collection</h3>
            {colls.length === 0 && <div style={{ color: 'var(--txt3)', fontSize: '12px', marginBottom: '10px' }}>No collections yet. Create one in the Collections tab.</div>}
            {colls.map(c => (
              <div key={c.id} className="coll-pick-item" onClick={() => addToCollection(c.id, showCollPick)}>
                {c.name} <span style={{ color: 'var(--txt3)', fontSize: '10px' }}>({c.item_count} items)</span>
              </div>
            ))}
            <button className="btn btn-sm btn-s" style={{ marginTop: '10px' }} onClick={() => setShowCollPick(null)}>Cancel</button>
          </div>
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
