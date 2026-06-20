// MatchReplaceUI — UI de extensión (extraído de App.jsx).

export function MatchReplaceUI({ ext, updateExtCfg }) {
  const rules = ext.config?.rules || [];

  const updateRule = (idx, field, value) => {
    const newRules = rules.map((r, i) => i === idx ? { ...r, [field]: value } : r);
    updateExtCfg(ext.name, { ...ext.config, rules: newRules });
  };

  const removeRule = idx => {
    updateExtCfg(ext.name, { ...ext.config, rules: rules.filter((_, i) => i !== idx) });
  };

  const addRule = () => {
    updateExtCfg(ext.name, { ...ext.config, rules: [...rules, {
      enabled: true, when: 'request', target: 'url', pattern: '', replace: '', regex: false, ignore_case: false, header: ''
    }]});
  };

  const duplicateRule = idx => {
    const newRules = [...rules];
    newRules.splice(idx + 1, 0, { ...rules[idx] });
    updateExtCfg(ext.name, { ...ext.config, rules: newRules });
  };

  const whenColors = { request: 'var(--blue)', response: 'var(--green)', both: 'var(--orange)' };
  const s = {
    card: { background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: '6px', padding: '12px', marginBottom: '8px', opacity: 1 },
    cardOff: { background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: '6px', padding: '12px', marginBottom: '8px', opacity: 0.5 },
    row: { display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' },
    lastRow: { display: 'flex', gap: '8px', alignItems: 'center' },
    label: { fontSize: '10px', color: 'var(--txt3)', marginBottom: '3px', display: 'block' },
    sel: { background: 'var(--bg)', color: 'var(--txt)', border: '1px solid var(--brd)', borderRadius: '4px', padding: '4px 6px', fontSize: '11px', fontFamily: 'var(--font-mono)', outline: 'none' },
    inp: { background: 'var(--bg)', color: 'var(--txt)', border: '1px solid var(--brd)', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', fontFamily: 'var(--font-mono)', flex: 1, outline: 'none', width: '100%' },
    badge: (color) => ({ fontSize: '9px', padding: '2px 6px', borderRadius: '3px', background: color, color: '#fff', fontWeight: '600', textTransform: 'uppercase' }),
  };

  return (
    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--brd)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--txt2)' }}>
          Rules ({rules.length})
        </div>
        <button className="btn btn-sm btn-p" onClick={addRule}>+ Add Rule</button>
      </div>

      {rules.length === 0 && (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--txt3)', fontSize: '11px', background: 'var(--bg3)', borderRadius: '6px' }}>
          No rules yet. Click "+ Add Rule" to create one.
        </div>
      )}

      {rules.map((rule, idx) => (
        <div key={idx} style={rule.enabled ? s.card : s.cardOff}>
          {/* Row 1: Enable + When + Target + Actions */}
          <div style={s.row}>
            <input type="checkbox" checked={rule.enabled} onChange={e => updateRule(idx, 'enabled', e.target.checked)}
              title={rule.enabled ? 'Disable rule' : 'Enable rule'} />
            <span style={s.badge(whenColors[rule.when] || 'var(--txt3)')}>#{idx + 1}</span>
            <div style={{ flex: 0 }}>
              <select style={s.sel} value={rule.when} onChange={e => updateRule(idx, 'when', e.target.value)}>
                <option value="request">Request</option>
                <option value="response">Response</option>
                <option value="both">Both</option>
              </select>
            </div>
            <div style={{ flex: 0 }}>
              <select style={s.sel} value={rule.target} onChange={e => updateRule(idx, 'target', e.target.value)}>
                <option value="url">URL</option>
                <option value="headers">Header</option>
                <option value="body">Body</option>
              </select>
            </div>
            {rule.target === 'headers' && (
              <input style={{ ...s.inp, maxWidth: '120px' }} value={rule.header || ''} placeholder="Header name"
                onChange={e => updateRule(idx, 'header', e.target.value)} title="Leave empty to match all headers" />
            )}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
              <button className="btn btn-sm btn-s" onClick={() => duplicateRule(idx)} title="Duplicate">⧉</button>
              <button className="btn btn-sm btn-d" onClick={() => removeRule(idx)} title="Delete">✕</button>
            </div>
          </div>

          {/* Row 2: Pattern → Replace */}
          <div style={s.lastRow}>
            <div style={{ flex: 1 }}>
              <label style={s.label}>Match</label>
              <input style={s.inp} value={rule.pattern} placeholder={rule.regex ? '(regex)' : 'text to find'}
                onChange={e => updateRule(idx, 'pattern', e.target.value)} />
            </div>
            <span style={{ color: 'var(--txt3)', fontSize: '14px', marginTop: '14px' }}>→</span>
            <div style={{ flex: 1 }}>
              <label style={s.label}>Replace</label>
              <input style={s.inp} value={rule.replace} placeholder="replacement"
                onChange={e => updateRule(idx, 'replace', e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: '6px', marginTop: '14px' }}>
              <button className={'btn btn-sm ' + (rule.regex ? 'btn-p' : 'btn-s')} onClick={() => updateRule(idx, 'regex', !rule.regex)}
                title="Regular expression" style={{ fontFamily: 'var(--font-mono)', fontSize: '10px' }}>.*</button>
              <button className={'btn btn-sm ' + (rule.ignore_case ? 'btn-p' : 'btn-s')} onClick={() => updateRule(idx, 'ignore_case', !rule.ignore_case)}
                title="Ignore case" style={{ fontFamily: 'var(--font-mono)', fontSize: '10px' }}>Aa</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
