import api from '../utils/api.js';

/**
 * Service for managing proxy bypass rules
 */
export const bypassService = {
  /**
   * Get all bypass rules
   */
  async getRules() {
    return await api.get('/api/bypass/rules');
  },

  /**
   * Create a new bypass rule
   * @param {Object} rule - { pattern, is_regex, description, enabled }
   */
  async createRule(rule) {
    return await api.post('/api/bypass/rules', rule);
  },

  /**
   * Update a bypass rule
   * @param {number} id - Rule ID
   * @param {Object} updates - Fields to update
   */
  async updateRule(id, updates) {
    return await api.put(`/api/bypass/rules/${id}`, updates);
  },

  /**
   * Delete a bypass rule
   * @param {number} id - Rule ID
   */
  async deleteRule(id) {
    return await api.del(`/api/bypass/rules/${id}`);
  },

  /**
   * Toggle enabled status of a rule
   * @param {number} id - Rule ID
   */
  async toggleRule(id) {
    return await api.post(`/api/bypass/rules/toggle/${id}`, {});
  },

  /**
   * Get available presets
   */
  async getPresets() {
    return await api.get('/api/bypass/presets');
  },

  /**
   * Apply a preset (adds multiple rules)
   * @param {string} presetName - Preset name (google, cloudflare, cdn)
   */
  async applyPreset(presetName) {
    return await api.post(`/api/bypass/presets/${presetName}`, {});
  },

  /**
   * Get current bypass status
   */
  async getStatus() {
    return await api.get('/api/bypass/status');
  }
};
