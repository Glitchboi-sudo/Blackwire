const { useState, useCallback } = React;
import { gitService } from '../services/gitService.js';

/**
 * Custom hook for Git operations
 * @param {Function} toast - Toast notification function
 * @returns {Object} Git state and methods
 */
export function useGit(toast) {
  const [commits, setCommits] = useState([]);
  const [commitMessage, setCommitMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Load commit history
  const loadHistory = useCallback(async () => {
    try {
      const history = await gitService.getHistory();
      setCommits(history);
    } catch (err) {
      console.error('Failed to load git history:', err);
    }
  }, []);

  // Create commit
  const createCommit = useCallback(async (message = null) => {
    const msg = message || commitMessage;
    if (!msg.trim()) {
      toast('Commit message required', 'error');
      return false;
    }

    setLoading(true);
    try {
      const r = await gitService.commit(msg);
      if (r.status === 'committed') {
        toast('Committed', 'success');
        setCommitMessage('');
        await loadHistory();
        return true;
      } else {
        toast('Commit failed: ' + (r.detail || 'unknown'), 'error');
        return false;
      }
    } catch (err) {
      toast('Commit failed', 'error');
      return false;
    } finally {
      setLoading(false);
    }
  }, [commitMessage, toast, loadHistory]);

  // Auto-commit (used with Ctrl+S)
  const autoCommit = useCallback(async () => {
    const msg = `Auto-save: ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`;
    return await createCommit(msg);
  }, [createCommit]);

  return {
    commits,
    commitMessage,
    setCommitMessage,
    loading,
    loadHistory,
    createCommit,
    autoCommit
  };
}
