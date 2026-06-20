// IntruderPanel — extraído de App.jsx (pestaña 'intruder').
// Recibe todo el estado/handlers vía props (objeto __appCtx de App.jsx).

export function IntruderPanel(props) {
  const { api, colorizeHeaders, deleteIntAttack, escapeHtml, fmtHHtml, intAttackType, intAttacks, intBody, intBodyRef, intComputeTotal, intConcurrency, intDelay, intDelayMax, intDelayMin, intDone, intFilter, intFollowRedirects, intHeaders, intHeadersHighlightRef, intHeadersRef, intMaxRetries, intMethod, intPayloads, intPct, intPositions, intRandomDelay, intResults, intRunning, intSelAttack, intSelPayloadSet, intSelResult, intSortCol, intSortDir, intSorted, intStartTime, intSubTab, intTimeout, intTotal, intUrl, intUrlRef, loadIntAttack, renameIntAttack, requests, runIntruderAttack, setIntAttackType, setIntBody, setIntConcurrency, setIntDelay, setIntDelayMax, setIntDelayMin, setIntDone, setIntFilter, setIntFollowRedirects, setIntHeaders, setIntMaxRetries, setIntMethod, setIntPayloads, setIntPct, setIntRandomDelay, setIntResults, setIntSelAttack, setIntSelPayloadSet, setIntSelResult, setIntSortCol, setIntSortDir, setIntSubTab, setIntTimeout, setIntTotal, setIntUrl, stopIntruderAttack, tab, toRep, toast } = props;
  return (
          <div style={{ display: 'flex', width: '100%', height: '100%' }}>
            <div className="rep-side" style={{ width: '200px', minWidth: '160px' }}>
              <div className="pnl-hdr">
                <span>Attacks</span>
                <button className="btn btn-sm btn-p" onClick={() => { setIntSelAttack(null); setIntMethod('GET'); setIntUrl(''); setIntHeaders(''); setIntBody(''); setIntResults([]); setIntDone(0); setIntTotal(0); setIntPct(0); setIntSelResult(null); setIntSubTab('positions'); }}>+ New</button>
              </div>
              <div className="rep-list">
                {intAttacks.map(a => (
                  <div key={a.id} className={'rep-item' + (intSelAttack === a.id ? ' sel' : '')} onClick={() => loadIntAttack(a.id)}>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ fontSize: 11, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                      <div style={{ fontSize: 9, color: 'var(--txt3)' }}>{a.total} results {'\u00b7'} {a.created_at ? new Date(a.created_at).toLocaleDateString() : ''}</div>
                    </div>
                    {intSelAttack === a.id && (
                      <div style={{ display: 'flex', gap: 2 }} onClick={e => e.stopPropagation()}>
                        <button className="btn btn-sm btn-s" onClick={() => renameIntAttack(a.id)} style={{ padding: '2px 5px', fontSize: 10 }}>{'\u270e'}</button>
                        <button className="btn btn-sm btn-d" onClick={() => deleteIntAttack(a.id)} style={{ padding: '2px 5px', fontSize: 10 }}>{'\u2715'}</button>
                      </div>
                    )}
                  </div>
                ))}
                {intAttacks.length === 0 && (
                  <div style={{ padding: 14, fontSize: 11, color: 'var(--txt3)', textAlign: 'center' }}>No saved attacks</div>
                )}
              </div>
            </div>
            <div className="intr-cnt" style={{ flex: 1, minWidth: 0 }}>
            <div className="det-tabs" style={{ justifyContent: 'flex-start', gap: 0 }}>
              <div className={'det-tab' + (intSubTab === 'positions' ? ' act' : '')} onClick={() => setIntSubTab('positions')}>Positions</div>
              <div className={'det-tab' + (intSubTab === 'payloads' ? ' act' : '')} onClick={() => setIntSubTab('payloads')}>Payloads</div>
              <div className={'det-tab' + (intSubTab === 'resource' ? ' act' : '')} onClick={() => setIntSubTab('resource')}>Resource Pool</div>
              <div className={'det-tab' + (intSubTab === 'results' ? ' act' : '')} onClick={() => setIntSubTab('results')}>Results {intResults.length > 0 ? '(' + intResults.length + ')' : ''}</div>
            </div>

            {intSubTab === 'positions' && (
              <div className="int-positions">
                <div className="int-section">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <label style={{ fontSize: 11, color: 'var(--txt2)' }}>Attack Type:</label>
                    <select className="sel" value={intAttackType} onChange={e => setIntAttackType(e.target.value)} style={{ fontSize: 11, padding: '4px 8px' }}>
                      <option value="targeted">Targeted</option>
                      <option value="broadcast">Broadcast</option>
                      <option value="parallel">Parallel</option>
                      <option value="matrix">Matrix</option>
                    </select>
                    <span style={{ fontSize: 10, color: 'var(--txt3)', flex: 1 }}>
                      {intAttackType === 'targeted' && 'Tests each position one at a time with a single payload set'}
                      {intAttackType === 'broadcast' && 'Same payload in all positions simultaneously'}
                      {intAttackType === 'parallel' && 'Different payload per position, iterated in parallel (zip)'}
                      {intAttackType === 'matrix' && 'Cartesian product of all payload sets — tests every combination'}
                    </span>
                  </div>
                </div>

                <div className="int-section">
                  <h4>Request</h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <select className="mth-sel" value={intMethod} onChange={e => setIntMethod(e.target.value)} style={{ fontSize: 11 }}>
                      <option>GET</option><option>POST</option><option>PUT</option><option>PATCH</option><option>DELETE</option><option>HEAD</option><option>OPTIONS</option>
                    </select>
                    <input ref={intUrlRef} className="url-in" placeholder="https://example.com/api/endpoint" value={intUrl} onChange={e => setIntUrl(e.target.value)} style={{ flex: 1 }} />
                  </div>
                  <label style={{ fontSize: 10, color: 'var(--txt3)', display: 'block', marginBottom: 4 }}>Headers</label>
                  <div className="hdr-wrap">
                    <pre ref={intHeadersHighlightRef} className="hdr-highlight int-editor" aria-hidden="true" dangerouslySetInnerHTML={{ __html: (intHeaders ? colorizeHeaders(intHeaders) : '') + '\n' }} />
                    <textarea ref={intHeadersRef} className="int-editor hdr-ta" rows={4} value={intHeaders} onChange={e => setIntHeaders(e.target.value)}
                      onScroll={e => { if (intHeadersHighlightRef.current) intHeadersHighlightRef.current.scrollTop = e.target.scrollTop; }}
                      placeholder={'Content-Type: application/json\nAuthorization: Bearer \u00a7token\u00a7'} spellCheck="false" />
                  </div>
                  <label style={{ fontSize: 10, color: 'var(--txt3)', display: 'block', marginBottom: 4, marginTop: 8 }}>Body</label>
                  <textarea ref={intBodyRef} className="int-editor" rows={6} value={intBody} onChange={e => setIntBody(e.target.value)}
                    placeholder={'{"username":"\u00a7user\u00a7","password":"\u00a7pass\u00a7"}'} />
                </div>

                <div className="int-section">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button className="btn btn-sm btn-p" onClick={() => {
                      const ref = intUrlRef.current || intHeadersRef.current || intBodyRef.current;
                      if (!ref) return;
                      const start = ref.selectionStart;
                      const end = ref.selectionEnd;
                      if (start === end) { toast('Select text first', 'error'); return; }
                      const val = ref.value;
                      const selected = val.substring(start, end);
                      const nv = val.substring(0, start) + '\u00a7' + selected + '\u00a7' + val.substring(end);
                      if (ref === intUrlRef.current) setIntUrl(nv);
                      else if (ref === intHeadersRef.current) setIntHeaders(nv);
                      else if (ref === intBodyRef.current) setIntBody(nv);
                      setTimeout(() => ref.focus(), 0);
                    }}>{'\u00a7'} Add {'\u00a7'}</button>
                    <button className="btn btn-sm btn-s" onClick={() => {
                      setIntUrl(intUrl.replace(/\u00a7[^\u00a7]*\u00a7/g, m => m.slice(1, -1)));
                      setIntHeaders(intHeaders.replace(/\u00a7[^\u00a7]*\u00a7/g, m => m.slice(1, -1)));
                      setIntBody(intBody.replace(/\u00a7[^\u00a7]*\u00a7/g, m => m.slice(1, -1)));
                    }}>Clear {'\u00a7'}</button>
                    <span style={{ fontSize: 11, color: 'var(--txt2)' }}>Positions found: <strong style={{ color: 'var(--orange)' }}>{intPositions.length}</strong></span>
                  </div>
                  {intPositions.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                      {intPositions.map((p, i) => (
                        <span key={i} className="int-pos-tag">#{i + 1}: {p.name} <span style={{ color: 'var(--txt3)', fontSize: 9 }}>({p.section})</span></span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {intSubTab === 'payloads' && (
              <div className="int-payloads">
                <div className="int-section">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <label style={{ fontSize: 11, color: 'var(--txt2)' }}>Payload Set:</label>
                    <select className="sel" value={intSelPayloadSet} onChange={e => setIntSelPayloadSet(Number(e.target.value))} style={{ fontSize: 11, padding: '4px 8px' }}>
                      {intPositions.map((p, i) => (
                        <option key={i} value={i}>Position #{i + 1}: {p.name}</option>
                      ))}
                    </select>
                  </div>
                  {intPositions.length === 0 && (
                    <div className="empty" style={{ padding: 30 }}>
                      <div className="empty-i">{'\u00a7'}</div>
                      <span>Add position markers in the Positions tab first</span>
                    </div>
                  )}
                  {intPositions.length > 0 && (() => {
                    const idx = intSelPayloadSet;
                    const cfg = intPayloads[idx] || { type: 'list', items: '' };
                    const updateCfg = (key, val) => setIntPayloads(prev => ({ ...prev, [idx]: { ...prev[idx], [key]: val } }));
                    return React.createElement(React.Fragment, null,
                      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 } },
                        React.createElement('label', { style: { fontSize: 11, color: 'var(--txt2)' } }, 'Payload Type:'),
                        React.createElement('select', { className: 'sel', value: cfg.type, onChange: e => updateCfg('type', e.target.value), style: { fontSize: 11, padding: '4px 8px' } },
                          React.createElement('option', { value: 'list' }, 'Simple List'),
                          React.createElement('option', { value: 'numbers' }, 'Numbers'),
                          React.createElement('option', { value: 'bruteforce' }, 'Brute Forcer')
                        )
                      ),
                      cfg.type === 'list' && React.createElement('div', { className: 'int-section' },
                        React.createElement('h4', null, 'Simple List'),
                        React.createElement('textarea', { className: 'int-editor', rows: 12, value: cfg.items || '', onChange: e => updateCfg('items', e.target.value),
                          placeholder: 'Enter one payload per line...' }),
                        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 } },
                          React.createElement('button', { className: 'btn btn-sm btn-s', onClick: () => {
                            const input = document.createElement('input');
                            input.type = 'file'; input.accept = '.txt,.csv,.lst,.list';
                            input.onchange = e => {
                              const f = e.target.files[0]; if (!f) return;
                              const reader = new FileReader();
                              reader.onload = ev => updateCfg('items', (cfg.items ? cfg.items + '\n' : '') + ev.target.result);
                              reader.readAsText(f);
                            };
                            input.click();
                          }}, 'Load File'),
                          React.createElement('button', { className: 'btn btn-sm btn-s', onClick: async () => {
                            try { const t = await navigator.clipboard.readText(); updateCfg('items', (cfg.items ? cfg.items + '\n' : '') + t); } catch(e) { toast('Clipboard access denied', 'error'); }
                          }}, 'Paste'),
                          React.createElement('button', { className: 'btn btn-sm btn-d', onClick: () => updateCfg('items', '') }, 'Clear'),
                          React.createElement('span', { style: { fontSize: 10, color: 'var(--txt3)', marginLeft: 'auto' } },
                            'Items: ' + ((cfg.items || '').split('\n').filter(l => l.length > 0).length))
                        )
                      ),
                      cfg.type === 'numbers' && React.createElement('div', { className: 'int-section' },
                        React.createElement('h4', null, 'Numbers Range'),
                        React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 } },
                          React.createElement('label', { style: { fontSize: 10, color: 'var(--txt3)' } }, 'From:', React.createElement('input', { type: 'number', className: 'int-editor', style: { marginTop: 4, padding: 6, minHeight: 'auto' }, value: cfg.from || 0, onChange: e => updateCfg('from', Number(e.target.value)) })),
                          React.createElement('label', { style: { fontSize: 10, color: 'var(--txt3)' } }, 'To:', React.createElement('input', { type: 'number', className: 'int-editor', style: { marginTop: 4, padding: 6, minHeight: 'auto' }, value: cfg.to || 99, onChange: e => updateCfg('to', Number(e.target.value)) })),
                          React.createElement('label', { style: { fontSize: 10, color: 'var(--txt3)' } }, 'Step:', React.createElement('input', { type: 'number', className: 'int-editor', style: { marginTop: 4, padding: 6, minHeight: 'auto' }, value: cfg.step || 1, onChange: e => updateCfg('step', Number(e.target.value)) })),
                          React.createElement('label', { style: { fontSize: 10, color: 'var(--txt3)' } }, 'Pad digits (0=none):', React.createElement('input', { type: 'number', className: 'int-editor', style: { marginTop: 4, padding: 6, minHeight: 'auto' }, value: cfg.padLen || 0, onChange: e => updateCfg('padLen', Number(e.target.value)) }))
                        ),
                        React.createElement('div', { style: { fontSize: 10, color: 'var(--txt3)', marginTop: 8 } },
                          'Will generate ' + (Math.max(0, Math.floor(((cfg.to || 99) - (cfg.from || 0)) / Math.max(1, cfg.step || 1)) + 1)) + ' payloads')
                      ),
                      cfg.type === 'bruteforce' && React.createElement('div', { className: 'int-section' },
                        React.createElement('h4', null, 'Brute Forcer'),
                        React.createElement('label', { style: { fontSize: 10, color: 'var(--txt3)', display: 'block', marginBottom: 4 } }, 'Character Set:'),
                        React.createElement('input', { className: 'int-editor', style: { minHeight: 'auto', padding: 6 }, value: cfg.charset || 'abcdefghijklmnopqrstuvwxyz', onChange: e => updateCfg('charset', e.target.value) }),
                        React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 } },
                          React.createElement('label', { style: { fontSize: 10, color: 'var(--txt3)' } }, 'Min Length:', React.createElement('input', { type: 'number', className: 'int-editor', style: { marginTop: 4, padding: 6, minHeight: 'auto' }, value: cfg.minLen || 1, onChange: e => updateCfg('minLen', Number(e.target.value)) })),
                          React.createElement('label', { style: { fontSize: 10, color: 'var(--txt3)' } }, 'Max Length:', React.createElement('input', { type: 'number', className: 'int-editor', style: { marginTop: 4, padding: 6, minHeight: 'auto' }, value: cfg.maxLen || 3, onChange: e => updateCfg('maxLen', Number(e.target.value)) }))
                        ),
                        React.createElement('div', { style: { fontSize: 10, color: 'var(--txt3)', marginTop: 8 } },
                          (() => { const c = (cfg.charset || 'a').length; const mn = Math.max(1, cfg.minLen || 1); const mx = Math.min(8, cfg.maxLen || 3); let t = 0; for (let l = mn; l <= mx; l++) t += Math.pow(c, l); return 'Will generate ~' + (t > 500000 ? '500,000 (capped)' : t.toLocaleString()) + ' payloads'; })()
                        )
                      ),
                      React.createElement('div', { className: 'int-section', style: { marginTop: 12 } },
                        React.createElement('h4', null, 'Payload Processing'),
                        React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' } },
                          React.createElement('label', { style: { fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 } },
                            React.createElement('input', { type: 'checkbox', checked: cfg.urlEncode || false, onChange: e => updateCfg('urlEncode', e.target.checked) }),
                            'URL-encode'),
                          React.createElement('label', { style: { fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 } },
                            React.createElement('input', { type: 'checkbox', checked: cfg.base64 || false, onChange: e => updateCfg('base64', e.target.checked) }),
                            'Base64')
                        ),
                        React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 } },
                          React.createElement('label', { style: { fontSize: 10, color: 'var(--txt3)' } }, 'Prefix:', React.createElement('input', { className: 'int-editor', style: { marginTop: 4, padding: 6, minHeight: 'auto' }, value: cfg.prefix || '', onChange: e => updateCfg('prefix', e.target.value) })),
                          React.createElement('label', { style: { fontSize: 10, color: 'var(--txt3)' } }, 'Suffix:', React.createElement('input', { className: 'int-editor', style: { marginTop: 4, padding: 6, minHeight: 'auto' }, value: cfg.suffix || '', onChange: e => updateCfg('suffix', e.target.value) }))
                        )
                      )
                    );
                  })()}
                </div>
              </div>
            )}

            {intSubTab === 'resource' && (
              <div className="int-resource">
                <div className="int-section">
                  <h4>Throttle Settings</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <label style={{ fontSize: 11, color: 'var(--txt2)' }}>Concurrent Requests (1-50):
                      <input type="number" className="int-editor" style={{ marginTop: 4, padding: 6, minHeight: 'auto' }}
                        value={intConcurrency} onChange={e => setIntConcurrency(Math.max(1, Math.min(50, Number(e.target.value) || 1)))} min={1} max={50} />
                    </label>
                    <label style={{ fontSize: 11, color: 'var(--txt2)' }}>Fixed Delay Between Batches (ms):
                      <input type="number" className="int-editor" style={{ marginTop: 4, padding: 6, minHeight: 'auto' }}
                        value={intDelay} onChange={e => setIntDelay(Math.max(0, Number(e.target.value) || 0))} min={0} />
                    </label>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input type="checkbox" checked={intRandomDelay} onChange={e => setIntRandomDelay(e.target.checked)} />
                      Random delay instead
                    </label>
                    {intRandomDelay && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8, marginLeft: 20 }}>
                        <label style={{ fontSize: 10, color: 'var(--txt3)' }}>Min (ms):
                          <input type="number" className="int-editor" style={{ marginTop: 4, padding: 6, minHeight: 'auto' }}
                            value={intDelayMin} onChange={e => setIntDelayMin(Number(e.target.value) || 0)} />
                        </label>
                        <label style={{ fontSize: 10, color: 'var(--txt3)' }}>Max (ms):
                          <input type="number" className="int-editor" style={{ marginTop: 4, padding: 6, minHeight: 'auto' }}
                            value={intDelayMax} onChange={e => setIntDelayMax(Number(e.target.value) || 0)} />
                        </label>
                      </div>
                    )}
                  </div>
                </div>

                <div className="int-section">
                  <h4>Connection Settings</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <label style={{ fontSize: 11, color: 'var(--txt2)' }}>Request Timeout (seconds):
                      <input type="number" className="int-editor" style={{ marginTop: 4, padding: 6, minHeight: 'auto' }}
                        value={intTimeout} onChange={e => setIntTimeout(Math.max(1, Number(e.target.value) || 30))} min={1} />
                    </label>
                    <label style={{ fontSize: 11, color: 'var(--txt2)' }}>Max Retries on Error:
                      <input type="number" className="int-editor" style={{ marginTop: 4, padding: 6, minHeight: 'auto' }}
                        value={intMaxRetries} onChange={e => setIntMaxRetries(Math.max(0, Number(e.target.value) || 0))} min={0} />
                    </label>
                  </div>
                  <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
                    <input type="checkbox" checked={intFollowRedirects} onChange={e => setIntFollowRedirects(e.target.checked)} />
                    Follow redirects
                  </label>
                </div>

                <div className="int-section">
                  <h4>Attack Preview</h4>
                  <div style={{ fontSize: 11, color: 'var(--txt2)', lineHeight: 1.8 }}>
                    <div>Attack type: <strong>{intAttackType.replace('_', ' ')}</strong></div>
                    <div>Positions: <strong>{intPositions.length}</strong></div>
                    <div>Total requests: <strong style={{ color: 'var(--cyan)' }}>{intComputeTotal().toLocaleString()}</strong></div>
                    {intComputeTotal() > 0 && intConcurrency > 0 && (
                      <div>Estimated time: <strong>~{(() => {
                        const total = intComputeTotal();
                        const batches = Math.ceil(total / intConcurrency);
                        const avgDelay = intRandomDelay ? (intDelayMin + intDelayMax) / 2 : intDelay;
                        const secs = batches * 0.5 + batches * avgDelay / 1000;
                        if (secs < 60) return Math.round(secs) + 's';
                        if (secs < 3600) return Math.round(secs / 60) + ' min';
                        return (secs / 3600).toFixed(1) + ' hr';
                      })()}</strong></div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {intSubTab === 'results' && (
              <div className="int-results-cnt">
                <div className="sens-toolbar">
                  <button className="btn btn-sm btn-p" onClick={runIntruderAttack} disabled={intRunning || intPositions.length === 0}>{'\u25b6'} Start Attack</button>
                  <button className="btn btn-sm btn-d" onClick={stopIntruderAttack} disabled={!intRunning}>{'\u25a0'} Stop</button>
                  <button className="btn btn-sm btn-s" onClick={() => { setIntResults([]); setIntDone(0); setIntPct(0); setIntSelResult(null); }}>Clear</button>
                  <div className="int-progress" style={{ flex: 1, marginLeft: 8, marginRight: 8 }}>
                    <div className="int-progress-bar" style={{ width: intPct + '%' }} />
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--txt3)', whiteSpace: 'nowrap' }}>{intPct}%</span>
                </div>
                <div className="int-stats" style={{ padding: '4px 14px', background: 'var(--bg2)', borderBottom: '1px solid var(--brd)' }}>
                  <span>{intDone}/{intTotal} requests</span>
                  {intStartTime && intDone > 0 && <span>{(intDone / ((Date.now() - intStartTime) / 1000)).toFixed(1)} req/s</span>}
                  {intStartTime && <span>Elapsed: {Math.round((Date.now() - intStartTime) / 1000)}s</span>}
                  <div style={{ flex: 1 }} />
                  <input className="int-editor" style={{ minHeight: 'auto', padding: '3px 8px', width: 180, resize: 'none', fontSize: 10 }}
                    placeholder="Filter results..." value={intFilter} onChange={e => setIntFilter(e.target.value)} />
                </div>
                <div className="int-results">
                  <div className="int-row int-row-hdr" onClick={e => {
                    const col = e.target.dataset.col;
                    if (!col) return;
                    setIntSortCol(col);
                    setIntSortDir(prev => intSortCol === col ? (prev === 'asc' ? 'desc' : 'asc') : 'asc');
                  }}>
                    <span data-col="#"># {intSortCol === '#' ? (intSortDir === 'asc' ? '\u25b2' : '\u25bc') : ''}</span>
                    <span data-col="payload">Payload {intSortCol === 'payload' ? (intSortDir === 'asc' ? '\u25b2' : '\u25bc') : ''}</span>
                    <span data-col="status">Status {intSortCol === 'status' ? (intSortDir === 'asc' ? '\u25b2' : '\u25bc') : ''}</span>
                    <span data-col="length">Length {intSortCol === 'length' ? (intSortDir === 'asc' ? '\u25b2' : '\u25bc') : ''}</span>
                    <span data-col="time">Time {intSortCol === 'time' ? (intSortDir === 'asc' ? '\u25b2' : '\u25bc') : ''}</span>
                    <span>Error</span>
                  </div>
                  {intSorted.map(r => (
                    <div key={r.num} className={'int-row' + (intSelResult && intSelResult.num === r.num ? ' sel' : '')}
                      onClick={() => setIntSelResult(prev => prev && prev.num === r.num ? null : r)}>
                      <span style={{ color: 'var(--txt3)' }}>{r.num}</span>
                      <span className="int-payload-txt" title={r.payload}>{r.payload}</span>
                      <span className={'int-status s' + String(r.status).charAt(0)}>{r.status || '-'}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>{r.length > 0 ? r.length.toLocaleString() : '-'}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>{r.time > 0 ? r.time + 'ms' : '-'}</span>
                      <span style={{ color: 'var(--red)', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.error}>{r.error}</span>
                    </div>
                  ))}
                  {intResults.length === 0 && !intRunning && (
                    <div className="empty" style={{ padding: 40 }}>
                      <div className="empty-i">{'\u26a1'}</div>
                      <span>Click "Start Attack" to begin</span>
                    </div>
                  )}
                </div>
                {intSelResult && (
                  <div className="int-detail">
                    <div className="det-tabs" style={{ justifyContent: 'flex-start', gap: 0, flexShrink: 0 }}>
                      <div className="det-tab act" style={{ fontSize: 10 }}>Request / Response #{intSelResult.num}</div>
                      <div style={{ flex: 1 }} />
                      <button className="btn btn-sm btn-s" style={{ margin: '2px 6px', fontSize: 9 }} onClick={() => toRep(intSelResult.request)}>Send to Repeater</button>
                      <button className="btn btn-sm btn-s" style={{ margin: '2px 6px', fontSize: 9, padding: '2px 6px' }} onClick={() => setIntSelResult(null)}>{'\u2715'}</button>
                    </div>
                    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                      <div style={{ flex: 1, overflow: 'auto', padding: 10, borderRight: '1px solid var(--brd)' }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--cyan)', marginBottom: 6 }}>Request</div>
                        <pre style={{ fontFamily: 'var(--font-mono)', fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'var(--txt)', margin: 0 }}
                          dangerouslySetInnerHTML={{ __html: escapeHtml(intSelResult.request.method + ' ' + intSelResult.request.url) + '\n' + fmtHHtml(intSelResult.request.headers, intSelResult.request.url) + (intSelResult.request.body ? '\n\n' + escapeHtml(intSelResult.request.body) : '') }} />
                      </div>
                      <div style={{ flex: 1, overflow: 'auto', padding: 10 }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--green)', marginBottom: 6 }}>Response</div>
                        {intSelResult.response.error ? (
                          <div style={{ color: 'var(--red)', fontSize: 11 }}>{intSelResult.response.error}</div>
                        ) : (
                          <pre style={{ fontFamily: 'var(--font-mono)', fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'var(--txt)', margin: 0 }}
                            dangerouslySetInnerHTML={{ __html: escapeHtml('HTTP ' + intSelResult.response.status_code + ' (' + intSelResult.time + 'ms, ' + intSelResult.length + ' bytes)') + '\n' + fmtHHtml(intSelResult.response.headers) + (intSelResult.response.body ? '\n\n' + escapeHtml(intSelResult.response.body) : '') }} />
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          </div>
  );
}
