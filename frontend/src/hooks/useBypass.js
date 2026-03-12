/**
 * Hook for managing proxy bypass rules
 */

const { useState, useCallback } = React;
import { bypassService } from '../services/bypassService.js';

export function useBypass(toast) {
  const [rules, setRules] = useState([]);
  const [presets, setPresets] = useState({});
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  /**
   * Load all bypass rules
   */
  const loadRules = useCallback(async () => {
    setLoading(true);
    try {
      const data = await bypassService.getRules();
      setRules(data.rules || []);
      return data.rules;
    } catch (err) {
      console.error('Failed to load bypass rules:', err);
      toast && toast('Failed to load bypass rules', 'error');
      return [];
    } finally {
      setLoading(false);
    }
  }, [toast]);

  /**
   * Load presets
   */
  const loadPresets = useCallback(async () => {
    try {
      const data = await bypassService.getPresets();
      setPresets(data.presets || {});
      return data.presets;
    } catch (err) {
      console.error('Failed to load presets:', err);
      return {};
    }
  }, []);

  /**
   * Load bypass status
   */
  const loadStatus = useCallback(async () => {
    try {
      const data = await bypassService.getStatus();
      setStatus(data);
      return data;
    } catch (err) {
      console.error('Failed to load bypass status:', err);
      return null;
    }
  }, []);

  /**
   * Create a new bypass rule
   */
  const createRule = useCallback(async (ruleData) => {
    setLoading(true);
    try {
      const result = await bypassService.createRule(ruleData);
      toast && toast(result.message || 'Bypass rule created', 'success');
      await loadRules();
      await loadStatus();
      return result;
    } catch (err) {
      console.error('Failed to create bypass rule:', err);
      toast && toast(err.message || 'Failed to create bypass rule', 'error');
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast, loadRules, loadStatus]);

  /**
   * Update a bypass rule
   */
  const updateRule = useCallback(async (id, updates) => {
    setLoading(true);
    try {
      const result = await bypassService.updateRule(id, updates);
      toast && toast(result.message || 'Bypass rule updated', 'success');
      await loadRules();
      await loadStatus();
      return result;
    } catch (err) {
      console.error('Failed to update bypass rule:', err);
      toast && toast(err.message || 'Failed to update bypass rule', 'error');
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast, loadRules, loadStatus]);

  /**
   * Delete a bypass rule
   */
  const deleteRule = useCallback(async (id) => {
    setLoading(true);
    try {
      const result = await bypassService.deleteRule(id);
      toast && toast(result.message || 'Bypass rule deleted', 'success');
      await loadRules();
      await loadStatus();
      return result;
    } catch (err) {
      console.error('Failed to delete bypass rule:', err);
      toast && toast('Failed to delete bypass rule', 'error');
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast, loadRules, loadStatus]);

  /**
   * Toggle a bypass rule
   */
  const toggleRule = useCallback(async (id) => {
    try {
      const result = await bypassService.toggleRule(id);
      toast && toast(result.message || 'Bypass rule toggled', 'success');
      await loadRules();
      await loadStatus();
      return result;
    } catch (err) {
      console.error('Failed to toggle bypass rule:', err);
      toast && toast('Failed to toggle bypass rule', 'error');
      return null;
    }
  }, [toast, loadRules, loadStatus]);

  /**
   * Apply a preset
   */
  const applyPreset = useCallback(async (presetName) => {
    setLoading(true);
    try {
      const result = await bypassService.applyPreset(presetName);
      toast && toast(result.message || `Preset '${presetName}' applied`, 'success');
      await loadRules();
      await loadStatus();
      return result;
    } catch (err) {
      console.error('Failed to apply preset:', err);
      toast && toast('Failed to apply preset', 'error');
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast, loadRules, loadStatus]);

  return {
    rules,
    presets,
    status,
    loading,
    loadRules,
    loadPresets,
    loadStatus,
    createRule,
    updateRule,
    deleteRule,
    toggleRule,
    applyPreset
  };
}
