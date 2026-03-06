import api from '../utils/api.js';

export const scopeService = {
  /**
   * List all scope rules
   */
  async list() {
    return await api.get('/api/scope');
  },

  /**
   * Add a new scope rule
   */
  async addRule(pattern, type, enabled = true) {
    return await api.post('/api/scope/rules', { pattern, type, enabled });
  },

  /**
   * Delete a scope rule
   */
  async deleteRule(id) {
    return await api.del(`/api/scope/rules/${id}`);
  },

  /**
   * Toggle rule enabled/disabled
   */
  async toggleRule(id) {
    return await api.put(`/api/scope/rules/${id}`);
  }
};
