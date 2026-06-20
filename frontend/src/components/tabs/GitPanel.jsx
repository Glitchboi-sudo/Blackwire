// GitPanel — extraído de App.jsx (pestaña 'git').
// Recibe todo el estado/handlers vía props (objeto __appCtx de App.jsx).

export function GitPanel(props) {
  const { cmtMsg, commit, commits, git, setCmtMsg } = props;
  return (
          <div className="git-pnl">
            <div className="git-sec">
              <div className="git-ttl">Create Commit (Press Ctrl+S for auto-commit)</div>
              <div className="cmt-form">
                <input className="cmt-in" placeholder="Message..." value={cmtMsg} onChange={e => setCmtMsg(e.target.value)} onKeyPress={e => e.key === 'Enter' && commit()} />
                <button className="btn btn-p" onClick={commit}>Commit</button>
              </div>
            </div>
            <div className="git-sec">
              <div className="git-ttl">History</div>
              <div className="cmt-list">
                {commits.map((c, i) => (
                  <div key={i} className="cmt-item">
                    <span className="cmt-hash">{c.hash}</span>
                    <span className="cmt-msg">{c.message}</span>
                    <span className="cmt-date">{c.date}</span>
                  </div>
                ))}
                {commits.length === 0 && (
                  <div className="cmt-item" style={{ justifyContent: 'center', color: 'var(--txt3)' }}>
                    No commits
                  </div>
                )}
              </div>
            </div>
          </div>
  );
}
