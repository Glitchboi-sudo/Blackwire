/**
 * OptimizedRequestDetail - Ejemplo de componente optimizado para mostrar detalles de request
 * Usa LazyContent y VirtualizedText para prevenir congelamiento del navegador
 */

const { useState, useEffect } = React;
import { LazyContent } from './LazyContent.js';
import { VirtualizedText } from './VirtualizedText.js';
import { useLazyRequest } from '../hooks/useLazyRequest.js';

/**
 * Componente optimizado para mostrar detalles de request
 * @param {Object} props
 * @param {number} props.requestId - ID del request a mostrar
 * @param {Function} props.toast - Función para mostrar notificaciones
 */
export function OptimizedRequestDetail({ requestId, toast }) {
  const {
    requestDetail,
    loading,
    error,
    loadRequest,
    loadFullRequestBody,
    loadFullResponseBody
  } = useLazyRequest(toast);

  const [activeTab, setActiveTab] = useState('request');

  // Cargar request cuando cambia el ID
  useEffect(() => {
    if (requestId) {
      loadRequest(requestId);
    }
  }, [requestId, loadRequest]);

  if (!requestId) {
    return React.createElement('div', {
      style: {
        padding: '20px',
        textAlign: 'center',
        color: 'var(--text-muted, #888)'
      }
    }, 'Select a request to view details');
  }

  if (loading && !requestDetail) {
    return React.createElement('div', {
      style: {
        padding: '20px',
        textAlign: 'center'
      }
    }, 'Loading...');
  }

  if (error) {
    return React.createElement('div', {
      style: {
        padding: '20px',
        color: 'var(--error, #f44)',
        background: 'var(--error-bg, #3a1a1a)',
        border: '1px solid var(--error, #f44)',
        borderRadius: '4px',
        margin: '20px'
      }
    }, `Error: ${error}`);
  }

  if (!requestDetail) {
    return null;
  }

  // Helper para decidir si usar virtualización
  const shouldVirtualize = (content) => {
    if (!content) return false;
    const lineCount = content.split('\n').length;
    return lineCount > 1000; // Virtualizar si tiene más de 1000 líneas
  };

  // Renderizar body con LazyContent
  const renderBody = (body, isTruncated, size, loadFullFn) => {
    return React.createElement(LazyContent, {
      preview: body,
      isTruncated: isTruncated,
      size: size,
      onLoadFull: loadFullFn,
      type: 'request'
    }, (content, isExpanded) => {
      if (shouldVirtualize(content)) {
        return React.createElement(VirtualizedText, {
          content: content,
          lineHeight: 20,
          containerHeight: 500,
          className: 'request-body-virtualized'
        });
      }

      return React.createElement('pre', {
        style: {
          margin: 0,
          padding: '12px',
          background: 'var(--bg, #1a1a1a)',
          border: '1px solid var(--border, #444)',
          borderRadius: '4px',
          maxHeight: '500px',
          overflow: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          fontFamily: 'monospace',
          fontSize: '13px'
        }
      }, content || '(empty)');
    });
  };

  return React.createElement('div', {
    className: 'optimized-request-detail',
    style: {
      height: '100%',
      display: 'flex',
      flexDirection: 'column'
    }
  },
    // Header con información básica
    React.createElement('div', {
      style: {
        padding: '16px',
        borderBottom: '1px solid var(--border, #444)',
        background: 'var(--bg-secondary, #222)'
      }
    },
      React.createElement('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '8px'
        }
      },
        React.createElement('span', {
          style: {
            padding: '4px 8px',
            background: 'var(--primary, #4a9eff)',
            color: '#fff',
            borderRadius: '3px',
            fontSize: '12px',
            fontWeight: 'bold'
          }
        }, requestDetail.method),
        React.createElement('span', {
          style: {
            flex: 1,
            fontFamily: 'monospace',
            fontSize: '14px',
            color: 'var(--text, #eee)'
          }
        }, requestDetail.url),
        requestDetail.response_status && React.createElement('span', {
          style: {
            padding: '4px 8px',
            background: requestDetail.response_status < 300 ? 'var(--success, #4a9)' :
                       requestDetail.response_status < 400 ? 'var(--warning, #fa4)' :
                       'var(--error, #f44)',
            color: '#fff',
            borderRadius: '3px',
            fontSize: '12px',
            fontWeight: 'bold'
          }
        }, requestDetail.response_status)
      ),
      // Indicadores de tamaño
      requestDetail.is_large && React.createElement('div', {
        style: {
          fontSize: '11px',
          color: 'var(--warning, #fa4)',
          marginTop: '4px'
        }
      }, '⚠️ Large request/response - content will be loaded on demand')
    ),

    // Tabs
    React.createElement('div', {
      style: {
        display: 'flex',
        borderBottom: '1px solid var(--border, #444)',
        background: 'var(--bg-secondary, #222)'
      }
    },
      ['request', 'response'].map(tab =>
        React.createElement('button', {
          key: tab,
          onClick: () => setActiveTab(tab),
          style: {
            padding: '12px 20px',
            background: activeTab === tab ? 'var(--bg, #1a1a1a)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === tab ? '2px solid var(--primary, #4a9eff)' : '2px solid transparent',
            color: activeTab === tab ? 'var(--text, #eee)' : 'var(--text-muted, #888)',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: activeTab === tab ? '600' : '400',
            transition: 'all 0.2s'
          }
        }, tab.charAt(0).toUpperCase() + tab.slice(1))
      )
    ),

    // Content
    React.createElement('div', {
      style: {
        flex: 1,
        overflow: 'auto',
        padding: '16px'
      }
    },
      activeTab === 'request' ? React.createElement('div', null,
        // Headers
        React.createElement('h4', {
          style: {
            margin: '0 0 12px 0',
            fontSize: '13px',
            fontWeight: '600',
            color: 'var(--text, #eee)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }
        }, 'Headers'),
        React.createElement('pre', {
          style: {
            margin: '0 0 24px 0',
            padding: '12px',
            background: 'var(--bg, #1a1a1a)',
            border: '1px solid var(--border, #444)',
            borderRadius: '4px',
            maxHeight: '200px',
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            fontFamily: 'monospace',
            fontSize: '12px'
          }
        }, Object.entries(requestDetail.headers || {})
          .map(([k, v]) => `${k}: ${v}`)
          .join('\n') || '(no headers)'),

        // Body
        React.createElement('h4', {
          style: {
            margin: '0 0 12px 0',
            fontSize: '13px',
            fontWeight: '600',
            color: 'var(--text, #eee)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }
        }, 'Body'),
        renderBody(
          requestDetail.body,
          requestDetail.body_truncated,
          requestDetail.body_size,
          () => loadFullRequestBody(requestId)
        )
      ) : React.createElement('div', null,
        // Response Status
        React.createElement('h4', {
          style: {
            margin: '0 0 12px 0',
            fontSize: '13px',
            fontWeight: '600',
            color: 'var(--text, #eee)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }
        }, 'Status'),
        React.createElement('div', {
          style: {
            margin: '0 0 24px 0',
            padding: '8px 12px',
            background: 'var(--bg, #1a1a1a)',
            border: '1px solid var(--border, #444)',
            borderRadius: '4px',
            fontFamily: 'monospace',
            fontSize: '14px'
          }
        }, requestDetail.response_status || '(no response)'),

        // Response Headers
        React.createElement('h4', {
          style: {
            margin: '0 0 12px 0',
            fontSize: '13px',
            fontWeight: '600',
            color: 'var(--text, #eee)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }
        }, 'Headers'),
        React.createElement('pre', {
          style: {
            margin: '0 0 24px 0',
            padding: '12px',
            background: 'var(--bg, #1a1a1a)',
            border: '1px solid var(--border, #444)',
            borderRadius: '4px',
            maxHeight: '200px',
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            fontFamily: 'monospace',
            fontSize: '12px'
          }
        }, Object.entries(requestDetail.response_headers || {})
          .map(([k, v]) => `${k}: ${v}`)
          .join('\n') || '(no headers)'),

        // Response Body
        React.createElement('h4', {
          style: {
            margin: '0 0 12px 0',
            fontSize: '13px',
            fontWeight: '600',
            color: 'var(--text, #eee)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }
        }, 'Body'),
        renderBody(
          requestDetail.response_body,
          requestDetail.response_body_truncated,
          requestDetail.response_body_size,
          () => loadFullResponseBody(requestId)
        )
      )
    )
  );
}
