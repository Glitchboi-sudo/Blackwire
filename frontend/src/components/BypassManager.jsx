// BypassManager — gestiona reglas de bypass del proxy (URLs excluidas del MITM).
// Útil para sitios como Google reCAPTCHA que no confían en certificados MITM.
// Recibe `bypass` (del hook useBypass, instanciado en App.jsx) y `toast` como props.

const { useState, useEffect } = React;

export function BypassManager({ toast, bypass }) {
  const { rules, presets, status, loading, loadRules, loadPresets, loadStatus, createRule, updateRule, deleteRule, toggleRule, applyPreset } = bypass;
  const [showPresets, setShowPresets] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [formData, setFormData] = useState({ pattern: '', is_regex: false, description: '', enabled: true });

  useEffect(() => { loadRules(); loadPresets(); loadStatus(); }, []);

  const handleSubmit = async () => {
    if (!formData.pattern.trim()) { toast('Pattern is required', 'error'); return; }
    if (editingRule) { await updateRule(editingRule.id, formData); setEditingRule(null); } else { await createRule(formData); }
    setFormData({ pattern: '', is_regex: false, description: '', enabled: true });
  };

  const handleEdit = (rule) => { setEditingRule(rule); setFormData({ pattern: rule.pattern, is_regex: rule.is_regex, description: rule.description || '', enabled: rule.enabled }); };
  const handleDelete = async (id) => { if (confirm('Delete this bypass rule?')) await deleteRule(id); };
  const handleApplyPreset = async (presetName) => { if (confirm(`Apply ${presetName} preset?`)) { await applyPreset(presetName); setShowPresets(false); } };
  const cancelEdit = () => { setEditingRule(null); setFormData({ pattern: '', is_regex: false, description: '', enabled: true }); };

  return React.createElement('div', { className: 'scp-pnl' },
    React.createElement('div', { className: 'scp-hdr' },
      React.createElement('h3', null, 'Proxy Bypass'),
      React.createElement('p', null, 'Exclude URLs from MITM interception'),
      status && status.status === 'active' && React.createElement('p', { style: { fontSize: '11px', color: 'var(--green)', marginTop: '6px' } },
        `Active: ${status.enabled_rules_count} rule${status.enabled_rules_count !== 1 ? 's' : ''} • Restart proxy to apply changes`)
    ),

    React.createElement('div', { className: 'scp-form' },
      React.createElement('input', {
        className: 'inp',
        style: { flex: 1, fontFamily: 'monospace', fontSize: '12px' },
        placeholder: editingRule ? 'Edit pattern' : '*.google.com or regex pattern',
        value: formData.pattern,
        onChange: e => setFormData({ ...formData, pattern: e.target.value })
      }),
      React.createElement('input', {
        className: 'inp',
        style: { width: '200px', fontSize: '12px' },
        placeholder: 'Description',
        value: formData.description,
        onChange: e => setFormData({ ...formData, description: e.target.value })
      }),
      React.createElement('label', { style: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', whiteSpace: 'nowrap', cursor: 'pointer' } },
        React.createElement('input', {
          type: 'checkbox',
          checked: formData.is_regex,
          onChange: e => setFormData({ ...formData, is_regex: e.target.checked })
        }),
        'Regex'
      ),
      React.createElement('button', {
        className: 'btn btn-p',
        onClick: handleSubmit,
        disabled: loading || !formData.pattern.trim()
      }, editingRule ? 'Update' : '+ Add'),
      editingRule && React.createElement('button', { className: 'btn btn-s', onClick: cancelEdit }, 'Cancel'),
      React.createElement('button', {
        className: 'btn btn-s',
        onClick: () => setShowPresets(!showPresets)
      }, showPresets ? 'Hide Presets' : 'Presets')
    ),

    showPresets && React.createElement('div', { style: { margin: '0 0 16px 0', padding: '12px', background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: '4px' } },
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' } },
        Object.entries(presets).map(([name, rules]) =>
          React.createElement('div', {
            key: name,
            style: { padding: '10px', background: 'var(--bg)', border: '1px solid var(--brd)', borderRadius: '3px', cursor: 'pointer' },
            onClick: () => handleApplyPreset(name)
          },
            React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: '4px' } },
              React.createElement('span', { style: { fontWeight: '600', fontSize: '12px', textTransform: 'capitalize' } }, name.replace(/_/g, ' ')),
              React.createElement('span', { style: { fontSize: '10px', padding: '2px 5px', background: 'var(--bg2)', borderRadius: '2px', color: 'var(--txt3)' } }, rules.length)
            ),
            React.createElement('div', { style: { fontSize: '10px', color: 'var(--txt3)' } },
              rules.slice(0, 2).map(r => r.pattern).join(', ') + (rules.length > 2 ? '...' : '')
            )
          )
        )
      )
    ),

    React.createElement('div', { className: 'scp-rules' },
      rules.length === 0 ?
        React.createElement('div', { className: 'empty', style: { padding: 30 } },
          React.createElement('span', null, 'No bypass rules')
        ) :
        rules.map(rule =>
          React.createElement('div', { key: rule.id, className: 'scp-rule' + (rule.enabled ? '' : ' dis') },
            React.createElement('input', {
              type: 'checkbox',
              checked: rule.enabled,
              onChange: () => toggleRule(rule.id),
              style: { cursor: 'pointer', marginRight: '12px' }
            }),
            React.createElement('div', { style: { flex: 1, minWidth: 0 } },
              React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
                React.createElement('code', { className: 'rul-pat' }, rule.pattern),
                rule.is_regex && React.createElement('span', {
                  style: {
                    fontSize: '9px',
                    padding: '1px 4px',
                    background: 'var(--primary)',
                    color: '#fff',
                    borderRadius: '2px',
                    fontWeight: '600'
                  }
                }, 'RE')
              ),
              rule.description && React.createElement('div', { style: { fontSize: '11px', color: 'var(--txt3)', marginTop: '2px' } }, rule.description)
            ),
            React.createElement('div', { className: 'rul-acts' },
              React.createElement('button', { onClick: () => handleEdit(rule), className: 'btn btn-sm btn-s' }, 'Edit'),
              React.createElement('button', { onClick: () => handleDelete(rule.id), className: 'btn btn-sm btn-d' }, '×')
            )
          )
        )
    )
  );
}
