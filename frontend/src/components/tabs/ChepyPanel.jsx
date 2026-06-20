// ChepyPanel — extraído de App.jsx (pestaña 'chepy').
// Recibe todo el estado/handlers vía props (objeto __appCtx de App.jsx).

export function ChepyPanel(props) {
  const { ResizeHandle, addChepyOp, bakeChepy, chepy, chepyBaking, chepyCat, chepyCntRef, chepyErr, chepyIn, chepyInW, chepyOps, chepyOut, chepyRecW, chepySelCat, chepySubTab, clearChepyRecipe, decodeJWT, encodeJWT, jwtHeader, jwtPayload, jwtSignature, jwtToken, moveChepyOp, removeChepyOp, setChepyIn, setChepyInW, setChepyRecW, setChepySelCat, setChepySubTab, setJwtHeader, setJwtPayload, setJwtSignature, setJwtToken, tab, toast, updateChepyArg } = props;
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
                    <button className="btn btn-sm btn-s" onClick={() => setChepyIn('')}>Clear</button>
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
                  <button className="btn btn-sm btn-d" onClick={clearChepyRecipe}>Clear</button>
                  <button className="btn btn-sm btn-p" onClick={bakeChepy} disabled={chepyBaking}>
                    {chepyBaking ? '...' : 'Bake'}
                  </button>
                </div>
              </div>

              <div className="chepy-add">
                <select className="sel" value={chepySelCat}
                  onChange={e => setChepySelCat(e.target.value)}
                  style={{ margin: '8px', borderRadius: '4px' }}>
                  {Object.keys(chepyCat).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <div className="chepy-ops-list">
                  {(chepyCat[chepySelCat] || []).map(op => (
                    <div key={op.name} className="chepy-avail-op" onClick={() => addChepyOp(op)}>
                      {op.label}
                    </div>
                  ))}
                </div>
              </div>

              <div className="chepy-steps">
                {chepyOps.length === 0 && (
                  <div className="empty" style={{ padding: 20, fontSize: 11 }}>
                    <span>Click operations above to build a recipe</span>
                  </div>
                )}
                {chepyOps.map((op, i) => (
                  <div key={i} className="chepy-step">
                    <div className="chepy-step-hdr">
                      <span className="chepy-step-num">{i + 1}</span>
                      <span className="chepy-step-name">{op.label}</span>
                      <div className="chepy-step-acts">
                        <button className="btn btn-sm btn-s" onClick={() => moveChepyOp(i, -1)} disabled={i === 0}>&#9650;</button>
                        <button className="btn btn-sm btn-s" onClick={() => moveChepyOp(i, 1)} disabled={i === chepyOps.length - 1}>&#9660;</button>
                        <button className="btn btn-sm btn-d" onClick={() => removeChepyOp(i)}>&#10005;</button>
                      </div>
                    </div>
                    {op.params.length > 0 && (
                      <div className="chepy-step-params">
                        {op.params.map(p => (
                          <div key={p.name} className="chepy-param">
                            <label className="chepy-param-lbl">{p.label}</label>
                            {p.type === 'select' ? (
                              <select className="sel" value={op.args[p.name] || p.default}
                                onChange={e => updateChepyArg(i, p.name, e.target.value)}
                                style={{ flex: 1, fontSize: '11px', padding: '5px 8px' }}>
                                {(p.options || []).map(o => <option key={o} value={o}>{o}</option>)}
                              </select>
                            ) : (
                              <input className="inp" value={op.args[p.name] || ''}
                                onChange={e => updateChepyArg(i, p.name, e.target.value)}
                                placeholder={p.default || ''}
                                style={{ flex: 1, fontSize: '11px', padding: '5px 8px' }} />
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
              ) : (
                <div className="code">{chepyOut || 'Output will appear here after baking'}</div>
              )}
            </div>
              </div>
            )}

            {chepySubTab === 'jwt' && (
              <div className="jwt-analyzer" style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '20px', gap: '16px', overflow: 'auto' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--txt1)' }}>JWT Token</label>
                  <textarea
                    className="ed-ta"
                    style={{ minHeight: '80px', fontFamily: 'var(--font-mono)', fontSize: '11px' }}
                    value={jwtToken}
                    onChange={e => setJwtToken(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
                  />
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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--txt1)' }}>Header (JSON)</label>
                    <textarea
                      className="ed-ta"
                      style={{ minHeight: '120px', fontFamily: 'var(--font-mono)', fontSize: '11px' }}
                      value={jwtHeader}
                      onChange={e => setJwtHeader(e.target.value)}
                      placeholder='{\n  "alg": "HS256",\n  "typ": "JWT"\n}'
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--txt1)' }}>Payload (JSON)</label>
                    <textarea
                      className="ed-ta"
                      style={{ minHeight: '120px', fontFamily: 'var(--font-mono)', fontSize: '11px' }}
                      value={jwtPayload}
                      onChange={e => setJwtPayload(e.target.value)}
                      placeholder='{\n  "sub": "1234567890",\n  "name": "John Doe",\n  "iat": 1516239022\n}'
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--txt1)' }}>Signature</label>
                  <input
                    className="inp"
                    style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}
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

                <div style={{ marginTop: '20px', padding: '16px', background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: '4px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px', color: 'var(--cyan)' }}>Common JWT Attacks</div>
                  <div style={{ fontSize: '11px', color: 'var(--txt2)', lineHeight: '1.6', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--txt1)', marginBottom: '4px' }}>1. Algorithm Confusion (alg=none)</div>
                      <div>Change the "alg" field in the header to "none" and remove the signature. Some implementations don't verify signatures when alg is none.</div>
                      <code style={{ display: 'block', marginTop: '4px', padding: '6px', background: 'var(--bg3)', borderRadius: '2px', fontSize: '10px' }}>{'{"alg": "none", "typ": "JWT"}'}</code>
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--txt1)', marginBottom: '4px' }}>2. Key Confusion Attack</div>
                      <div>Change "alg" from RS256 (asymmetric) to HS256 (symmetric). If the server uses the public key as HMAC secret, you can forge signatures.</div>
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--txt1)', marginBottom: '4px' }}>3. Weak Secret Brute Force</div>
                      <div>If HS256/HS512 is used with a weak secret, the signature can be brute-forced offline. Use tools like hashcat or jwt_tool.</div>
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--txt1)', marginBottom: '4px' }}>4. JKU/X5U Header Injection</div>
                      <div>Add "jku" (JWK Set URL) or "x5u" (X.509 URL) headers pointing to attacker-controlled keys. If not validated, server may accept forged tokens.</div>
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--txt1)', marginBottom: '4px' }}>5. Kid Header Injection</div>
                      <div>The "kid" (Key ID) parameter can sometimes be exploited for path traversal or SQL injection if used unsafely in key lookup.</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
  );
}
