import api from '../utils/api.js';

export const intruderService = {
  /**
   * List all saved attacks
   */
  async listAttacks() {
    return await api.get('/api/intruder/attacks');
  },

  /**
   * Save an attack configuration
   */
  async saveAttack(name, config, results = [], total = 0) {
    return await api.post('/api/intruder/attacks', {
      name,
      config,
      results,
      total
    });
  },

  /**
   * Load an attack configuration
   */
  async loadAttack(id) {
    return await api.get(`/api/intruder/attacks/${id}`);
  },

  /**
   * Update/rename an attack
   */
  async updateAttack(id, name = null, config = null, results = null) {
    const data = {};
    if (name !== null) data.name = name;
    if (config !== null) data.config = config;
    if (results !== null) data.results = results;
    return await api.put(`/api/intruder/attacks/${id}`, data);
  },

  /**
   * Delete an attack
   */
  async deleteAttack(id) {
    return await api.del(`/api/intruder/attacks/${id}`);
  }
};
