import api from '../utils/api.js';

export const requestService = {
  /**
   * Search requests with HTTPQL query and pagination
   */
  async search(query = '', page = 1, pageSize = 500, savedOnly = false, scopeOnly = false, ast = null) {
    const body = {
      page,
      page_size: pageSize,
      saved_only: savedOnly,
      in_scope_only: scopeOnly
    };
    if (query && ast) {
      body.query = query;
      body.ast = ast;
    }
    return await api.post('/api/requests/search', body);
  },

  /**
   * Get full request detail
   */
  async getDetail(id) {
    return await api.get(`/api/requests/${id}/detail`);
  },

  /**
   * Toggle saved status
   */
  async toggleSave(id) {
    return await api.put(`/api/requests/${id}/save`);
  },

  /**
   * Delete a request
   */
  async delete(id) {
    return await api.del(`/api/requests/${id}`);
  },

  /**
   * Clear all unsaved requests
   */
  async clearUnsaved() {
    return await api.del('/api/requests?keep_saved=true');
  }
};
