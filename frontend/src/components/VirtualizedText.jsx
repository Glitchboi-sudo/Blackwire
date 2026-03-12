/**
 * VirtualizedText - Component for efficiently rendering very large text
 * Only renders visible lines to prevent DOM overload
 */

const { useState, useEffect, useRef, useCallback } = React;

/**
 * VirtualizedText component for large text content
 * @param {Object} props
 * @param {string} props.content - Text content to render
 * @param {number} props.lineHeight - Height of each line in pixels (default: 20)
 * @param {number} props.containerHeight - Height of container in pixels (default: 400)
 * @param {Function} props.renderLine - Optional custom line renderer
 * @param {string} props.className - Additional CSS class
 */
export function VirtualizedText({
  content,
  lineHeight = 20,
  containerHeight = 400,
  renderLine,
  className = ''
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: containerHeight });

  // Split content into lines
  const lines = content ? content.split('\n') : [];
  const totalLines = lines.length;
  const totalHeight = totalLines * lineHeight;

  // Calculate visible range with buffer
  const bufferLines = 10; // Render extra lines above and below for smooth scrolling
  const visibleLines = Math.ceil(dimensions.height / lineHeight);
  const startLine = Math.max(0, Math.floor(scrollTop / lineHeight) - bufferLines);
  const endLine = Math.min(totalLines, startLine + visibleLines + bufferLines * 2);

  // Get visible lines
  const visibleContent = lines.slice(startLine, endLine);

  // Handle scroll
  const handleScroll = useCallback((e) => {
    setScrollTop(e.target.scrollTop);
  }, []);

  // Update dimensions on mount and resize
  useEffect(() => {
    if (containerRef.current) {
      const updateDimensions = () => {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width, height: rect.height });
      };

      updateDimensions();
      window.addEventListener('resize', updateDimensions);
      return () => window.removeEventListener('resize', updateDimensions);
    }
  }, []);

  // Default line renderer
  const defaultRenderLine = (line, index) => {
    return React.createElement('div', {
      key: startLine + index,
      style: {
        height: `${lineHeight}px`,
        lineHeight: `${lineHeight}px`,
        whiteSpace: 'pre',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        fontFamily: 'monospace',
        fontSize: '13px',
        padding: '0 8px'
      }
    }, line);
  };

  const lineRenderer = renderLine || defaultRenderLine;

  return React.createElement('div', {
    ref: containerRef,
    className: `virtualized-text ${className}`,
    onScroll: handleScroll,
    style: {
      height: `${containerHeight}px`,
      overflow: 'auto',
      position: 'relative',
      border: '1px solid var(--border, #444)',
      background: 'var(--bg, #1a1a1a)',
      borderRadius: '4px'
    }
  },
    // Spacer for total height
    React.createElement('div', {
      style: {
        height: `${totalHeight}px`,
        position: 'relative'
      }
    },
      // Visible content container
      React.createElement('div', {
        style: {
          position: 'absolute',
          top: `${startLine * lineHeight}px`,
          left: 0,
          right: 0
        }
      },
        visibleContent.map((line, index) => lineRenderer(line, index))
      )
    ),

    // Scrollbar info (optional)
    totalLines > visibleLines && React.createElement('div', {
      style: {
        position: 'absolute',
        top: '4px',
        right: '24px',
        padding: '2px 6px',
        background: 'rgba(0,0,0,0.7)',
        borderRadius: '3px',
        fontSize: '11px',
        color: '#aaa',
        pointerEvents: 'none'
      }
    }, `${totalLines.toLocaleString()} lines`)
  );
}
