import api from '../utils/api.js';

export const proxyService = {
  /**
   * Get proxy status
   */
  async getStatus() {
    return await api.get('/api/proxy/status');
  },

  /**
   * Start proxy server
   */
  async start(port, mode = 'regular', extra = '') {
    return await api.post(`/api/proxy/start?port=${port}&mode=${mode}&extra=${encodeURIComponent(extra)}`);
  },

  /**
   * Stop proxy server
   */
  async stop() {
    return await api.post('/api/proxy/stop');
  },

  /**
   * Launch browser with proxy
   */
  async launchBrowser(proxyPort) {
    return await api.post(`/api/browser/launch?proxy_port=${proxyPort}`);
  }
};
