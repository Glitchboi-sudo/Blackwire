// ProjectsPanel — extraído de App.jsx (pestaña 'projects').
// Recibe todo el estado/handlers vía props (objeto __appCtx de App.jsx).

const { useState, useEffect, useRef } = React;

export function ProjectsPanel(props) {
  const { collections, createPrj, delPrj, exportProject, exportProjectBurp, importAsNewProject, importBurpXML, importProject, newDesc, newName, prjs, projects, repeater, requests, scope, selectPrj, setNewDesc, setNewName, setShowNew, showNew } = props;

  // Un solo menú abierto a la vez, identificado por `${nombre}:${tipo}`.
  // Abrir uno cierra automáticamente cualquier otro.
  const [openMenu, setOpenMenu] = useState(null);
  const listRef = useRef(null);

  const toggleMenu = (key) => setOpenMenu(prev => (prev === key ? null : key));
  const closeMenu = () => setOpenMenu(null);

  // Cerrar el menú al hacer click fuera de la lista de proyectos.
  useEffect(() => {
    if (!openMenu) return undefined;
    const handleClickOutside = (e) => {
      if (listRef.current && !listRef.current.contains(e.target)) closeMenu();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenu]);

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
            <div className="prj-list" ref={listRef}>
              {prjs.map(p => {
                const exportKey = p.name + ':export';
                const importKey = p.name + ':import';
                return (
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
                    <div className="prj-menu-wrap">
                      <button
                        className="btn btn-sm btn-s"
                        onClick={(e) => { e.stopPropagation(); toggleMenu(exportKey); }}
                        title="Export project data to file"
                      >
                        ↑ ▼
                      </button>
                      {openMenu === exportKey && (
                        <div className="prj-menu" onClick={(e) => e.stopPropagation()}>
                          <div
                            className="prj-menu-item"
                            onClick={() => { closeMenu(); exportProject(p.name); }}
                            title="Export complete project (requests, repeater, collections, rules, scope)"
                          >
                            <div style={{ fontWeight: 600 }}>↑ Complete Project (JSON)</div>
                            <div className="prj-menu-sub">All data: requests, repeater, collections, scope</div>
                          </div>
                          <div
                            className="prj-menu-item"
                            onClick={() => { closeMenu(); exportProjectBurp(p.name); }}
                            title="Export only HTTP history for Burp Suite Pro"
                          >
                            <div style={{ fontWeight: 600 }}>↑ Burp Suite Format (XML)</div>
                            <div className="prj-menu-sub">Only HTTP history, compatible with Burp</div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="prj-menu-wrap">
                      <button
                        className="btn btn-sm btn-s"
                        onClick={(e) => { e.stopPropagation(); toggleMenu(importKey); }}
                        title="Import data into this project"
                      >
                        ↓ ▼
                      </button>
                      {openMenu === importKey && (
                        <div className="prj-menu" onClick={(e) => e.stopPropagation()}>
                          <div
                            className="prj-menu-item"
                            onClick={() => { closeMenu(); importProject(p.name, false); }}
                            title="Add data from file to existing project data"
                          >
                            <div style={{ fontWeight: 600 }}>↓ Merge (Keep Existing)</div>
                            <div className="prj-menu-sub">Combine file data with current data</div>
                          </div>
                          <div
                            className="prj-menu-item"
                            onClick={() => { closeMenu(); importProject(p.name, true); }}
                            title="Delete all current data and replace with file data"
                          >
                            <div style={{ fontWeight: 600, color: 'var(--red)' }}>🔄 Replace (Delete All)</div>
                            <div className="prj-menu-sub">Clear project and import file data</div>
                          </div>
                          <div
                            className="prj-menu-item"
                            onClick={() => { closeMenu(); importBurpXML(p.name); }}
                            title="Import HTTP history from Burp Suite XML export"
                          >
                            <div style={{ fontWeight: 600 }}>↓ From Burp Suite (XML)</div>
                            <div className="prj-menu-sub">Import HTTP history from Burp export</div>
                          </div>
                        </div>
                      )}
                    </div>
                    <button className="btn btn-sm btn-d" onClick={() => delPrj(p.name)}>×</button>
                  </div>
                </div>
                );
              })}
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
