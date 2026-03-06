import api from '../utils/api.js';

export const chepyService = {
  /**
   * Get list of available cipher operations
   */
  async getOperations() {
    return await api.get('/api/chepy/operations');
  },

  /**
   * Execute cipher operations pipeline
   */
  async bake(input, operations) {
    return await api.post('/api/chepy/bake', { input, operations });
  }
};
