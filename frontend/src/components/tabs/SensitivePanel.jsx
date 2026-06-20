// SensitivePanel — extraído de App.jsx (pestaña 'sensitive').
// Recibe todo el estado/handlers vía props (objeto __appCtx de App.jsx).

export function SensitivePanel(props) {
  const { SENS_COLORS, SENS_FILES, SENS_GENERAL, SENS_TOKENS, SENS_URLS, colorizeHeaders, escapeHtml, highlightMatches, loadSensDetail, reqs, runSensitiveScan, search, sensBatch, sensDetailRef, sensEntropyThreshold, sensFilter, sensFiltered, sensMaxSize, sensPatterns, sensPct, sensResults, sensScanning, sensScopeOnly, sensSelDetail, sensSelResult, sensSubTab, sensUnique, setSensBatch, setSensEntropyThreshold, setSensFilter, setSensMaxSize, setSensPatterns, setSensPct, setSensResults, setSensScopeOnly, setSensSelDetail, setSensSelResult, setSensSubTab, setSensUnique, stopSensitiveScan, tab } = props;
  return (
          <div className="sens-cnt">
            <div className="det-tabs" style={{ justifyContent: 'flex-start', gap: 0 }}>
              <div className={'det-tab' + (sensSubTab === 'logger' ? ' act' : '')} onClick={() => setSensSubTab('logger')}>Logger</div>
              <div className={'det-tab' + (sensSubTab === 'options' ? ' act' : '')} onClick={() => setSensSubTab('options')}>Options</div>
            </div>

            {sensSubTab === 'logger' && (
              <React.Fragment>
                <div className="sens-toolbar">
                  <button className="btn btn-sm btn-g" onClick={runSensitiveScan} disabled={sensScanning || reqs.length === 0}>
                    {sensScanning ? '...' : '\u25B6'} Scan
                  </button>
                  <button className="btn btn-sm btn-d" onClick={stopSensitiveScan} disabled={!sensScanning}>
                    {'\u25A0'} Stop
                  </button>
                  <button className="btn btn-sm btn-s" onClick={() => { setSensResults([]); setSensSelResult(null); setSensSelDetail(null); setSensPct(0); }}>
                    Clear
                  </button>
                  <div className="sens-progress" style={{ flex: 1 }}>
                    <div className="sens-progress-bar" style={{ width: sensPct + '%' }} />
                  </div>
                  <span style={{ fontSize: '10px', color: 'var(--txt2)', whiteSpace: 'nowrap' }}>
                    {sensScanning ? sensPct + '%' : sensResults.length + ' findings'}
                  </span>
                </div>

                <div className="sens-filter-bar">
                  <input
                    placeholder="Filter results..."
                    value={sensFilter}
                    onChange={e => setSensFilter(e.target.value)}
                    style={{ flex: 1, padding: '4px 8px', background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: '4px', color: 'var(--txt)', fontSize: '11px', fontFamily: 'var(--font-mono)', outline: 'none' }}
                  />
                  <label style={{ fontSize: '10px', color: 'var(--txt2)', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={sensUnique} onChange={e => setSensUnique(e.target.checked)} />
                    Unique
                  </label>
                  <label style={{ fontSize: '10px', color: 'var(--txt2)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Entropy ≥
                    <input
                      type="number"
                      min="0"
                      max="8"
                      step="0.1"
                      value={sensEntropyThreshold}
                      onChange={e => setSensEntropyThreshold(parseFloat(e.target.value) || 0)}
                      style={{ width: '50px', padding: '2px 4px', background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: '4px', color: 'var(--txt)', fontSize: '10px', fontFamily: 'var(--font-mono)' }}
                      title="Minimum entropy threshold to filter false positives (e.g., HTML tags). Default: 2.5"
                    />
                  </label>
                  <span style={{ fontSize: '10px', color: 'var(--txt3)' }}>
                    {sensFiltered.length}{sensFiltered.length !== sensResults.length ? ' / ' + sensResults.length : ''}
                  </span>
                </div>

                <div className="sens-results">
                  <div className="sens-row sens-row-hdr">
                    <span>Category</span>
                    <span>Match</span>
                    <span>Pattern / URL</span>
                  </div>
                  {sensFiltered.length === 0 && !sensScanning && (
                    <div className="empty" style={{ padding: '40px 0' }}>
                      <div className="empty-i">{sensResults.length === 0 ? '\uD83D\uDD0D' : '\uD83D\uDD0E'}</div>
                      <span>{sensResults.length === 0 ? 'Click Scan to analyze captured traffic' : 'No results match your filter'}</span>
                    </div>
                  )}
                  {sensFiltered.map((r, i) => (
                    <div key={i} className={'sens-row' + (sensSelResult === r ? ' sel' : '')} onClick={() => loadSensDetail(r)}>
                      <span className="sens-cat" style={{ background: (SENS_COLORS[r.category] || 'var(--txt3)') + '22', color: SENS_COLORS[r.category] || 'var(--txt3)' }}>
                        {r.category}
                      </span>
                      <span className="sens-match" title={r.match}>{r.match}</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                        <span className="sens-pname">{r.patternName}</span>
                        <span className="sens-purl" title={r.url}>{r.method} {r.url}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {sensSelResult && (
                  <div className="sens-detail">
                    <div className="pnl-hdr">
                      <span style={{ fontSize: '11px' }}>
                        <span className="sens-cat" style={{ background: (SENS_COLORS[sensSelResult.category] || 'var(--txt3)') + '22', color: SENS_COLORS[sensSelResult.category] || 'var(--txt3)', marginRight: '8px' }}>
                          {sensSelResult.category}
                        </span>
                        {sensSelResult.patternName} — <span style={{ color: 'var(--txt3)' }}>{sensSelResult.section}</span>
                      </span>
                      <button className="btn btn-sm btn-s" onClick={() => { setSensSelResult(null); setSensSelDetail(null); }}>Close</button>
                    </div>
                    <div ref={sensDetailRef} style={{ flex: 1, overflow: 'auto', padding: '10px', fontFamily: 'var(--font-mono)', fontSize: '11px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                      {sensSelDetail ? (() => {
                        const secMap = {
                          reqUrl: sensSelDetail.url || '',
                          reqHeaders: sensSelDetail.headers || '',
                          reqBody: sensSelDetail.body || '',
                          respHeaders: sensSelDetail.response_headers || '',
                          respBody: sensSelDetail.response_body || '',
                        };
                        const text = secMap[sensSelResult.section] || '';
                        const isHdr = sensSelResult.section === 'reqHeaders' || sensSelResult.section === 'respHeaders';
                        if (isHdr) {
                          const base = colorizeHeaders(text);
                          const mt = escapeHtml(sensSelResult.match.replace(/\.\.\.$/, ''));
                          const re = mt ? new RegExp('(' + mt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi') : null;
                          const html = re ? base.replace(re, '<span class="search-hl">$1</span>') : base;
                          return React.createElement('div', { dangerouslySetInnerHTML: { __html: html } });
                        }
                        const hl = highlightMatches(text, sensSelResult.match.replace(/\.\.\.$/, ''), false, 0);
                        return React.createElement('div', { dangerouslySetInnerHTML: { __html: hl.html } });
                      })() : <span style={{ color: 'var(--txt3)' }}>Loading...</span>}
                    </div>
                  </div>
                )}
              </React.Fragment>
            )}

            {sensSubTab === 'options' && (
              <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
                <div className="sens-opt-section">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ fontWeight: 600, fontSize: '12px' }}>Scanner Config</span>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '11px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      Batch Size:
                      <input type="number" min="1" max="20" value={sensBatch} onChange={e => setSensBatch(Math.max(1, parseInt(e.target.value) || 4))}
                        style={{ width: '50px', padding: '3px 6px', background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: '4px', color: 'var(--txt)', fontSize: '11px' }} />
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      Max Resp Size:
                      <input type="number" min="0" value={sensMaxSize} onChange={e => setSensMaxSize(parseInt(e.target.value) || 0)}
                        style={{ width: '90px', padding: '3px 6px', background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: '4px', color: 'var(--txt)', fontSize: '11px' }} />
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={sensScopeOnly} onChange={e => setSensScopeOnly(e.target.checked)} />
                      Scope only
                    </label>
                  </div>
                </div>

                {[
                  { key: 'general', label: 'General Patterns', defaults: SENS_GENERAL },
                  { key: 'tokens', label: 'Token Patterns', defaults: SENS_TOKENS },
                  { key: 'urls', label: 'URL Patterns', defaults: SENS_URLS },
                  { key: 'files', label: 'File Extension Patterns', defaults: SENS_FILES },
                ].map(grp => (
                  <div key={grp.key} className="sens-opt-section">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 600, fontSize: '12px' }}>{grp.label} ({sensPatterns[grp.key].filter(p => p.enabled).length}/{sensPatterns[grp.key].length})</span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button className="btn btn-sm btn-s" onClick={() => setSensPatterns(prev => ({ ...prev, [grp.key]: prev[grp.key].map(p => ({ ...p, enabled: true })) }))}>All</button>
                        <button className="btn btn-sm btn-s" onClick={() => setSensPatterns(prev => ({ ...prev, [grp.key]: prev[grp.key].map(p => ({ ...p, enabled: false })) }))}>None</button>
                        <button className="btn btn-sm btn-s" onClick={() => {
                          const name = prompt('Pattern name:');
                          if (!name) return;
                          const regex = prompt('Regex:');
                          if (!regex) return;
                          const category = prompt('Category:', grp.key === 'files' ? 'Files' : 'Custom');
                          setSensPatterns(prev => ({
                            ...prev,
                            [grp.key]: [...prev[grp.key], { name, regex, category: category || 'Custom', sections: grp.key === 'files' ? ['reqUrl'] : ['respHeaders','respBody'], enabled: true }]
                          }));
                        }}>+ Add</button>
                        <button className="btn btn-sm btn-s" onClick={() => setSensPatterns(prev => ({ ...prev, [grp.key]: grp.defaults.map(p => ({...p})) }))}>Reset</button>
                      </div>
                    </div>
                    <div style={{ maxHeight: '300px', overflow: 'auto' }}>
                      {sensPatterns[grp.key].map((pat, pi) => (
                        <div key={pi} className="sens-pat-row">
                          <input type="checkbox" checked={pat.enabled} onChange={e => {
                            const val = e.target.checked;
                            const gk = grp.key;
                            const idx = pi;
                            setSensPatterns(prev => ({
                              ...prev,
                              [gk]: prev[gk].map((p, j) => j === idx ? { ...p, enabled: val } : p)
                            }));
                          }} />
                          <span style={{ flex: '0 0 180px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={pat.name}>{pat.name}</span>
                          <span style={{ flex: 1, fontFamily: 'var(--font-mono)', color: 'var(--txt3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '10px' }} title={pat.regex}>{pat.regex}</span>
                          <span className="sens-section-badge">{pat.sections.join(', ')}</span>
                          <button className="btn btn-sm btn-s" style={{ padding: '1px 5px', fontSize: '9px' }} onClick={() => {
                            setSensPatterns(prev => {
                              const next = { ...prev, [grp.key]: prev[grp.key].filter((_, j) => j !== pi) };
                              return next;
                            });
                          }}>{'\u2715'}</button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
  );
}
