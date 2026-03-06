import api from '../utils/api.js';

export const webhookService = {
  /**
   * Get webhook.site requests
   */
  async getRequests(limit = 200) {
    return await api.get(`/api/webhooksite/requests?limit=${limit}`);
  },

  /**
   * Refresh from webhook.site
   */
  async refresh(limit = 50) {
    return await api.post('/api/webhooksite/refresh', { limit });
  },

  /**
   * Create a new webhook token
   */
  async createToken() {
    return await api.post('/api/webhooksite/token');
  },

  /**
   * Clear webhook history
   */
  async clearHistory() {
    return await api.del('/api/webhooksite/requests');
  }
};
