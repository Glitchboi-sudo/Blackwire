import api from '../utils/api.js';

export const collectionService = {
  /**
   * List all collections
   */
  async list() {
    return await api.get('/api/collections');
  },

  /**
   * Create a new collection
   */
  async create(name, description = '') {
    return await api.post('/api/collections', { name, description });
  },

  /**
   * Delete a collection
   */
  async delete(id) {
    return await api.del(`/api/collections/${id}`);
  },

  /**
   * Get items in a collection
   */
  async getItems(collId) {
    return await api.get(`/api/collections/${collId}/items`);
  },

  /**
   * Add item to collection
   */
  async addItem(collId, request) {
    return await api.post(`/api/collections/${collId}/items`, { request });
  },

  /**
   * Delete item from collection
   */
  async deleteItem(collId, itemId) {
    return await api.del(`/api/collections/${collId}/items/${itemId}`);
  },

  /**
   * Update item extracts
   */
  async updateItem(collId, itemId, extracts) {
    return await api.put(`/api/collections/${collId}/items/${itemId}`, { extracts });
  },

  /**
   * Execute a collection item
   */
  async executeItem(collId, itemId, vars = {}) {
    return await api.post(`/api/collections/${collId}/items/${itemId}/execute`, { vars });
  }
};
