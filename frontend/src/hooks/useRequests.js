const { useState, useCallback } = React;
import { requestService } from '../services/requestService.js';

/**
 * Custom hook for HTTP history with filters
 * @param {Function} toast - Toast notification function
 * @returns {Object} Requests state and methods
 */
export function useRequests(toast) {
  const [requests, setRequests] = useState([]);
  const [selectedReq, setSelectedReq] = useState(null);
  const [selectedReqFull, setSelectedReqFull] = useState(null);
  const [search, setSearch] = useState('');
  const [savedOnly, setSavedOnly] = useState(false);
  const [scopeOnly, setScopeOnly] = useState(false);
  const [totalRequests, setTotalRequests] = useState(0);
  const [httpqlError, setHttpqlError] = useState('');
  const [detTab, setDetTab] = useState('request');
  const [loading, setLoading] = useState(false);

  // Load requests with pagination and filters
  const loadRequests = useCallback(async (page = 1, pageSize = 50) => {
    setLoading(true);
    setHttpqlError('');
    try {
      const data = await requestService.search(
        search,
        page,
        pageSize,
        savedOnly,
        scopeOnly,
        null // ast parameter
      );
      setRequests(Array.isArray(data.requests) ? data.requests : []);
      setTotalRequests(data.total || 0);
      return data;
    } catch (err) {
      console.error('Failed to load requests:', err);
      if (err.message && err.message.includes('httpql')) {
        setHttpqlError(err.message);
      }
      toast('Failed to load requests', 'error');
      return { requests: [], total: 0 };
    } finally {
      setLoading(false);
    }
  }, [search, savedOnly, scopeOnly, toast]);

  // Toggle saved flag
  const toggleSave = useCallback(async (reqId) => {
    setLoading(true);
    try {
      await requestService.toggleSave(reqId);
      // Update local state
      setRequests(prev => prev.map(r =>
        r.id === reqId ? { ...r, saved: !r.saved } : r
      ));
      toast('Bookmark toggled', 'success');
      return true;
    } catch (err) {
      toast('Failed to toggle bookmark', 'error');
      return false;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Delete request
  const deleteReq = useCallback(async (reqId) => {
    setLoading(true);
    try {
      await requestService.delete(reqId);
      setRequests(prev => prev.filter(r => r.id !== reqId));
      if (selectedReq?.id === reqId) {
        setSelectedReq(null);
        setSelectedReqFull(null);
      }
      toast('Request deleted', 'success');
      return true;
    } catch (err) {
      toast('Failed to delete request', 'error');
      return false;
    } finally {
      setLoading(false);
    }
  }, [selectedReq, toast]);

  // Clear history
  const clearHistory = useCallback(async () => {
    setLoading(true);
    try {
      await requestService.clearAll();
      setRequests([]);
      setSelectedReq(null);
      setSelectedReqFull(null);
      setTotalRequests(0);
      toast('History cleared', 'success');
      return true;
    } catch (err) {
      toast('Failed to clear history', 'error');
      return false;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Select request and load full details
  const selectRequest = useCallback(async (req) => {
    setSelectedReq(req);
    if (req) {
      try {
        const full = await requestService.getById(req.id);
        setSelectedReqFull(full);
      } catch (err) {
        console.error('Failed to load full request:', err);
      }
    } else {
      setSelectedReqFull(null);
    }
  }, []);

  // Add new request to the list (for WebSocket updates)
  const addRequest = useCallback((newReq) => {
    setRequests(prev => [newReq, ...prev]);
    setTotalRequests(prev => prev + 1);
  }, []);

  return {
    requests,
    selectedReq,
    selectedReqFull,
    search,
    setSearch,
    savedOnly,
    setSavedOnly,
    scopeOnly,
    setScopeOnly,
    totalRequests,
    httpqlError,
    detTab,
    setDetTab,
    loading,
    loadRequests,
    toggleSave,
    deleteReq,
    clearHistory,
    selectRequest,
    addRequest
  };
}
