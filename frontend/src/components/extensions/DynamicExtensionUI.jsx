// DynamicExtensionUI — UI de extensión (extraído de App.jsx).
import { extensionService } from '../../services/extensionService.js';

export function DynamicExtensionUI({ ext, updateExtCfg, toast, ...otherProps }) {
  const [component, setComponent] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    const loadUI = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch del archivo .ui.js compilado
        const uiCode = await extensionService.getUI(ext.name);

        // Inicializar namespace global si no existe
        if (!window.BlackwireExtensions) {
          window.BlackwireExtensions = {};
        }

        // Ejecutar el código del componente
        // El código debe registrar una función en window.BlackwireExtensions[ext.name]
        eval(uiCode);

        // Verificar que se registró correctamente
        if (typeof window.BlackwireExtensions[ext.name] !== 'function') {
          throw new Error('Extension UI did not register properly. Must define window.BlackwireExtensions["' + ext.name + '"]');
        }

        // Obtener el componente
        const ComponentFunc = window.BlackwireExtensions[ext.name];
        setComponent(() => ComponentFunc);
        setLoading(false);
      } catch (err) {
        console.error('Error loading dynamic extension UI:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    loadUI();
  }, [ext.name]);

  if (loading) {
    return (
      <div style={{ padding: '20px', color: 'var(--txt3)', fontSize: '11px' }}>
        Loading custom UI...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px', color: 'var(--red)', fontSize: '11px' }}>
        Error loading custom UI: {error}
      </div>
    );
  }

  if (!component) {
    return (
      <div style={{ padding: '20px', color: 'var(--txt3)', fontSize: '11px' }}>
        No custom UI available
      </div>
    );
  }

  // Renderizar el componente dinámico con todas las props
  return React.createElement(component, { ext, updateExtCfg, toast, ...otherProps });
}
