/**
 * Custom hook for lazy loading large request details
 * Prevents browser freeze by loading content on demand
 */

const { useState, useCallback, useEffect } = React;
import { requestService } from '../services/requestService.js';

/**
 * Hook for managing lazy-loaded request details
 * @param {Function} toast - Toast notification function
 * @returns {Object} Request state and methods
 */
export function useLazyRequest(toast) {
  const [requestDetail, setRequestDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Load request detail with optimization
   * @param {number} requestId - ID of request to load
   * @param {boolean} useLegacy - Use legacy endpoint (not recommended for large requests)
   */
  const loadRequest = useCallback(async (requestId, useLegacy = false) => {
    if (!requestId) {
      setRequestDetail(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const detail = useLegacy
        ? await requestService.getDetail(requestId)
        : await requestService.getDetailOptimized(requestId, false);

      setRequestDetail(detail);
      return detail;
    } catch (err) {
      console.error('Failed to load request detail:', err);
      setError(err.message || 'Failed to load request');
      toast && toast('Failed to load request detail', 'error');
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  /**
   * Load full request body (lazy)
   * @param {number} requestId
   */
  const loadFullRequestBody = useCallback(async (requestId) => {
    try {
      const data = await requestService.getRequestBody(requestId);
      return data.body;
    } catch (err) {
      console.error('Failed to load full request body:', err);
      toast && toast('Failed to load full request body', 'error');
      throw err;
    }
  }, [toast]);

  /**
   * Load full response body (lazy)
   * @param {number} requestId
   */
  const loadFullResponseBody = useCallback(async (requestId) => {
    try {
      const data = await requestService.getResponseBody(requestId);
      return data.response_body;
    } catch (err) {
      console.error('Failed to load full response body:', err);
      toast && toast('Failed to load full response body', 'error');
      throw err;
    }
  }, [toast]);

  /**
   * Get size information
   * @param {number} requestId
   */
  const getSizes = useCallback(async (requestId) => {
    try {
      return await requestService.getSizes(requestId);
    } catch (err) {
      console.error('Failed to get sizes:', err);
      return null;
    }
  }, []);

  /**
   * Clear current request
   */
  const clearRequest = useCallback(() => {
    setRequestDetail(null);
    setError(null);
  }, []);

  return {
    requestDetail,
    loading,
    error,
    loadRequest,
    loadFullRequestBody,
    loadFullResponseBody,
    getSizes,
    clearRequest
  };
}
