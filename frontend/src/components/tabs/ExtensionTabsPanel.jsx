// ExtensionTabsPanel — renderiza la pestaña de una extensión dinámica activa.
export function ExtensionTabsPanel(props) {
  const { extensions, tab, DynamicExtensionUI, SchemaBasedUI, EXTENSION_CUSTOM_COMPONENTS, updateExtCfg, toast, whkReqs, whkApiKey, setWhkApiKey, whkLoading, createWebhookToken, refreshWebhook, loadWebhookLocal } = props;
          // Lista de extensiones que ya tienen implementación hardcoded arriba
          const hardcodedTabs = ['chepy', 'sensitive', 'intruder'];

          // Check if current tab matches an extension name (excluding hardcoded ones)
          const activeExt = extensions.extensions.find(ext =>
            ext.enabled &&
            ext.tabs &&
            ext.tabs.length > 0 &&
            tab === ext.name &&
            !hardcodedTabs.includes(ext.name)
          );

          if (!activeExt) return null;

          // Determine which UI component to use (same priority as Extensions tab)
          let uiComponent = null;

          // 1. Si tiene custom_ui_file → usar DynamicExtensionUI (carga desde .ui.jsx)
          if (activeExt.custom_ui_file) {
            uiComponent = React.createElement(DynamicExtensionUI, {
              ext: activeExt,
              updateExtCfg,
              toast,
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
          else if (activeExt.ui_schema?.type === 'schema-driven') {
            uiComponent = React.createElement(SchemaBasedUI, { ext: activeExt, updateExtCfg });
          }
          // 3. Si está en registry de componentes custom → usar componente custom
          else if (EXTENSION_CUSTOM_COMPONENTS[activeExt.name]) {
            uiComponent = React.createElement(EXTENSION_CUSTOM_COMPONENTS[activeExt.name], {
              ext: activeExt,
              updateExtCfg,
              ...(activeExt.name === 'webhook_site' ? {
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
          else {
            uiComponent = (
              <div style={{ marginTop: '12px', padding: '12px', fontSize: '11px', color: 'var(--txt3)' }}>
                Extension enabled (no UI configured)
              </div>
            );
          }

          return (
            <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', padding: '20px' }}>
              {uiComponent}
            </div>
          );
}
