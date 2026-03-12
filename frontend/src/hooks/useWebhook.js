const { useState, useCallback } = React;
import { webhookService } from '../services/webhookService.js';

/**
 * Custom hook for Webhook.site integration
 * @param {Function} toast - Toast notification function
 * @returns {Object} Webhook state and methods
 */
export function useWebhook(toast) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedReq, setSelectedReq] = useState(null);
  const [search, setSearch] = useState('');
  const [detTab, setDetTab] = useState('request');
  const [apiKey, setApiKey] = useState('');

  // Load webhook requests
  const loadRequests = useCallback(async (tokenId = null) => {
    setLoading(true);
    try {
      const data = await webhookService.getRequests(tokenId);
      const newRequests = Array.isArray(data) ? data : (data.requests || []);
      setRequests(newRequests);

      // Preserve selected request after refresh
      setSelectedReq(currentSelected => {
        if (!currentSelected) return null;

        // Find the same request in the new list by ID
        const updated = newRequests.find(r => r.request_id === currentSelected.request_id);
        return updated || currentSelected; // Keep old if not found
      });
    } catch (err) {
      console.error('Failed to load webhook requests:', err);
      toast('Failed to load webhook requests', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Refresh webhook requests
  const refresh = useCallback(async (tokenId = null, silent = false) => {
    await loadRequests(tokenId);
    if (!silent) {
      toast('Requests refreshed', 'success');
    }
  }, [loadRequests, toast]);

  // Create new webhook token
  const createToken = useCallback(async () => {
    setLoading(true);
    try {
      const r = await webhookService.createToken(apiKey);
      if (r.token) {
        toast('Token created: ' + r.token, 'success');
        return r.token;
      } else {
        toast('Failed to create token', 'error');
        return null;
      }
    } catch (err) {
      toast('Failed to create token', 'error');
      return null;
    } finally {
      setLoading(false);
    }
  }, [apiKey, toast]);

  // Clear webhook history
  const clearHistory = useCallback(async (tokenId) => {
    setLoading(true);
    try {
      await webhookService.clearHistory(tokenId);
      setRequests([]);
      setSelectedReq(null);
      toast('History cleared', 'success');
      return true;
    } catch (err) {
      toast('Failed to clear history', 'error');
      return false;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Send request to repeater
  const toRepeater = useCallback(async (request) => {
    toast('Sent to Repeater', 'success');
    return true;
  }, [toast]);

  return {
    requests,
    loading,
    selectedReq,
    setSelectedReq,
    search,
    setSearch,
    detTab,
    setDetTab,
    apiKey,
    setApiKey,
    loadRequests,
    refresh,
    createToken,
    clearHistory,
    toRepeater
  };
}
