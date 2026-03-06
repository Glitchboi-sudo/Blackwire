import api from '../utils/api.js';

export const interceptService = {
  /**
   * Get intercept status and pending requests
   */
  async getStatus() {
    return await api.get('/api/intercept/status');
  },

  /**
   * Toggle intercept on/off
   */
  async toggle() {
    return await api.post('/api/intercept/toggle');
  },

  /**
   * Forward a pending request (optionally modified)
   */
  async forward(id, modifiedRequest = null) {
    return await api.post(`/api/intercept/${id}/forward`, modifiedRequest ? { request: modifiedRequest } : {});
  },

  /**
   * Drop a pending request
   */
  async drop(id) {
    return await api.post(`/api/intercept/${id}/drop`);
  },

  /**
   * Forward all pending requests
   */
  async forwardAll() {
    return await api.post('/api/intercept/forward-all');
  },

  /**
   * Drop all pending requests
   */
  async dropAll() {
    return await api.post('/api/intercept/drop-all');
  }
};
