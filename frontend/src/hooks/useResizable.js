const { useState, useCallback } = React;

/**
 * Custom hook for resizable panels
 * @param {number} initialSize - Initial size (px or %)
 * @param {number} minSize - Minimum size (default: 100)
 * @param {number} maxSize - Maximum size (default: Infinity)
 * @returns {Object} Size state and resize handler
 */
export function useResizable(initialSize, minSize = 100, maxSize = Infinity) {
  const [size, setSize] = useState(initialSize);

  const handleResize = useCallback((delta) => {
    setSize(prevSize => {
      const newSize = prevSize + delta;
      return Math.max(minSize, Math.min(maxSize, newSize));
    });
  }, [minSize, maxSize]);

  const resetSize = useCallback(() => {
    setSize(initialSize);
  }, [initialSize]);

  return {
    size,
    setSize,
    handleResize,
    resetSize
  };
}
