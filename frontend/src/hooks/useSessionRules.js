const { useState, useCallback } = React;
import { sessionService } from '../services/sessionService.js';

/**
 * Custom hook for session variable extraction rules
 * @param {Function} toast - Toast notification function
 * @returns {Object} Session rules state and methods
 */
export function useSessionRules(toast) {
  const [sessionRules, setSessionRules] = useState([]);
  const [newRule, setNewRule] = useState({ name: '', pattern: '', type: 'regex', enabled: true });
  const [loading, setLoading] = useState(false);

  // Load session rules
  const loadRules = useCallback(async () => {
    try {
      const data = await sessionService.list();
      setSessionRules(Array.isArray(data) ? data : (data.rules || []));
    } catch (err) {
      console.error('Failed to load session rules:', err);
    }
  }, []);

  // Add new rule
  const addRule = useCallback(async (name, pattern, type = 'regex', enabled = true) => {
    const ruleName = name || newRule.name;
    const rulePattern = pattern || newRule.pattern;

    if (!ruleName.trim() || !rulePattern.trim()) {
      toast('Name and pattern required', 'error');
      return false;
    }

    setLoading(true);
    try {
      await sessionService.addRule(ruleName, rulePattern, type || newRule.type, enabled);
      setNewRule({ name: '', pattern: '', type: 'regex', enabled: true });
      await loadRules();
      toast('Session rule added', 'success');
      return true;
    } catch (err) {
      toast('Failed to add session rule', 'error');
      return false;
    } finally {
      setLoading(false);
    }
  }, [newRule, toast, loadRules]);

  // Delete rule
  const deleteRule = useCallback(async (id) => {
    setLoading(true);
    try {
      await sessionService.deleteRule(id);
      await loadRules();
      toast('Session rule deleted', 'success');
      return true;
    } catch (err) {
      toast('Failed to delete session rule', 'error');
      return false;
    } finally {
      setLoading(false);
    }
  }, [toast, loadRules]);

  // Toggle rule enabled/disabled
  const toggleRule = useCallback(async (id) => {
    setLoading(true);
    try {
      await sessionService.toggleRule(id);
      await loadRules();
      return true;
    } catch (err) {
      toast('Failed to toggle session rule', 'error');
      return false;
    } finally {
      setLoading(false);
    }
  }, [toast, loadRules]);

  return {
    sessionRules,
    setSessionRules, // Allow direct state setting
    newRule,
    setNewRule,
    loading,
    loadRules,
    addRule,
    deleteRule,
    toggleRule
  };
}
