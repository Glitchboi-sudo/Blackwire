// RepeaterPanel — extraído de App.jsx (pestaña 'repeater').
// Recibe todo el estado/handlers vía props (objeto __appCtx de App.jsx).

export function RepeaterPanel(props) {
  const { ResizeHandle, colorizeBody, colorizeHeaders, delRepItem, fmtHHtml, followRedirect, handleRepBodyInput, highlightMatches, hookToast, loadRepItem, loading, minify, minifyRepBody, navigateHistory, prettyPrint, prettyRepBody, renameRepItem, repB, repBodyColor, repBodyEditRef, repCntRef, repFollowRedirects, repH, repHeadersHighlightRef, repHeadersRef, repHistory, repHistoryIndex, repM, repReqs, repResp, repRespBody, repRespFormat, repSearch, repSideW, repSplitPct, repU, repeater, saveRep, search, selRep, sendRep, setRepB, setRepBodyColor, setRepFollowRedirects, setRepH, setRepM, setRepRespBody, setRepRespFormat, setRepSideW, setRepU, showContextMenu, stCls } = props;
  return (
          <div className="rep-cnt" ref={repCntRef}>
            <div className="rep-side" style={{ width: repSideW + 'px' }}>
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
            <ResizeHandle onDrag={(dx) => setRepSideW(w => Math.max(100, Math.min(400, w + dx)))} />
            <div className="rep-main">
              <div className="req-bar">
                <button className="btn btn-s" onClick={() => navigateHistory(-1)} disabled={repHistoryIndex <= 0} title="Previous">◀</button>
                <button className="btn btn-s" onClick={() => navigateHistory(1)} disabled={repHistoryIndex >= repHistory.length - 1} title="Next">▶</button>
                <input className="mth-sel" list="rep-methods" value={repM}
                  onChange={e => setRepM(e.target.value.toUpperCase())}
                  title="Método HTTP (editable: admite métodos personalizados)" />
                <datalist id="rep-methods">
                  <option value="GET" /><option value="HEAD" /><option value="POST" />
                  <option value="PUT" /><option value="PATCH" /><option value="DELETE" />
                  <option value="CONNECT" /><option value="OPTIONS" /><option value="TRACE" />
                </datalist>
                <input className="url-in" placeholder="https://..." value={repU} onChange={e => setRepU(e.target.value)} />
                <button className="btn btn-p" onClick={sendRep} disabled={loading || !repU}>{loading ? '...' : '▶ Send'}</button>
                <select className="sel" value={repFollowRedirects ? 'follow' : 'manual'} onChange={e => setRepFollowRedirects(e.target.value === 'follow')}
                  style={{ fontSize: '10px', padding: '4px 6px', minWidth: '105px' }} title="Redirect mode">
                  <option value="manual">No Redirect</option>
                  <option value="follow">Auto Follow</option>
                </select>
              </div>
              <div className="rep-edit" style={{ gridTemplateColumns: repSplitPct + '% 1fr' }}>
                <div className="ed-pane">
                  <div className="ed-hdr">
                    <span>Headers</span>
                  </div>
                  <div className="hdr-wrap" style={{ height: '40%' }}>
                    <pre ref={repHeadersHighlightRef} className="hdr-highlight ed-ta" aria-hidden="true" style={{ pointerEvents: 'none' }} dangerouslySetInnerHTML={{ __html: (repH ? colorizeHeaders(repH) : '') + '\n' }} />
                    <textarea ref={repHeadersRef} className="ed-ta hdr-ta" value={repH} onChange={e => setRepH(e.target.value)}
                      onScroll={e => { if (repHeadersHighlightRef.current) repHeadersHighlightRef.current.scrollTop = e.target.scrollTop; }}
                      spellCheck="false" />
                  </div>
                  <div className="ed-hdr">
                    <span>Body</span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button className="btn btn-sm btn-s" onClick={prettyRepBody} title="Pretty Print">Pretty</button>
                      <button className="btn btn-sm btn-s" onClick={minifyRepBody} title="Minify">Minify</button>
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
                          <button className={'btn btn-sm ' + (repRespFormat === 'code' ? 'btn-p' : 'btn-s')} onClick={() => setRepRespFormat('code')}>Raw</button>
                          <button className="btn btn-sm btn-s" onClick={() => { setRepRespBody(prettyPrint(repRespBody)); }} title="Pretty Print">Pretty</button>
                          <button className={'btn btn-sm ' + (repRespFormat === 'render' ? 'btn-p' : 'btn-s')} onClick={() => setRepRespFormat('render')}>Render</button>
                        </div>
                      )}
                    </div>
                  </div>
                  {repResp && repResp.error ? (
                    <div className="code">{repResp.error}</div>
                  ) : repResp ? (
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}
                         onContextMenu={e => showContextMenu(e, { method: repM, url: repU, headers: repH, body: repRespBody, response_body: repRespBody, response_headers: repResp.headers, response_status: repResp.status_code }, 'repeater-response')}>
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
                      <div className="code" style={{ height: '100px', minHeight: '60px', overflow: 'auto', flexShrink: 0, borderBottom: '1px solid var(--brd)' }} dangerouslySetInnerHTML={{ __html: fmtHHtml(repResp.headers) }} />
                      {(() => {
                        if (repRespFormat === 'render') {
                          const blob = new Blob([repRespBody], { type: 'text/html' });
                          const blobUrl = URL.createObjectURL(blob);
                          return (
                            <iframe
                              src={blobUrl}
                              sandbox="allow-same-origin"
                              style={{ flex: 1, width: '100%', border: 'none', background: '#fff' }}
                              title="Rendered Response"
                              onLoad={() => URL.revokeObjectURL(blobUrl)}
                            />
                          );
                        }
                        if (repSearch.debouncedSearchTerm) {
                          const hl = highlightMatches(repRespBody, repSearch.debouncedSearchTerm, repSearch.isRegex, repSearch.matchIndex);
                          if (hl.count !== repSearch.matchCount) setTimeout(() => repSearch.setMatchCount(hl.count), 0);
                          return <div className="code" ref={repSearch.contentRef} style={{ flex: 1, overflow: 'auto' }} dangerouslySetInnerHTML={{ __html: hl.html }} />;
                        }
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
                      <div className="search-bar" style={{ borderTop: '1px solid var(--brd)' }}>
                        <input
                          placeholder={repSearch.isRegex ? 'Regex search...' : 'Search body...'}
                          value={repSearch.searchTerm}
                          onChange={e => { repSearch.setSearchTerm(e.target.value); repSearch.setMatchIndex(0); }}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); repSearch.nextMatch(); }
                            if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); repSearch.prevMatch(); }
                            if (e.key === 'Escape') { repSearch.close(); }
                          }}
                          style={repSearch.isSearching ? { opacity: 0.7 } : {}}
                        />
                        <button className={'srch-btn' + (repSearch.isRegex ? ' act' : '')} onClick={() => { repSearch.toggleRegex(); repSearch.setMatchIndex(0); }} title="Toggle regex">.*</button>
                        <span className="search-info">{repSearch.isSearching ? '⏳' : (repSearch.matchCount > 0 ? (repSearch.matchIndex + 1) + '/' + repSearch.matchCount : '0/0')}</span>
                        <button className="srch-btn" onClick={repSearch.prevMatch} disabled={repSearch.matchCount === 0}>▲</button>
                        <button className="srch-btn" onClick={repSearch.nextMatch} disabled={repSearch.matchCount === 0}>▼</button>
                        <button className="srch-btn" onClick={repSearch.close}>✕</button>
                      </div>
                    </div>
                  ) : (
                    <div className="code">Send a request</div>
                  )}
                </div>
              </div>
            </div>
          </div>
  );
}
