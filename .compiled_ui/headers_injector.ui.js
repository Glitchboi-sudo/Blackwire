/**
 * Headers Injector - UI Dinámica
 * Este archivo se carga dinámicamente sin necesidad de recompilar App.jsx
 */

(function() {
  // Inicializar namespace global
  if (!window.BlackwireExtensions) {
    window.BlackwireExtensions = {};
  }

  // Registrar componente para esta extensión
  window.BlackwireExtensions['headers_injector'] = function(props) {
    const { ext, updateExtCfg, toast } = props;
    const config = ext.config || {};
    const headers = config.headers || [];

    // Agregar nuevo header
    const addHeader = () => {
      const newHeaders = [...headers, { name: '', value: '', enabled: true }];
      updateExtCfg(ext.name, { ...config, headers: newHeaders });
    };

    // Eliminar header
    const removeHeader = (index) => {
      const newHeaders = headers.filter((_, i) => i !== index);
      updateExtCfg(ext.name, { ...config, headers: newHeaders });
    };

    // Actualizar header
    const updateHeader = (index, field, value) => {
      const newHeaders = [...headers];
      newHeaders[index] = { ...newHeaders[index], [field]: value };
      updateExtCfg(ext.name, { ...config, headers: newHeaders });
    };

    // Toggle header enabled
    const toggleHeader = (index) => {
      const newHeaders = [...headers];
      newHeaders[index] = { ...newHeaders[index], enabled: !newHeaders[index].enabled };
      updateExtCfg(ext.name, { ...config, headers: newHeaders });
    };

    return React.createElement('div', {
      style: {
        marginTop: '12px',
        paddingTop: '12px',
        borderTop: '1px solid var(--brd)'
      }
    }, [
      // Título y botón agregar
      React.createElement('div', {
        key: 'header-controls',
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px'
        }
      }, [
        React.createElement('div', {
          key: 'title',
          style: { fontSize: '11px', color: 'var(--txt2)', fontWeight: 'bold' }
        }, 'Custom Headers'),
        React.createElement('button', {
          key: 'add-btn',
          className: 'btn btn-sm btn-p',
          onClick: addHeader
        }, '+ Add Header')
      ]),

      // Lista de headers
      headers.length === 0
        ? React.createElement('div', {
            key: 'empty',
            style: {
              padding: '20px',
              textAlign: 'center',
              fontSize: '11px',
              color: 'var(--txt3)',
              border: '1px dashed var(--brd)',
              borderRadius: '4px'
            }
          }, 'No headers configured. Click "Add Header" to create one.')
        : headers.map((header, index) =>
            React.createElement('div', {
              key: 'header-' + index,
              style: {
                display: 'flex',
                gap: '8px',
                marginBottom: '8px',
                padding: '8px',
                border: '1px solid var(--brd)',
                borderRadius: '4px',
                backgroundColor: header.enabled ? 'transparent' : 'var(--bg2)',
                opacity: header.enabled ? 1 : 0.6
              }
            }, [
              // Checkbox enabled
              React.createElement('input', {
                key: 'enabled',
                type: 'checkbox',
                checked: header.enabled,
                onChange: () => toggleHeader(index),
                style: { marginTop: '6px' }
              }),

              // Input name
              React.createElement('input', {
                key: 'name',
                className: 'inp',
                type: 'text',
                placeholder: 'Header Name (e.g., X-Custom-Header)',
                value: header.name || '',
                onChange: (e) => updateHeader(index, 'name', e.target.value),
                style: { flex: '1' }
              }),

              // Input value
              React.createElement('input', {
                key: 'value',
                className: 'inp',
                type: 'text',
                placeholder: 'Header Value',
                value: header.value || '',
                onChange: (e) => updateHeader(index, 'value', e.target.value),
                style: { flex: '1' }
              }),

              // Botón eliminar
              React.createElement('button', {
                key: 'delete',
                className: 'btn btn-sm btn-d',
                onClick: () => removeHeader(index),
                style: { padding: '4px 8px' }
              }, '🗑')
            ])
          ),

      // Contador de headers activos
      headers.length > 0 && React.createElement('div', {
        key: 'footer',
        style: {
          marginTop: '12px',
          padding: '8px',
          fontSize: '10px',
          color: 'var(--txt3)',
          borderTop: '1px solid var(--brd)'
        }
      }, `${headers.filter(h => h.enabled).length} of ${headers.length} headers active`)
    ]);
  };
})();
