import api from '../utils/api.js';

export const proxyService = {
  /**
   * Get proxy status
   */
  async getStatus() {
    return await api.get('/api/proxy/status');
  },

  /**
   * List local addresses the proxy can listen on
   */
  async getInterfaces() {
    return await api.get('/api/proxy/interfaces');
  },

  /**
   * Start proxy server
   */
  async start(port, mode = 'regular', extra = '', listenHost = '') {
    return await api.post(`/api/proxy/start?port=${port}&mode=${mode}&extra=${encodeURIComponent(extra)}&listen_host=${encodeURIComponent(listenHost)}`);
  },

  /**
   * Stop proxy server
   */
  async stop() {
    return await api.post('/api/proxy/stop');
  }
};
