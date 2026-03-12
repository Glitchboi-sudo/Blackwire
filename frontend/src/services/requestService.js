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
   * Get full request detail (legacy - not optimized)
   */
  async getDetail(id) {
    return await api.get(`/api/requests/${id}/detail`);
  },

  /**
   * Get optimized request detail with truncation for large content
   * @param {number} id - Request ID
   * @param {boolean} full - If true, load full content (may be slow for large requests)
   */
  async getDetailOptimized(id, full = false) {
    const params = full ? '?full=true' : '';
    return await api.get(`/api/v2/requests/${id}/detail${params}`);
  },

  /**
   * Get full request body (for lazy loading)
   */
  async getRequestBody(id) {
    return await api.get(`/api/v2/requests/${id}/body`);
  },

  /**
   * Get full response body (for lazy loading)
   */
  async getResponseBody(id) {
    return await api.get(`/api/v2/requests/${id}/response-body`);
  },

  /**
   * Get size information for request/response
   */
  async getSizes(id) {
    return await api.get(`/api/v2/requests/${id}/sizes`);
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
  },

  /**
   * Clear all requests (including saved)
   */
  async clearAll() {
    return await api.del('/api/requests?keep_saved=false');
  }
};
