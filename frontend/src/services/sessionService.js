import api from '../utils/api.js';

export const sessionService = {
  /**
   * List all session extraction rules
   */
  async list() {
    return await api.get('/api/session/rules');
  },

  /**
   * Add a new session rule
   */
  async addRule(rule) {
    return await api.post('/api/session/rules', rule);
  },

  /**
   * Delete a session rule
   */
  async deleteRule(id) {
    return await api.del(`/api/session/rules/${id}`);
  },

  /**
   * Toggle rule enabled/disabled
   */
  async toggleRule(id, enabled) {
    return await api.put(`/api/session/rules/${id}`, { enabled });
  }
};
