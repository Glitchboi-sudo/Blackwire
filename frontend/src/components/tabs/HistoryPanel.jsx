// HistoryPanel — extraído de App.jsx (pestaña 'history').
// Recibe todo el estado/handlers vía props (objeto __appCtx de App.jsx).

export function HistoryPanel(props) {
  const { API, ResizeHandle, api, applyPreset, clearHist, currentPage, delPreset, delReq, detTab, escapeHtml, exportSitemap, extensions, filtered, firstPage, fmtHHtml, fmtTime, formatBody, highlightMatches, histContentRef, histPanelW, histSearch, histSubTab, httpqlError, lastPage, loadReqs, loadWsConns, loadWsFrames, nextPage, pageSize, pagination, presetName, presets, prevPage, renderTreeNode, reqFormat, requests, resendWsFrame, respFormat, savePreset, savedOnly, scopeOnly, search, selReq, selReqFull, selWsConn, selWsFrame, selectWsFrame, setDetTab, setHistPanelW, setHistSubTab, setPageSize, setPresetName, setReqFormat, setRespFormat, setSavedOnly, setScopeOnly, setSearch, setSelReq, setShowPresets, setSmExpanded, setSmFilterExt, setSmFilterMethod, setSmFilterStatus, setSmFilterText, setSmSelNode, setSmShowStats, setSmTreeW, setWsConnsW, setWsFramesW, setWsResendMsg, showContextMenu, showPresets, siteTree, smContentRef, smFilterExt, smFilterMethod, smFilterStatus, smFilterText, smNodeReqs, smSelNode, smShowStats, smStats, smTreeW, stCls, tab, toRep, togSave, totalPages, totalRequests, wsConns, wsConnsW, wsFrames, wsFramesW, wsResendMsg, wsResendResp, wsSending } = props;
  return (
          <div className="hist-wrap">
            <div className="hist-sub-tabs">
              <div className={'hist-sub-tab' + (histSubTab === 'http' ? ' act' : '')} onClick={() => setHistSubTab('http')}>HTTP</div>
              <div className={'hist-sub-tab' + (histSubTab === 'ws' ? ' act' : '')} onClick={() => { setHistSubTab('ws'); loadWsConns(); }}>WebSocket</div>
              <div className={'hist-sub-tab' + (histSubTab === 'sitemap' ? ' act' : '')} onClick={() => setHistSubTab('sitemap')}>Site Map</div>
            </div>

            {histSubTab === 'http' && (
              <div className="hist-content" ref={histContentRef}>
                <div className="panel hist-pnl" style={{ width: histPanelW + '%' }}>
                  <div className="flt-bar">
                    <div className="flt-in-wrap">
                      <input className={'flt-in' + (httpqlError ? ' flt-err' : '')} placeholder='Filter: req.method.eq:"GET" AND resp.code.lt:400' value={search} onChange={e => setSearch(e.target.value)} />
                      {httpqlError && <div className="flt-err-msg">{httpqlError}</div>}
                    </div>
                    <div className="flt-preset-wrap" style={{position:'relative'}}>
                      <div className="flt-tog" onClick={() => setShowPresets(!showPresets)} title="Filter presets">▼</div>
                      {showPresets && (
                        <div className="flt-preset-dd">
                          <div className="flt-preset-save">
                            <input className="flt-in flt-preset-name" placeholder="Preset name..." value={presetName} onChange={e => setPresetName(e.target.value)} onKeyDown={e => e.key === 'Enter' && savePreset()} />
                            <button className="btn btn-sm btn-p" onClick={savePreset} disabled={!presetName.trim() || !search.trim()}>Save</button>
                          </div>
                          {presets.length === 0 && <div className="flt-preset-empty">No presets saved</div>}
                          {presets.map(p => (
                            <div key={p.id} className="flt-preset-item">
                              <span className="flt-preset-name-label" onClick={() => applyPreset(p)} title={p.query}>{p.name}</span>
                              <span className="flt-preset-q">{p.query}</span>
                              <button className="btn btn-sm btn-d flt-preset-del" onClick={() => delPreset(p.id)}>×</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className={'flt-tog' + (scopeOnly ? ' act' : '')} onClick={() => setScopeOnly(!scopeOnly)}>Scope</div>
                    <div className={'flt-tog' + (savedOnly ? ' act' : '')} onClick={() => setSavedOnly(!savedOnly)}>★</div>
                  </div>
                  <div className="pnl-hdr">
                    <span>{totalRequests > 0 ? `${((currentPage - 1) * pageSize) + 1}-${Math.min(currentPage * pageSize, totalRequests)} of ${totalRequests}` : '0 requests'}</span>
                    <div className="acts">
                      <button className="btn btn-sm btn-s" onClick={loadReqs}>↻</button>
                      <button className="btn btn-sm btn-d" onClick={clearHist}>Clear</button>
                    </div>
                  </div>
                  {totalPages > 1 && (
                    <div className="pagination-bar">
                      <button className="btn btn-sm btn-s" onClick={firstPage} disabled={currentPage === 1} title="First page">«</button>
                      <button className="btn btn-sm btn-s" onClick={prevPage} disabled={currentPage === 1} title="Previous page">‹</button>
                      <span className="pagination-info">Page {currentPage} of {totalPages}</span>
                      <button className="btn btn-sm btn-s" onClick={nextPage} disabled={currentPage === totalPages} title="Next page">›</button>
                      <button className="btn btn-sm btn-s" onClick={lastPage} disabled={currentPage === totalPages} title="Last page">»</button>
                      <select className="pagination-size" value={pageSize} onChange={e => setPageSize(Number(e.target.value))}>
                        <option value="100">100</option>
                        <option value="250">250</option>
                        <option value="500">500</option>
                        <option value="1000">1000</option>
                      </select>
                    </div>
                  )}
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
                          <div className="empty-i">□</div>
                          <span>No requests</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <ResizeHandle onDrag={(dx) => {
                  const el = histContentRef.current;
                  if (!el) return;
                  const dpct = (dx / el.offsetWidth) * 100;
                  setHistPanelW(prev => Math.max(20, Math.min(80, prev + dpct)));
                }} />

                <div className="panel det-pnl">
                  {selReq ? (
                    <React.Fragment>
                      <div className="pnl-hdr">
                        <span title={selReq.url} style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '10px' }}>{selReq.method} {selReq.url}</span>
                        <div className="acts" style={{ flexShrink: 0 }}>
                          <button className="btn btn-sm btn-p" onClick={() => selReqFull && toRep(selReqFull)} disabled={!selReqFull}>→ Rep</button>
                          <button className={'btn btn-sm ' + (selReq.saved ? 'btn-g' : 'btn-s')} onClick={() => togSave(selReq.id)}>
                            {selReq.saved ? '★' : '☆'}
                          </button>
                          <button className="btn btn-sm btn-d" onClick={() => delReq(selReq.id)}>×</button>
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
                          {detTab === 'response' && (
                            <>
                              <button className={'btn btn-sm ' + (respFormat === 'render' ? 'btn-p' : 'btn-s')} onClick={() => setRespFormat('render')}>
                                Render
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      {!selReqFull ? (
                        <div className="empty"><div className="splash-spin" style={{margin:'20px auto'}} /></div>
                      ) : (
                      <div className="code" ref={histSearch.contentRef}>
                        {(() => {
                          const d = selReqFull;
                          if (detTab === 'response' && respFormat === 'render') {
                            return (
                              <iframe
                                src={API + '/api/requests/' + selReq.id + '/render'}
                                sandbox="allow-same-origin"
                                style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
                                title="Rendered Response"
                              />
                            );
                          }
                          const reqFormatted = d.body ? formatBody(d.body, reqFormat) : { text: '', html: false };
                          const respFormatted = formatBody(d.response_body || '', respFormat);
                          const rawContent = detTab === 'request'
                            ? (escapeHtml(d.method + ' ' + (() => {
                                try { return new URL(d.url).pathname; } catch (e) { return d.url; }
                              })()) + '\n\n' + fmtHHtml(d.headers, d.url) + (d.body ? '\n\n' + (reqFormatted.html ? reqFormatted.text : escapeHtml(reqFormatted.text)) : ''))
                            : (escapeHtml('HTTP ' + d.response_status) + '\n\n' + fmtHHtml(d.response_headers) + '\n\n' + (respFormatted.html ? respFormatted.text : escapeHtml(respFormatted.text)));
                          if (histSearch.debouncedSearchTerm) {
                            const plainText = rawContent.replace(/<[^>]*>/g, '');
                            const hl = highlightMatches(plainText, histSearch.debouncedSearchTerm, histSearch.isRegex, histSearch.matchIndex);
                            if (hl.count !== histSearch.matchCount) setTimeout(() => histSearch.setMatchCount(hl.count), 0);
                            return <div dangerouslySetInnerHTML={{ __html: hl.html }} />;
                          }
                          return <div dangerouslySetInnerHTML={{ __html: rawContent }} />;
                        })()}
                      </div>
                      )}
                      <div className="search-bar" style={{ borderTop: '1px solid var(--brd)' }}>
                        <input
                          placeholder={histSearch.isRegex ? 'Regex search...' : 'Search body...'}
                          value={histSearch.searchTerm}
                          onChange={e => { histSearch.setSearchTerm(e.target.value); histSearch.setMatchIndex(0); }}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); histSearch.nextMatch(); }
                            if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); histSearch.prevMatch(); }
                            if (e.key === 'Escape') { histSearch.close(); }
                          }}
                          style={histSearch.isSearching ? { opacity: 0.7 } : {}}
                        />
                        <button className={'srch-btn' + (histSearch.isRegex ? ' act' : '')} onClick={() => { histSearch.toggleRegex(); histSearch.setMatchIndex(0); }} title="Toggle regex">.*</button>
                        <span className="search-info">{histSearch.isSearching ? '⏳' : (histSearch.matchCount > 0 ? (histSearch.matchIndex + 1) + '/' + histSearch.matchCount : '0/0')}</span>
                        <button className="srch-btn" onClick={histSearch.prevMatch} disabled={histSearch.matchCount === 0}>▲</button>
                        <button className="srch-btn" onClick={histSearch.nextMatch} disabled={histSearch.matchCount === 0}>▼</button>
                        <button className="srch-btn" onClick={histSearch.close}>✕</button>
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
                <div className="ws-conns panel" style={{ width: wsConnsW + 'px' }}>
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
                <ResizeHandle onDrag={(dx) => setWsConnsW(w => Math.max(120, Math.min(400, w + dx)))} />
                <div className="ws-frames panel" style={{ width: wsFramesW + 'px' }}>
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
                <ResizeHandle onDrag={(dx) => setWsFramesW(w => Math.max(150, Math.min(500, w + dx)))} />
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

            {histSubTab === 'sitemap' && (
              <div className="hist-content" ref={smContentRef}>
                <div className="panel sm-tree" style={{ width: smTreeW + '%' }}>
                  <div className="pnl-hdr">
                    <span>{Object.keys(siteTree).length} hosts</span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button className="btn btn-sm btn-s" onClick={() => setSmShowStats(!smShowStats)}>
                        {smShowStats ? 'Hide' : 'Show'} Stats
                      </button>
                      <button className="btn btn-sm btn-s" onClick={() => { setSmExpanded({}); setSmSelNode(null); }}>Collapse All</button>
                    </div>
                  </div>
                  {smShowStats && (
                    <div style={{ padding: '12px', borderBottom: '1px solid var(--brd)', fontSize: '10px', color: 'var(--txt2)' }}>
                      <div style={{ marginBottom: '8px', fontWeight: 600, color: 'var(--txt1)' }}>Top Methods</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '12px' }}>
                        {Object.entries(smStats.methods).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([m, c]) => (
                          <span key={m} style={{ padding: '2px 6px', background: 'var(--bg3)', borderRadius: '2px' }}>
                            <span className={'mth-' + m} style={{ fontWeight: 600 }}>{m}</span> {c}
                          </span>
                        ))}
                      </div>
                      <div style={{ marginBottom: '8px', fontWeight: 600, color: 'var(--txt1)' }}>Status Codes</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '12px' }}>
                        {Object.entries(smStats.statuses).sort((a, b) => b[1] - a[1]).map(([s, c]) => (
                          <span key={s} style={{ padding: '2px 6px', background: 'var(--bg3)', borderRadius: '2px' }}>
                            {s}: {c}
                          </span>
                        ))}
                      </div>
                      <div style={{ marginBottom: '8px', fontWeight: 600, color: 'var(--txt1)' }}>Top Extensions</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {Object.entries(smStats.extensions).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([e, c]) => (
                          <span key={e} style={{ padding: '2px 6px', background: 'var(--bg3)', borderRadius: '2px' }}>
                            .{e}: {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="pnl-cnt">
                    {Object.keys(siteTree).length === 0 ? (
                      <div className="empty">
                        <div className="empty-i">🌐</div>
                        <span>No requests captured</span>
                      </div>
                    ) : (
                      Object.entries(siteTree)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([origin, node]) => renderTreeNode(origin, node, 0, ''))
                    )}
                  </div>
                </div>
                <ResizeHandle onDrag={(dx) => {
                  const el = smContentRef.current;
                  if (!el) return;
                  const dpct = (dx / el.offsetWidth) * 100;
                  setSmTreeW(prev => Math.max(15, Math.min(70, prev + dpct)));
                }} />
                <div className="sm-right">
                  <div className="panel" style={{ flex: smSelNode && selReq ? 1 : 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <div className="pnl-hdr">
                      <span>{smSelNode ? smNodeReqs.length + ' requests' : 'Select a node'}</span>
                      {smSelNode && (
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button className="btn btn-sm btn-s" onClick={() => exportSitemap('json')} title="Export as JSON">JSON</button>
                          <button className="btn btn-sm btn-s" onClick={() => exportSitemap('csv')} title="Export as CSV">CSV</button>
                        </div>
                      )}
                    </div>
                    {smSelNode && (
                      <div style={{ padding: '8px', borderBottom: '1px solid var(--brd)', display: 'grid', gridTemplateColumns: 'auto auto auto 1fr', gap: '6px', alignItems: 'center' }}>
                        <select className="sel" value={smFilterMethod} onChange={e => setSmFilterMethod(e.target.value)} style={{ fontSize: '10px', padding: '4px 6px' }}>
                          <option value="">All Methods</option>
                          <option value="GET">GET</option>
                          <option value="POST">POST</option>
                          <option value="PUT">PUT</option>
                          <option value="DELETE">DELETE</option>
                          <option value="PATCH">PATCH</option>
                          <option value="OPTIONS">OPTIONS</option>
                          <option value="HEAD">HEAD</option>
                        </select>
                        <select className="sel" value={smFilterStatus} onChange={e => setSmFilterStatus(e.target.value)} style={{ fontSize: '10px', padding: '4px 6px' }}>
                          <option value="">All Status</option>
                          <option value="2">2xx</option>
                          <option value="3">3xx</option>
                          <option value="4">4xx</option>
                          <option value="5">5xx</option>
                        </select>
                        <input className="inp" placeholder="Extension" value={smFilterExt} onChange={e => setSmFilterExt(e.target.value)} style={{ fontSize: '10px', padding: '4px 6px', width: '80px' }} />
                        <input className="inp" placeholder="Search URL..." value={smFilterText} onChange={e => setSmFilterText(e.target.value)} style={{ fontSize: '10px', padding: '4px 6px' }} />
                      </div>
                    )}
                    <div className="pnl-cnt">
                      {smSelNode ? (
                        <div className="req-list">
                          {smNodeReqs.map(r => (
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
                        </div>
                      ) : (
                        <div className="empty"><span>Click a node in the tree</span></div>
                      )}
                    </div>
                  </div>
                  {selReq && smSelNode && (
                    <div className="panel" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--brd)' }}>
                      <div className="pnl-hdr">
                        <span>{selReq.method} {selReq.url.substring(0, 60)}</span>
                        <div className="acts">
                          <button className="btn btn-sm btn-p" onClick={() => selReqFull && toRep(selReqFull)} disabled={!selReqFull}>→ Rep</button>
                        </div>
                      </div>
                      <div className="det-tabs">
                        <div className={'det-tab' + (detTab === 'request' ? ' act' : '')} onClick={() => setDetTab('request')}>Request</div>
                        <div className={'det-tab' + (detTab === 'response' ? ' act' : '')} onClick={() => setDetTab('response')}>Response</div>
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <button className={'btn btn-sm ' + (detTab === 'request' ? (reqFormat === 'raw' ? 'btn-p' : 'btn-s') : (respFormat === 'raw' ? 'btn-p' : 'btn-s'))} onClick={() => detTab === 'request' ? setReqFormat('raw') : setRespFormat('raw')}>Raw</button>
                          <button className={'btn btn-sm ' + (detTab === 'request' ? (reqFormat === 'pretty' ? 'btn-p' : 'btn-s') : (respFormat === 'pretty' ? 'btn-p' : 'btn-s'))} onClick={() => detTab === 'request' ? setReqFormat('pretty') : setRespFormat('pretty')}>Pretty</button>
                          {detTab === 'response' && (
                            <>
                              <button className={'btn btn-sm ' + (respFormat === 'render' ? 'btn-p' : 'btn-s')} onClick={() => setRespFormat('render')}>
                                Render
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      {!selReqFull ? (
                        <div className="empty"><div className="splash-spin" style={{margin:'20px auto'}} /></div>
                      ) : (
                      <div className="code">
                        {(() => {
                          const d = selReqFull;
                          if (detTab === 'response' && respFormat === 'render') {
                            return (
                              <iframe
                                src={API + '/api/requests/' + selReq.id + '/render'}
                                sandbox="allow-same-origin"
                                style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
                                title="Rendered Response"
                              />
                            );
                          }
                          const reqF = d.body ? formatBody(d.body, reqFormat) : { text: '', html: false };
                          const resF = formatBody(d.response_body || '', respFormat);
                          const ct = detTab === 'request'
                            ? (escapeHtml(d.method + ' ' + (() => { try { return new URL(d.url).pathname; } catch (e) { return d.url; } })()) + '\n\n' + fmtHHtml(d.headers, d.url) + (d.body ? '\n\n' + (reqF.html ? reqF.text : escapeHtml(reqF.text)) : ''))
                            : (escapeHtml('HTTP ' + d.response_status) + '\n\n' + fmtHHtml(d.response_headers) + '\n\n' + (resF.html ? resF.text : escapeHtml(resF.text)));
                          return <div dangerouslySetInnerHTML={{ __html: ct }} />;
                        })()}
                      </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
  );
}
