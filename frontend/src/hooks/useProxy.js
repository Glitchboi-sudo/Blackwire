const { useState, useEffect, useCallback } = React;
import { proxyService } from '../services/proxyService.js';

/**
 * Custom hook for proxy control
 * @param {Function} toast - Toast notification function
 * @param {Object} currentProject - Current project object
 * @returns {Object} Proxy state and methods
 */
export function useProxy(toast, currentProject) {
  const [isRunning, setIsRunning] = useState(false);
  const [port, setPort] = useState(8080);
  const [mode, setMode] = useState('regular');
  const [args, setArgs] = useState('');
  const [loading, setLoading] = useState(false);

  // Load proxy status
  const loadStatus = useCallback(async () => {
    try {
      const r = await proxyService.getStatus();
      setIsRunning(r.running);
    } catch (err) {
      console.error('Failed to load proxy status:', err);
    }
  }, []);

  // Load config from project
  useEffect(() => {
    if (currentProject?.config) {
      setPort(currentProject.config.proxy_port || 8080);
      setMode(currentProject.config.proxy_mode || 'regular');
      setArgs(currentProject.config.proxy_args || '');
    }
  }, [currentProject]);

  // Start proxy
  const start = useCallback(async () => {
    setLoading(true);
    try {
      const r = await proxyService.start(port, mode, args);
      if (r.status === 'started' || r.status === 'already_running') {
        setIsRunning(true);
        toast('Proxy started', 'success');
      } else {
        toast('Failed: ' + (r.error || 'unknown'), 'error');
      }
    } catch (err) {
      toast('Failed to start proxy', 'error');
    } finally {
      setLoading(false);
    }
  }, [port, mode, args, toast]);

  // Stop proxy
  const stop = useCallback(async () => {
    try {
      await proxyService.stop();
      setIsRunning(false);
      toast('Stopped', 'success');
    } catch (err) {
      toast('Failed to stop proxy', 'error');
    }
  }, [toast]);

  // Launch browser with proxy
  const launchBrowser = useCallback(async () => {
    try {
      const r = await proxyService.launchBrowser(port);
      toast(r.status === 'launched' ? 'Browser launched' : 'Failed', 'success');
    } catch (err) {
      toast('Failed to launch browser', 'error');
    }
  }, [port, toast]);

  return {
    isRunning,
    port,
    setPort,
    mode,
    setMode,
    args,
    setArgs,
    loading,
    start,
    stop,
    launchBrowser,
    loadStatus
  };
}
