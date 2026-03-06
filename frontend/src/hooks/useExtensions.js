const { useState, useCallback } = React;
import { extensionService } from '../services/extensionService.js';

/**
 * Custom hook for extension management
 * @param {Function} toast - Toast notification function
 * @returns {Object} Extensions state and methods
 */
export function useExtensions(toast) {
  const [extensions, setExtensions] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load extensions
  const loadExtensions = useCallback(async () => {
    try {
      const data = await extensionService.list();
      setExtensions(Array.isArray(data) ? data : (data.extensions || []));
    } catch (err) {
      console.error('Failed to load extensions:', err);
    }
  }, []);

  // Toggle extension enabled/disabled
  const toggleEnabled = useCallback(async (extensionId) => {
    setLoading(true);
    try {
      await extensionService.toggleEnabled(extensionId);
      await loadExtensions();
      toast('Extension toggled', 'success');
      return true;
    } catch (err) {
      toast('Failed to toggle extension', 'error');
      return false;
    } finally {
      setLoading(false);
    }
  }, [toast, loadExtensions]);

  // Update extension configuration
  const updateConfig = useCallback(async (extensionId, config) => {
    setLoading(true);
    try {
      await extensionService.updateConfig(extensionId, config);
      await loadExtensions();
      toast('Extension config updated', 'success');
      return true;
    } catch (err) {
      toast('Failed to update extension config', 'error');
      return false;
    } finally {
      setLoading(false);
    }
  }, [toast, loadExtensions]);

  return {
    extensions,
    loading,
    loadExtensions,
    toggleEnabled,
    updateConfig
  };
}
