const { useState, useCallback } = React;
import { interceptService } from '../services/interceptService.js';

/**
 * Custom hook for intercept control
 * @param {Function} toast - Toast notification function
 * @returns {Object} Intercept state and methods
 */
export function useIntercept(toast) {
  const [intOn, setIntOn] = useState(false);
  const [pending, setPending] = useState([]);
  const [selPend, setSelPend] = useState(null);
  const [editReq, setEditReq] = useState('');
  const [editingRequest, setEditingRequest] = useState(null);
  const [loading, setLoading] = useState(false);

  // Load intercept status and pending requests
  const loadStatus = useCallback(async () => {
    try {
      const status = await interceptService.getStatus();
      setIntOn(status.enabled || false);
      setPending(status.pending_requests || []);
    } catch (err) {
      console.error('Failed to load intercept status:', err);
    }
  }, []);

  // Toggle intercept on/off
  const toggle = useCallback(async () => {
    setLoading(true);
    try {
      const r = await interceptService.toggle();
      setIntOn(r.enabled);
      toast(r.enabled ? 'Intercept enabled' : 'Intercept disabled', 'success');
      return true;
    } catch (err) {
      toast('Failed to toggle intercept', 'error');
      return false;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Forward a single request
  const forward = useCallback(async (id, modifiedRequest = null) => {
    setLoading(true);
    try {
      await interceptService.forward(id, modifiedRequest);
      await loadStatus();
      toast('Request forwarded', 'success');
      setSelPend(null);
      setEditReq('');
      return true;
    } catch (err) {
      toast('Failed to forward request', 'error');
      return false;
    } finally {
      setLoading(false);
    }
  }, [toast, loadStatus]);

  // Drop a single request
  const drop = useCallback(async (id) => {
    setLoading(true);
    try {
      await interceptService.drop(id);
      await loadStatus();
      toast('Request dropped', 'success');
      setSelPend(null);
      setEditReq('');
      return true;
    } catch (err) {
      toast('Failed to drop request', 'error');
      return false;
    } finally {
      setLoading(false);
    }
  }, [toast, loadStatus]);

  // Forward all pending requests
  const forwardAll = useCallback(async () => {
    setLoading(true);
    try {
      await interceptService.forwardAll();
      await loadStatus();
      toast('All requests forwarded', 'success');
      return true;
    } catch (err) {
      toast('Failed to forward all requests', 'error');
      return false;
    } finally {
      setLoading(false);
    }
  }, [toast, loadStatus]);

  // Drop all pending requests
  const dropAll = useCallback(async () => {
    setLoading(true);
    try {
      await interceptService.dropAll();
      await loadStatus();
      toast('All requests dropped', 'success');
      return true;
    } catch (err) {
      toast('Failed to drop all requests', 'error');
      return false;
    } finally {
      setLoading(false);
    }
  }, [toast, loadStatus]);

  return {
    intOn,
    isEnabled: intOn, // Alias for compatibility
    setEnabled: setIntOn, // Allow direct state setting
    pending,
    setPending, // Allow direct state setting
    selPend,
    setSelPend,
    editReq,
    setEditReq,
    editingRequest,
    setEditingRequest,
    loading,
    loadStatus,
    toggle,
    forward,
    drop,
    forwardAll,
    dropAll
  };
}
