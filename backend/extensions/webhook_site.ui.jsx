/**
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
    const tokenId = ext.config?.token_id;
    const tokenUrl = ext.config?.token_url;
    const savedApiKey = ext.config?.api_key || '';

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
        } catch {
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
      } catch {
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
        <div ref={containerRef} style={{ padding: '12px', borderTop: '1px solid var(--brd)' }}>
          <div style={{ fontSize: '11px', color: 'var(--txt2)', marginBottom: '12px' }}>
            Configure webhook.site integration. Create a token to receive HTTP requests.
          </div>

          {/* API Key Field - always visible */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '10px', color: 'var(--txt3)', marginBottom: '4px' }}>
              API Key (optional - for premium features)
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                className="inp"
                type="password"
                placeholder="Enter API Key"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                style={{ flex: 1 }}
              />
              {tokenId && apiKey !== savedApiKey && (
                <button
                  className="btn btn-s"
                  onClick={updateApiKey}
                  disabled={loading}
                >
                  Update
                </button>
              )}
            </div>
          </div>

          {!tokenId ? (
            <div>
              <button
                className="btn btn-p"
                onClick={createToken}
                disabled={loading}
                style={{ width: '100%' }}
              >
                {loading ? 'Creating...' : 'Create Webhook URL'}
              </button>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: '11px', color: 'var(--txt3)', marginBottom: '8px' }}>
                Current Webhook URL:
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                background: 'var(--bg3)',
                padding: '8px',
                borderRadius: '4px',
                marginBottom: '12px',
                wordBreak: 'break-all'
              }}>
                {tokenUrl}
              </div>
              <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                <button className="btn btn-s" onClick={syncWebhook} disabled={loading}>
                  {loading ? '...' : 'Sync'}
                </button>
                <button className="btn btn-s" onClick={copyUrl}>
                  Copy to clipboard
                </button>
                <button className="btn btn-s" onClick={regenerateUrl} disabled={loading}>
                  Regenerate
                </button>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button className="btn btn-d" onClick={clearHistory}>
                  Clear History
                </button>
              </div>
              <div style={{ fontSize: '10px', color: 'var(--txt3)', marginTop: '8px' }}>
                {whkReqs.length} requests stored
              </div>
            </div>
          )}
        </div>
      );
    }

    // Vista completa para tab personalizada
    return (
      <div ref={containerRef} style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
        {/* Panel izquierdo - Configuración y lista */}
        <div style={{
          width: '350px',
          borderRight: '1px solid var(--brd)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* Header */}
          <div style={{
            padding: '16px',
            borderBottom: '1px solid var(--brd)',
            background: 'var(--bg2)'
          }}>
            <h3 style={{ margin: 0, fontSize: '14px', marginBottom: '12px' }}>Webhook.site</h3>

            {/* API Key Field - always visible */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '10px', color: 'var(--txt3)', marginBottom: '4px' }}>
                API Key (optional - for premium features)
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  className="inp"
                  type="password"
                  placeholder="Enter API Key"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  style={{ flex: 1 }}
                />
                {tokenId && apiKey !== savedApiKey && (
                  <button
                    className="btn btn-sm btn-p"
                    onClick={updateApiKey}
                    disabled={loading}
                  >
                    Update
                  </button>
                )}
              </div>
            </div>

            {!tokenId ? (
              <div>
                <button
                  className="btn btn-p"
                  onClick={createToken}
                  disabled={loading}
                  style={{ width: '100%' }}
                >
                  {loading ? 'Creating...' : 'Create Webhook URL'}
                </button>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: '10px', color: 'var(--txt3)', marginBottom: '6px' }}>
                  Current Webhook URL:
                </div>
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  background: 'var(--bg3)',
                  padding: '8px',
                  borderRadius: '4px',
                  marginBottom: '8px',
                  wordBreak: 'break-all'
                }}>
                  {tokenUrl}
                </div>

                <button
                  className="btn btn-sm btn-s"
                  onClick={copyUrl}
                  style={{ width: '100%', marginBottom: '12px' }}
                >
                  Copy to clipboard
                </button>

                <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
                  <button
                    className="btn btn-sm btn-p"
                    onClick={syncWebhook}
                    disabled={loading}
                    style={{ flex: 1 }}
                  >
                    {loading ? '...' : 'Sync'}
                  </button>
                  <button
                    className="btn btn-sm btn-s"
                    onClick={regenerateUrl}
                    disabled={loading}
                    style={{ flex: 1 }}
                  >
                    Regenerate
                  </button>
                  <button
                    className="btn btn-sm btn-d"
                    onClick={clearHistory}
                    style={{ flex: 1 }}
                  >
                    Clear
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', alignItems: 'center' }}>
                  <input
                    className="inp"
                    placeholder="Search..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '10px',
                    color: 'var(--txt2)',
                    whiteSpace: 'nowrap'
                  }}>
                    <input
                      type="checkbox"
                      checked={showAllTokens}
                      onChange={e => setShowAllTokens(e.target.checked)}
                    />
                    All tokens
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Lista de requests */}
          <div style={{ flex: 1, overflow: 'auto' }}>
            {filteredReqs.length === 0 && (
              <div style={{
                padding: '40px 20px',
                textAlign: 'center',
                color: 'var(--txt3)',
                fontSize: '11px'
              }}>
                {whkReqs.length === 0 ? 'No requests yet' : 'No matches'}
              </div>
            )}

            {filteredReqs.map(req => (
              <div
                key={req.request_id}
                onClick={() => setSelectedReq(req)}
                style={{
                  padding: '10px 12px',
                  borderBottom: '1px solid var(--brd)',
                  cursor: 'pointer',
                  background: selectedReq?.request_id === req.request_id ? 'var(--bg3)' : 'transparent',
                  transition: 'background 0.1s'
                }}
                onMouseEnter={e => {
                  if (selectedReq?.request_id !== req.request_id) {
                    e.currentTarget.style.background = 'var(--bg2)';
                  }
                }}
                onMouseLeave={e => {
                  if (selectedReq?.request_id !== req.request_id) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <span className={'mth mth-' + (req.method || 'GET')}>
                    {req.method || 'GET'}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--txt3)' }}>
                    {formatTime(req.created_at)}
                  </span>
                  {showAllTokens && req.token_id !== tokenId && (
                    <span style={{
                      fontSize: '9px',
                      padding: '2px 4px',
                      background: 'var(--bg3)',
                      borderRadius: '3px',
                      color: 'var(--txt3)',
                      fontFamily: 'var(--font-mono)'
                    }}>
                      {req.token_id?.substring(0, 8)}
                    </span>
                  )}
                </div>
                <div style={{
                  fontSize: '10px',
                  color: 'var(--txt2)',
                  fontFamily: 'var(--font-mono)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {req.url || 'No URL'}
                </div>
                {req.ip && (
                  <div style={{ fontSize: '9px', color: 'var(--txt3)', marginTop: '2px' }}>
                    {req.ip}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Panel derecho - Detalles */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!selectedReq ? (
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--txt3)',
              fontSize: '12px'
            }}>
              Select a request to view details
            </div>
          ) : (
            <React.Fragment>
              {/* Header de request seleccionada */}
              <div style={{
                padding: '16px',
                borderBottom: '1px solid var(--brd)',
                background: 'var(--bg2)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span className={'mth mth-' + (selectedReq.method || 'GET')}>
                    {selectedReq.method || 'GET'}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {selectedReq.url || 'No URL'}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '8px', fontSize: '10px', color: 'var(--txt3)' }}>
                  <span>{formatTime(selectedReq.created_at)}</span>
                  {selectedReq.ip && <span>• {selectedReq.ip}</span>}
                  {selectedReq.user_agent && (
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      • {selectedReq.user_agent}
                    </span>
                  )}
                </div>

                <div style={{ marginTop: '12px', display: 'flex', gap: '6px' }}>
                  <button className="btn btn-sm btn-p" onClick={sendToRepeater}>
                    Send to Repeater
                  </button>
                </div>
              </div>

              {/* Tabs de detalles */}
              <div style={{
                display: 'flex',
                gap: '2px',
                padding: '0 16px',
                borderBottom: '1px solid var(--brd)',
                background: 'var(--bg2)'
              }}>
                {['request', 'headers', 'query', 'body'].map(tab => (
                  <div
                    key={tab}
                    onClick={() => setDetailTab(tab)}
                    style={{
                      padding: '8px 16px',
                      fontSize: '11px',
                      cursor: 'pointer',
                      color: detailTab === tab ? 'var(--primary)' : 'var(--txt2)',
                      borderBottom: detailTab === tab ? '2px solid var(--primary)' : 'none',
                      marginBottom: '-1px',
                      textTransform: 'capitalize'
                    }}
                  >
                    {tab}
                  </div>
                ))}
              </div>

              {/* Contenido del tab */}
              <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
                {detailTab === 'request' && (
                  <div>
                    <div style={{ marginBottom: '16px' }}>
                      <div style={{ fontSize: '10px', color: 'var(--txt3)', marginBottom: '6px' }}>
                        Method & URL
                      </div>
                      <div style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        background: 'var(--bg3)',
                        padding: '12px',
                        borderRadius: '4px'
                      }}>
                        {selectedReq.method || 'GET'} {selectedReq.url || 'No URL'}
                      </div>
                    </div>

                    {selectedReq.content && (
                      <div>
                        <div style={{ fontSize: '10px', color: 'var(--txt3)', marginBottom: '6px' }}>
                          Body
                        </div>
                        <div style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '11px',
                          background: 'var(--bg3)',
                          padding: '12px',
                          borderRadius: '4px',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word'
                        }}
                        dangerouslySetInnerHTML={{ __html: highlightJSON(selectedReq.content) }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {detailTab === 'headers' && (
                  <div>
                    <div style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      background: 'var(--bg3)',
                      padding: '12px',
                      borderRadius: '4px',
                      whiteSpace: 'pre-wrap'
                    }}
                    dangerouslySetInnerHTML={{ __html: highlightHeaders(selectedReq.headers) }}
                    />
                  </div>
                )}

                {detailTab === 'query' && (
                  <div>
                    {selectedReq.query ? (
                      <div style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        background: 'var(--bg3)',
                        padding: '12px',
                        borderRadius: '4px',
                        whiteSpace: 'pre-wrap'
                      }}
                      dangerouslySetInnerHTML={{ __html: highlightJSON(selectedReq.query) }}
                      />
                    ) : (
                      <div style={{ color: 'var(--txt3)', fontSize: '11px' }}>
                        No query parameters
                      </div>
                    )}
                  </div>
                )}

                {detailTab === 'body' && (
                  <div>
                    {selectedReq.content ? (
                      <React.Fragment>
                        <div style={{ marginBottom: '8px', display: 'flex', gap: '6px' }}>
                          <button
                            className={'btn btn-sm ' + (format === 'raw' ? 'btn-p' : 'btn-s')}
                            onClick={() => setFormat('raw')}
                          >
                            Raw
                          </button>
                          <button
                            className={'btn btn-sm ' + (format === 'pretty' ? 'btn-p' : 'btn-s')}
                            onClick={() => setFormat('pretty')}
                          >
                            Pretty
                          </button>
                        </div>
                        <div style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '11px',
                          background: 'var(--bg3)',
                          padding: '12px',
                          borderRadius: '4px',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word'
                        }}
                        dangerouslySetInnerHTML={{
                          __html: format === 'pretty'
                            ? highlightJSON(formatBody(selectedReq.content, 'pretty').text)
                            : highlightJSON(selectedReq.content)
                        }}
                        />
                      </React.Fragment>
                    ) : (
                      <div style={{ color: 'var(--txt3)', fontSize: '11px' }}>
                        No body content
                      </div>
                    )}
                  </div>
                )}
              </div>
            </React.Fragment>
          )}
        </div>
      </div>
    );
  };
})();
