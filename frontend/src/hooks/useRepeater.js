const { useState, useCallback } = React;
import { repeaterService } from '../services/repeaterService.js';

/**
 * Custom hook for Repeater tabs and sending requests
 * @param {Function} toast - Toast notification function
 * @returns {Object} Repeater state and methods
 */
export function useRepeater(toast) {
  const [savedTabs, setSavedTabs] = useState([]);
  const [selectedTab, setSelectedTab] = useState(null);
  const [method, setMethod] = useState('GET');
  const [url, setUrl] = useState('');
  const [headers, setHeaders] = useState('');
  const [body, setBody] = useState('');
  const [response, setResponse] = useState('');
  const [respBody, setRespBody] = useState('');
  const [respFormat, setRespFormat] = useState('raw');
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [followRedirects, setFollowRedirects] = useState(true);
  const [loading, setLoading] = useState(false);

  // Load saved tabs
  const loadTabs = useCallback(async () => {
    try {
      const data = await repeaterService.list();
      setSavedTabs(Array.isArray(data) ? data : (data.tabs || []));
    } catch (err) {
      console.error('Failed to load repeater tabs:', err);
    }
  }, []);

  // Send request
  const send = useCallback(async () => {
    if (!url.trim()) {
      toast('URL required', 'error');
      return false;
    }

    setLoading(true);
    try {
      const r = await repeaterService.sendRaw(
        method,
        url,
        headers,
        body,
        followRedirects
      );

      setResponse(r.raw_response || '');
      setRespBody(r.body || '');

      // Add to history
      const histItem = { method, url, headers, body, response: r };
      setHistory(prev => [...prev, histItem]);
      setHistoryIndex(prev => prev + 1);

      toast('Request sent', 'success');
      return true;
    } catch (err) {
      toast('Failed to send request', 'error');
      return false;
    } finally {
      setLoading(false);
    }
  }, [method, url, headers, body, followRedirects, toast]);

  // Save tab
  const save = useCallback(async (name) => {
    if (!name.trim()) {
      toast('Tab name required', 'error');
      return false;
    }

    setLoading(true);
    try {
      const r = await repeaterService.save(name, method, url, headers, body, response);
      if (r.status === 'saved') {
        await loadTabs();
        toast('Tab saved', 'success');
        return true;
      } else {
        toast('Failed to save tab', 'error');
        return false;
      }
    } catch (err) {
      toast('Failed to save tab', 'error');
      return false;
    } finally {
      setLoading(false);
    }
  }, [method, url, headers, body, response, toast, loadTabs]);

  // Rename tab
  const rename = useCallback(async (tabId, newName) => {
    setLoading(true);
    try {
      await repeaterService.update(tabId, newName);
      await loadTabs();
      toast('Tab renamed', 'success');
      return true;
    } catch (err) {
      toast('Failed to rename tab', 'error');
      return false;
    } finally {
      setLoading(false);
    }
  }, [toast, loadTabs]);

  // Delete tab
  const deleteTab = useCallback(async (tabId) => {
    setLoading(true);
    try {
      await repeaterService.deleteTab(tabId);
      await loadTabs();
      if (selectedTab?.id === tabId) {
        setSelectedTab(null);
      }
      toast('Tab deleted', 'success');
      return true;
    } catch (err) {
      toast('Failed to delete tab', 'error');
      return false;
    } finally {
      setLoading(false);
    }
  }, [selectedTab, toast, loadTabs]);

  // Load tab
  const loadTab = useCallback((tab) => {
    setSelectedTab(tab);
    setMethod(tab.method || 'GET');
    setUrl(tab.url || '');
    setHeaders(tab.headers || '');
    setBody(tab.body || '');
  }, []);

  // Send to repeater (from history/intercept)
  const toRepeater = useCallback((req) => {
    setMethod(req.method || 'GET');
    setUrl(req.url || '');
    setHeaders(req.headers || '');
    setBody(req.body || '');
    toast('Loaded to Repeater', 'success');
  }, [toast]);

  // Navigate history
  const navigateHistory = useCallback((direction) => {
    const newIndex = direction === 'back' ? historyIndex - 1 : historyIndex + 1;
    if (newIndex >= 0 && newIndex < history.length) {
      const item = history[newIndex];
      setMethod(item.method);
      setUrl(item.url);
      setHeaders(item.headers);
      setBody(item.body);
      setResponse(item.response.raw_response || '');
      setRespBody(item.response.body || '');
      setHistoryIndex(newIndex);
    }
  }, [history, historyIndex]);

  return {
    savedTabs,
    selectedTab,
    method,
    setMethod,
    url,
    setUrl,
    headers,
    setHeaders,
    body,
    setBody,
    response,
    setResponse, // Expose setter for loading saved responses
    respBody,
    setRespBody, // Expose setter for loading saved response bodies
    respFormat,
    setRespFormat,
    history,
    setHistory, // Expose setter
    historyIndex,
    setHistoryIndex, // Expose setter
    followRedirects,
    setFollowRedirects,
    loading,
    loadTabs,
    send,
    save,
    rename,
    delete: deleteTab,
    loadTab,
    toRepeater,
    navigateHistory
  };
}
