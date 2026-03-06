import api from '../utils/api.js';

export const websocketService = {
  /**
   * Get list of WebSocket connections
   */
  async getConnections() {
    return await api.get('/api/websocket/connections');
  },

  /**
   * Get frames for a specific WebSocket connection
   */
  async getFrames(url) {
    return await api.get(`/api/websocket/frames?url=${encodeURIComponent(url)}`);
  },

  /**
   * Resend a WebSocket frame
   */
  async resendFrame(url, message) {
    return await api.post('/api/websocket/resend', { url, message });
  }
};
