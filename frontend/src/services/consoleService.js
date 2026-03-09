import api from '../utils/api.js';

export const consoleService = {
  async getLogs(limit = 500) {
    return await api.get(`/api/console/logs?limit=${limit}`);
  },

  async clearLogs() {
    return await api.del('/api/console/logs');
  }
};
