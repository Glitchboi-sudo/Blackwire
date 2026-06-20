// ConsolePanel — pestaña 'console' (logs del proxy en vivo).
export function ConsolePanel(props) {
  const { proxyConsole, consoleEndRef } = props;
          const levelColor = { DEBUG: 'var(--txt3)', INFO: 'var(--cyan)', WARNING: 'var(--orange)', ERROR: 'var(--red)', CRITICAL: 'var(--red)' };
          const levelBg   = { DEBUG: 'transparent', INFO: 'transparent', WARNING: 'rgba(255,165,0,0.06)', ERROR: 'rgba(220,50,50,0.08)', CRITICAL: 'rgba(220,50,50,0.12)' };
          return (
            <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', overflow: 'hidden' }}>
              {/* Toolbar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderBottom: '1px solid var(--brd)', flexShrink: 0, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', color: proxyConsole.connected ? 'var(--green)' : 'var(--txt3)', display: 'flex', alignItems: 'center', gap: '5px', minWidth: '80px' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: proxyConsole.connected ? 'var(--green)' : 'var(--txt3)', display: 'inline-block' }} />
                  {proxyConsole.connected ? 'Live' : 'Disconnected'}
                </span>
                <input
                  className="inp"
                  style={{ flex: 1, minWidth: '160px', fontSize: '11px', padding: '4px 8px' }}
                  placeholder="Filter messages..."
                  value={proxyConsole.filter}
                  onChange={e => proxyConsole.setFilter(e.target.value)}
                />
                <select
                  className="sel"
                  style={{ fontSize: '11px', padding: '4px 6px' }}
                  value={proxyConsole.levelFilter}
                  onChange={e => proxyConsole.setLevelFilter(e.target.value)}
                >
                  <option value="ALL">All levels</option>
                  <option value="DEBUG">DEBUG</option>
                  <option value="INFO">INFO</option>
                  <option value="WARNING">WARNING</option>
                  <option value="ERROR">ERROR</option>
                  <option value="CRITICAL">CRITICAL</option>
                </select>
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--txt2)', cursor: 'pointer', userSelect: 'none' }}>
                  <input type="checkbox" checked={proxyConsole.autoScroll} onChange={e => proxyConsole.setAutoScroll(e.target.checked)} />
                  Auto-scroll
                </label>
                <button className="btn btn-sm btn-s" onClick={proxyConsole.clearLogs}>Clear</button>
                <span style={{ fontSize: '10px', color: 'var(--txt3)' }}>{proxyConsole.filteredLogs.length} entries</span>
              </div>
              {/* Log area */}
              <div style={{ flex: 1, overflowY: 'auto', fontFamily: 'var(--font-mono)', fontSize: '11px', padding: '4px 0' }}>
                {proxyConsole.filteredLogs.length === 0 ? (
                  <div className="empty">
                    <div className="empty-i">&#9654;</div>
                    <span>{proxyConsole.logs.length === 0 ? 'No proxy logs yet. Start the proxy to see output here.' : 'No entries match the current filter.'}</span>
                  </div>
                ) : (
                  proxyConsole.filteredLogs.map((entry, i) => (
                    <div key={i} style={{ display: 'flex', gap: '8px', padding: '2px 12px', borderBottom: '1px solid var(--brd)', background: levelBg[entry.level] || 'transparent', lineHeight: '1.5' }}>
                      <span style={{ color: 'var(--txt3)', flexShrink: 0, minWidth: '82px' }}>
                        {entry.ts ? entry.ts.replace('T', ' ').replace(/\.\d+Z$/, 'Z') : ''}
                      </span>
                      <span style={{ color: levelColor[entry.level] || 'var(--txt)', fontWeight: '600', flexShrink: 0, minWidth: '50px' }}>
                        {entry.level}
                      </span>
                      <span style={{ color: 'var(--txt3)', flexShrink: 0, minWidth: '90px', maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={entry.name}>
                        {entry.name}
                      </span>
                      <span style={{ color: 'var(--txt)', wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>{entry.msg}</span>
                    </div>
                  ))
                )}
                <div ref={consoleEndRef} />
              </div>
            </div>
          );
}
