const { useState, useCallback } = React;
import { scopeService } from '../services/scopeService.js';

/**
 * Custom hook for scope rules management
 * @param {Function} toast - Toast notification function
 * @returns {Object} Scope state and methods
 */
export function useScope(toast) {
  const [rules, setRules] = useState([]);
  const [newPattern, setNewPattern] = useState('');
  const [newType, setNewType] = useState('include');
  const [loading, setLoading] = useState(false);

  // Load scope rules
  const loadRules = useCallback(async () => {
    try {
      const data = await scopeService.list();
      setRules(Array.isArray(data) ? data : (data.rules || []));
    } catch (err) {
      console.error('Failed to load scope rules:', err);
    }
  }, []);

  // Add new rule
  const addRule = useCallback(async (pattern = null, type = null) => {
    const pat = pattern !== null ? pattern : newPattern;
    const ruleType = type !== null ? type : newType;

    if (!pat.trim()) {
      toast('Pattern required', 'error');
      return false;
    }

    setLoading(true);
    try {
      await scopeService.addRule(pat, ruleType, true);
      if (pattern === null) {
        setNewPattern('');
        setNewType('include');
      }
      await loadRules();
      toast('Rule added', 'success');
      return true;
    } catch (err) {
      toast('Failed to add rule', 'error');
      return false;
    } finally {
      setLoading(false);
    }
  }, [newPattern, newType, toast, loadRules]);

  // Delete rule
  const deleteRule = useCallback(async (id) => {
    setLoading(true);
    try {
      await scopeService.deleteRule(id);
      await loadRules();
      toast('Rule deleted', 'success');
      return true;
    } catch (err) {
      toast('Failed to delete rule', 'error');
      return false;
    } finally {
      setLoading(false);
    }
  }, [toast, loadRules]);

  // Toggle rule enabled/disabled
  const toggleRule = useCallback(async (id) => {
    setLoading(true);
    try {
      await scopeService.toggleRule(id);
      await loadRules();
      return true;
    } catch (err) {
      toast('Failed to toggle rule', 'error');
      return false;
    } finally {
      setLoading(false);
    }
  }, [toast, loadRules]);

  return {
    rules,
    setRules, // Allow direct state setting
    newPattern,
    setNewPattern,
    newType,
    setNewType,
    loading,
    loadRules,
    addRule,
    deleteRule,
    toggleRule
  };
}
