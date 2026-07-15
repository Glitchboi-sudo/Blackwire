// ComparePanel — extraído de App.jsx (pestaña 'compare').
// Recibe todo el estado/handlers vía props (objeto __appCtx de App.jsx).

const { useRef } = React;

export function ComparePanel(props) {
  const { ResizeHandle, cmpA, cmpB, cmpDiff, cmpSplitPct, cmpView, colorizeHeaders, setCmpA, setCmpB, setCmpSplitPct, setCmpView, tab } = props;
  const wrapRef = useRef(null);
  return (
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
            <div className="det-tabs" style={{ justifyContent: 'flex-start', gap: 0 }}>
              <div className={'det-tab' + (cmpView === 'request' ? ' act' : '')} onClick={() => setCmpView('request')}>Request</div>
              <div className={'det-tab' + (cmpView === 'response' ? ' act' : '')} onClick={() => setCmpView('response')}>Response</div>
              <div style={{ flex: 1 }} />
              <button className="btn btn-sm btn-s" style={{ margin: '4px 10px' }} onClick={() => { setCmpA(null); setCmpB(null); }}>Clear All</button>
            </div>
            {!cmpA && !cmpB ? (
              <div className="empty">
                <div className="empty-i">&#8596;</div>
                <span>Right-click a request and choose "Send to Compare (A/B)"</span>
              </div>
            ) : (
              <div className="cmp-wrap" ref={wrapRef}>
                <div className="cmp-side" style={{ flex: 'none', width: cmpSplitPct + '%' }}>
                  <div className="pnl-hdr">
                    <span style={{ fontWeight: 600, color: 'var(--red)' }}>A {cmpA ? <span style={{ fontWeight: 400, color: 'var(--txt2)' }}>{cmpA.method} {cmpA.url}</span> : '(empty)'}</span>
                    <button className="btn btn-sm btn-s" onClick={() => setCmpA(null)}>Clear</button>
                  </div>
                  <div className="cmp-body">
                    {cmpDiff.map((d, i) => {
                      const txt = d.type === 'added' ? null : (d.lineA ?? '');
                      return <div key={i} className={'cmp-line ' + (d.type === 'equal' ? 'cmp-eq' : d.type === 'removed' ? 'cmp-rem' : 'cmp-blank')}
                        dangerouslySetInnerHTML={{ __html: txt == null ? '\u00A0' : colorizeHeaders(txt) }} />;
                    })}
                  </div>
                </div>
                <ResizeHandle onDrag={(dx) => {
                  const el = wrapRef.current;
                  if (!el) return;
                  const dpct = (dx / el.offsetWidth) * 100;
                  setCmpSplitPct(prev => Math.max(20, Math.min(80, prev + dpct)));
                }} />
                <div className="cmp-side">
                  <div className="pnl-hdr">
                    <span style={{ fontWeight: 600, color: 'var(--green)' }}>B {cmpB ? <span style={{ fontWeight: 400, color: 'var(--txt2)' }}>{cmpB.method} {cmpB.url}</span> : '(empty)'}</span>
                    <button className="btn btn-sm btn-s" onClick={() => setCmpB(null)}>Clear</button>
                  </div>
                  <div className="cmp-body">
                    {cmpDiff.map((d, i) => {
                      const txt = d.type === 'removed' ? null : (d.lineB ?? '');
                      return <div key={i} className={'cmp-line ' + (d.type === 'equal' ? 'cmp-eq' : d.type === 'added' ? 'cmp-add' : 'cmp-blank')}
                        dangerouslySetInnerHTML={{ __html: txt == null ? '\u00A0' : colorizeHeaders(txt) }} />;
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
  );
}
