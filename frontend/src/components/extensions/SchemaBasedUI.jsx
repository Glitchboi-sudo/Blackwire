// SchemaBasedUI — UI de extensión (extraído de App.jsx).

export function SchemaBasedUI({ ext, updateExtCfg }) {
  const schema = ext.ui_schema;
  const config = ext.config || {};

  if (!schema || !schema.fields) {
    return (
      <div style={{ padding: '20px', color: 'var(--txt3)', fontSize: '11px' }}>
        No UI schema defined for this extension.
      </div>
    );
  }

  const handleFieldChange = (fieldName, value) => {
    updateExtCfg(ext.name, { ...config, [fieldName]: value });
  };

  return (
    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--brd)' }}>
      {schema.fields.map(field => (
        <div key={field.name} style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', fontSize: '11px', color: 'var(--txt2)', marginBottom: '6px' }}>
            {field.label}
            {field.required && <span style={{ color: 'var(--red)' }}> *</span>}
          </label>

          {(field.type === 'text' || field.type === 'password') && (
            <input
              className="inp"
              type={field.type}
              placeholder={field.placeholder || ''}
              value={config[field.name] !== undefined ? config[field.name] : (field.default || '')}
              onChange={e => handleFieldChange(field.name, e.target.value)}
            />
          )}

          {field.type === 'textarea' && (
            <textarea
              className="inp"
              placeholder={field.placeholder || ''}
              value={config[field.name] !== undefined ? config[field.name] : (field.default || '')}
              onChange={e => handleFieldChange(field.name, e.target.value)}
              rows={field.rows || 4}
            />
          )}

          {field.type === 'number' && (
            <input
              className="inp"
              type="number"
              placeholder={field.placeholder || ''}
              value={config[field.name] !== undefined ? config[field.name] : (field.default || 0)}
              onChange={e => handleFieldChange(field.name, parseInt(e.target.value) || 0)}
              min={field.min}
              max={field.max}
            />
          )}

          {field.type === 'checkbox' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={config[field.name] !== undefined ? config[field.name] : (field.default || false)}
                onChange={e => handleFieldChange(field.name, e.target.checked)}
              />
              {field.help && <span style={{ fontSize: '10px', color: 'var(--txt3)' }}>{field.help}</span>}
            </div>
          )}

          {field.type === 'select' && (
            <select
              className="inp"
              value={config[field.name] !== undefined ? config[field.name] : (field.default || '')}
              onChange={e => handleFieldChange(field.name, e.target.value)}
            >
              {field.options && field.options.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          )}

          {field.help && field.type !== 'checkbox' && (
            <div style={{ fontSize: '10px', color: 'var(--txt3)', marginTop: '4px' }}>
              {field.help}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
