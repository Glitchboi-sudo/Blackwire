import api from '../utils/api.js';

export const repeaterService = {
  /**
   * List all saved repeater tabs
   */
  async list() {
    return await api.get('/api/repeater');
  },

  /**
   * Send raw HTTP request
   */
  async sendRaw(method, url, headers, body, followRedirects = false) {
    return await api.post('/api/repeater/send-raw', {
      method,
      url,
      headers,
      body,
      follow_redirects: followRedirects
    });
  },

  /**
   * Save a repeater tab
   */
  async save(name, method, url, headers, body, lastResponse = null) {
    return await api.post('/api/repeater', {
      name,
      method,
      url,
      headers,
      body,
      last_response: lastResponse
    });
  },

  /**
   * Update/rename repeater tab
   */
  async update(id, data) {
    // If data is a string, treat it as a name update only
    if (typeof data === 'string') {
      return await api.put(`/api/repeater/${id}`, { name: data });
    }
    // Otherwise, send the full data object
    return await api.put(`/api/repeater/${id}`, data);
  },

  /**
   * Delete a repeater tab
   */
  async delete(id) {
    return await api.del(`/api/repeater/${id}`);
  }
};
