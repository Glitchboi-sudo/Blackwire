import api from '../utils/api.js';

export const gitService = {
  /**
   * Get git commit history
   */
  async getHistory() {
    return await api.get('/api/git/history');
  },

  /**
   * Create a new commit
   */
  async commit(message) {
    return await api.post('/api/git/commit', { message });
  }
};
