/**
 * LazyContent - Component for lazy loading large content
 * Prevents browser freeze by loading content on demand
 */

const { useState, useEffect } = React;

/**
 * LazyContent component that loads large content on demand
 * @param {Object} props
 * @param {string} props.preview - Preview/truncated content to show initially
 * @param {boolean} props.isTruncated - Whether content is truncated
 * @param {number} props.size - Size of full content in bytes
 * @param {Function} props.onLoadFull - Async function to load full content
 * @param {string} props.type - Content type (request/response)
 * @param {Function} props.children - Render function that receives content
 */
export function LazyContent({ preview, isTruncated, size, onLoadFull, type, children }) {
  const [content, setContent] = useState(preview || '');
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Reset when preview changes (different request selected)
    setContent(preview || '');
    setIsExpanded(false);
    setError(null);
  }, [preview]);

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const handleLoadFull = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const fullContent = await onLoadFull();
      setContent(fullContent);
      setIsExpanded(true);
    } catch (err) {
      console.error('Failed to load full content:', err);
      setError('Failed to load full content. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCollapse = () => {
    setContent(preview || '');
    setIsExpanded(false);
  };

  return React.createElement('div', { className: 'lazy-content' },
    // Show load banner if content is truncated
    isTruncated && !isExpanded && React.createElement('div', {
      className: 'lazy-content-banner',
      style: {
        padding: '12px',
        margin: '8px 0',
        background: 'var(--accent-bg, #2a2a2a)',
        border: '1px solid var(--border, #444)',
        borderRadius: '4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px'
      }
    },
      React.createElement('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '13px',
          color: 'var(--text-muted, #888)'
        }
      },
        React.createElement('span', {
          style: { fontSize: '16px' }
        }, '📄'),
        React.createElement('span', null,
          `Content truncated for preview (${formatSize(size)} total)`
        )
      ),
      React.createElement('button', {
        onClick: handleLoadFull,
        disabled: isLoading,
        style: {
          padding: '6px 12px',
          background: 'var(--primary, #4a9eff)',
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          cursor: isLoading ? 'wait' : 'pointer',
          fontSize: '12px',
          fontWeight: '500',
          opacity: isLoading ? 0.7 : 1
        }
      }, isLoading ? 'Loading...' : 'Load Full Content')
    ),

    // Show collapse button if expanded
    isExpanded && React.createElement('div', {
      className: 'lazy-content-banner',
      style: {
        padding: '8px 12px',
        margin: '8px 0',
        background: 'var(--success-bg, #1a3a1a)',
        border: '1px solid var(--success, #4a9)',
        borderRadius: '4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '12px'
      }
    },
      React.createElement('span', {
        style: { color: 'var(--success, #4a9)' }
      }, `✓ Full content loaded (${formatSize(size)})`),
      React.createElement('button', {
        onClick: handleCollapse,
        style: {
          padding: '4px 8px',
          background: 'transparent',
          color: 'var(--text-muted, #888)',
          border: '1px solid var(--border, #444)',
          borderRadius: '3px',
          cursor: 'pointer',
          fontSize: '11px'
        }
      }, 'Collapse')
    ),

    // Show error if any
    error && React.createElement('div', {
      style: {
        padding: '12px',
        margin: '8px 0',
        background: 'var(--error-bg, #3a1a1a)',
        border: '1px solid var(--error, #a44)',
        borderRadius: '4px',
        color: 'var(--error, #a44)',
        fontSize: '13px'
      }
    }, error),

    // Render content
    children(content, isExpanded)
  );
}
