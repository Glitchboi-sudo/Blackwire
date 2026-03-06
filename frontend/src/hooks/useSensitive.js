const { useState, useCallback, useRef } = React;
import { SENS_DEFAULT_PATTERNS } from '../utils/parsing.js';

/**
 * Custom hook for sensitive data scanner
 * @param {Function} toast - Toast notification function
 * @returns {Object} Sensitive data scanner state and methods
 */
export function useSensitive(toast) {
  const [results, setResults] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [filter, setFilter] = useState('');
  const [unique, setUnique] = useState(true);
  const [selectedResult, setSelectedResult] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [patterns, setPatterns] = useState(SENS_DEFAULT_PATTERNS());
  const [scopeOnly, setScopeOnly] = useState(true);
  const [maxSize, setMaxSize] = useState(1024);
  const [entropyThreshold, setEntropyThreshold] = useState(3.5);
  const [batch, setBatch] = useState(100);
  const stopRef = useRef(false);

  // Run scan (simplified - actual scanning logic is complex)
  const runScan = useCallback(async () => {
    const enabledPatterns = patterns.filter(p => p.enabled);
    if (enabledPatterns.length === 0) {
      toast('No patterns enabled', 'error');
      return false;
    }

    setScanning(true);
    setProgress(0);
    setResults([]);

    try {
      // Simulated scanning process
      // In reality, this would call a backend service that:
      // 1. Fetches requests from history
      // 2. Applies filters (scope, size)
      // 3. Runs regex patterns and entropy analysis
      // 4. Batches results

      toast('Scanning started', 'info');

      // Simulate progress updates
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setScanning(false);
            toast('Scan completed', 'success');
            return 100;
          }
          return prev + 10;
        });
      }, 500);

      return true;
    } catch (err) {
      toast('Scan failed', 'error');
      setScanning(false);
      return false;
    }
  }, [patterns, toast]);

  // Stop scan
  const stopScan = useCallback(() => {
    stopRef.current = true;
    setScanning(false);
    setProgress(0);
    toast('Scan stopped', 'info');
  }, [toast]);

  // Load detail for a result
  const loadDetail = useCallback(async (result) => {
    setSelectedResult(result);

    try {
      // In reality, this would fetch full request/response details
      setSelectedDetail({
        request_id: result.request_id,
        url: result.url,
        method: result.method,
        matches: result.matches,
        context: result.context || ''
      });
    } catch (err) {
      console.error('Failed to load result detail:', err);
      toast('Failed to load details', 'error');
    }
  }, [toast]);

  return {
    results,
    setResults, // Allow direct state setting
    scanning,
    setScanning, // Allow direct state setting
    progress,
    setProgress, // Allow direct state setting
    filter,
    setFilter,
    unique,
    setUnique,
    selectedResult,
    selectedDetail,
    patterns,
    setPatterns,
    scopeOnly,
    setScopeOnly,
    maxSize,
    setMaxSize,
    entropyThreshold,
    setEntropyThreshold,
    batch,
    setBatch,
    setBatchSize: setBatch, // Alias for compatibility
    stopRef,
    runScan,
    stopScan,
    loadDetail
  };
}
