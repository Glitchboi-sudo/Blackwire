const { useState, useCallback } = React;

/**
 * Custom hook for API loading pattern with loading state and error handling
 * @param {Function} apiFunction - Async function to call
 * @param {any} initialData - Initial data value (default: null)
 * @returns {Object} Data, loading state, error, and load function
 */
export function useAPILoad(apiFunction, initialData = null) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async (...args) => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFunction(...args);
      setData(result);
      return result;
    } catch (err) {
      setError(err);
      console.error('API load error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiFunction]);

  const reset = useCallback(() => {
    setData(initialData);
    setError(null);
    setLoading(false);
  }, [initialData]);

  return {
    data,
    setData,
    loading,
    error,
    load,
    reset
  };
}
