import api from '../utils/api.js';

export const extensionService = {
  /**
   * List all extensions
   */
  async list() {
    return await api.get('/api/extensions');
  },

  /**
   * Update extension configuration
   */
  async updateConfig(name, config) {
    return await api.put(`/api/extensions/${name}`, config);
  },

  /**
   * Get extension UI component (for dynamic loading)
   */
  async getUI(name) {
    const response = await fetch(`/api/extensions/${name}/ui.js`);
    return await response.text();
  }
};
