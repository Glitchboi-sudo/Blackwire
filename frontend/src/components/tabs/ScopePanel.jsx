// ScopePanel — extraído de App.jsx (pestaña 'scope').
// Recibe todo el estado/handlers vía props (objeto __appCtx de App.jsx).

export function ScopePanel(props) {
  const { addRule, newPat, newType, scope, scopeRules, setNewPat, setNewType } = props;
  return (
          <div className="scp-pnl">
            <div className="scp-hdr">
              <h3>Scope Rules</h3>
              <p>Define which hosts are in scope</p>
            </div>
            <div className="scp-form">
              <input className="inp" style={{ flex: 1 }} placeholder="Pattern: *.example.com" value={newPat} onChange={e => setNewPat(e.target.value)} />
              <select className="sel" value={newType} onChange={e => setNewType(e.target.value)}>
                <option value="include">Include</option>
                <option value="exclude">Exclude</option>
              </select>
              <button className="btn btn-p" onClick={addRule}>+ Add</button>
            </div>
            <div className="scp-rules">
              {scopeRules.map(r => (
                <div key={r.id} className={'scp-rule' + (r.enabled ? '' : ' dis')}>
                  <span className={'rul-type rul-' + (r.rule_type === 'include' ? 'inc' : 'exc')}>{r.rule_type}</span>
                  <span className="rul-pat">{r.pattern}</span>
                  <div className="rul-acts">
                    <button className="btn btn-sm btn-s" onClick={() => scope.toggleRule(r.id)}>{r.enabled ? 'Disable' : 'Enable'}</button>
                    <button className="btn btn-sm btn-d" onClick={() => scope.deleteRule(r.id)}>×</button>
                  </div>
                </div>
              ))}
              {scopeRules.length === 0 && (
                <div className="empty" style={{ padding: 30 }}>
                  <div className="empty-i">🎯</div>
                  <span>Sin reglas — todo el tráfico está en scope</span>
                  <span className="empty-hint">El "scope" define qué sitios te interesan. Agrega una regla <b>Include</b> (p. ej. <code>*.example.com</code>) para enfocarte solo en ese objetivo, o <b>Exclude</b> para ignorar ruido. Sin reglas, se captura todo.</span>
                </div>
              )}
            </div>
          </div>
  );
}
