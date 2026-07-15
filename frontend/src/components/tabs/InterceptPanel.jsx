// InterceptPanel — extraído de App.jsx (pestaña 'intercept').
// Recibe todo el estado/handlers vía props (objeto __appCtx de App.jsx).

export function InterceptPanel(props) {
  const { ResizeHandle, colorizeHeaders, dropAll, dropReq, editReq, fmtH, fmtTime, fwdAll, fwdReq, intOn, intPendW, intercept, interceptHeadersHighlightRef, interceptHeadersRef, pending, pxPort, requests, search, selPend, setEditReq, setIntPendW, setSelPend, showContextMenu } = props;
  return (
          <div className="icept-pnl">
            {/* Control bar */}
            <div className="icept-bar">
              <button className={'icept-toggle ' + (intOn ? 'on' : 'off')} onClick={() => intercept.toggle()} title={intOn ? 'Disable intercept' : 'Enable intercept'}>
                <span className="icept-dot" style={{ background: intOn ? '#ef4444' : 'var(--txt3)' }} />
                {intOn ? 'Intercept ON' : 'Intercept OFF'}
              </button>
              <div className="icept-sep" />
              <button className="btn btn-g btn-sm" disabled={!selPend} onClick={() => selPend && fwdReq(selPend.id, editReq)} title="Forward selected request">▶ Forward</button>
              <button className="btn btn-d btn-sm" disabled={!selPend} onClick={() => selPend && dropReq(selPend.id)} title="Drop selected request">✕ Drop</button>
              {pending.length > 0 && (
                <>
                  <div className="icept-sep" />
                  <button className="btn btn-s btn-sm" onClick={fwdAll} title="Forward all pending">▶▶ Fwd All ({pending.length})</button>
                  <button className="btn btn-s btn-sm" onClick={dropAll} title="Drop all pending">✕ Drop All</button>
                </>
              )}
              <div style={{ flex: 1 }} />
              {intOn && pending.length > 0 && (
                <span style={{ fontSize: 10, color: 'var(--orange)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                  {pending.length} request{pending.length !== 1 ? 's' : ''} queued
                </span>
              )}
            </div>

            {/* Body: queue + editor */}
            <div className="icept-body">
              {/* Queue */}
              <div className="icept-queue" style={{ width: intPendW + 'px' }}>
                <div className="pnl-hdr">
                  <span>Queue</span>
                  {pending.length > 0 && (
                    <span style={{ background: 'var(--orange)', color: '#000', padding: '1px 7px', borderRadius: 10, fontSize: 9, fontWeight: 700, marginLeft: 6 }}>{pending.length}</span>
                  )}
                </div>
                <div className="icept-queue-list">
                  {pending.map(r => {
                    let host = r.url, path = '';
                    try { const u = new URL(r.url); host = u.host; path = u.pathname + (u.search || ''); } catch (e) {}
                    return (
                      <div key={r.id}
                        className={'icept-item' + (selPend?.id === r.id ? ' sel' : '')}
                        onClick={() => { setSelPend(r); setEditReq({ ...r, rawHeaders: fmtH(r.headers, r.url) }); }}
                        onContextMenu={e => showContextMenu(e, r, 'intercept')}
                      >
                        <span className={'mth mth-' + r.method}>{r.method}</span>
                        <div className="icept-item-info">
                          <span className="icept-item-host">{host}</span>
                          {path && path !== '/' && <span className="icept-item-path">{path}</span>}
                        </div>
                        <span className="icept-item-ts">{fmtTime(r.timestamp)}</span>
                      </div>
                    );
                  })}
                  {pending.length === 0 && (
                    <div className="icept-empty" style={{ padding: '40px 16px' }}>
                      <span style={{ fontSize: 28 }}>{intOn ? '⏳' : '🔓'}</span>
                      <span style={{ fontSize: 11, textAlign: 'center', lineHeight: 1.5 }}>
                        {intOn ? 'Esperando tráfico… navega para que las peticiones se pausen aquí y puedas editarlas antes de reenviarlas.' : 'Activa la interceptación para pausar y editar cada petición antes de que salga.'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <ResizeHandle onDrag={(dx) => setIntPendW(w => Math.max(160, Math.min(500, w + dx)))} />

              {/* Editor */}
              <div className="icept-edit">
                {selPend && editReq ? (
                  <>
                    <div className="ed-row" onContextMenu={e => showContextMenu(e, editReq, 'intercept')}>
                      <select className="mth-sel" value={editReq.method} onChange={e => setEditReq({ ...editReq, method: e.target.value })}>
                        {['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS','TRACE'].map(m => <option key={m}>{m}</option>)}
                      </select>
                      <input className="url-in" value={editReq.url} onChange={e => setEditReq({ ...editReq, url: e.target.value })} spellCheck="false" />
                    </div>
                    <div className="icept-section">Headers</div>
                    <div className="hdr-wrap" style={{ height: '38%', flexShrink: 0 }}>
                      <pre ref={interceptHeadersHighlightRef} className="hdr-highlight ed-ta" aria-hidden="true" style={{ pointerEvents: 'none' }}
                        dangerouslySetInnerHTML={{ __html: colorizeHeaders(editReq.rawHeaders || '') + '\n' }} />
                      <textarea ref={interceptHeadersRef} className="ed-ta hdr-ta"
                        value={editReq.rawHeaders || ''}
                        onChange={e => {
                          const raw = e.target.value;
                          const h = {};
                          raw.split('\n').forEach(l => { const ci = l.indexOf(':'); if (ci > 0) h[l.slice(0, ci).trim()] = l.slice(ci + 1).trim(); });
                          setEditReq({ ...editReq, rawHeaders: raw, headers: h });
                        }}
                        onScroll={e => { if (interceptHeadersHighlightRef.current) interceptHeadersHighlightRef.current.scrollTop = e.target.scrollTop; }}
                        spellCheck="false"
                      />
                    </div>
                    <div className="icept-section">Body</div>
                    <textarea className="ed-ta" style={{ flex: 1 }}
                      value={editReq.body || ''}
                      onChange={e => setEditReq({ ...editReq, body: e.target.value })}
                      placeholder="(empty body)"
                      spellCheck="false"
                    />
                  </>
                ) : (
                  <div className="icept-empty">
                    <span style={{ fontSize: 36 }}>{intOn ? '🔒' : '🔓'}</span>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt2)', marginBottom: 6 }}>
                        {intOn ? (pending.length > 0 ? 'Select a request from the queue' : 'Waiting for traffic...') : 'Interceptor is OFF'}
                      </div>
                      <div style={{ fontSize: 11 }}>
                        {!intOn ? 'Click "Intercept OFF" to start capturing' : pending.length === 0 ? `Proxy running on port ${pxPort}` : ''}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
  );
}
