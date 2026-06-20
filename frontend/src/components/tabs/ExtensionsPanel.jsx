// ExtensionsPanel — extraído de App.jsx (pestaña 'extensions').
// Recibe todo el estado/handlers vía props (objeto __appCtx de App.jsx).

export function ExtensionsPanel(props) {
  const { DynamicExtensionUI, EXTENSION_CUSTOM_COMPONENTS, SchemaBasedUI, createWebhookToken, extensions, loadWebhookLocal, refreshWebhook, sensitive, setWhkApiKey, toast, togExtEnabled, updateExtCfg, whkApiKey, whkLoading, whkReqs } = props;
  return (
          <div className="scp-pnl">
            <div className="scp-hdr">
              <h3>Extensions</h3>
              <p>Manage and configure extensions for request/response manipulation</p>
            </div>
            {extensions.length === 0 && (
              <div className="empty" style={{ padding: 30 }}>
                <div className="empty-i"></div>
                <span>No extensions installed</span>
              </div>
            )}
            {extensions.extensions.filter(ext => ext.name !== 'sensitive').map(ext => (
              <div key={ext.name} style={{ background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: '8px', padding: '16px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>{ext.title || ext.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--txt2)' }}>{ext.description || 'No description'}</div>
                  </div>
                  <button className={'btn btn-sm ' + (ext.enabled ? 'btn-g' : 'btn-s')} onClick={() => togExtEnabled(ext.name, !ext.enabled)}>
                    {ext.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
                {ext.enabled && (() => {
                  // 1. Si tiene custom_ui_file → usar DynamicExtensionUI (carga desde .ui.jsx)
                  if (ext.custom_ui_file) {
                    return React.createElement(DynamicExtensionUI, {
                      ext,
                      updateExtCfg,
                      toast,
                      // Props adicionales para extensiones que puedan necesitarlas
                      whkReqs,
                      whkApiKey,
                      setWhkApiKey,
                      whkLoading,
                      createWebhookToken,
                      refreshWebhook,
                      loadWebhookLocal
                    });
                  }

                  // 2. Si tiene ui_schema con tipo schema-driven → usar SchemaBasedUI
                  if (ext.ui_schema?.type === 'schema-driven') {
                    return React.createElement(SchemaBasedUI, { ext, updateExtCfg });
                  }

                  // 3. Si está en registry de componentes custom → usar componente custom
                  if (EXTENSION_CUSTOM_COMPONENTS[ext.name]) {
                    return React.createElement(EXTENSION_CUSTOM_COMPONENTS[ext.name], {
                      ext,
                      updateExtCfg,
                      // Props específicas solo para extensiones que las necesitan
                      ...(ext.name === 'webhook_site' ? {
                        whkReqs,
                        whkApiKey,
                        setWhkApiKey,
                        whkLoading,
                        createWebhookToken,
                        refreshWebhook,
                        loadWebhookLocal,
                        toast
                      } : {})
                    });
                  }

                  // 4. Fallback: extensión sin UI
                  return (
                    <div style={{ marginTop: '12px', padding: '12px', fontSize: '11px', color: 'var(--txt3)' }}>
                      Extension enabled (no UI configured)
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>
  );
}
