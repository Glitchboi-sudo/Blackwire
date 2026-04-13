const { useState, useCallback } = React;
import { websocketService } from '../services/websocketService.js';

/**
 * Custom hook for WebSocket viewer
 * @param {Function} toast - Toast notification function
 * @returns {Object} WebSocket state and methods
 */
export function useWebSockets(toast) {
  const [connections, setConnections] = useState([]);
  const [selectedConn, setSelectedConn] = useState(null);
  const [frames, setFrames] = useState([]);
  const [selectedFrame, setSelectedFrame] = useState(null);
  const [resendMsg, setResendMsg] = useState('');
  const [resendResp, setResendResp] = useState('');
  const [sending, setSending] = useState(false);

  // Load WebSocket connections
  const loadConnections = useCallback(async () => {
    try {
      const data = await websocketService.getConnections();
      setConnections(Array.isArray(data) ? data : (data.connections || []));
    } catch (err) {
      console.error('Failed to load WebSocket connections:', err);
    }
  }, []);

  // Load frames for a connection
  const loadFrames = useCallback(async (connId) => {
    try {
      const data = await websocketService.getFrames(connId);
      setFrames(Array.isArray(data) ? data : (data.frames || []));
    } catch (err) {
      console.error('Failed to load WebSocket frames:', err);
    }
  }, []);

  // Select a frame
  const selectFrame = useCallback((frame) => {
    setSelectedFrame(frame);
    if (frame && frame.data) {
      setResendMsg(frame.data);
    }
  }, []);

  // Resend a WebSocket message
  const resend = useCallback(async (connId, message) => {
    if (!message.trim()) {
      toast('Message required', 'error');
      return false;
    }

    setSending(true);
    try {
      const r = await websocketService.sendMessage(connId, message);
      if (r.status === 'sent') {
        setResendResp(r.response || '');
        toast('Message sent', 'success');
        await loadFrames(connId);
        return true;
      } else {
        toast('Failed to send message', 'error');
        return false;
      }
    } catch (err) {
      toast('Failed to send message', 'error');
      return false;
    } finally {
      setSending(false);
    }
  }, [toast, loadFrames]);

  return {
    connections,
    setConnections, // Allow direct state setting
    selectedConn,
    setSelectedConn,
    frames,
    setFrames, // Allow direct state setting
    selectedFrame,
    resendMsg,
    setResendMsg,
    resendResp,
    setResendResp, // Allow direct state setting
    sending,
    setSending, // Allow direct state setting
    loadConnections,
    loadFrames,
    selectFrame,
    resend
  };
}
