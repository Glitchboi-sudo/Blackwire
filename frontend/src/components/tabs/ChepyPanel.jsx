// ChepyPanel — extraído de App.jsx (pestaña 'chepy').
// Recibe todo el estado/handlers vía props (objeto __appCtx de App.jsx).

const { useState, useMemo } = React;

// Claims estándar de JWT con marca de tiempo epoch → fecha legible.
const JWT_TIME_CLAIMS = { exp: 'Expira', iat: 'Emitido (iat)', nbf: 'No antes (nbf)', auth_time: 'Auth time' };

const JWT_ATTACKS = [
  {
    title: '1. Algorithm Confusion (alg=none)',
    body: 'Cambia el campo "alg" del header a "none" y elimina la firma. Algunas implementaciones no verifican la firma cuando alg es none.',
    code: '{"alg": "none", "typ": "JWT"}',
  },
  {
    title: '2. Key Confusion (RS256 → HS256)',
    body: 'Cambia "alg" de RS256 (asimétrico) a HS256 (simétrico). Si el servidor usa la clave pública como secret HMAC, puedes forjar firmas.',
  },
  {
    title: '3. Weak Secret Brute Force',
    body: 'Si se usa HS256/HS512 con un secret débil, la firma puede romperse offline. Usa hashcat (-m 16500) o jwt_tool.',
  },
  {
    title: '4. JKU/X5U Header Injection',
    body: 'Añade headers "jku" (JWK Set URL) o "x5u" (X.509 URL) apuntando a claves controladas por el atacante. Si no se validan, el servidor puede aceptar tokens forjados.',
  },
  {
    title: '5. Kid Header Injection',
    body: 'El parámetro "kid" (Key ID) puede explotarse para path traversal o SQL injection si se usa sin sanitizar en la búsqueda de la clave.',
  },
];

function formatEpoch(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  try {
    return new Date(n * 1000).toLocaleString();
  } catch (e) {
    return null;
  }
}

export function ChepyPanel(props) {
  const { ResizeHandle, addChepyOp, bakeChepy, chepy, chepyBaking, chepyCat, chepyCntRef, chepyErr, chepyIn, chepyInW, chepyOps, chepyOut, chepyRecW, chepySelCat, chepySubTab, clearChepyRecipe, decodeJWT, encodeJWT, jwtHeader, jwtPayload, jwtSignature, jwtToken, moveChepyOp, removeChepyOp, setChepyIn, setChepyInW, setChepyRecW, setChepySelCat, setChepySubTab, setJwtHeader, setJwtPayload, setJwtSignature, setJwtToken, tab, toast, updateChepyArg } = props;

  const [opFilter, setOpFilter] = useState('');

  // Con filtro: busca operaciones en TODAS las categorías. Sin filtro: muestra
  // solo la categoría seleccionada.
  const availableOps = useMemo(() => {
    const q = opFilter.trim().toLowerCase();
    if (!q) return (chepyCat[chepySelCat] || []).map(op => ({ op, cat: chepySelCat }));
    const out = [];
    for (const cat of Object.keys(chepyCat)) {
      for (const op of chepyCat[cat] || []) {
        if (op.label.toLowerCase().includes(q) || op.name.toLowerCase().includes(q)) {
          out.push({ op, cat });
        }
      }
    }
    return out;
  }, [opFilter, chepySelCat, chepyCat]);

  // Claims JWT legibles a partir del payload.
  const jwtClaims = useMemo(() => {
    try {
      const payload = JSON.parse(jwtPayload);
      const rows = [];
      for (const [key, label] of Object.entries(JWT_TIME_CLAIMS)) {
        if (payload[key] != null) {
          const human = formatEpoch(payload[key]);
          rows.push({ key, label, value: human || String(payload[key]) });
        }
      }
      if (payload.exp != null) {
        const expired = Number(payload.exp) * 1000 < Date.now();
        rows.push({ key: '_status', label: 'Estado', value: expired ? 'EXPIRADO' : 'Vigente', warn: expired });
      }
      return rows;
    } catch (e) {
      return [];
    }
  }, [jwtPayload]);

  const jwtAlg = useMemo(() => {
    try {
      return JSON.parse(jwtHeader).alg || null;
    } catch (e) {
      return null;
    }
  }, [jwtHeader]);

  const tokenSegments = (jwtToken || '').split('.');

  return (
    <div className="chepy-cnt" ref={chepyCntRef}>
      <div className="hist-sub-tabs">
        <div className={'hist-sub-tab' + (chepySubTab === 'cipher' ? ' act' : '')} onClick={() => setChepySubTab('cipher')}>Cipher</div>
        <div className={'hist-sub-tab' + (chepySubTab === 'jwt' ? ' act' : '')} onClick={() => setChepySubTab('jwt')}>JWT</div>
      </div>

      {chepySubTab === 'cipher' && (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <div className="chepy-col chepy-in-col" style={{ width: chepyInW + '%' }}>
            <div className="pnl-hdr">
              <span>Input</span>
              <button className="btn btn-sm btn-s" onClick={() => setChepyIn('')} disabled={!chepyIn}>Clear</button>
            </div>
            <textarea
              className="ed-ta"
              style={{ flex: 1 }}
              value={chepyIn}
              onChange={e => setChepyIn(e.target.value)}
              placeholder="Paste or type input text here..."
            />
          </div>

          <ResizeHandle onDrag={(dx) => {
            const el = chepyCntRef.current;
            if (!el) return;
            const dpct = (dx / el.offsetWidth) * 100;
            setChepyInW(prev => Math.max(15, Math.min(50, prev + dpct)));
          }} />

          <div className="chepy-col chepy-recipe-col" style={{ width: chepyRecW + '%' }}>
            <div className="pnl-hdr">
              <span>Recipe</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button className="btn btn-sm btn-d" onClick={clearChepyRecipe} disabled={chepyOps.length === 0}>Clear</button>
                <button className="btn btn-sm btn-p" onClick={bakeChepy} disabled={chepyBaking || chepyOps.length === 0}>
                  {chepyBaking ? '...' : 'Bake'}
                </button>
              </div>
            </div>

            <div className="chepy-add">
              <div className="chepy-op-search">
                <select className="sel" value={chepySelCat}
                  onChange={e => setChepySelCat(e.target.value)}
                  disabled={!!opFilter.trim()}
                  title={opFilter.trim() ? 'Limpia la búsqueda para elegir categoría' : 'Categoría de operaciones'}>
                  {Object.keys(chepyCat).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <input className="inp chepy-op-filter" value={opFilter}
                  onChange={e => setOpFilter(e.target.value)}
                  placeholder="Buscar operación..." />
                {opFilter && (
                  <button className="btn btn-sm btn-s" onClick={() => setOpFilter('')} title="Limpiar búsqueda">✕</button>
                )}
              </div>
              <div className="chepy-ops-list">
                {availableOps.length === 0 && (
                  <div className="chepy-ops-empty">Sin operaciones que coincidan</div>
                )}
                {availableOps.map(({ op, cat }) => (
                  <div key={cat + ':' + op.name} className="chepy-avail-op" onClick={() => addChepyOp(op)} title={'Añadir: ' + op.label}>
                    <span className="chepy-avail-plus">+</span>
                    <span className="chepy-avail-label">{op.label}</span>
                    {opFilter.trim() && <span className="chepy-avail-cat">{cat}</span>}
                  </div>
                ))}
              </div>
            </div>

            <div className="chepy-steps">
              {chepyOps.length === 0 && (
                <div className="empty" style={{ padding: 20, fontSize: 11 }}>
                  <span>Añade operaciones de arriba para construir una receta</span>
                </div>
              )}
              {chepyOps.map((op, i) => (
                <div key={i} className="chepy-step">
                  <div className="chepy-step-hdr">
                    <span className="chepy-step-num">{i + 1}</span>
                    <span className="chepy-step-name">{op.label}</span>
                    <div className="chepy-step-acts">
                      <button className="btn btn-sm btn-s" onClick={() => moveChepyOp(i, -1)} disabled={i === 0} title="Subir">&#9650;</button>
                      <button className="btn btn-sm btn-s" onClick={() => moveChepyOp(i, 1)} disabled={i === chepyOps.length - 1} title="Bajar">&#9660;</button>
                      <button className="btn btn-sm btn-d" onClick={() => removeChepyOp(i)} title="Quitar">&#10005;</button>
                    </div>
                  </div>
                  {op.params.length > 0 && (
                    <div className="chepy-step-params">
                      {op.params.map(p => (
                        <div key={p.name} className="chepy-param">
                          <label className="chepy-param-lbl">{p.label}</label>
                          {p.type === 'select' ? (
                            <select className="sel chepy-param-field" value={op.args[p.name] || p.default}
                              onChange={e => updateChepyArg(i, p.name, e.target.value)}>
                              {(p.options || []).map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                          ) : (
                            <input className="inp chepy-param-field" value={op.args[p.name] || ''}
                              onChange={e => updateChepyArg(i, p.name, e.target.value)}
                              placeholder={p.default || ''} />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <ResizeHandle onDrag={(dx) => {
            const el = chepyCntRef.current;
            if (!el) return;
            const dpct = (dx / el.offsetWidth) * 100;
            setChepyRecW(prev => Math.max(15, Math.min(50, prev + dpct)));
          }} />

          <div className="chepy-col chepy-out-col">
            <div className="pnl-hdr">
              <span>Output</span>
              <button className="btn btn-sm btn-s"
                onClick={() => { navigator.clipboard.writeText(chepyOut); toast('Copied', 'success'); }}
                disabled={!chepyOut}>
                Copy
              </button>
            </div>
            {chepyErr ? (
              <div className="code" style={{ color: 'var(--red)' }}>{chepyErr}</div>
            ) : chepyOut ? (
              <div className="code">{chepyOut}</div>
            ) : (
              <div className="empty" style={{ fontSize: 12 }}>
                <span>{chepyOps.length === 0 ? 'Construye una receta y pulsa Bake' : 'Pulsa Bake para ver el resultado'}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {chepySubTab === 'jwt' && (
        <div className="jwt-analyzer">
          <div className="jwt-field">
            <label className="jwt-label">JWT Token</label>
            <textarea
              className="ed-ta jwt-token-ta"
              value={jwtToken}
              onChange={e => setJwtToken(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
            />
            {tokenSegments.length === 3 && tokenSegments[0] && (
              <div className="jwt-token-view" title="header . payload . signature">
                <span className="jwt-seg jwt-seg-h">{tokenSegments[0]}</span>
                <span className="jwt-dot">.</span>
                <span className="jwt-seg jwt-seg-p">{tokenSegments[1]}</span>
                <span className="jwt-dot">.</span>
                <span className="jwt-seg jwt-seg-s">{tokenSegments[2]}</span>
              </div>
            )}
            <button
              className="btn btn-p"
              onClick={() => {
                const decoded = decodeJWT(jwtToken);
                if (decoded) {
                  setJwtHeader(JSON.stringify(decoded.header, null, 2));
                  setJwtPayload(JSON.stringify(decoded.payload, null, 2));
                  setJwtSignature(decoded.signature);
                  toast('JWT decoded successfully', 'success');
                } else {
                  toast('Invalid JWT token', 'error');
                }
              }}
              disabled={!jwtToken}
            >
              Decode JWT
            </button>
          </div>

          <div className="jwt-grid">
            <div className="jwt-field">
              <label className="jwt-label jwt-label-h">Header (JSON)</label>
              <textarea
                className="ed-ta jwt-json-ta"
                value={jwtHeader}
                onChange={e => setJwtHeader(e.target.value)}
                placeholder={'{\n  "alg": "HS256",\n  "typ": "JWT"\n}'}
              />
            </div>

            <div className="jwt-field">
              <label className="jwt-label jwt-label-p">Payload (JSON)</label>
              <textarea
                className="ed-ta jwt-json-ta"
                value={jwtPayload}
                onChange={e => setJwtPayload(e.target.value)}
                placeholder={'{\n  "sub": "1234567890",\n  "name": "John Doe",\n  "iat": 1516239022\n}'}
              />
            </div>
          </div>

          {(jwtClaims.length > 0 || jwtAlg) && (
            <div className="jwt-claims">
              {jwtAlg && (
                <div className="jwt-claim">
                  <span className="jwt-claim-k">Algoritmo</span>
                  <span className={'jwt-claim-v' + (jwtAlg === 'none' ? ' warn' : '')}>{jwtAlg}</span>
                </div>
              )}
              {jwtClaims.map(c => (
                <div key={c.key} className="jwt-claim">
                  <span className="jwt-claim-k">{c.label}</span>
                  <span className={'jwt-claim-v' + (c.warn ? ' warn' : '')}>{c.value}</span>
                </div>
              ))}
            </div>
          )}

          <div className="jwt-field">
            <label className="jwt-label jwt-label-s">Signature</label>
            <input
              className="inp jwt-sig-in"
              value={jwtSignature}
              onChange={e => setJwtSignature(e.target.value)}
              placeholder="SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
            />
          </div>

          <button
            className="btn btn-p"
            onClick={() => {
              try {
                const header = JSON.parse(jwtHeader);
                const payload = JSON.parse(jwtPayload);
                const token = encodeJWT(header, payload, jwtSignature);
                if (token) {
                  setJwtToken(token);
                  toast('JWT encoded successfully', 'success');
                } else {
                  toast('Failed to encode JWT', 'error');
                }
              } catch (e) {
                toast('Invalid JSON in header or payload', 'error');
              }
            }}
          >
            Encode JWT
          </button>

          <div className="jwt-attacks">
            <div className="jwt-attacks-title">Common JWT Attacks</div>
            {JWT_ATTACKS.map(a => (
              <div key={a.title} className="jwt-attack">
                <div className="jwt-attack-title">{a.title}</div>
                <div className="jwt-attack-body">{a.body}</div>
                {a.code && <code className="jwt-attack-code">{a.code}</code>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
