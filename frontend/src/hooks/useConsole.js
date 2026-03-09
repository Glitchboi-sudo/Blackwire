const { useState, useEffect, useRef, useCallback } = React;
import { consoleService } from '../services/consoleService.js';

/**
 * Hook for the real-time proxy console.
 * Opens an SSE connection to /api/console/stream and maintains a local
 * ring-buffer of log entries.  On connect the server sends the full
 * buffer snapshot first so history is always available.
 */
export function useConsole() {
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('ALL');
  const [autoScroll, setAutoScroll] = useState(true);
  const [connected, setConnected] = useState(false);
  const esRef = useRef(null);
  const reconnectTimer = useRef(null);

  const connect = useCallback(() => {
    if (esRef.current) return;

    const es = new EventSource('/api/console/stream');

    es.onopen = () => setConnected(true);

    es.onmessage = (e) => {
      if (!e.data || e.data.startsWith(':')) return; // keepalive comment
      try {
        const entry = JSON.parse(e.data);
        setLogs(prev => {
          const next = [...prev, entry];
          // Keep latest 1000 entries in memory
          return next.length > 1000 ? next.slice(-1000) : next;
        });
      } catch (_) {}
    };

    es.onerror = () => {
      setConnected(false);
      es.close();
      esRef.current = null;
      // Auto-reconnect after 4 s
      reconnectTimer.current = setTimeout(connect, 4000);
    };

    esRef.current = es;
  }, []);

  const disconnect = useCallback(() => {
    clearTimeout(reconnectTimer.current);
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
      setConnected(false);
    }
  }, []);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    connect();
    return disconnect;
  }, [connect, disconnect]);

  const clearLogs = useCallback(async () => {
    try {
      await consoleService.clearLogs();
      setLogs([]);
    } catch (_) {}
  }, []);

  // Derived: filtered log entries
  const filteredLogs = logs.filter(entry => {
    if (levelFilter !== 'ALL' && entry.level !== levelFilter) return false;
    if (filter) {
      const q = filter.toLowerCase();
      return (entry.msg || '').toLowerCase().includes(q) ||
             (entry.name || '').toLowerCase().includes(q);
    }
    return true;
  });

  return {
    logs,
    filteredLogs,
    filter, setFilter,
    levelFilter, setLevelFilter,
    autoScroll, setAutoScroll,
    connected,
    clearLogs,
  };
}
