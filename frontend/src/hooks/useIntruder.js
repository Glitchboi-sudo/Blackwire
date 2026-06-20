const { useState, useCallback, useRef } = React;
import { intruderService } from '../services/intruderService.js';

/**
 * Custom hook for Intruder attack configuration and execution
 * @param {Function} toast - Toast notification function
 * @returns {Object} Intruder state and methods
 */
export function useIntruder(toast) {
  const [method, setMethod] = useState('GET');
  const [url, setUrl] = useState('');
  const [headers, setHeaders] = useState('');
  const [body, setBody] = useState('');
  const [positions, setPositions] = useState([]);
  const [attackType, setAttackType] = useState('sniper');
  const [payloads, setPayloads] = useState([[]]);
  const [results, setResults] = useState([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [startTime, setStartTime] = useState(null);
  const [concurrency, setConcurrency] = useState(10);
  const [delay, setDelay] = useState(0);
  const [followRedirects, setFollowRedirects] = useState(true);
  const [timeout, setTimeout] = useState(30);
  const [savedAttacks, setSavedAttacks] = useState([]);
  const [selectedAttack, setSelectedAttack] = useState(null);
  const [loading, setLoading] = useState(false);
  // Resource-pool / throttling state usado por el runner en App.jsx.
  const [randomDelay, setRandomDelay] = useState(false);
  const [delayMin, setDelayMin] = useState(0);
  const [delayMax, setDelayMax] = useState(1000);
  const [maxRetries, setMaxRetries] = useState(0);
  // Flag de cancelación del ataque (no dispara re-render).
  const stopRef = useRef(false);

  // Load saved attacks
  const loadAttacks = useCallback(async () => {
    try {
      const data = await intruderService.listAttacks();
      setSavedAttacks(Array.isArray(data) ? data : (data.attacks || []));
    } catch (err) {
      console.error('Failed to load saved attacks:', err);
    }
  }, []);

  // Save attack configuration
  const saveAttack = useCallback(async (name) => {
    if (!name.trim()) {
      toast('Attack name required', 'error');
      return false;
    }

    setLoading(true);
    try {
      const config = {
        name,
        method,
        url,
        headers,
        body,
        positions,
        attack_type: attackType,
        payloads,
        concurrency,
        delay,
        follow_redirects: followRedirects,
        timeout
      };

      const r = await intruderService.saveAttack(config);
      if (r.status === 'saved') {
        await loadAttacks();
        toast('Attack saved', 'success');
        return true;
      } else {
        toast('Failed to save attack', 'error');
        return false;
      }
    } catch (err) {
      toast('Failed to save attack', 'error');
      return false;
    } finally {
      setLoading(false);
    }
  }, [method, url, headers, body, positions, attackType, payloads, concurrency, delay, followRedirects, timeout, toast, loadAttacks]);

  // Load attack configuration
  const loadAttack = useCallback((attack) => {
    setSelectedAttack(attack);
    setMethod(attack.method || 'GET');
    setUrl(attack.url || '');
    setHeaders(attack.headers || '');
    setBody(attack.body || '');
    setPositions(attack.positions || []);
    setAttackType(attack.attack_type || 'sniper');
    setPayloads(attack.payloads || [[]]);
    setConcurrency(attack.concurrency || 10);
    setDelay(attack.delay || 0);
    setFollowRedirects(attack.follow_redirects !== false);
    setTimeout(attack.timeout || 30);
    toast('Attack loaded', 'success');
  }, [toast]);

  // Delete attack
  const deleteAttack = useCallback(async (attackId) => {
    setLoading(true);
    try {
      await intruderService.deleteAttack(attackId);
      await loadAttacks();
      if (selectedAttack?.id === attackId) {
        setSelectedAttack(null);
      }
      toast('Attack deleted', 'success');
      return true;
    } catch (err) {
      toast('Failed to delete attack', 'error');
      return false;
    } finally {
      setLoading(false);
    }
  }, [selectedAttack, toast, loadAttacks]);

  // Run attack (simplified - actual execution logic is complex)
  const runAttack = useCallback(async () => {
    if (!url.trim()) {
      toast('URL required', 'error');
      return false;
    }

    if (positions.length === 0) {
      toast('No positions defined', 'error');
      return false;
    }

    setRunning(true);
    setProgress(0);
    setResults([]);

    try {
      const config = {
        method,
        url,
        headers,
        body,
        positions,
        attack_type: attackType,
        payloads,
        concurrency,
        delay,
        follow_redirects: followRedirects,
        timeout
      };

      // Start attack
      const r = await intruderService.startAttack(config);
      if (r.status === 'started') {
        toast('Attack started', 'success');
        return true;
      } else {
        toast('Failed to start attack', 'error');
        setRunning(false);
        return false;
      }
    } catch (err) {
      toast('Failed to start attack', 'error');
      setRunning(false);
      return false;
    }
  }, [url, positions, method, headers, body, attackType, payloads, concurrency, delay, followRedirects, timeout, toast]);

  // Stop attack
  const stopAttack = useCallback(async () => {
    try {
      await intruderService.stopAttack();
      setRunning(false);
      toast('Attack stopped', 'info');
      return true;
    } catch (err) {
      toast('Failed to stop attack', 'error');
      return false;
    }
  }, [toast]);

  // Compute total requests
  const computeTotal = useCallback(() => {
    if (positions.length === 0) return 0;

    switch (attackType) {
      case 'sniper':
        return positions.reduce((sum, pos, idx) => sum + (payloads[idx]?.length || 0), 0);
      case 'battering_ram':
        return payloads[0]?.length || 0;
      case 'pitchfork':
        return Math.min(...positions.map((_, idx) => payloads[idx]?.length || 0));
      case 'cluster_bomb':
        return positions.reduce((prod, pos, idx) => prod * (payloads[idx]?.length || 1), 1);
      default:
        return 0;
    }
  }, [positions, payloads, attackType]);

  return {
    method,
    setMethod,
    url,
    setUrl,
    headers,
    setHeaders,
    body,
    setBody,
    positions,
    setPositions,
    attackType,
    setAttackType,
    payloads,
    setPayloads,
    results,
    setResults, // Allow direct state setting
    running,
    setRunning, // Allow direct state setting
    isRunning: running, // alias usado por App.jsx
    stopRef,
    randomDelay,
    setRandomDelay,
    delayMin,
    setDelayMin,
    delayMax,
    setDelayMax,
    maxRetries,
    setMaxRetries,
    progress,
    setProgress, // Allow direct state setting
    done,
    setDone, // Allow direct state setting
    total,
    setTotal, // Allow direct state setting
    startTime,
    setStartTime, // Allow direct state setting
    concurrency,
    setConcurrency,
    delay,
    setDelay,
    followRedirects,
    setFollowRedirects,
    timeout,
    setTimeout,
    savedAttacks,
    selectedAttack,
    loading,
    loadAttacks,
    saveAttack,
    loadAttack,
    deleteAttack,
    runAttack,
    stopAttack,
    computeTotal
  };
}
