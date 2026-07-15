// CollectionsPanel — extraído de App.jsx (pestaña 'collections').
// Recibe todo el estado/handlers vía props (objeto __appCtx de App.jsx).

export function CollectionsPanel(props) {
  const { ResizeHandle, addSessionRule, collItems, collResps, collRunning, collSideW, collStep, collStepsW, collSubTab, collVars, collections, colls, colorizeBody, createColl, deleteColl, deleteCollItem, deleteSessionRule, executeCollStep, loadCollItems, loadSessionRules, newRule, requests, resetCollRun, selColl, sessionRulesData, setCollSideW, setCollStep, setCollStepsW, setCollSubTab, setNewRule, showContextMenu, stCls, tab, toggleSessionRule, updateCollItemExtracts } = props;
  return (
          <div className="coll-cnt">
            <div className="hist-sub-tabs">
              <div className={'hist-sub-tab' + (collSubTab === 'collections' ? ' act' : '')} onClick={() => setCollSubTab('collections')}>Collections</div>
              <div className={'hist-sub-tab' + (collSubTab === 'session-rules' ? ' act' : '')} onClick={() => { setCollSubTab('session-rules'); loadSessionRules(); }}>Session Rules</div>
            </div>

            {collSubTab === 'collections' && (
              <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                <div className="coll-side panel" style={{ width: collSideW + 'px' }}>
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
                    <span>Aún no hay colecciones</span>
                    <span className="empty-hint">Una colección encadena varias peticiones (p. ej. login → acción) y pasa variables entre ellas. Créala con el botón de arriba.</span>
                  </div>
                )}
              </div>
            </div>
            <ResizeHandle onDrag={(dx) => setCollSideW(w => Math.max(100, Math.min(400, w + dx)))} />
            <div className="coll-steps panel" style={{ width: collStepsW + 'px' }}>
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
                    <span>Colección vacía</span>
                    <span className="empty-hint">Agrega peticiones con clic derecho → "Add to Collection" en History.</span>
                  </div>
                )}
                {!selColl && (
                  <div className="empty" style={{ padding: 20, fontSize: 11 }}>
                    <span>Selecciona una colección para ver sus pasos</span>
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
            <ResizeHandle onDrag={(dx) => setCollStepsW(w => Math.max(150, Math.min(600, w + dx)))} />
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

            {collSubTab === 'session-rules' && (
              <div style={{ padding: '20px', overflow: 'auto', flex: 1 }}>
                <div style={{ maxWidth: '900px', margin: '0 auto' }}>
                  <div style={{ marginBottom: '24px', padding: '16px', background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: '4px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px', color: 'var(--cyan)' }}>Add Session Rule</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                      <div>
                        <label style={{ fontSize: '11px', color: 'var(--txt2)', display: 'block', marginBottom: '4px' }}>Rule Name</label>
                        <input className="inp" value={newRule.name} onChange={e => setNewRule({ ...newRule, name: e.target.value })} placeholder="My Session Token" />
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', color: 'var(--txt2)', display: 'block', marginBottom: '4px' }}>Variable Name</label>
                        <input className="inp" value={newRule.variable} onChange={e => setNewRule({ ...newRule, variable: e.target.value })} placeholder="session_token" />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                      <div>
                        <label style={{ fontSize: '11px', color: 'var(--txt2)', display: 'block', marginBottom: '4px' }}>When</label>
                        <select className="sel" value={newRule.when} onChange={e => setNewRule({ ...newRule, when: e.target.value })}>
                          <option value="request">Request</option>
                          <option value="response">Response</option>
                          <option value="both">Both</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', color: 'var(--txt2)', display: 'block', marginBottom: '4px' }}>Target</label>
                        <select className="sel" value={newRule.target} onChange={e => setNewRule({ ...newRule, target: e.target.value })}>
                          <option value="url">URL</option>
                          <option value="headers">Headers</option>
                          <option value="body">Body</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', color: 'var(--txt2)', display: 'block', marginBottom: '4px' }}>Group Number</label>
                        <input className="inp" type="number" value={newRule.group} onChange={e => setNewRule({ ...newRule, group: parseInt(e.target.value) || 1 })} />
                      </div>
                    </div>
                    {newRule.target === 'headers' && (
                      <div style={{ marginBottom: '12px' }}>
                        <label style={{ fontSize: '11px', color: 'var(--txt2)', display: 'block', marginBottom: '4px' }}>Header Name</label>
                        <input className="inp" value={newRule.header} onChange={e => setNewRule({ ...newRule, header: e.target.value })} placeholder="Set-Cookie" />
                      </div>
                    )}
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ fontSize: '11px', color: 'var(--txt2)', display: 'block', marginBottom: '4px' }}>Regex Pattern</label>
                      <input className="inp" value={newRule.regex} onChange={e => setNewRule({ ...newRule, regex: e.target.value })} placeholder="session=([^;]+)" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }} />
                    </div>
                    <button className="btn btn-p" onClick={addSessionRule}>Add Rule</button>
                  </div>

                  <div style={{ marginBottom: '16px', fontSize: '13px', fontWeight: 600 }}>Active Rules ({sessionRulesData.length})</div>
                  {sessionRulesData.map(rule => (
                    <div key={rule.id} style={{ marginBottom: '12px', padding: '12px', background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: '4px', opacity: rule.enabled ? 1 : 0.5 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                        <input type="checkbox" checked={rule.enabled} onChange={e => toggleSessionRule(rule.id, e.target.checked)} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--txt1)' }}>{rule.name}</div>
                          <div style={{ fontSize: '10px', color: 'var(--txt2)', marginTop: '2px' }}>
                            Extract to variable: <code style={{ background: 'var(--bg3)', padding: '1px 4px', borderRadius: '2px' }}>{rule.variable}</code>
                          </div>
                        </div>
                        <button className="btn btn-sm btn-d" onClick={() => deleteSessionRule(rule.id)}>Delete</button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px', fontSize: '10px', color: 'var(--txt2)' }}>
                        <span>When:</span><span>{rule.when}</span>
                        <span>Target:</span><span>{rule.target}{rule.target === 'headers' && rule.header ? ' (' + rule.header + ')' : ''}</span>
                        <span>Regex:</span><code style={{ background: 'var(--bg3)', padding: '2px 4px', borderRadius: '2px', fontFamily: 'var(--font-mono)' }}>{rule.regex}</code>
                        <span>Group:</span><span>{rule.group}</span>
                      </div>
                    </div>
                  ))}
                  {sessionRulesData.length === 0 && (
                    <div className="empty" style={{ padding: '30px' }}>
                      <span>No session rules configured</span>
                    </div>
                  )}

                  <div style={{ marginTop: '24px', padding: '16px', background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: '4px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px', color: 'var(--cyan)' }}>Usage</div>
                    <div style={{ fontSize: '11px', color: 'var(--txt2)', lineHeight: '1.6' }}>
                      Session rules automatically extract values from requests/responses using regex patterns. Extracted values are stored as variables that can be used in Collections.
                      <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
                        <li>Use capturing groups in regex: <code style={{ background: 'var(--bg3)', padding: '1px 4px', borderRadius: '2px' }}>session=([^;]+)</code></li>
                        <li>Specify which group to extract (default is 1)</li>
                        <li>Target can be URL, specific header, or body content</li>
                        <li>Variables are automatically available in Collection requests as {'{{variable_name}}'}</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
  );
}
