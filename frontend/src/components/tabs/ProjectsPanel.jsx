// ProjectsPanel — extraído de App.jsx (pestaña 'projects').
// Recibe todo el estado/handlers vía props (objeto __appCtx de App.jsx).

export function ProjectsPanel(props) {
  const { collections, createPrj, delPrj, exportProject, exportProjectBurp, importAsNewProject, importBurpXML, importProject, newDesc, newName, prjs, projects, repeater, requests, scope, selectPrj, setNewDesc, setNewName, setShowNew, showNew } = props;
  return (
          <div className="prj-pnl">
            <div className="prj-hdr">
              <h2>Projects</h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-p" onClick={() => setShowNew(true)}>+ New</button>
                <button className="btn btn-s" onClick={importAsNewProject} title="Create new project from Blackwire export file">↓ Create from File</button>
              </div>
            </div>
            {showNew && (
              <div className="new-prj">
                <input className="inp" placeholder="Project name" value={newName} onChange={e => setNewName(e.target.value)} />
                <input className="inp" placeholder="Description" value={newDesc} onChange={e => setNewDesc(e.target.value)} />
                <div className="form-acts">
                  <button className="btn btn-p" onClick={createPrj}>Create</button>
                  <button className="btn btn-s" onClick={() => setShowNew(false)}>Cancel</button>
                </div>
              </div>
            )}
            <div className="prj-list">
              {prjs.map(p => (
                <div key={p.name} className={'prj-card' + (p.is_current ? ' cur' : '')} onClick={() => selectPrj(p.name)}>
                  <div>
                    <div className="prj-name">
                      {p.name}
                      {p.is_current && <span className="cur-badge">ACTIVE</span>}
                    </div>
                    <div className="prj-desc">{p.description || 'No description'}</div>
                    <div className="prj-date">{p.created_at ? new Date(p.created_at).toLocaleDateString() : ''}</div>
                  </div>
                  <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <button
                        className="btn btn-sm btn-s"
                        onClick={(e) => {
                          e.stopPropagation();
                          const menu = e.currentTarget.nextElementSibling;
                          menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
                        }}
                        title="Export project data to file"
                      >
                        ↑ ▼
                      </button>
                      <div
                        style={{
                          display: 'none',
                          position: 'absolute',
                          right: 0,
                          background: 'var(--bg2)',
                          border: '1px solid var(--brd)',
                          borderRadius: '4px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                          zIndex: 1000,
                          minWidth: '240px',
                          marginTop: '4px'
                        }}
                        onClick={(e) => { e.stopPropagation(); e.currentTarget.style.display = 'none'; }}
                      >
                        <div
                          style={{
                            padding: '8px 12px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            borderBottom: '1px solid var(--brd)',
                            color: 'var(--txt)'
                          }}
                          onClick={(e) => { e.stopPropagation(); exportProject(p.name); }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg3)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          title="Export complete project (requests, repeater, collections, rules, scope)"
                        >
                          <div style={{ fontWeight: 600 }}>↑ Complete Project (JSON)</div>
                          <div style={{ fontSize: '10px', color: 'var(--txt3)', marginTop: '2px' }}>All data: requests, repeater, collections, scope</div>
                        </div>
                        <div
                          style={{
                            padding: '8px 12px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            color: 'var(--txt)'
                          }}
                          onClick={(e) => { e.stopPropagation(); exportProjectBurp(p.name); }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg3)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          title="Export only HTTP history for Burp Suite Pro"
                        >
                          <div style={{ fontWeight: 600 }}>↑ Burp Suite Format (XML)</div>
                          <div style={{ fontSize: '10px', color: 'var(--txt3)', marginTop: '2px' }}>Only HTTP history, compatible with Burp</div>
                        </div>
                      </div>
                    </div>
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <button
                        className="btn btn-sm btn-s"
                        onClick={(e) => {
                          e.stopPropagation();
                          const menu = e.currentTarget.nextElementSibling;
                          menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
                        }}
                        title="Import data into this project"
                      >
                        ↓ ▼
                      </button>
                      <div
                        style={{
                          display: 'none',
                          position: 'absolute',
                          right: 0,
                          background: 'var(--bg2)',
                          border: '1px solid var(--brd)',
                          borderRadius: '4px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                          zIndex: 1000,
                          minWidth: '240px',
                          marginTop: '4px'
                        }}
                        onClick={(e) => { e.stopPropagation(); e.currentTarget.style.display = 'none'; }}
                      >
                        <div
                          style={{
                            padding: '8px 12px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            borderBottom: '1px solid var(--brd)',
                            color: 'var(--txt)'
                          }}
                          onClick={(e) => { e.stopPropagation(); importProject(p.name, false); }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg3)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          title="Add data from file to existing project data"
                        >
                          <div style={{ fontWeight: 600 }}>↓ Merge (Keep Existing)</div>
                          <div style={{ fontSize: '10px', color: 'var(--txt3)', marginTop: '2px' }}>Combine file data with current data</div>
                        </div>
                        <div
                          style={{
                            padding: '8px 12px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            borderBottom: '1px solid var(--brd)',
                            color: 'var(--red)'
                          }}
                          onClick={(e) => { e.stopPropagation(); importProject(p.name, true); }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg3)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          title="Delete all current data and replace with file data"
                        >
                          <div style={{ fontWeight: 600 }}>🔄 Replace (Delete All)</div>
                          <div style={{ fontSize: '10px', color: 'var(--txt3)', marginTop: '2px' }}>Clear project and import file data</div>
                        </div>
                        <div
                          style={{
                            padding: '8px 12px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            color: 'var(--txt)'
                          }}
                          onClick={(e) => { e.stopPropagation(); importBurpXML(p.name); }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg3)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          title="Import HTTP history from Burp Suite XML export"
                        >
                          <div style={{ fontWeight: 600 }}>↓ From Burp Suite (XML)</div>
                          <div style={{ fontSize: '10px', color: 'var(--txt3)', marginTop: '2px' }}>Import HTTP history from Burp export</div>
                        </div>
                      </div>
                    </div>
                    <button className="btn btn-sm btn-d" onClick={() => delPrj(p.name)}>×</button>
                  </div>
                </div>
              ))}
              {prjs.length === 0 && (
                <div className="empty">
                  <div className="empty-i"></div>
                  <span>No projects</span>
                </div>
              )}
            </div>
          </div>
  );
}
