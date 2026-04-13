const _jsxFileName = "/tmp/tmpk58g2vi0/src/webhook_site.ui.jsx"; function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }/**
 * Webhook.site Extension - Dynamic UI
 * Visor completo de webhook requests
 */

(function() {
  if (!window.BlackwireExtensions) {
    window.BlackwireExtensions = {};
  }

  window.BlackwireExtensions['webhook_site'] = function(props) {
    const { ext, updateExtCfg, toast } = props;

    // Extraer valores primitivos estables del config
    const tokenId = _optionalChain([ext, 'access', _ => _.config, 'optionalAccess', _2 => _2.token_id]);
    const tokenUrl = _optionalChain([ext, 'access', _3 => _3.config, 'optionalAccess', _4 => _4.token_url]);
    const savedApiKey = _optionalChain([ext, 'access', _5 => _5.config, 'optionalAccess', _6 => _6.api_key]) || '';

    // State local
    const [apiKey, setApiKey] = React.useState(savedApiKey);
    const [whkReqs, setWhkReqs] = React.useState([]);
    const [selectedReq, setSelectedReq] = React.useState(null);
    const [detailTab, setDetailTab] = React.useState('request');
    const [format, setFormat] = React.useState('raw');
    const [search, setSearch] = React.useState('');
    const [loading, setLoading] = React.useState(false);
    const [showAllTokens, setShowAllTokens] = React.useState(true); // Por defecto activado
    const [editingApiKey, setEditingApiKey] = React.useState(false);

    // Cargar requests del backend
    const loadRequests = React.useCallback(async () => {
      try {
        const url = showAllTokens
          ? '/api/webhooksite/requests?all_tokens=true'
          : '/api/webhooksite/requests';
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          const newRequests = data.requests || [];
          setWhkReqs(newRequests);

          // Preserve selected request after refresh
          setSelectedReq(currentSelected => {
            if (!currentSelected) return null;

            // Find the same request in the new list by ID
            const updated = newRequests.find(r => r.request_id === currentSelected.request_id);
            return updated || currentSelected; // Keep old if not found (shouldn't happen)
          });
        }
      } catch (err) {
        console.error('Error loading webhook requests:', err);
      }
    }, [showAllTokens]);

    // Sync con webhook.site API
    const syncWebhook = React.useCallback(async () => {
      if (!tokenId || loading) return;

      setLoading(true);
      try {
        const res = await fetch('/api/webhooksite/refresh', { method: 'POST' });
        if (res.ok) {
          await loadRequests();
          toast('Synced with webhook.site', 'success');
        } else {
          toast('Failed to sync', 'error');
        }
      } catch (err) {
        toast('Sync error: ' + err.message, 'error');
      } finally {
        setLoading(false);
      }
    }, [tokenId, loading, loadRequests, toast]);

    // Crear nuevo token
    const createToken = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/webhooksite/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ api_key: apiKey })
        });

        if (res.ok) {
          const data = await res.json();
          updateExtCfg(ext.name, {
            ...ext.config,
            token_id: data.token_id,
            token_url: data.token_url,
            token_created_at: data.created_at,
            api_key: apiKey
          });
          toast('Webhook URL created', 'success');
          await loadRequests();
        } else {
          toast('Failed to create token', 'error');
        }
      } catch (err) {
        toast('Error: ' + err.message, 'error');
      } finally {
        setLoading(false);
      }
    };

    // Actualizar API Key sin crear nuevo token
    const updateApiKey = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/webhooksite/apikey', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ api_key: apiKey })
        });

        if (res.ok) {
          updateExtCfg(ext.name, {
            ...ext.config,
            api_key: apiKey
          });
          setEditingApiKey(false);
          toast('API Key updated', 'success');
        } else {
          toast('Failed to update API Key', 'error');
        }
      } catch (err) {
        toast('Error: ' + err.message, 'error');
      } finally {
        setLoading(false);
      }
    };

    // Regenerar URL (crea nuevo token pero preserva requests antiguas)
    const regenerateUrl = async () => {
      if (!confirm('Generate new Webhook URL? Previous requests will be preserved and visible in "All tokens" view.')) return;

      setLoading(true);
      try {
        const res = await fetch('/api/webhooksite/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ api_key: apiKey })
        });

        if (res.ok) {
          const data = await res.json();
          updateExtCfg(ext.name, {
            ...ext.config,
            token_id: data.token_id,
            token_url: data.token_url,
            token_created_at: data.created_at,
            api_key: apiKey
          });
          // Activar "All tokens" para mostrar requests del token anterior
          setShowAllTokens(true);
          toast('New Webhook URL generated. Showing all tokens.', 'success');
          await loadRequests();
        } else {
          toast('Failed to regenerate URL', 'error');
        }
      } catch (err) {
        toast('Error: ' + err.message, 'error');
      } finally {
        setLoading(false);
      }
    };

    // Clear history
    const clearHistory = async () => {
      if (!confirm('Clear all webhook history?')) return;

      try {
        const res = await fetch('/api/webhooksite/requests', { method: 'DELETE' });
        if (res.ok) {
          setWhkReqs([]);
          setSelectedReq(null);
          toast('History cleared', 'success');
        }
      } catch (err) {
        toast('Error clearing history', 'error');
      }
    };

    // Copiar URL al portapapeles
    const copyUrl = () => {
      if (!tokenUrl) return;

      navigator.clipboard.writeText(tokenUrl).then(() => {
        toast('URL copied to clipboard', 'success');
      }).catch(() => {
        toast('Failed to copy URL', 'error');
      });
    };

    // Send to Repeater
    const sendToRepeater = () => {
      if (!selectedReq) return;

      fetch('/api/repeater/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: selectedReq.url || '',
          method: selectedReq.method || 'GET',
          headers: selectedReq.headers || {},
          body: selectedReq.content || ''
        })
      }).then(() => {
        toast('Sent to Repeater', 'success');
      }).catch(() => {
        toast('Failed to send to Repeater', 'error');
      });
    };

    // Format helpers
    const formatHeaders = (headers) => {
      if (!headers) return '';
      if (typeof headers === 'string') return headers;
      return Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join('\n');
    };

    const formatBody = (content, fmt) => {
      if (!content) return { text: '', html: false };

      if (fmt === 'pretty') {
        try {
          const parsed = JSON.parse(content);
          return {
            text: JSON.stringify(parsed, null, 2),
            html: false
          };
        } catch (e2) {
          return { text: content, html: false };
        }
      }
      return { text: content, html: false };
    };

    const formatTime = (timestamp) => {
      if (!timestamp) return '';
      try {
        const date = new Date(timestamp);
        return date.toLocaleTimeString();
      } catch (e3) {
        return timestamp;
      }
    };

    // Syntax highlighting functions
    const highlightJSON = (json) => {
      json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return json.replace(
        /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
        (match) => {
          let cls = 'color: #b5cea8'; // numbers
          if (/^"/.test(match)) {
            if (/:$/.test(match)) {
              cls = 'color: #9cdcfe; font-weight: 500'; // keys
            } else {
              cls = 'color: #ce9178'; // strings
            }
          } else if (/true|false/.test(match)) {
            cls = 'color: #569cd6'; // booleans
          } else if (/null/.test(match)) {
            cls = 'color: #569cd6'; // null
          }
          return `<span style="${cls}">${match}</span>`;
        }
      );
    };

    const highlightHeaders = (headers) => {
      if (!headers) return '';
      const headerText = formatHeaders(headers);
      return headerText.replace(/^(.+?):\s*(.+)$/gm, (match, key, value) => {
        return `<span style="color: #4ec9b0; font-weight: 500">${key}</span><span style="color: #999">:</span> <span style="color: #ce9178">${value}</span>`;
      });
    };

    // Load inicial y cuando cambie showAllTokens
    React.useEffect(() => {
      loadRequests();
    }, [loadRequests, showAllTokens]);

    // Detectar si estamos en modo compacto (Extensions tab) o pantalla completa
    const [isCompact, setIsCompact] = React.useState(false);
    const containerRef = React.useRef(null);

    React.useEffect(() => {
      const checkSize = () => {
        if (containerRef.current) {
          const width = containerRef.current.offsetWidth;
          setIsCompact(width < 800);
        }
      };

      checkSize();
      window.addEventListener('resize', checkSize);
      return () => window.removeEventListener('resize', checkSize);
    }, []);

    // Filtrar requests por búsqueda
    const filteredReqs = React.useMemo(() => {
      if (!search) return whkReqs;
      const lower = search.toLowerCase();
      return whkReqs.filter(r =>
        (r.url || '').toLowerCase().includes(lower) ||
        (r.method || '').toLowerCase().includes(lower) ||
        (r.ip || '').toLowerCase().includes(lower)
      );
    }, [whkReqs, search]);

    // Vista compacta para Extensions tab
    if (isCompact) {
      return (
        React.createElement('div', { ref: containerRef, style: { padding: '12px', borderTop: '1px solid var(--brd)' }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 317}}
          , React.createElement('div', { style: { fontSize: '11px', color: 'var(--txt2)', marginBottom: '12px' }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 318}}, "Configure webhook.site integration. Create a token to receive HTTP requests."

          )

          /* API Key Field - always visible */
          , React.createElement('div', { style: { marginBottom: '12px' }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 323}}
            , React.createElement('div', { style: { fontSize: '10px', color: 'var(--txt3)', marginBottom: '4px' }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 324}}, "API Key (optional - for premium features)"

            )
            , React.createElement('div', { style: { display: 'flex', gap: '6px' }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 327}}
              , React.createElement('input', {
                className: "inp",
                type: "password",
                placeholder: "Enter API Key"  ,
                value: apiKey,
                onChange: e => setApiKey(e.target.value),
                style: { flex: 1 }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 328}}
              )
              , tokenId && apiKey !== savedApiKey && (
                React.createElement('button', {
                  className: "btn btn-s" ,
                  onClick: updateApiKey,
                  disabled: loading, __self: this, __source: {fileName: _jsxFileName, lineNumber: 337}}
, "Update"

                )
              )
            )
          )

          , !tokenId ? (
            React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 349}}
              , React.createElement('button', {
                className: "btn btn-p" ,
                onClick: createToken,
                disabled: loading,
                style: { width: '100%' }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 350}}

                , loading ? 'Creating...' : 'Create Webhook URL'
              )
            )
          ) : (
            React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 360}}
              , React.createElement('div', { style: { fontSize: '11px', color: 'var(--txt3)', marginBottom: '8px' }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 361}}, "Current Webhook URL:"

              )
              , React.createElement('div', { style: {
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                background: 'var(--bg3)',
                padding: '8px',
                borderRadius: '4px',
                marginBottom: '12px',
                wordBreak: 'break-all'
              }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 364}}
                , tokenUrl
              )
              , React.createElement('div', { style: { display: 'flex', gap: '6px', marginBottom: '8px' }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 375}}
                , React.createElement('button', { className: "btn btn-s" , onClick: syncWebhook, disabled: loading, __self: this, __source: {fileName: _jsxFileName, lineNumber: 376}}
                  , loading ? '...' : 'Sync'
                )
                , React.createElement('button', { className: "btn btn-s" , onClick: copyUrl, __self: this, __source: {fileName: _jsxFileName, lineNumber: 379}}, "Copy to clipboard"

                )
                , React.createElement('button', { className: "btn btn-s" , onClick: regenerateUrl, disabled: loading, __self: this, __source: {fileName: _jsxFileName, lineNumber: 382}}, "Regenerate"

                )
              )
              , React.createElement('div', { style: { display: 'flex', gap: '6px' }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 386}}
                , React.createElement('button', { className: "btn btn-d" , onClick: clearHistory, __self: this, __source: {fileName: _jsxFileName, lineNumber: 387}}, "Clear History"

                )
              )
              , React.createElement('div', { style: { fontSize: '10px', color: 'var(--txt3)', marginTop: '8px' }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 391}}
                , whkReqs.length, " requests stored"
              )
            )
          )
        )
      );
    }

    // Vista completa para tab personalizada
    return (
      React.createElement('div', { ref: containerRef, style: { display: 'flex', height: '100%', overflow: 'hidden' }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 402}}
        /* Panel izquierdo - Configuración y lista */
        , React.createElement('div', { style: {
          width: '350px',
          borderRight: '1px solid var(--brd)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 404}}
          /* Header */
          , React.createElement('div', { style: {
            padding: '16px',
            borderBottom: '1px solid var(--brd)',
            background: 'var(--bg2)'
          }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 412}}
            , React.createElement('h3', { style: { margin: 0, fontSize: '14px', marginBottom: '12px' }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 417}}, "Webhook.site")

            /* API Key Field - always visible */
            , React.createElement('div', { style: { marginBottom: '12px' }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 420}}
              , React.createElement('div', { style: { fontSize: '10px', color: 'var(--txt3)', marginBottom: '4px' }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 421}}, "API Key (optional - for premium features)"

              )
              , React.createElement('div', { style: { display: 'flex', gap: '6px' }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 424}}
                , React.createElement('input', {
                  className: "inp",
                  type: "password",
                  placeholder: "Enter API Key"  ,
                  value: apiKey,
                  onChange: e => setApiKey(e.target.value),
                  style: { flex: 1 }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 425}}
                )
                , tokenId && apiKey !== savedApiKey && (
                  React.createElement('button', {
                    className: "btn btn-sm btn-p"  ,
                    onClick: updateApiKey,
                    disabled: loading, __self: this, __source: {fileName: _jsxFileName, lineNumber: 434}}
, "Update"

                  )
                )
              )
            )

            , !tokenId ? (
              React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 446}}
                , React.createElement('button', {
                  className: "btn btn-p" ,
                  onClick: createToken,
                  disabled: loading,
                  style: { width: '100%' }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 447}}

                  , loading ? 'Creating...' : 'Create Webhook URL'
                )
              )
            ) : (
              React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 457}}
                , React.createElement('div', { style: { fontSize: '10px', color: 'var(--txt3)', marginBottom: '6px' }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 458}}, "Current Webhook URL:"

                )
                , React.createElement('div', { style: {
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  background: 'var(--bg3)',
                  padding: '8px',
                  borderRadius: '4px',
                  marginBottom: '8px',
                  wordBreak: 'break-all'
                }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 461}}
                  , tokenUrl
                )

                , React.createElement('button', {
                  className: "btn btn-sm btn-s"  ,
                  onClick: copyUrl,
                  style: { width: '100%', marginBottom: '12px' }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 473}}
, "Copy to clipboard"

                )

                , React.createElement('div', { style: { display: 'flex', gap: '6px', marginBottom: '12px' }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 481}}
                  , React.createElement('button', {
                    className: "btn btn-sm btn-p"  ,
                    onClick: syncWebhook,
                    disabled: loading,
                    style: { flex: 1 }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 482}}

                    , loading ? '...' : 'Sync'
                  )
                  , React.createElement('button', {
                    className: "btn btn-sm btn-s"  ,
                    onClick: regenerateUrl,
                    disabled: loading,
                    style: { flex: 1 }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 490}}
, "Regenerate"

                  )
                  , React.createElement('button', {
                    className: "btn btn-sm btn-d"  ,
                    onClick: clearHistory,
                    style: { flex: 1 }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 498}}
, "Clear"

                  )
                )

                , React.createElement('div', { style: { display: 'flex', gap: '6px', marginBottom: '12px', alignItems: 'center' }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 507}}
                  , React.createElement('input', {
                    className: "inp",
                    placeholder: "Search...",
                    value: search,
                    onChange: e => setSearch(e.target.value),
                    style: { flex: 1 }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 508}}
                  )
                  , React.createElement('label', { style: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '10px',
                    color: 'var(--txt2)',
                    whiteSpace: 'nowrap'
                  }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 515}}
                    , React.createElement('input', {
                      type: "checkbox",
                      checked: showAllTokens,
                      onChange: e => setShowAllTokens(e.target.checked), __self: this, __source: {fileName: _jsxFileName, lineNumber: 523}}
                    ), "All tokens"

                  )
                )
              )
            )
          )

          /* Lista de requests */
          , React.createElement('div', { style: { flex: 1, overflow: 'auto' }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 536}}
            , filteredReqs.length === 0 && (
              React.createElement('div', { style: {
                padding: '40px 20px',
                textAlign: 'center',
                color: 'var(--txt3)',
                fontSize: '11px'
              }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 538}}
                , whkReqs.length === 0 ? 'No requests yet' : 'No matches'
              )
            )

            , filteredReqs.map(req => (
              React.createElement('div', {
                key: req.request_id,
                onClick: () => setSelectedReq(req),
                style: {
                  padding: '10px 12px',
                  borderBottom: '1px solid var(--brd)',
                  cursor: 'pointer',
                  background: _optionalChain([selectedReq, 'optionalAccess', _7 => _7.request_id]) === req.request_id ? 'var(--bg3)' : 'transparent',
                  transition: 'background 0.1s'
                },
                onMouseEnter: e => {
                  if (_optionalChain([selectedReq, 'optionalAccess', _8 => _8.request_id]) !== req.request_id) {
                    e.currentTarget.style.background = 'var(--bg2)';
                  }
                },
                onMouseLeave: e => {
                  if (_optionalChain([selectedReq, 'optionalAccess', _9 => _9.request_id]) !== req.request_id) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 549}}

                , React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 570}}
                  , React.createElement('span', { className: 'mth mth-' + (req.method || 'GET'), __self: this, __source: {fileName: _jsxFileName, lineNumber: 571}}
                    , req.method || 'GET'
                  )
                  , React.createElement('span', { style: { fontSize: '10px', color: 'var(--txt3)' }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 574}}
                    , formatTime(req.created_at)
                  )
                  , showAllTokens && req.token_id !== tokenId && (
                    React.createElement('span', { style: {
                      fontSize: '9px',
                      padding: '2px 4px',
                      background: 'var(--bg3)',
                      borderRadius: '3px',
                      color: 'var(--txt3)',
                      fontFamily: 'var(--font-mono)'
                    }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 578}}
                      , _optionalChain([req, 'access', _10 => _10.token_id, 'optionalAccess', _11 => _11.substring, 'call', _12 => _12(0, 8)])
                    )
                  )
                )
                , React.createElement('div', { style: {
                  fontSize: '10px',
                  color: 'var(--txt2)',
                  fontFamily: 'var(--font-mono)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 590}}
                  , req.url || 'No URL'
                )
                , req.ip && (
                  React.createElement('div', { style: { fontSize: '9px', color: 'var(--txt3)', marginTop: '2px' }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 601}}
                    , req.ip
                  )
                )
              )
            ))
          )
        )

        /* Panel derecho - Detalles */
        , React.createElement('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 611}}
          , !selectedReq ? (
            React.createElement('div', { style: {
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--txt3)',
              fontSize: '12px'
            }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 613}}, "Select a request to view details"

            )
          ) : (
            React.createElement(React.Fragment, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 624}}
              /* Header de request seleccionada */
              , React.createElement('div', { style: {
                padding: '16px',
                borderBottom: '1px solid var(--brd)',
                background: 'var(--bg2)'
              }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 626}}
                , React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 631}}
                  , React.createElement('span', { className: 'mth mth-' + (selectedReq.method || 'GET'), __self: this, __source: {fileName: _jsxFileName, lineNumber: 632}}
                    , selectedReq.method || 'GET'
                  )
                  , React.createElement('span', { style: {
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 635}}
                    , selectedReq.url || 'No URL'
                  )
                )

                , React.createElement('div', { style: { display: 'flex', gap: '8px', fontSize: '10px', color: 'var(--txt3)' }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 647}}
                  , React.createElement('span', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 648}}, formatTime(selectedReq.created_at))
                  , selectedReq.ip && React.createElement('span', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 649}}, "• " , selectedReq.ip)
                  , selectedReq.user_agent && (
                    React.createElement('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 651}}, "• "
                       , selectedReq.user_agent
                    )
                  )
                )

                , React.createElement('div', { style: { marginTop: '12px', display: 'flex', gap: '6px' }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 657}}
                  , React.createElement('button', { className: "btn btn-sm btn-p"  , onClick: sendToRepeater, __self: this, __source: {fileName: _jsxFileName, lineNumber: 658}}, "Send to Repeater"

                  )
                )
              )

              /* Tabs de detalles */
              , React.createElement('div', { style: {
                display: 'flex',
                gap: '2px',
                padding: '0 16px',
                borderBottom: '1px solid var(--brd)',
                background: 'var(--bg2)'
              }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 665}}
                , ['request', 'headers', 'query', 'body'].map(tab => (
                  React.createElement('div', {
                    key: tab,
                    onClick: () => setDetailTab(tab),
                    style: {
                      padding: '8px 16px',
                      fontSize: '11px',
                      cursor: 'pointer',
                      color: detailTab === tab ? 'var(--primary)' : 'var(--txt2)',
                      borderBottom: detailTab === tab ? '2px solid var(--primary)' : 'none',
                      marginBottom: '-1px',
                      textTransform: 'capitalize'
                    }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 673}}

                    , tab
                  )
                ))
              )

              /* Contenido del tab */
              , React.createElement('div', { style: { flex: 1, overflow: 'auto', padding: '16px' }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 692}}
                , detailTab === 'request' && (
                  React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 694}}
                    , React.createElement('div', { style: { marginBottom: '16px' }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 695}}
                      , React.createElement('div', { style: { fontSize: '10px', color: 'var(--txt3)', marginBottom: '6px' }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 696}}, "Method & URL"

                      )
                      , React.createElement('div', { style: {
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        background: 'var(--bg3)',
                        padding: '12px',
                        borderRadius: '4px'
                      }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 699}}
                        , selectedReq.method || 'GET', " " , selectedReq.url || 'No URL'
                      )
                    )

                    , selectedReq.content && (
                      React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 711}}
                        , React.createElement('div', { style: { fontSize: '10px', color: 'var(--txt3)', marginBottom: '6px' }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 712}}, "Body"

                        )
                        , React.createElement('div', { style: {
                          fontFamily: 'var(--font-mono)',
                          fontSize: '11px',
                          background: 'var(--bg3)',
                          padding: '12px',
                          borderRadius: '4px',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word'
                        },
                        dangerouslySetInnerHTML: { __html: highlightJSON(selectedReq.content) }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 715}}
                        )
                      )
                    )
                  )
                )

                , detailTab === 'headers' && (
                  React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 732}}
                    , React.createElement('div', { style: {
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      background: 'var(--bg3)',
                      padding: '12px',
                      borderRadius: '4px',
                      whiteSpace: 'pre-wrap'
                    },
                    dangerouslySetInnerHTML: { __html: highlightHeaders(selectedReq.headers) }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 733}}
                    )
                  )
                )

                , detailTab === 'query' && (
                  React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 747}}
                    , selectedReq.query ? (
                      React.createElement('div', { style: {
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        background: 'var(--bg3)',
                        padding: '12px',
                        borderRadius: '4px',
                        whiteSpace: 'pre-wrap'
                      },
                      dangerouslySetInnerHTML: { __html: highlightJSON(selectedReq.query) }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 749}}
                      )
                    ) : (
                      React.createElement('div', { style: { color: 'var(--txt3)', fontSize: '11px' }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 760}}, "No query parameters"

                      )
                    )
                  )
                )

                , detailTab === 'body' && (
                  React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 768}}
                    , selectedReq.content ? (
                      React.createElement(React.Fragment, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 770}}
                        , React.createElement('div', { style: { marginBottom: '8px', display: 'flex', gap: '6px' }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 771}}
                          , React.createElement('button', {
                            className: 'btn btn-sm ' + (format === 'raw' ? 'btn-p' : 'btn-s'),
                            onClick: () => setFormat('raw'), __self: this, __source: {fileName: _jsxFileName, lineNumber: 772}}
, "Raw"

                          )
                          , React.createElement('button', {
                            className: 'btn btn-sm ' + (format === 'pretty' ? 'btn-p' : 'btn-s'),
                            onClick: () => setFormat('pretty'), __self: this, __source: {fileName: _jsxFileName, lineNumber: 778}}
, "Pretty"

                          )
                        )
                        , React.createElement('div', { style: {
                          fontFamily: 'var(--font-mono)',
                          fontSize: '11px',
                          background: 'var(--bg3)',
                          padding: '12px',
                          borderRadius: '4px',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word'
                        },
                        dangerouslySetInnerHTML: {
                          __html: format === 'pretty'
                            ? highlightJSON(formatBody(selectedReq.content, 'pretty').text)
                            : highlightJSON(selectedReq.content)
                        }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 785}}
                        )
                      )
                    ) : (
                      React.createElement('div', { style: { color: 'var(--txt3)', fontSize: '11px' }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 802}}, "No body content"

                      )
                    )
                  )
                )
              )
            )
          )
        )
      )
    );
  };
})();
